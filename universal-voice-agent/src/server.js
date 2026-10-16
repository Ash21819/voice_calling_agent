/**
 * server.js
 * ─────────
 * Express + WebSocket server entrypoint for the Universal Voice Agent Bridge.
 *
 * Endpoints:
 *   - POST /api/calls/start      — Initiate an outbound call bridge
 *   - GET  /api/calls            — List active bridges
 *   - GET  /api/calls/:id        — Get bridge status
 *   - DELETE /api/calls/:id      — End a bridge
 *   - GET  /api/health           — Health check
 *   - WS   /ws/exotel            — Exotel media stream WebSocket endpoint
 *   - WS   /ws/dashboard         — Dashboard real-time events (optional)
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { VoiceBridge } from './bridge/VoiceBridge.js';
import { OpenAIManager } from './ai/OpenAIManager.js';
import { createExotelStream } from './telephony/ExotelStream.js';
import { MockSaaSAdapter } from './adapters/MockSaaSAdapter.js';
import { WebhookSaaSAdapter } from './adapters/WebhookSaaSAdapter.js';

// ─── Configuration ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ─── SaaS Adapter Factory ────────────────────────────────────────
/**
 * Create the appropriate SaaS adapter based on environment config.
 * @returns {import('./adapters/SaaSAdapter.js').SaaSAdapter}
 */
function createSaaSAdapter() {
  const adapterType = process.env.SAAS_ADAPTER || 'mock';

  switch (adapterType) {
    case 'webhook':
      return new WebhookSaaSAdapter({
        webhookUrl: process.env.WEBHOOK_URL,
        webhookSecret: process.env.WEBHOOK_SECRET,
      });

    case 'mock':
    default:
      return new MockSaaSAdapter();
  }
}

// ─── App Setup ───────────────────────────────────────────────────
const app = express();
app.use(express.json());

const server = createServer(app);

/** @type {Map<string, VoiceBridge>} Active bridge sessions */
const activeBridges = new Map();

/** @type {Set<WebSocket>} Dashboard WebSocket clients */
const dashboardClients = new Set();

// Initialize SaaS adapter
const saasAdapter = createSaaSAdapter();

// ─── WebSocket Servers ───────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws/exotel' });
const wssDashboard = new WebSocketServer({ server, path: '/ws/dashboard' });

/**
 * Broadcast an event to all dashboard clients.
 * @param {string} type - Event type
 * @param {object} data - Event data
 */
function broadcastToDashboard(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of dashboardClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ─── Exotel WebSocket Handler ────────────────────────────────────
wss.on('connection', async (ws, req) => {
  const bridgeId = `bridge-${uuidv4().slice(0, 8)}`;
  console.log(`[Server] New Exotel connection: ${bridgeId}`);

  // Parse metadata from query params or headers
  const url = new URL(req.url, `http://${req.headers.host}`);
  const metadata = {
    callSid: url.searchParams.get('callSid') || url.searchParams.get('CallSid'),
    from: url.searchParams.get('from') || url.searchParams.get('From'),
    to: url.searchParams.get('to') || url.searchParams.get('To'),
    direction: url.searchParams.get('direction') || 'inbound',
  };

  // Create Exotel stream
  const exotelStream = createExotelStream({
    ws,
    callSid: metadata.callSid,
    streamSid: `stream-${bridgeId}`,
    metadata,
  });

  // Create OpenAI manager with tools from adapter
  const openAIManager = new OpenAIManager({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_REALTIME_MODEL,
    voice: process.env.OPENAI_VOICE,
    instructions: process.env.OPENAI_INSTRUCTIONS,
    tools: saasAdapter.getToolDefinitions(),
  });

  // Create and start the bridge
  const bridge = new VoiceBridge({
    bridgeId,
    exotelStream,
    openAIManager,
    saasAdapter,
  });

  // Track bridge
  activeBridges.set(bridgeId, bridge);

  // Bridge lifecycle events
  bridge.on('active', (data) => {
    broadcastToDashboard('bridge:active', data);
  });

  bridge.on('transcript', (data) => {
    broadcastToDashboard('bridge:transcript', { bridgeId, ...data });
  });

  bridge.on('tool_call', (data) => {
    broadcastToDashboard('bridge:tool_call', { bridgeId, ...data });
  });

  bridge.on('ended', (data) => {
    activeBridges.delete(bridgeId);
    broadcastToDashboard('bridge:ended', data);
  });

  // Start the bridge
  try {
    await bridge.start();
  } catch (err) {
    console.error(`[Server] Bridge start failed:`, err.message);
    broadcastToDashboard('bridge:error', { bridgeId, error: err.message });
    bridge.end();
  }
});

// ─── Dashboard WebSocket Handler ─────────────────────────────────
wssDashboard.on('connection', (ws) => {
  dashboardClients.add(ws);
  console.log('[Server] Dashboard client connected');

  // Send current state
  ws.send(
    JSON.stringify({
      type: 'init',
      data: {
        activeBridges: Array.from(activeBridges.values()).map((b) => b.getStatus()),
        adapter: saasAdapter.name,
      },
    })
  );

  ws.on('close', () => {
    dashboardClients.delete(ws);
    console.log('[Server] Dashboard client disconnected');
  });
});

// ─── REST API Routes ─────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeBridges: activeBridges.size,
    adapter: saasAdapter.name,
    adapterConnected: saasAdapter.connected,
  });
});

