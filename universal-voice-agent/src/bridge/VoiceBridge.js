/**
 * VoiceBridge.js
 * ──────────────
 * Core orchestrator that connects Exotel (telephony) ↔ OpenAI Realtime API (Voice AI)
 * and integrates with any CRM through the SaaSAdapter interface.
 *
 * Responsibilities:
 *   - Audio pipeline: Exotel μ-law 8kHz → transcode → OpenAI PCM16 24kHz (and reverse)
 *   - State management: call lifecycle, conversation tracking
 *   - Tool dispatch: route AI function calls to the SaaS adapter
 *   - Context injection: enrich AI instructions with CRM data
 */

import { EventEmitter } from 'events';
import { AudioTranscoder } from './AudioTranscoder.js';

export class VoiceBridge extends EventEmitter {
  /**
   * @param {object} options
   * @param {import('../telephony/ExotelStream.js').ExotelStream} options.exotelStream
   * @param {import('../ai/OpenAIManager.js').OpenAIManager} options.openAIManager
   * @param {import('../adapters/SaaSAdapter.js').SaaSAdapter} options.saaSAdapter
   */
  constructor(options = {}) {
    super();
    this.exotelStream = options.exotelStream;
    this.openAI = options.openAIManager;
    this.adapter = options.saaSAdapter;
    this.transcoder = new AudioTranscoder({
      inputSampleRate: 8000,
      outputSampleRate: 24000,
      channels: 1,
    });

    /** @type {string} Unique bridge/call session ID */
    this.bridgeId = options.bridgeId || `bridge-${Date.now()}`;

    /** @type {'idle'|'connecting'|'active'|'ending'|'ended'} */
    this.state = 'idle';

    /** @type {object|null} Contact info from CRM */
    this.contact = null;

    /** @type {number} Call start timestamp */
    this.startedAt = null;

    /** @type {Array<string>} Transcript entries */
    this.transcript = [];

    /** @type {string} Caller phone number */
    this.callerNumber = null;

    this._bindEvents();
    console.log(`[VoiceBridge:${this.bridgeId}] Initialized`);
  }

  /**
   * Start the bridge: connect to OpenAI, lookup contact, begin audio flow.
   * @returns {Promise<void>}
   */
  async start() {
    this.state = 'connecting';
    this.startedAt = Date.now();
    this.callerNumber = this.exotelStream.getCallerNumber();

    console.log(`[VoiceBridge:${this.bridgeId}] Starting for caller: ${this.callerNumber}`);

    // Log call start to CRM
    await this._safeCall(() =>
      this.adapter.logCallEvent({
        callId: this.bridgeId,
        phoneNumber: this.callerNumber,
        direction: 'inbound',
        status: 'ringing',
      })
    );

    // Lookup contact in CRM
    this.contact = await this._safeCall(() =>
      this.adapter.lookupContact(this.callerNumber)
    );

    // Get context from CRM to inject into AI
    const contactContext = await this._safeCall(() =>
      this.adapter.getContactContext(this.callerNumber)
    );

    // Enrich AI instructions with CRM context
    if (contactContext) {
      const enrichedInstructions = `${this.openAI.instructions}\n\n---\nCRM Context for this caller:\n${contactContext}`;
      this.openAI.updateInstructions(enrichedInstructions);
    }

    // Connect to OpenAI Realtime API
    await this.openAI.connect();

    // Log connected state
    await this._safeCall(() =>
      this.adapter.logCallEvent({
        callId: this.bridgeId,
        phoneNumber: this.callerNumber,
        direction: 'inbound',
        status: 'connected',
      })
    );

    this.state = 'active';
    this.emit('active', { bridgeId: this.bridgeId, caller: this.callerNumber });
    console.log(`[VoiceBridge:${this.bridgeId}] ACTIVE`);
  }

  /**
   * End the bridge session gracefully.
   * @returns {Promise<void>}
   */
  async end() {
    if (this.state === 'ended' || this.state === 'ending') return;
    this.state = 'ending';

    const duration = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;

    console.log(`[VoiceBridge:${this.bridgeId}] Ending (duration: ${duration}s)`);

    // Log call end to CRM
    await this._safeCall(() =>
      this.adapter.logCallEvent({
        callId: this.bridgeId,
        phoneNumber: this.callerNumber,
        direction: 'inbound',
        status: 'ended',
        duration,
        transcript: this.transcript.join('\n'),
      })
    );

    // Cleanup
    this.openAI.disconnect();
    this.exotelStream.close();
    this.transcoder.reset();

    this.state = 'ended';
    this.emit('ended', { bridgeId: this.bridgeId, duration });
    console.log(`[VoiceBridge:${this.bridgeId}] ENDED`);
  }

