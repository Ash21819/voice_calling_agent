# Universal Voice Agent Bridge

A **SaaS-Agnostic AI Calling Agent** that connects **Exotel** (Telephony) with the **OpenAI Realtime API** (Voice AI), using an **Adapter Pattern** to integrate with **ANY CRM or SaaS system**.

## 🚨 Constraints Met

- ✅ **Pure JavaScript** — No TypeScript. Modern ES Modules with JSDoc annotations.
- ✅ **SaaS Agnostic** — Core bridge knows nothing about specific CRMs. Uses `SaaSAdapter` interface.
- ✅ **Real-Time Audio** — Handles 8kHz μ-law ↔ 24kHz PCM16 transcoding.

## 📁 Project Structure

```
universal-voice-agent/
├── src/
│   ├── server.js                  # Express + WebSocket server entrypoint
│   ├── bridge/
│   │   ├── VoiceBridge.js         # Core orchestrator: Exotel <-> OpenAI audio & state
│   │   └── AudioTranscoder.js     # Handles 8kHz mulaw <-> 24kHz PCM16 conversion
│   ├── adapters/
│   │   ├── SaaSAdapter.js         # Abstract base class defining the interface for ANY CRM
│   │   ├── MockSaaSAdapter.js     # In-memory mock adapter for local testing
│   │   └── WebhookSaaSAdapter.js  # Generic adapter that just POSTs events to any webhook URL
│   ├── ai/
│   │   └── OpenAIManager.js       # Manages OpenAI Realtime WebSocket, VAD, and Tool Calling
│   └── telephony/
│       └── ExotelStream.js        # Handles Exotel WebSocket connection and audio payloads
├── package.json
└── .env.example
```

## 🚀 Quick Start

```bash
# Install dependencies
cd universal-voice-agent
npm install

# Configure environment
cp .env.example .env
# Edit .env with your OpenAI API key and Exotel credentials

# Start the server
npm start

# Or with auto-reload (Node.js 18+)
npm run dev
```

## 🔌 Exotel Configuration

In your Exotel dashboard, set the Media Stream WebSocket URL to:

```
ws://your-server.com:3000/ws/exotel?CallSid={call_sid}&From={from}&To={to}
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check & status |
| GET | `/api/calls` | List active bridges |
| GET | `/api/calls/:id` | Get bridge status |
| POST | `/api/calls/start` | Initiate outbound call |
| DELETE | `/api/calls/:id` | End a bridge |

## 🔗 WebSocket Endpoints

- `ws://localhost:3000/ws/exotel` — Exotel media stream
- `ws://localhost:3000/ws/dashboard` — Real-time dashboard events

## 🧩 Creating a Custom Adapter

Extend `SaaSAdapter` and implement all abstract methods:

```javascript
import { SaaSAdapter } from './adapters/SaaSAdapter.js';

export class SalesforceAdapter extends SaaSAdapter {
  constructor(config) {
    super('SalesforceAdapter', config);
  }

  async connect() { /* Initialize CRM client */ }
  async lookupContact(phone) { /* Find customer */ }
  async logCallEvent(event) { /* Log call to CRM */ }
  async handleToolCall(name, args) { /* Execute AI tool */ }
  getToolDefinitions() { /* Return OpenAI function schemas */ }
  // ... implement all methods
}
```

## 🎵 Audio Pipeline

```
Exotel (8kHz μ-law) → decode → resample 8k→24k → OpenAI (24kHz PCM16)
OpenAI (24kHz PCM16) → resample 24k→8k → encode μ-law → Exotel (8kHz μ-law)
```

## License

MIT
