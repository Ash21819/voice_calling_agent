/**
 * OpenAIManager.js
 * ────────────────
 * Manages the connection to OpenAI Realtime API via WebSocket.
 * Handles:
 *   - Session configuration (voice, VAD, tools)
 *   - Audio streaming (24kHz PCM16)
 *   - Function/tool calling dispatch
 *   - Conversation events
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class OpenAIManager extends EventEmitter {
  /**
   * @param {object} config
   * @param {string} config.apiKey - OpenAI API key
   * @param {string} [config.model='gpt-4o-realtime-preview-2024-12-17']
   * @param {string} [config.voice='alloy']
   * @param {string} [config.instructions]
   * @param {Array} [config.tools] - Function definitions for tool calling
   */
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-realtime-preview-2024-12-17';
    this.voice = config.voice || 'alloy';
    this.instructions = config.instructions || 'You are a helpful AI voice agent.';
    this.tools = config.tools || [];

    /** @type {WebSocket|null} */
    this.ws = null;
    this.sessionId = null;
    this.isConnected = false;
    this._reconnectAttempts = 0;
    this._maxReconnects = 3;
  }

  /**
   * Connect to the OpenAI Realtime API WebSocket.
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.model}`;

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.ws.on('open', () => {
        console.log('[OpenAIManager] WebSocket connected');
        this.isConnected = true;
        this._reconnectAttempts = 0;
        this._configureSession();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this._handleEvent(event);
        } catch (err) {
          console.error('[OpenAIManager] Failed to parse message:', err.message);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[OpenAIManager] WebSocket closed: ${code} ${reason}`);
        this.isConnected = false;
        this.emit('disconnected', { code, reason: reason.toString() });
      });

      this.ws.on('error', (err) => {
        console.error('[OpenAIManager] WebSocket error:', err.message);
        this.isConnected = false;
        reject(err);
      });
    });
  }

  /**
   * Configure the Realtime session with voice, VAD, and tools.
   * @private
   */
  _configureSession() {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.instructions,
        voice: this.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        tools: this.tools,
        tool_choice: 'auto',
        temperature: 0.8,
      },
    };

    this._send(sessionConfig);
    console.log('[OpenAIManager] Session configured');
  }

  /**
   * Handle incoming events from OpenAI Realtime API.
   * @param {object} event
   * @private
   */
  _handleEvent(event) {
    switch (event.type) {
      case 'session.created':
        this.sessionId = event.session?.id;
        console.log(`[OpenAIManager] Session created: ${this.sessionId}`);
        this.emit('session.created', event.session);
        break;

      case 'session.updated':
        console.log('[OpenAIManager] Session updated');
        this.emit('session.updated');
        break;

      case 'input_audio_buffer.speech_started':
        this.emit('speech_started');
        break;

      case 'input_audio_buffer.speech_stopped':
        this.emit('speech_stopped');
        break;

      case 'input_audio_buffer.committed':
        this.emit('audio_committed', event);
        break;

      case 'conversation.item.created':
        this.emit('item.created', event.item);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.emit('user_transcript', event.transcript);
        break;

      case 'response.audio.delta':
        // Audio output from OpenAI (24kHz PCM16, base64 encoded)
        this.emit('audio.delta', event.delta);
        break;

      case 'response.audio_transcript.delta':
        this.emit('assistant_transcript_delta', event.delta);
        break;

      case 'response.audio_transcript.done':
        this.emit('assistant_transcript', event.transcript);
        break;

      case 'response.audio.done':
        this.emit('audio.done');
        break;

      case 'response.done':
        this.emit('response.done', event.response);
        break;

      case 'response.function_call_arguments.delta':
        this.emit('function_call_delta', event);
        break;

      case 'response.function_call_arguments.done':
        this._handleFunctionCall(event);
        break;

      case 'response.output_item.done':
        if (event.item?.type === 'function_call') {
          this._handleFunctionCall(event.item);
        }
        break;

      case 'error':
        console.error('[OpenAIManager] API Error:', event.error);
        this.emit('error', event.error);
        break;

      default:
        // Pass through unhandled events
        this.emit('event', event);
        break;
    }
  }

  /**
   * Handle a function call from the AI.
   * @param {object} item - Function call item
   * @private
   */
  _handleFunctionCall(item) {
    const callId = item.call_id;
    const name = item.name || item.function?.name;
    let args = {};

    try {
      args = JSON.parse(item.arguments || item.function?.arguments || '{}');
    } catch (_) {
      args = {};
    }

    console.log(`[OpenAIManager] Function call: ${name}`, args);
    this.emit('function_call', { callId, name, args });
  }

  /**
   * Send a function call result back to OpenAI.
   * @param {string} callId - The function call ID
   * @param {string} name - Function name
   * @param {*} result - Result to return to the AI
   */
  sendFunctionResult(callId, name, result) {
    const output = typeof result === 'string' ? result : JSON.stringify(result);

    this._send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output,
      },
    });

    // Trigger a new response after providing the function result
    this._send({ type: 'response.create' });
    console.log(`[OpenAIManager] Function result sent for ${name} (callId: ${callId})`);
  }

  /**
   * Append audio data to the input buffer (from the caller).
   * Audio must be 24kHz PCM16, base64 encoded.
   * @param {string} base64Audio - Base64 encoded 24kHz PCM16 audio
   */
  appendAudio(base64Audio) {
    if (!this.isConnected) return;

    this._send({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    });
  }

  /**
   * Commit the current audio buffer and request a response.
   */
  commitAndRespond() {
    this._send({ type: 'input_audio_buffer.commit' });
    this._send({ type: 'response.create' });
  }

  /**
   * Send a text message to the conversation.
   * @param {string} text
   * @param {string} [role='user']
   */
  sendTextMessage(text, role = 'user') {
    this._send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role,
        content: [{ type: 'text', text }],
      },
    });
    this._send({ type: 'response.create' });
  }

  /**
   * Update the session instructions dynamically.
   * @param {string} instructions - New system instructions
   */
  updateInstructions(instructions) {
    this.instructions = instructions;
    this._send({
      type: 'session.update',
      session: { instructions },
    });
  }

  /**
   * Update tools dynamically.
   * @param {Array} tools - New tool definitions
   */
  updateTools(tools) {
    this.tools = tools;
    this._send({
      type: 'session.update',
      session: { tools },
    });
  }

  /**
   * Truncate the AI's audio output (e.g., when user starts speaking).
   */
  truncateResponse() {
    this._send({ type: 'response.cancel' });
  }

  /**
   * Disconnect from OpenAI Realtime API.
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    console.log('[OpenAIManager] Disconnected');
  }

  /**
   * Send a raw event to the WebSocket.
   * @param {object} data
   * @private
   */
  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[OpenAIManager] Cannot send — WebSocket not open');
    }
  }
}

export default OpenAIManager;