  /**
   * Bind all event handlers for the audio pipeline.
   * @private
   */
  _bindEvents() {
    // ─── Exotel → OpenAI (caller speaks → AI hears) ───
    this.exotelStream.on('audio', (ulawBuffer) => {
      if (this.state !== 'active') return;

      // Transcode: 8kHz μ-law → 24kHz PCM16
      const pcm24k = this.transcoder.ulawToOpenAIPCM(ulawBuffer);

      // Encode as base64 for OpenAI
      const base64Audio = pcm24k.toString('base64');

      // Send to OpenAI
      this.openAI.appendAudio(base64Audio);
    });

    // ─── OpenAI → Exotel (AI speaks → caller hears) ───
    this.openAI.on('audio.delta', (base64Delta) => {
      if (this.state !== 'active') return;

      // Decode base64 → 24kHz PCM16 buffer
      const pcm24kBuffer = Buffer.from(base64Delta, 'base64');

      // Transcode: 24kHz PCM16 → 8kHz μ-law
      const ulawBuffer = this.transcoder.openAIPCMToUlaw(pcm24kBuffer);

      // Send to Exotel
      this.exotelStream.sendAudio(ulawBuffer);
    });

    // ─── VAD Events ───
    this.openAI.on('speech_started', () => {
      this.emit('speech_started');
      // Clear any pending audio playback on Exotel side
      this.exotelStream.clearPlayback();
    });

    this.openAI.on('speech_stopped', () => {
      this.emit('speech_stopped');
    });

    // ─── Transcript Events ───
    this.openAI.on('user_transcript', (transcript) => {
      this.transcript.push(`[Caller]: ${transcript}`);
      this.emit('transcript', { role: 'user', text: transcript });
    });

    this.openAI.on('assistant_transcript', (transcript) => {
      this.transcript.push(`[AI]: ${transcript}`);
      this.emit('transcript', { role: 'assistant', text: transcript });
    });

    // ─── Function/Tool Call Dispatch ───
    this.openAI.on('function_call', async ({ callId, name, args }) => {
      console.log(`[VoiceBridge:${this.bridgeId}] Tool call: ${name}`, args);
      this.emit('tool_call', { callId, name, args });

      try {
        const result = await this.adapter.handleToolCall(name, args);
        this.openAI.sendFunctionResult(callId, name, result);
      } catch (err) {
        console.error(`[VoiceBridge:${this.bridgeId}] Tool call error:`, err.message);
        this.openAI.sendFunctionResult(callId, name, {
          error: err.message,
        });
      }
    });

    // ─── Stream lifecycle ───
    this.exotelStream.on('stop', () => {
      console.log(`[VoiceBridge:${this.bridgeId}] Exotel stream stopped`);
      this.end();
    });

    this.exotelStream.on('close', () => {
      console.log(`[VoiceBridge:${this.bridgeId}] Exotel stream closed`);
      this.end();
    });

    // ─── OpenAI disconnect ───
    this.openAI.on('disconnected', () => {
      if (this.state === 'active') {
        console.log(`[VoiceBridge:${this.bridgeId}] OpenAI disconnected unexpectedly`);
        this.end();
      }
    });
  }

  /**
   * Safely call an adapter method, catching errors.
   * @param {Function} fn
   * @returns {Promise<*>}
   * @private
   */
  async _safeCall(fn) {
    try {
      return await fn();
    } catch (err) {
      console.error(`[VoiceBridge:${this.bridgeId}] Adapter error:`, err.message);
      return null;
    }
  }

  /**
   * Get current bridge status.
   * @returns {object}
   */
  getStatus() {
    return {
      bridgeId: this.bridgeId,
      state: this.state,
      callerNumber: this.callerNumber,
      contact: this.contact?.name || null,
      duration: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
      transcriptLines: this.transcript.length,
    };
  }
}

export default VoiceBridge;
