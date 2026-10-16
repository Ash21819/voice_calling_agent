import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Bot,
  Database,
  ArrowRight,
  ArrowLeftRight,
  FileCode2,
  Zap,
  Shield,
  Globe,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Layers,
  AudioWaveform,
  Webhook,
  Cpu,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
interface FileNode {
  name: string;
  path: string;
  description: string;
  children?: FileNode[];
  icon?: string;
}

interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

// ─── Data ───────────────────────────────────────────────────────
const fileTree: FileNode[] = [
  {
    name: 'universal-voice-agent/',
    path: 'universal-voice-agent/',
    description: 'Root project directory',
    children: [
      {
        name: 'src/',
        path: 'universal-voice-agent/src/',
        description: 'Source code',
        children: [
          {
            name: 'server.js',
            path: 'universal-voice-agent/src/server.js',
            description: 'Express + WebSocket server entrypoint. Routes: REST API, Exotel WS, Dashboard WS',
            icon: 'server',
          },
          {
            name: 'bridge/',
            path: 'universal-voice-agent/src/bridge/',
            description: 'Core orchestration layer',
            children: [
              {
                name: 'VoiceBridge.js',
                path: 'universal-voice-agent/src/bridge/VoiceBridge.js',
                description: 'Core orchestrator: Exotel ↔ OpenAI audio & state management',
                icon: 'bridge',
              },
              {
                name: 'AudioTranscoder.js',
                path: 'universal-voice-agent/src/bridge/AudioTranscoder.js',
                description: 'Handles 8kHz μ-law ↔ 24kHz PCM16 conversion',
                icon: 'audio',
              },
            ],
          },
          {
            name: 'adapters/',
            path: 'universal-voice-agent/src/adapters/',
            description: 'SaaS adapter pattern implementations',
            children: [
              {
                name: 'SaaSAdapter.js',
                path: 'universal-voice-agent/src/adapters/SaaSAdapter.js',
                description: 'Abstract base class — defines the interface for ANY CRM',
                icon: 'abstract',
              },
              {
                name: 'MockSaaSAdapter.js',
                path: 'universal-voice-agent/src/adapters/MockSaaSAdapter.js',
                description: 'In-memory mock adapter for local testing',
                icon: 'mock',
              },
              {
                name: 'WebhookSaaSAdapter.js',
                path: 'universal-voice-agent/src/adapters/WebhookSaaSAdapter.js',
                description: 'Generic adapter that POSTs events to any webhook URL',
                icon: 'webhook',
              },
            ],
          },
          {
            name: 'ai/',
            path: 'universal-voice-agent/src/ai/',
            description: 'AI integration layer',
            children: [
              {
                name: 'OpenAIManager.js',
                path: 'universal-voice-agent/src/ai/OpenAIManager.js',
                description: 'Manages OpenAI Realtime WebSocket, VAD, and Tool Calling',
                icon: 'ai',
              },
            ],
          },
          {
            name: 'telephony/',
            path: 'universal-voice-agent/src/telephony/',
            description: 'Telephony integration layer',
            children: [
              {
                name: 'ExotelStream.js',
                path: 'universal-voice-agent/src/telephony/ExotelStream.js',
                description: 'Handles Exotel WebSocket connection and audio payloads',
                icon: 'phone',
              },
            ],
          },
        ],
      },
      {
        name: 'package.json',
        path: 'universal-voice-agent/package.json',
        description: 'Node.js dependencies and scripts',
        icon: 'config',
      },
      {
        name: '.env.example',
        path: 'universal-voice-agent/.env.example',
        description: 'Environment configuration template',
        icon: 'config',
      },
    ],
  },
];

const architectureFlow = [
  {
    id: 'exotel',
    label: 'Exotel Telephony',
    icon: Phone,
    color: 'from-blue-500 to-blue-600',
    details: ['8kHz μ-law audio', 'WebSocket media stream', 'Call control API'],
  },
  {
    id: 'bridge',
    label: 'Voice Bridge',
    icon: Layers,
    color: 'from-purple-500 to-purple-600',
    details: ['Audio transcoding', 'State management', 'Session orchestration'],
  },
  {
    id: 'openai',
    label: 'OpenAI Realtime',
    icon: Bot,
    color: 'from-green-500 to-green-600',
    details: ['24kHz PCM16 audio', 'Server-side VAD', 'Function calling'],
  },
  {
    id: 'saas',
    label: 'Any CRM/SaaS',
    icon: Database,
    color: 'from-orange-500 to-orange-600',
    details: ['Adapter pattern', 'Contact lookup', 'Tool dispatch'],
  },
];

