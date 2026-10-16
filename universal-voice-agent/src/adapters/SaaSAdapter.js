/**
 * SaaSAdapter.js
 * ──────────────
 * Abstract base class defining the interface for ANY CRM/SaaS integration.
 * All adapters MUST extend this class and implement all abstract methods.
 *
 * The core bridge (VoiceBridge) knows NOTHING about specific CRMs.
 * It only interacts through this interface.
 */

export class SaaSAdapter {
  /**
   * @param {string} name - Human-readable adapter name
   * @param {object} [config={}] - Adapter-specific configuration
   */
  constructor(name, config = {}) {
    if (new.target === SaaSAdapter) {
      throw new Error('SaaSAdapter is abstract — use a concrete implementation');
    }
    this.name = name;
    this.config = config;
    this.connected = false;
  }

  /**
   * Initialize the adapter (connect to CRM, authenticate, etc.)
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error(`${this.name}: connect() not implemented`);
  }

  /**
   * Tear down the adapter connection.
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error(`${this.name}: disconnect() not implemented`);
  }

  /**
   * Look up a contact/customer by phone number.
   * @param {string} phoneNumber - E.164 formatted phone number
   * @returns {Promise<object|null>} Contact object or null if not found
   */
  async lookupContact(phoneNumber) {
    throw new Error(`${this.name}: lookupContact() not implemented`);
  }

  /**
   * Create or update a contact record.
   * @param {object} contactData - Contact fields to upsert
   * @returns {Promise<object>} The created/updated contact
   */
  async upsertContact(contactData) {
    throw new Error(`${this.name}: upsertContact() not implemented`);
  }

  /**
   * Log a call event to the CRM.
   * @param {object} callEvent - Call event data
   * @param {string} callEvent.callId - Unique call identifier
   * @param {string} callEvent.phoneNumber - Caller phone number
   * @param {string} callEvent.direction - 'inbound' or 'outbound'
   * @param {string} callEvent.status - 'ringing' | 'connected' | 'ended'
   * @param {number} [callEvent.duration] - Duration in seconds
   * @param {string} [callEvent.transcript] - Call transcript summary
   * @param {object} [callEvent.metadata] - Additional metadata
   * @returns {Promise<object>} The logged event record
   */
  async logCallEvent(callEvent) {
    throw new Error(`${this.name}: logCallEvent() not implemented`);
  }

  /**
   * Create a task/follow-up item in the CRM.
   * @param {object} taskData - Task details
   * @param {string} taskData.title - Task title
   * @param {string} taskData.description - Task description
   * @param {string} [taskData.assignee] - Assigned user
   * @param {string} [taskData.dueDate] - ISO date string
   * @param {string} [taskData.priority] - 'low' | 'medium' | 'high'
   * @returns {Promise<object>} The created task
   */
  async createTask(taskData) {
    throw new Error(`${this.name}: createTask() not implemented`);
  }

  /**
   * Get custom data/notes associated with a contact for the AI context.
   * @param {string} phoneNumber - E.164 formatted phone number
   * @returns {Promise<string>} Context string to inject into AI prompt
   */
  async getContactContext(phoneNumber) {
    throw new Error(`${this.name}: getContactContext() not implemented`);
  }

  /**
   * Handle a tool call from the AI agent (function calling).
   * @param {string} toolName - Name of the tool/function
   * @param {object} args - Arguments passed by the AI
   * @returns {Promise<*>} Result to send back to the AI
   */
  async handleToolCall(toolName, args) {
    throw new Error(`${this.name}: handleToolCall() not implemented`);
  }

  /**
   * Get the list of tools/functions this adapter exposes to the AI.
   * Used for OpenAI function calling schema.
   * @returns {Array<object>} Array of tool definitions (OpenAI function schema)
   */
  getToolDefinitions() {
    throw new Error(`${this.name}: getToolDefinitions() not implemented`);
  }
}

export default SaaSAdapter;