// List active bridges
app.get('/api/calls', (req, res) => {
  const bridges = Array.from(activeBridges.values()).map((b) => b.getStatus());
  res.json({ bridges, count: bridges.length });
});

// Get bridge status
app.get('/api/calls/:id', (req, res) => {
  const bridge = activeBridges.get(req.params.id);
  if (!bridge) {
    return res.status(404).json({ error: 'Bridge not found' });
  }
  res.json(bridge.getStatus());
});

// End a bridge
app.delete('/api/calls/:id', async (req, res) => {
  const bridge = activeBridges.get(req.params.id);
  if (!bridge) {
    return res.status(404).json({ error: 'Bridge not found' });
  }
  await bridge.end();
  res.json({ message: 'Bridge ended', bridgeId: req.params.id });
});

// Start outbound call (placeholder — actual Exotel API call would go here)
app.post('/api/calls/start', async (req, res) => {
  const { to, from, metadata } = req.body;

  if (!to) {
    return res.status(400).json({ error: 'Missing "to" phone number' });
  }

  // In production, this would call the Exotel API to initiate a call.
  // The call would then connect to our WebSocket endpoint.
  res.json({
    message: 'Call initiation requested',
    to,
    from: from || process.env.EXOTEL_DEFAULT_FROM,
    note: 'In production, this triggers an Exotel API call which connects back to /ws/exotel',
  });
});

// ─── Server Start ────────────────────────────────────────────────
async function main() {
  // Connect SaaS adapter
  try {
    await saasAdapter.connect();
    console.log(`[Server] SaaS Adapter connected: ${saasAdapter.name}`);
  } catch (err) {
    console.error(`[Server] SaaS Adapter connection failed:`, err.message);
  }

  server.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Universal Voice Agent Bridge — Running                   ║
╠══════════════════════════════════════════════════════════════╣
║  Server:      http://${HOST}:${PORT}                         ║
║  Exotel WS:   ws://${HOST}:${PORT}/ws/exotel                 ║
║  Dashboard:   ws://${HOST}:${PORT}/ws/dashboard              ║
║  Health:      http://${HOST}:${PORT}/api/health               ║
║  Adapter:     ${saasAdapter.name.padEnd(45)}║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});

// ─── Graceful Shutdown ──────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received — shutting down...');
  for (const bridge of activeBridges.values()) {
    await bridge.end();
  }
  await saasAdapter.disconnect();
  server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received — shutting down...');
  for (const bridge of activeBridges.values()) {
    await bridge.end();
  }
  await saasAdapter.disconnect();
  server.close();
  process.exit(0);
});
