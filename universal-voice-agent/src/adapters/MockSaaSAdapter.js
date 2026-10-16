/**
 * MockSaaSAdapter.js
 * ──────────────────
 * In-memory mock adapter for local testing and development.
 * Stores all data in memory — no external dependencies.
 */

import { SaaSAdapter } from './SaaSAdapter.js';
import { v4 as uuidv4 } from 'uuid';

export class MockSaaSAdapter extends SaaSAdapter {
  constructor(config = {}) {
    super('MockSaaSAdapter', config);

    /** @type {Map<string, object>} contacts indexed by phone number */
    this.contacts = new Map();

    /** @type {Array<object>} call event log */
    this.callLog = [];

    /** @type {Array<object>} task list */
    this.tasks = [];

    // Seed some demo contacts
    this._seedDemoData();
  }

  _seedDemoData() {
    this.contacts.set('+15551234567', {
      id: 'contact-001',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+15551234567',
      company: 'Acme Corp',
      notes: 'VIP customer. Prefers concise communication.',
      lastContact: '2024-12-01T10:00:00Z',
    });

    this.contacts.set('+15559876543', {
      id: 'contact-002',
      name: 'Bob Smith',
      email: 'bob@example.com',
      phone: '+15559876543',
      company: 'TechStart Inc',
      notes: 'Interested in enterprise plan. Follow up after holidays.',
      lastContact: '2024-11-15T14:30:00Z',
    });
  }

  async connect() {
    this.connected = true;
    console.log('[MockSaaSAdapter] Connected (in-memory store)');
  }

  async disconnect() {
    this.connected = false;
    console.log('[MockSaaSAdapter] Disconnected');
  }

  async lookupContact(phoneNumber) {
    const contact = this.contacts.get(phoneNumber) || null;
    console.log(`[MockSaaSAdapter] lookupContact(${phoneNumber}) → ${contact ? contact.name : 'NOT FOUND'}`);
    return contact;
  }

  async upsertContact(contactData) {
    const key = contactData.phone;
    const existing = this.contacts.get(key);
    const contact = {
      id: existing?.id || `contact-${uuidv4().slice(0, 8)}`,
      ...existing,
      ...contactData,
      updatedAt: new Date().toISOString(),
    };
    this.contacts.set(key, contact);
    console.log(`[MockSaaSAdapter] upsertContact → ${contact.name} (${contact.phone})`);
    return contact;
  }

  async logCallEvent(callEvent) {
    const event = {
      id: `event-${uuidv4().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      ...callEvent,
    };
    this.callLog.push(event);
    console.log(`[MockSaaSAdapter] logCallEvent → ${event.status} | ${event.phoneNumber}`);
    return event;
  }

  async createTask(taskData) {
    const task = {
      id: `task-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...taskData,
    };
    this.tasks.push(task);
    console.log(`[MockSaaSAdapter] createTask → ${task.title}`);
    return task;
  }

  async getContactContext(phoneNumber) {
    const contact = this.contacts.get(phoneNumber);
    if (!contact) return 'No previous records for this caller.';

    const recentCalls = this.callLog
      .filter((e) => e.phoneNumber === phoneNumber)
      .slice(-3);

    let context = `Customer: ${contact.name} (${contact.company})\n`;
    context += `Notes: ${contact.notes}\n`;
    if (recentCalls.length > 0) {
      context += `Recent interactions: ${recentCalls.length} call(s)\n`;
    }
    return context;
  }

  async handleToolCall(toolName, args) {
    console.log(`[MockSaaSAdapter] handleToolCall → ${toolName}`, args);

    switch (toolName) {
      case 'create_follow_up':
        return await this.createTask({
          title: args.title || 'Follow-up task',
          description: args.description || '',
          priority: args.priority || 'medium',
          dueDate: args.dueDate,
        });

      case 'update_customer_notes':
        const contact = this.contacts.get(args.phoneNumber);
        if (contact) {
          contact.notes = (contact.notes || '') + '\n' + args.note;
          this.contacts.set(args.phoneNumber, contact);
          return { success: true, message: 'Notes updated' };
        }
        return { success: false, message: 'Contact not found' };

      case 'get_order_status':
        return {
          orderId: 'ORD-12345',
          status: 'shipped',
          trackingNumber: 'TRK-9876543210',
          estimatedDelivery: '2024-12-20',
        };

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'create_follow_up',
          description: 'Create a follow-up task for the customer after the call',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Task description' },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Task priority',
              },
              dueDate: { type: 'string', description: 'Due date (ISO format)' },
            },
            required: ['title'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_customer_notes',
          description: 'Add a note to the customer record',
          parameters: {
            type: 'object',
            properties: {
              phoneNumber: { type: 'string', description: 'Customer phone number' },
              note: { type: 'string', description: 'Note to add' },
            },
            required: ['phoneNumber', 'note'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_order_status',
          description: 'Look up the status of a customer order',
          parameters: {
            type: 'object',
            properties: {
              orderId: { type: 'string', description: 'Order ID to look up' },
            },
            required: [],
          },
        },
      },
    ];
  }
}

export default MockSaaSAdapter;
