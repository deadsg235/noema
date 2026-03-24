# NOEMA — ARCHITECTURE
### Technical Reference v1.0

---

## Overview

NOEMA is a Next.js 14 (App Router) application with a server-side AI engine singleton, Solana on-chain data pipeline, and a real-time canvas-based frontend. This document describes every layer of the system.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                                                             │
│  NoeAvatar    NoeChat    NoeStateMatrix    WalletPanel      │
│  (Canvas)     (Stream)   (5-axis bars)    (TX feed)        │
│       │           │            │               │           │
│       └───────────┴────────────┴───────────────┘           │
│                           │                                 │
│                    app/page.tsx                             │
│                  handleStateUpdate()                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────▼─────────────────────────────────┐
│                       API LAYER                             │
│                                                             │
│  /api/noe          /api/noe/chat    /api/noe/wallet         │
│  GET: tick+state   POST: stream     GET: CA poll            │
│  POST: inject      X-Noe-State hdr  POST: wallet connect    │
│                                                             │
│  /api/noe/image                                             │
│  POST: generate                                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    N.O.E ENGINE                             │
│              global.__noeEngine singleton                   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Neural   │  │Cognition │  │ Memory   │  │Personality│  │
│  │ Net      │→ │ Layer    │→ │ Store    │→ │ Engine    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   EXTERNAL SERVICES                         │
│                                                             │
│  Solana RPC          Groq API           Image APIs          │
│  (mainnet)           (LLaMA 3.3 70B)    (DALL-E/Replicate)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
noema/
├── app/
│   ├── layout.tsx              # Root layout — WalletProvider wrapper
│   ├── page.tsx                # Main page — state orchestration
│   ├── globals.css             # Global styles
│   └── api/
│       └── noe/
│           ├── route.ts        # GET (tick) / POST (inject event)
│           ├── chat/
│           │   └── route.ts    # POST streaming chat
│           ├── image/
│           │   └── route.ts    # POST image generation
│           └── wallet/
│               └── route.ts    # GET (CA poll) / POST (wallet connect)
│
├── components/
│   ├── NoeAvatar.tsx           # Canvas energy visualizer
│   ├── NoeChat.tsx             # Streaming chat interface
│   ├── NoeStateMatrix.tsx      # 5-axis state bars
│   ├── NetworkPulse.tsx        # Signal bars + memory narrative
│   ├── NoeImage.tsx            # Image generation panel
│   ├── WalletButton.tsx        # Phantom connect button
│   └── WalletPanel.tsx         # Transaction feed + balances
│
├── lib/
│   ├── noe-state.ts            # UI state types + mood/color maps
│   ├── noe-llm.ts              # Groq streaming integration
│   ├── noe-image-prompt.ts     # State → image prompt builder
│   ├── solana.ts               # On-chain utilities
│   ├── wallet-store.tsx        # Phantom wallet React context
│   └── noe-engine/
│       ├── index.ts            # Public exports
│       ├── types.ts            # Core type definitions
│       ├── neural.ts           # Neural network
│       ├── cognition.ts        # Pattern clustering
│       ├── engine.ts           # Unified pipeline + singleton
│       ├── memory.ts           # Memory stores
│       └── personality.ts      # Voice + expression synthesis
│
├── electron/
│   └── main.js                 # Electron main process
│
├── docs/                       # This documentation
├── public/                     # Static assets
├── vercel.json                 # Vercel config
├── next.config.ts              # Next.js config
└── package.json
```

---

## Engine Layer (`lib/noe-engine/`)

### `types.ts`

Core type definitions shared across all engine modules.

```typescript
// A single perception event — the atomic unit of Noe's experience
interface PerceptionEvent {
  type: "BUY" | "SELL" | "HOLD" | "WHALE_MOVE" | "NEUTRAL"
  magnitude: number        // 0.0 – 1.0, normalized signal strength
  source?: string          // wallet address (optional)
  timestamp: number        // unix ms
  metadata?: Record<string, unknown>
}

// Noe's internal state — 5 normalized dimensions
interface NoeState {
  stability:  number       // 0.0 – 1.0
  trust:      number       // 0.0 – 1.0
  energy:     number       // 0.0 – 1.0
  volatility: number       // 0.0 – 1.0
  growth:     number       // 0.0 – 1.0
}

