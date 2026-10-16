/**
 * WebhookSaaSAdapter.js
 * ─────────────────────
 * Generic adapter that forwards all events to any webhook URL.
 * Useful for connecting to custom CRMs, Zapier, Make.com, n8n, etc.
 *
 * The webhook endpoint receives POST requests with JSON payloads.
 * All responses are expected as JSON.
 */

import { SaaSAdapter } from './SaaSAdapter.js';
import crypto from 'crypto';

export class WebhookSaaSAdapter extends SaaSAdapter {
  /**
   * @param {object} config
   * @param {string} config.webhookUrl - Base URL for the webhook endpoint
   * @param {string} [config.webhookSecret] - Shared secret for HMAC signing
   * @param {number} [config.timeoutMs=5000] - Request timeout in milliseconds
   * @param {object} [config.headers] - Additional headers to include
   */
  constructor(config = {}) {
    super('WebhookSaaSAdapter', config);
    this.webhookUrl = config.webhookUrl;
    this.webhookSecret = config.webhookSecret || '';
    this.timeoutMs = config.timeoutMs || 5000;
    this.extraHeaders = config.headers || {};

    if (!this.webhookUrl) {
      throw new Error('WebhookSaaSAdapter requires a webhookUrl in config');
    }
  }

  /**
   * Sign a payload with HMAC-SHA256.
   * @param {string} body - JSON string body
   * @returns {string} HMAC signature
   */
  _signPayload(body) {
    if (!this.webhookSecret) return '';
    return crypto.createHmac('sha256', this.webhookSecret).update(body).digest('hex');
  }

  /**
   * Send a POST request to the webhook.
   * @param {string} action - Action name (e.g., 'lookup_contact', 'log_call_event')
   * @param {object} payload - Data to send
   * @returns {Promise<object>} Parsed JSON response
   */
  async _post(action, payload = {}) {
    const body = JSON.stringify({
      action,
      payload,
      timestamp: new Date().toISOString(),
      adapter: this.name,
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Action': action,
      ...this.extraHeaders,
    };

    const signature = this._signPayload(body);
    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`[WebhookSaaSAdapter] ${action} → ${response.status}`);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error(`[WebhookSaaSAdapter] ${action} → TIMEOUT (${this.timeoutMs}ms)`);
        throw new Error(`Webhook request timed out after ${this.timeoutMs}ms`);
      }
      console.error(`[WebhookSaaSAdapter] ${action} → ERROR: ${err.message}`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async connect() {
    try {
      await this._post('connect', { status: 'initializing' });
      this.connected = true;
      console.log(`[WebhookSaaSAdapter] Connected → ${this.webhookUrl}`);
    } catch (err) {
      console.warn(`[WebhookSaaSAdapter] Connect ping failed: ${err.message}`);
      // Don't throw — webhook might not implement 'connect' action
      this.connected = true;
    }
  }

  async disconnect() {
    try {
      await this._post('disconnect', { status: 'shutting_down' });
    } catch (_) {
      // Ignore disconnect errors
    }
    this.connected = false;
    console.log('[WebhookSaaSAdapter] Disconnected');
  }

  async lookupContact(phoneNumber) {
    const result = await this._post('lookup_contact', { phoneNumber });
    return result.data || result.contact || null;
  }

  async upsertContact(contactData) {
    const result = await this._post('upsert_contact', contactData);
    return result.data || result.contact || contactData;
  }

  async logCallEvent(callEvent) {
    const result = await this._post('log_call_event', callEvent);
    return result.data || result.event || callEvent;
  }

  async createTask(taskData) {
    const result = await this._post('create_task', taskData);
    return result.data || result.task || taskData;
  }

  async getContactContext(phoneNumber) {
    try {
      const result = await this._post('get_contact_context', { phoneNumber });
      return result.context || result.data || '';
    } catch (_) {
      return '';
    }
  }

  async handleToolCall(toolName, args) {
    const result = await this._post('tool_call', { toolName, args });
    return result.data || result.result || null;
  }

  getToolDefinitions() {
    // Webhook adapter returns empty tools by default.
    // The webhook endpoint can define tools via a 'get_tools' action.
    // For now, return a generic passthrough tool.
    return [
      {
        type: 'function',
        function: {
          name: 'crm_action',
          description: 'Perform a CRM action via the connected webhook',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'The CRM action to perform' },
              data: { type: 'object', description: 'Action parameters' },
            },
            required: ['action'],
          },
        },
      },
    ];
  }
}

export default WebhookSaaSAdapter;