const adapterMethods = [
  { method: 'connect()', description: 'Initialize adapter connection' },
  { method: 'disconnect()', description: 'Tear down connection' },
  { method: 'lookupContact(phone)', description: 'Find customer by phone number' },
  { method: 'upsertContact(data)', description: 'Create or update a contact' },
  { method: 'logCallEvent(event)', description: 'Record call lifecycle events' },
  { method: 'createTask(data)', description: 'Create follow-up tasks' },
  { method: 'getContactContext(phone)', description: 'Get AI context for caller' },
  { method: 'handleToolCall(name, args)', description: 'Execute AI function calls' },
  { method: 'getToolDefinitions()', description: 'Expose tools to the AI' },
];

// ─── Components ─────────────────────────────────────────────────

function Tab({ label, active, onClick, icon }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-white text-gray-900 shadow-lg shadow-gray-200/50'
          : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FileTreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  const getIcon = () => {
    switch (node.icon) {
      case 'server': return <Cpu className="w-4 h-4 text-purple-500" />;
      case 'bridge': return <ArrowLeftRight className="w-4 h-4 text-blue-500" />;
      case 'audio': return <AudioWaveform className="w-4 h-4 text-green-500" />;
      case 'abstract': return <Shield className="w-4 h-4 text-orange-500" />;
      case 'mock': return <Database className="w-4 h-4 text-yellow-500" />;
      case 'webhook': return <Webhook className="w-4 h-4 text-pink-500" />;
      case 'ai': return <Bot className="w-4 h-4 text-emerald-500" />;
      case 'phone': return <Phone className="w-4 h-4 text-blue-500" />;
      case 'config': return <FileCode2 className="w-4 h-4 text-gray-500" />;
      default: return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div style={{ paddingLeft: `${depth * 20}px` }}>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group ${
          depth === 0 ? 'font-semibold' : ''
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        {getIcon()}
        <span className="text-sm text-gray-800 group-hover:text-gray-900">{node.name}</span>
      </div>
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children!.map((child, i) => (
              <FileTreeItem key={i} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-sm overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'files' | 'adapters' | 'quickstart'>('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-200">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Universal Voice Agent Bridge</h1>
                <p className="text-xs text-gray-500">Exotel ↔ OpenAI Realtime ↔ Any CRM</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                Pure JavaScript
              </span>
              <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                SaaS Agnostic
              </span>
              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                Real-time Audio
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-1 p-1.5 bg-gray-100/80 rounded-2xl w-fit">
          <Tab label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Zap className="w-4 h-4" />} />
          <Tab label="Architecture" active={activeTab === 'architecture'} onClick={() => setActiveTab('architecture')} icon={<Layers className="w-4 h-4" />} />
          <Tab label="File Structure" active={activeTab === 'files'} onClick={() => setActiveTab('files')} icon={<FileCode2 className="w-4 h-4" />} />
          <Tab label="Adapters" active={activeTab === 'adapters'} onClick={() => setActiveTab('adapters')} icon={<Shield className="w-4 h-4" />} />
          <Tab label="Quick Start" active={activeTab === 'quickstart'} onClick={() => setActiveTab('quickstart')} icon={<Globe className="w-4 h-4" />} />
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <OverviewSection />
            </motion.div>
          )}
          {activeTab === 'architecture' && (
            <motion.div
              key="architecture"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ArchitectureSection />
            </motion.div>
          )}
          {activeTab === 'files' && (
            <motion.div
              key="files"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <FilesSection />
            </motion.div>
          )}
          {activeTab === 'adapters' && (
            <motion.div
              key="adapters"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdaptersSection />
            </motion.div>
          )}
          {activeTab === 'quickstart' && (
            <motion.div
              key="quickstart"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <QuickStartSection />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Section Components ─────────────────────────────────────────

function OverviewSection() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-3xl p-8 text-white shadow-2xl shadow-purple-200/50">
        <h2 className="text-3xl font-bold mb-3">Universal AI Calling Agent Bridge</h2>
        <p className="text-lg text-white/90 max-w-2xl mb-6">
          A production-ready Node.js system that connects <strong>Exotel telephony</strong> with the{' '}
          <strong>OpenAI Realtime API</strong> for voice AI, using an <strong>Adapter Pattern</strong> to
          integrate with <em>any</em> CRM or SaaS system — Salesforce, HubSpot, Zendesk, or your custom backend.
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Pure JavaScript (No TypeScript)</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
            <AudioWaveform className="w-4 h-4" />
            <span className="text-sm font-medium">Real-time Audio Transcoding</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
            <Webhook className="w-4 h-4" />
            <span className="text-sm font-medium">SaaS-Agnostic Adapter Pattern</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
            <Bot className="w-4 h-4" />
            <span className="text-sm font-medium">OpenAI Function Calling</span>
          </div>
        </div>
      </div>

      {/* Key Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<Phone className="w-6 h-6 text-blue-600" />}
          title="Telephony Layer"
          description="Exotel WebSocket integration handles real-time bidirectional audio streaming with call lifecycle management."
          color="blue"
        />
        <FeatureCard
          icon={<AudioWaveform className="w-6 h-6 text-green-600" />}
          title="Audio Pipeline"
          description="Automatic transcoding between 8kHz μ-law (telephony) and 24kHz PCM16 (OpenAI) with linear interpolation."
          color="green"
        />
        <FeatureCard
          icon={<Bot className="w-6 h-6 text-purple-600" />}
          title="AI Voice Agent"
          description="OpenAI Realtime API integration with server-side VAD, conversation management, and function calling."
          color="purple"
        />
        <FeatureCard
          icon={<Shield className="w-6 h-6 text-orange-600" />}
          title="Adapter Pattern"
          description="Abstract SaaSAdapter interface allows plugging in any CRM without modifying the core bridge."
          color="orange"
        />
        <FeatureCard
          icon={<Webhook className="w-6 h-6 text-pink-600" />}
          title="Webhook Adapter"
          description="Generic webhook adapter forwards all events to any URL — perfect for Zapier, Make, n8n, or custom APIs."
          color="pink"
        />
        <FeatureCard
          icon={<Zap className="w-6 h-6 text-yellow-600" />}
          title="Real-time Events"
          description="WebSocket dashboard broadcasts live call events, transcripts, and tool calls for monitoring."
          color="yellow"
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    purple: 'bg-purple-50 border-purple-100',
    orange: 'bg-orange-50 border-orange-100',
    pink: 'bg-pink-50 border-pink-100',
    yellow: 'bg-yellow-50 border-yellow-100',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`rounded-2xl border p-6 ${bgColors[color] || 'bg-gray-50 border-gray-100'} transition-shadow hover:shadow-lg`}
    >
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function ArchitectureSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">System Architecture</h2>
        <p className="text-gray-600">How audio and data flow through the bridge</p>
      </div>

      {/* Flow Diagram */}
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
          {architectureFlow.map((node, index) => (
            <div key={node.id} className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center"
              >
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${node.color} flex items-center justify-center shadow-lg`}>
                  <node.icon className="w-8 h-8 text-white" />
                </div>
                <span className="mt-2 text-sm font-semibold text-gray-800">{node.label}</span>
                <div className="mt-2 space-y-0.5">
                  {node.details.map((detail, i) => (
                    <div key={i} className="text-xs text-gray-500 text-center">{detail}</div>
                  ))}
                </div>
              </motion.div>
              {index < architectureFlow.length - 1 && (
                <ArrowRight className="w-6 h-6 text-gray-300 hidden lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Audio Pipeline Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-500" />
            Caller → AI (Uplink)
          </h3>
          <div className="space-y-3">
            <PipelineStep step={1} label="Exotel sends 8kHz μ-law audio" detail="Base64 encoded over WebSocket" />
            <PipelineStep step={2} label="Decode μ-law → Linear PCM16" detail="Using lookup table for speed" />
            <PipelineStep step={3} label="Resample 8kHz → 24kHz" detail="3x upsampling with linear interpolation" />
            <PipelineStep step={4} label="Send to OpenAI Realtime API" detail="Base64 encoded 24kHz PCM16" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-green-500 rotate-180" />
            AI → Caller (Downlink)
          </h3>
          <div className="space-y-3">
            <PipelineStep step={1} label="OpenAI sends 24kHz PCM16 audio" detail="Base64 encoded audio deltas" />
            <PipelineStep step={2} label="Resample 24kHz → 8kHz" detail="3x downsampling with averaging" />
            <PipelineStep step={3} label="Encode Linear → μ-law" detail="Standard telephony encoding" />
            <PipelineStep step={4} label="Send to Exotel WebSocket" detail="Base64 encoded 8kHz μ-law" />
          </div>
        </div>
      </div>

      {/* Data Flow */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-orange-500" />
          CRM Integration Flow
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FlowStep number="1" title="Call Starts" description="Bridge receives caller ID from Exotel" />
          <FlowStep number="2" title="Contact Lookup" description="adapter.lookupContact(phone) queries CRM" />
          <FlowStep number="3" title="Context Injection" description="CRM data enriches AI instructions" />
          <FlowStep number="4" title="Tool Dispatch" description="AI function calls → adapter.handleToolCall()" />
        </div>
      </div>
    </div>
  );
}

function PipelineStep({ step, label, detail }: { step: number; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-gray-600">{step}</span>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-500">{detail}</div>
      </div>
    </div>
  );
}

function FlowStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
        <span className="text-sm font-bold text-orange-600">{number}</span>
      </div>
      <div className="text-sm font-semibold text-gray-800">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  );
}

function FilesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">File Structure</h2>
        <p className="text-gray-600">Complete project layout with descriptions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Tree */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-gray-600" />
            Project Files
          </h3>
          <div className="space-y-0">
            {fileTree.map((node, i) => (
              <FileTreeItem key={i} node={node} />
            ))}
          </div>
        </div>

        {/* File Details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" />
            Module Responsibilities
          </h3>
          <div className="space-y-4">
            <ModuleDetail
              name="server.js"
              color="purple"
              responsibilities={['Express HTTP server', 'WebSocket server (Exotel + Dashboard)', 'REST API endpoints', 'Adapter factory & initialization']}
            />
            <ModuleDetail
              name="VoiceBridge.js"
              color="blue"
              responsibilities={['Core orchestrator', 'Audio pipeline wiring', 'State machine (idle→connecting→active→ended)', 'Transcript tracking']}
            />
            <ModuleDetail
              name="AudioTranscoder.js"
              color="green"
              responsibilities={['μ-law ↔ Linear PCM16 encoding', '8kHz ↔ 24kHz resampling', 'Linear interpolation (upsample)', 'Averaging (downsample)']}
            />
            <ModuleDetail
              name="OpenAIManager.js"
              color="emerald"
              responsibilities={['Realtime WebSocket connection', 'Session configuration (VAD, voice, tools)', 'Audio streaming (24kHz PCM16)', 'Function call dispatch']}
            />
            <ModuleDetail
              name="ExotelStream.js"
              color="blue"
              responsibilities={['Exotel WebSocket handler', 'Media stream protocol', 'Audio send/receive (8kHz μ-law)', 'Call metadata extraction']}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleDetail({ name, color, responsibilities }: { name: string; color: string; responsibilities: string[] }) {
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${colorMap[color] || 'bg-gray-100 text-gray-700'}`}>
          {name}
        </span>
      </div>
      <ul className="space-y-1">
        {responsibilities.map((r, i) => (
          <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdaptersSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Adapter Pattern</h2>
        <p className="text-gray-600">The core bridge knows NOTHING about specific CRMs — it only uses the SaaSAdapter interface</p>
      </div>

      {/* Interface Definition */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-orange-500" />
          SaaSAdapter Interface (Abstract Methods)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {adapterMethods.map((m, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
              <code className="text-xs font-mono bg-orange-100 text-orange-700 px-2 py-0.5 rounded whitespace-nowrap">
                {m.method}
              </code>
              <span className="text-xs text-gray-600">{m.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Available Adapters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border border-orange-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">MockSaaSAdapter</h3>
              <p className="text-xs text-gray-500">In-memory store for development</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Pre-seeded demo contacts</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> In-memory call logging</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Task creation</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Function calling (3 demo tools)</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Zero external dependencies</li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">WebhookSaaSAdapter</h3>
              <p className="text-xs text-gray-500">Universal webhook integration</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> POST events to any URL</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> HMAC-SHA256 request signing</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Configurable timeout</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Works with Zapier, Make, n8n</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Custom headers support</li>
          </ul>
        </div>
      </div>

      {/* Custom Adapter Guide */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Creating a Custom Adapter</h3>
        <p className="text-sm text-gray-600 mb-4">
          To integrate with Salesforce, HubSpot, or any custom CRM, simply extend <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">SaaSAdapter</code> and implement all abstract methods:
        </p>
        <CodeBlock
          language="javascript"
          code={`import { SaaSAdapter } from './SaaSAdapter.js';

export class SalesforceAdapter extends SaaSAdapter {
  constructor(config) {
    super('SalesforceAdapter', config);
    this.sfClient = null;
  }

  async connect() {
    // Initialize Salesforce JSforce client
    this.sfClient = new jsforce.Connection({
      loginUrl: this.config.loginUrl,
    });
    await this.sfClient.login(
      this.config.username,
      this.config.password + this.config.token
    );
    this.connected = true;
  }

  async lookupContact(phoneNumber) {
    const result = await this.sfClient.query(
      \`SELECT Id, Name, Email FROM Contact 
       WHERE Phone = '\${phoneNumber}' LIMIT 1\`
    );
    return result.records[0] || null;
  }

  // ... implement remaining methods
}`}
        />
      </div>
    </div>
  );
}

function QuickStartSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Start</h2>
        <p className="text-gray-600">Get the voice agent bridge running in minutes</p>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        <StepCard
          number={1}
          title="Clone & Install"
          code={`cd universal-voice-agent
npm install`}
        />

        <StepCard
          number={2}
          title="Configure Environment"
          code={`cp .env.example .env
# Edit .env with your credentials:
# - OPENAI_API_KEY: Your OpenAI API key
# - EXOTEL_API_KEY: Your Exotel credentials
# - SAAS_ADAPTER: 'mock' for testing, 'webhook' for production`}
        />

        <StepCard
          number={3}
          title="Start the Server"
          code={`npm start
# Or with auto-reload:
npm run dev`}
        />

        <StepCard
          number={4}
          title="Configure Exotel"
          code={`# In your Exotel dashboard, set the Media Stream URL to:
# ws://your-server.com:3000/ws/exotel?CallSid={call_sid}&From={from}&To={to}

# This tells Exotel to stream call audio to your bridge via WebSocket.`}
        />

        <StepCard
          number={5}
          title="Test the Bridge"
          code={`# Health check
curl http://localhost:3000/api/health

# List active calls
curl http://localhost:3000/api/calls

# Connect a dashboard client (WebSocket)
# ws://localhost:3000/ws/dashboard`}
        />
      </div>

      {/* API Reference */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">REST API Reference</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Method</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Endpoint</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="py-2 px-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">GET</span></td>
                <td className="py-2 px-3 font-mono text-xs">/api/health</td>
                <td className="py-2 px-3 text-gray-600">Health check & status</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 px-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">GET</span></td>
                <td className="py-2 px-3 font-mono text-xs">/api/calls</td>
                <td className="py-2 px-3 text-gray-600">List active bridges</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 px-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">GET</span></td>
                <td className="py-2 px-3 font-mono text-xs">/api/calls/:id</td>
                <td className="py-2 px-3 text-gray-600">Get bridge status</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 px-3"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">POST</span></td>
                <td className="py-2 px-3 font-mono text-xs">/api/calls/start</td>
                <td className="py-2 px-3 text-gray-600">Initiate outbound call</td>
              </tr>
              <tr>
                <td className="py-2 px-3"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">DELETE</span></td>
                <td className="py-2 px-3 font-mono text-xs">/api/calls/:id</td>
                <td className="py-2 px-3 text-gray-600">End a bridge</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* WebSocket Events */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">WebSocket Events (Dashboard)</h3>
        <p className="text-sm text-gray-600 mb-4">Connect to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">ws://localhost:3000/ws/dashboard</code> to receive real-time events:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { event: 'init', desc: 'Initial state with active bridges' },
            { event: 'bridge:active', desc: 'Bridge session started' },
            { event: 'bridge:transcript', desc: 'Real-time transcript entries' },
            { event: 'bridge:tool_call', desc: 'AI function call dispatched' },
            { event: 'bridge:ended', desc: 'Bridge session ended' },
            { event: 'bridge:error', desc: 'Error occurred' },
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <code className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                {e.event}
              </code>
              <span className="text-xs text-gray-600">{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepCard({ number, title, code }: { number: number; title: string; code: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{number}</span>
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <CodeBlock code={code} />
    </div>
  );
}