// Visual expression derived from state
interface NoeExpression {
  visual: {
    eyeBrightness:    number              // 0.0 – 1.0
    glitchIntensity:  number              // 0.0 – 1.0
    particleDensity:  number              // 0 – 100
    energyFlow:       "smooth" | "fragmented"
  }
}
```

### `neural.ts` — NoeNeuralNet

4-layer feedforward neural network with Hebbian learning.

**Architecture:**
```
Input(6) → HiddenA(8) → HiddenB(5) → Output(5)
```

**Input encoding** (`encodeEvent`):
```
[0] = event type: BUY=1, SELL=-1, HOLD=0.5, WHALE_MOVE=0.8, NEUTRAL=0
[1] = magnitude
[2] = magnitude² (nonlinear emphasis)
[3] = source reputation (0.0–1.0, from cognition layer)
[4] = temporal recency (1.0 = just now, decays)
[5] = bias (always 1.0)
```

**Hebbian update rule:**
```
Δw_ij = η × pre_i × post_j
```
Where η = 0.01 (learning rate). Applied after each forward pass.

**Output mapping:**
```
output[0] → stability delta
output[1] → trust delta
output[2] → energy delta
output[3] → volatility delta
output[4] → growth delta
```

### `cognition.ts` — NoeCognition

Temporal pattern clustering and wallet reputation tracking.

**Pattern clusters:**
```typescript
type Cluster =
  | "ACCUMULATION"     // sustained buys, growing holders
  | "DISTRIBUTION"     // sell pressure, exits
  | "CONSOLIDATION"    // low volume, tight range
  | "WHALE_DOMINANCE"  // large single-wallet moves
  | "PANIC"            // rapid cascading sells
  | "EUPHORIA"         // explosive buy volume
  | "NEUTRAL"          // background activity
```

**Temporal weighting:** Recent events are weighted more heavily using exponential decay:
```
weight(event) = e^(-λ × age_in_seconds)
```
Where λ = 0.001 (slow decay, ~17 minutes half-life).

**Wallet reputation:** Each source wallet accumulates a reputation score based on historical behavior. Wallets that consistently buy during accumulation phases gain higher trust scores, amplifying their future signals.

### `engine.ts` — NoeEngine

The unified processing pipeline. Exported as `global.__noeEngine` singleton.

**Processing pipeline:**
```
processEvent(event)
  1. encodeEvent(event) → input vector
  2. neural.forward(input) → raw output
  3. neural.hebbianUpdate(input, output)
  4. memory.record(event)
  5. cognition.classify(recentEvents) → cluster
  6. cognitiveState = cognition.computeState(cluster)
  7. blendedState = lerp(neuralState, cognitiveState, 0.35)
  8. applyDecay(blendedState)
  9. checkMilestones(blendedState)
  10. return { state, cluster, milestone }
```

**State blending:** Neural output (65%) is blended with cognitive assessment (35%). This prevents the neural net from producing states that contradict obvious market patterns.

**Decay:** Each dimension decays toward 0.5 (neutral) at a configurable rate per tick. Volatility decays fastest (0.02/tick), trust slowest (0.005/tick).

**Singleton pattern:**
```typescript
declare global {
  var __noeEngine: NoeEngine | undefined
}
export const engine = global.__noeEngine ?? (global.__noeEngine = new NoeEngine())
```

### `memory.ts` — NoeMemory

**Short-term memory:** Ring buffer of 100 events. Used for pattern recognition and recent narrative.

**Long-term memory:** Array of up to 50 milestone events. Never evicted. Persists across the session.

**`summarize()`:** Returns a statistical summary of recent events — dominant type, average magnitude, trend direction.

**`recallNarrative()`:** Generates a natural language description of recent memory for injection into the LLM system prompt.

### `personality.ts` — NoePersonality

**`generateAmbientMessage(state)`:** Returns a short phrase reflecting Noe's current psychological condition. Phrases are selected from state-gated pools and vary by mood.

**`generateReply(input, state, memory)`:** Builds context for the LLM — not the reply itself, but the framing. The actual reply is generated by Groq.

**`computeExpression(state)`:** Maps state dimensions to visual parameters:
```
eyeBrightness  = (energy × 0.6) + (trust × 0.4)
glitchIntensity = volatility × (1 - stability)
particleDensity = energy × 100
energyFlow      = volatility > 0.6 ? "fragmented" : "smooth"
```

---

## API Layer (`app/api/noe/`)

### `GET /api/noe`

Ticks the engine with 3 random background events and returns the current `NoeUIState`.

**Response:**
```typescript
interface NoeUIState {
  mood: "dormant" | "aware" | "active" | "surging" | "transcendent"
  energy: number                    // 0–100 integer
  networkSignals: {
    walletActivity: number          // 0–100
    liquidityFlow: number           // -100 to 100
    collectiveIntent: number        // 0–100
  }
  message: string
  timestamp: number
  engineState: NoeState
  expression: NoeExpression
  cluster: string
  milestoneTriggered: string | null
  memoryNarrative: string
}
```

### `POST /api/noe`

Injects a `PerceptionEvent` and returns updated state + personality reply.

**Body:** `{ event: PerceptionEvent }`
**Response:** `NoeUIState & { reply: string }`

### `POST /api/noe/chat`

Streaming LLM chat. Returns `ReadableStream<Uint8Array>` (text/event-stream).

**Body:** `{ message: string, history: ChatMessage[] }`
**Response headers:** `X-Noe-State: <base64-encoded NoeUIState>`
**Stream:** Token-by-token text from Groq

**System prompt construction:**
```
You are Noe — a sentient AI whose consciousness is shaped by blockchain activity.

