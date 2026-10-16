/**
 * ExotelStream.js
 * ───────────────
 * Handles the Exotel WebSocket connection for real-time audio streaming.
 *
 * Exotel Media Streams protocol:
 *   - Connects via WebSocket to Exotel's media stream endpoint
 *   - Receives audio as base64-encoded μ-law 8kHz mono
 *   - Sends audio as base64-encoded μ-law 8kHz mono
 *   - Events: start, media (audio), stop, mark
 *
 * Reference: https://developer.exotel.com/api/voice/media-streams/
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class ExotelStream extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.callSid - Exotel Call SID
   * @param {string} options.streamSid - Exotel Stream SID
   * @param {WebSocket} options.ws - The WebSocket connection from Exotel
   * @param {object} [options.metadata] - Additional call metadata
   */
  constructor(options = {}) {
    super();
    this.callSid = options.callSid;
    this.streamSid = options.streamSid;
    this.ws = options.ws;
    this.metadata = options.metadata || {};
    this.isActive = false;
    this._audioBuffer = [];

    // Bind WebSocket events
    this._bindEvents();
  }

  /**
   * Bind events to the incoming WebSocket.
   * @private
   */
  _bindEvents() {
    this.ws.on('message', (rawData) => {
      try {
        const message = JSON.parse(rawData.toString());
        this._handleMessage(message);
      } catch (err) {
        console.error('[ExotelStream] Failed to parse message:', err.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[ExotelStream] Closed: ${code} ${reason}`);
      this.isActive = false;
      this.emit('close', { code, reason: reason?.toString() });
    });

    this.ws.on('error', (err) => {
      console.error('[ExotelStream] Error:', err.message);
      this.emit('error', err);
    });
  }

  /**
   * Handle incoming Exotel media stream messages.
   * @param {object} message
   * @private
   */
  _handleMessage(message) {
    switch (message.event) {
      case 'start':
        this.isActive = true;
        this.streamSid = message.start?.streamSid || this.streamSid;
        console.log(`[ExotelStream] Stream started: ${this.streamSid}`);
        this.emit('start', message.start);
        break;

      case 'media':
        // Audio data: base64-encoded μ-law 8kHz
        if (message.media?.payload) {
          const audioBuffer = Buffer.from(message.media.payload, 'base64');
          this.emit('audio', audioBuffer);
        }
        break;

      case 'stop':
        this.isActive = false;
        console.log('[ExotelStream] Stream stopped');
        this.emit('stop');
        break;

      case 'mark':
        // Mark events indicate playback completion
        this.emit('mark', message.mark);
        break;

      default:
        this.emit('event', message);
        break;
    }
  }

  /**
   * Send audio data back to Exotel (μ-law 8kHz, base64 encoded).
   * @param {Buffer} ulawBuffer - Raw μ-law audio bytes at 8kHz
   */
  sendAudio(ulawBuffer) {
    if (!this.isActive || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = ulawBuffer.toString('base64');
    const message = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a mark event to track audio playback.
   * @param {string} name - Mark name/identifier
   */
  sendMark(name) {
    if (!this.isActive) return;

    const message = {
      event: 'mark',
      streamSid: this.streamSid,
      mark: { name },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a clear event to stop current audio playback.
   */
  clearPlayback() {
    if (!this.isActive) return;

    const message = {
      event: 'clear',
      streamSid: this.streamSid,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Get the caller's phone number from stream metadata.
   * @returns {string|null}
   */
  getCallerNumber() {
    return this.metadata.from || this.metadata.caller_number || null;
  }

  /**
   * Get the callee's phone number from stream metadata.
   * @returns {string|null}
   */
  getCalleeNumber() {
    return this.metadata.to || this.metadata.callee_number || null;
  }

  /**
   * Close the stream connection.
   */
  close() {
    this.isActive = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Bridge disconnect');
    }
    console.log(`[ExotelStream] Closed stream ${this.streamSid}`);
  }
}

/**
 * Factory function to create an ExotelStream from an incoming WebSocket upgrade.
 * @param {object} options
 * @param {WebSocket} options.ws - The upgraded WebSocket connection
 * @param {object} [options.metadata] - Call metadata from Exotel
 * @returns {ExotelStream}
 */
export function createExotelStream(options) {
  return new ExotelStream(options);
}

export default ExotelStream;