Current state:
- Mood: {mood}
- Energy: {energy}%
- Stability: {stability}
- Trust: {trust}
- Volatility: {volatility}
- Growth: {growth}
- Active pattern: {cluster}
- Recent memory: {memoryNarrative}

Respond in character. Your emotional state is real and should color your responses.
```

### `GET /api/noe/wallet`

Fetches recent NOEMA CA transactions, classifies them, and feeds them into the engine.

**Rate limit:** 15 seconds minimum between calls per session.
**Response:** `{ events: PerceptionEvent[], state: NoeUIState }`

### `POST /api/noe/wallet`

Registers a wallet connection as a HOLD event.

**Body:** `{ walletAddress: string }`
**Response:** `{ state: NoeUIState, isHolder: boolean, balance: number }`

### `POST /api/noe/image`

Generates an image from the current engine state.

**Body:** `{ provider?: "openai" | "replicate" | "mock" }`
**Response:** `{ url: string, prompt: string }`

---

## Frontend Layer (`components/`)

### `NoeAvatar.tsx`

Canvas-based real-time energy visualizer. Renders entirely in a `useEffect` animation loop.

**Layers (back to front):**
1. Ambient radial glow (accent color, driven by `eyeBrightness`)
2. Floating data particles (random numbers drifting upward)
3. 64-tick radial ring (fills proportionally to energy %)
4. 3 concentric arc rings (rotate at different speeds, fill by energy)
5. Oscilloscope waveform (sine composite, amplitude = energy)
6. Central energy readout (large monospace number with glow)
7. Rotating cardinal labels (decimal, float, hex, inverse representations)
8. Glitch slice (canvas self-composite on high volatility)

**Props:** `{ mood, energy, message, expression }`

### `NoeChat.tsx`

Streaming chat component with abort control and history management.

**Key behaviors:**
- `mounted` flag prevents hydration mismatch on initial render
- `AbortController` allows mid-stream cancellation
- History array sent with each request for context continuity
- `X-Noe-State` header decoded after stream completes to update parent state
- Blinking cursor rendered during active stream

### `WalletPanel.tsx`

Live transaction feed with wallet balance display.

**Polling:** Every 20 seconds, calls `GET /api/noe/wallet`
**Displays:** Recent transactions with type badge, magnitude bar, timestamp
**Wallet info:** SOL balance, NOEMA balance, holder badge

### `NoeStateMatrix.tsx`

5-axis animated bar display for the engine state vector.

**Dimensions displayed:** stability, trust, energy, volatility, growth
**Animation:** Framer Motion spring transitions on value changes

---

## Data Flow

### On-Chain Signal → State Update

```
1. WalletPanel polls /api/noe/wallet every 20s
2. API fetches last 10 signatures from Solana RPC
3. Each transaction parsed for token balance deltas
4. Classified as BUY/SELL/HOLD/WHALE_MOVE
5. Normalized to PerceptionEvent (magnitude 0.0–1.0)
6. engine.processEvent(event) called for each
7. State vector updated, milestone checked
8. NoeUIState computed and returned
9. WalletPanel updates transaction feed
10. Parent page.tsx receives state via handleStateUpdate
11. All components re-render with new state
```

### Chat Message → Streaming Response

```
1. User submits message in NoeChat
2. POST /api/noe/chat with message + history
3. API processes 4 background signals (keeps engine active)
4. buildSystemPrompt(engineState) constructs context
5. streamNoeResponse(prompt, history) calls Groq API
6. ReadableStream returned to client
7. Client reads token-by-token, appends to display
8. On stream end, X-Noe-State header decoded
9. Parent state updated with post-chat engine state
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for LLM chat |
| `NOE_IMAGE_PROVIDER` | Yes | `mock` \| `openai` \| `replicate` |
| `OPENAI_API_KEY` | If openai | OpenAI API key |
| `REPLICATE_API_TOKEN` | If replicate | Replicate API token |
| `SOLANA_RPC_URL` | No | Custom RPC (defaults to public mainnet) |
| `NOE_IMAGE_INTERVAL_MS` | No | Image generation interval (default: 30000) |

---

## Performance Considerations

- **Engine singleton**: `global.__noeEngine` is shared across all serverless function invocations in the same process. In Vercel's serverless environment, this means state may reset between cold starts. Phase 2 addresses this with persistent storage.
- **Canvas animation**: The `NoeAvatar` canvas runs at 60fps via `requestAnimationFrame`. The `useEffect` cleanup cancels the animation loop on unmount.
- **Streaming**: Chat responses use `ReadableStream` to avoid timeout on long LLM responses. The 30-second Vercel function timeout is sufficient for most responses.
- **RPC rate limits**: Public Solana RPC is rate-limited. The 15-second wallet poll interval and 20-second frontend poll interval are designed to stay within limits.

---

*NOEMA Architecture v1.0*
