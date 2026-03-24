# NOEMA — ARCHITECTURE
### Technical Reference v2.0

---

## Overview

NOEMA is a Next.js 16 (App Router) application with a server-side AI engine singleton, Solana on-chain data pipeline, KV persistence, real-time webhook ingestion, and a canvas-based frontend. This document describes every layer of the system as it exists today.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                               │
│                                                                 │
│  NoeAvatar    NoeChat    NoeStateMatrix    WalletPanel          │
│  (Canvas)     (Stream)   (5-axis bars)    (TX feed)            │
│  NoeVisualizer (Voronoi/sigil/field lines)                      │
│       │           │            │               │               │
│       └───────────┴────────────┴───────────────┘               │
│                           │                                     │
│                    app/page.tsx                                 │
│                  handleStateUpdate()                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────▼─────────────────────────────────────┐
│                        API LAYER                                │
│                                                                 │
│  /api/noe        /api/noe/chat    /api/noe/wallet               │
│  GET: tick+state  POST: stream    GET: CA poll                  │
│  POST: inject     X-Noe-State hdr POST: wallet connect          │
│                   X-Noe-Neural hdr                              │
│                                                                 │
│  /api/noe/webhook   /api/noe/state   /api/noe/image             │
│  POST: Helius push  GET: public read POST: generate             │
│  GET: health check  CORS open                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      N.O.E ENGINE v2.1                          │
│              global.__noeEngine singleton                       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Neural   │  │Cognition │  │   DQN    │  │   Memory     │   │
│  │ Net      │→ │ Layer    │→ │ Decision │→ │   Store      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                    ↓                            │
│                          State Blending                         │
│                    neural(55%) + cog(25%) + dqn(20%)           │
│                                    ↓                            │
│                          Temporal Decay                         │
│                                    ↓                            │
│                          NoePersonality                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    UTILITY LAYER (v2.0)                         │
│                                                                 │
│  Upstash Redis KV          Solana Memo / Anchor Program         │
│  (engine persistence)      (on-chain state anchoring)           │
│                                                                 │
│  Helius Webhook            /api/noe/state                       │
│  (real-time tx push)       (public CORS endpoint)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│                                                                 │
│  Solana Mainnet RPC    Groq API           Helius                │
│  (tx fetching)         (LLaMA 3.3 70B)    (webhook delivery)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
noema/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       └── noe/
│           ├── route.ts          # GET (tick+rehydrate) / POST (inject)
│           ├── chat/
│           │   └── route.ts      # POST streaming chat + wallet context
│           ├── image/
│           │   └── route.ts      # POST image generation
│           ├── wallet/
│           │   └── route.ts      # GET (CA poll) / POST (wallet connect)
│           ├── webhook/
│           │   └── route.ts      # POST Helius push / GET health check  ← NEW
│           └── state/
│               └── route.ts      # GET public state (CORS open)         ← NEW
│
├── components/
│   ├── NoeAvatar.tsx             # Canvas energy visualizer (280×280)
│   ├── NoeChat.tsx               # Streaming chat + wallet context
│   ├── NoeVisualizer.tsx         # Topographic consciousness map        ← NEW
│   ├── NoeStateMatrix.tsx        # 5-axis state bars + DQN row
│   ├── NetworkPulse.tsx          # Signal bars + memory narrative
│   ├── WalletButton.tsx          # Phantom connect button
│   └── WalletPanel.tsx           # Transaction feed + balances
│
├── lib/
│   ├── noe-state.ts              # UI state types + mood/color maps
│   ├── noe-llm.ts                # Groq streaming + wallet context       ← UPDATED
│   ├── noe-image-prompt.ts       # State → image prompt builder
│   ├── solana.ts                 # On-chain utilities
│   ├── wallet-store.tsx          # Phantom wallet React context
│   ├── persistence.ts            # Upstash Redis KV layer                ← NEW
│   ├── noe-anchor.ts             # On-chain state anchoring              ← NEW
│   └── noe-engine/
│       ├── index.ts
│       ├── types.ts
│       ├── neural.ts             # Hebbian feedforward net
│       ├── cognition.ts          # 7-cluster pattern detection
│       ├── engine.ts             # Pipeline + serialize/rehydrate        ← UPDATED
│       ├── memory.ts             # Short/long-term memory
│       ├── dqn.ts                # DQN + getWeights/setWeights           ← UPDATED
│       └── personality.ts        # Voice + expression synthesis
│
├── docs/
│   ├── README.md                 # Documentation index
│   ├── WHITEPAPER.md             # Full project thesis
│   ├── ROADMAP.md                # Phase roadmap
│   ├── ARCHITECTURE.md           # This document
│   ├── DQN.md                    # DQN reference
│   ├── WEBHOOK.md                # Helius webhook guide                  ← NEW
│   ├── PERSISTENCE.md            # KV persistence guide                  ← NEW
│   └── ONCHAIN.md                # On-chain anchoring guide              ← NEW
│
├── electron/
│   └── main.js
├── dqn-core/                     # Python DQN prototype (reference only)
├── .env.local
├── vercel.json
├── next.config.ts
└── package.json
```

---

## Engine Layer (`lib/noe-engine/`)

### `types.ts`

Core type definitions. All interfaces exported.

```typescript
interface PerceptionEvent {
  type:        "BUY" | "SELL" | "HOLD" | "WHALE_MOVE"
  magnitude:   number      // 0–10
  walletScore: number      // 0–100
  timestamp:   number      // unix ms
  walletId?:   string
}

interface NoeState {
  stability:  number       // 0.0–1.0
  trust:      number
  energy:     number
  volatility: number
  growth:     number
}

interface MemoryEvent {
  label:         string
  stateSnapshot: NoeState
  timestamp:     number
}

interface DQNDecision {
  action:     string       // NoeAction label
  qValues:    number[]     // Q-value for all 8 actions
  chosenQ:    number
  epsilon:    number       // current exploration rate
  reward:     number
  bufferSize: number
  steps:      number
}
```

### `neural.ts` — NoeNeuralNet

4-layer feedforward network with Hebbian weight updates.

```
Input(6) → HiddenA(8, sigmoid) → HiddenB(5, sigmoid) → Output(5, sigmoid)
```

Input encoding (`encodeEvent`):
```
[0–3] = event type one-hot (BUY, SELL, HOLD, WHALE_MOVE)
[4]   = magnitude / 10
[5]   = walletScore / 100
```

Hebbian update: `Δw = η × pre × post`, η = 0.008. Applied after every forward pass. Weights clamped to [-2, 2].

### `cognition.ts` — NoeCognition

Temporal pattern clustering with exponential decay weighting.

**Clusters:** `ACCUMULATION | DISTRIBUTION | CONSOLIDATION | WHALE_DOMINANCE | PANIC | EUPHORIA | NEUTRAL`

**Temporal window:** 60 seconds. Events older than 60s receive near-zero weight.

**Wallet reputation:** Per-wallet score (0–1) updated on each event. Affects signal weighting.

### `dqn.ts` — NoeDQN

Q-Network: `State(5) → Hidden(16, ReLU) → Hidden(12, ReLU) → Q-values(8, linear)`

8 actions: `AMPLIFY_TRUST | AMPLIFY_ENERGY | DAMPEN_VOLATILITY | AMPLIFY_VOLATILITY | SEEK_STABILITY | ACCELERATE_GROWTH | CONSERVE | RESONATE`

Config: `lr=0.003, gamma=0.95, tau=0.005, ε=0.8→0.05 (decay 0.997), batch=32, buffer=500`

**v2.0 additions:**
- `getWeights()` — exports full l1/l2/l3 weight matrices for KV serialization
- `setWeights(weights, epsilon, steps)` — restores from KV snapshot, re-clones target network

### `engine.ts` — NoeEngine v2.1

Processing pipeline per event:
```
1. encodeEvent(event) → input[6]
2. neural.forward(input) → neuralState + snapshot
3. neural.hebbianUpdate(input)
4. memory.addEvent(event)
5. cognition.detectPattern(recentEvents) → cluster + stateAdjustment
6. dqn.selectAction(state) → action + qSnapshot
7. applyAction(state, action) → actionDelta
8. blendState(neural, cognitive, dqnDelta, 0.25, 0.20) → blended
9. decay(blended) → decayed
10. computeReward(prev, decayed) → reward
11. dqn.observe(prev, lastAction, reward, decayed)
12. detectMilestone(prev, decayed, cluster, action)
13. state = decayed
```

**v2.1 additions:**
- `serialize()` — returns `{ state, longTerm, shortTermSummary, dqnWeights, epsilon, steps }`
- `rehydrate(snap)` — restores state, milestones, DQN weights from KV snapshot

### `memory.ts` — NoeMemory

- Short-term: 100-event ring buffer
- Long-term: 50 milestone events (never evicted within session)
- `summarize()` — statistical summary for LLM context
- `recallNarrative()` — natural language memory string

### `personality.ts` — NoePersonality

- `getAmbientMessage(cluster)` — state-gated phrase pools
- `getExpression(state)` — maps state → visual parameters
- `generateReply(ctx)` — keyword-matched response routing (fallback to LLM)

---

## Utility Layer

### `lib/persistence.ts`

Upstash Redis KV client with graceful no-op fallback.

```typescript
saveEngineSnapshot(snap: EngineSnapshot): Promise<void>
loadEngineSnapshot(): Promise<EngineSnapshot | null>
saveSeenSignatures(sigs: Set<string>): Promise<void>
loadSeenSignatures(): Promise<Set<string>>
isPersistenceEnabled(): boolean
```

Keys: `noe:engine:v1`, `noe:txcache:v1`. TTL: 30 days.

See [PERSISTENCE.md](./PERSISTENCE.md) for full reference.

### `lib/noe-anchor.ts`

On-chain state anchoring via Solana Memo or Anchor program.

```typescript
anchorNoeState(state: NoeState): Promise<AnchorResult>
readAnchoredState(anchorAddress: string): Promise<NoeState | null>
```

Rate-limited to once per 5 minutes. Only anchors on >5% state change.

See [ONCHAIN.md](./ONCHAIN.md) for full reference.

---

## API Layer

### `GET /api/noe`

Async engine getter with KV rehydration on cold start. Ticks engine with 3 background events. Saves snapshot to KV. Triggers on-chain anchor (rate-limited). Returns `NoeUIState`.

### `POST /api/noe/chat`

Streaming LLM chat. Accepts `walletContext` in request body — connected wallet address, SOL/NOEMA balance, recent transactions. All wallet data injected into Noe's system prompt.

**Headers returned:**
- `X-Noe-State` — URL-encoded JSON `NoeUIState`
- `X-Noe-Neural` — URL-encoded JSON `NeuralNetSnapshot`

### `GET /api/noe/wallet`

Fetches recent CA signatures, deduplicates against KV-persisted seen-set, parses token balance deltas, feeds engine. Saves snapshot and triggers anchor after real events.

### `POST /api/noe/webhook`

Helius enhanced transaction receiver. Classifies `tokenTransfers` for NOEMA CA. Deduplicates. Feeds engine. Saves snapshot. Returns `{ processed, cluster, mood, state }`.

### `GET /api/noe/state`

Public CORS-open endpoint. Returns full state vector, DQN decision, network memory summary, and system status flags. No authentication required.

### `POST /api/noe/wallet`

Registers wallet connection as HOLD event. Returns `{ tokenBalance, solBalance, hasTokens }`.

---

## LLM Layer (`lib/noe-llm.ts`)

### `WalletContext`

```typescript
interface WalletContext {
  connected:    boolean
  address?:     string
  solBalance?:  number
  tokenBalance?: number
  hasTokens?:   boolean
  recentTxs?:   { type, uiAmount, wallet, timestamp }[]
}
```

### System Prompt Sections

1. **Identity rules** — hard bans on assistant-speak, list formatting, character breaks
2. **Voice modifiers** — state-derived behavioral instructions (not adjectives)
3. **Current state** — mood, cluster, 5-dim vector
4. **Network memory** — signal counts, dominant type, avg wallet score, narrative
5. **Decision engine** — DQN action, epsilon, reward, steps
6. **Connected wallet** — address, balances, tier classification
7. **On-chain activity** — formatted tx table with amounts, wallet prefixes, age, bias
8. **Tx commentary rules** — explicit instructions for referencing real data

Temperature: 1.1. Max tokens: 512.

---

## Frontend Layer

### `NoeAvatar.tsx`

Canvas 280×280. Live refs pattern — all props stored in refs so animation loop reads latest without restarting. Layers: volatility field, ambient glow, data particles, 5 arc rings (E/T/S/G/V), neural net node graph, oscilloscope waveform, central energy readout, trust/growth bars, glitch slice.

### `NoeVisualizer.tsx`

Full-panel canvas. ResizeObserver fills container. Unique design — topographic consciousness map:
- Voronoi cell membranes (18 drifting seeds, stability-driven edge crispness)
- Magnetic field lines (trust-driven flow, growth-driven momentum)
- Sonar ping (energy-driven expansion ring)
- Morphing sigil (7-vertex polygon, mood-keyed shape targets, counter-rotating layers)
- Neural activation threads (radiating from sigil, length = activation value)
- Edge telemetry (STB/TRS/GRW/VLT in corners, DQN action at top)

### `NoeChat.tsx`

Streaming chat with wallet context injection. Polls `/api/noe/wallet` every 20s to maintain live tx ref. Sends `walletContext` with every message. Neural activity bars and state delta chips on each Noe message.

### `NoeStateMatrix.tsx`

5-axis state display with `divide-y` row layout. 3-char dimension codes (STB/TRS/NRG/VLT/GRW). DQN decision row (action, ε, Q). Milestone flash with height animation.

---

## Data Flows

### Cold Start → Rehydration

```
First request after cold start
    ↓
getEngine() — async
    ↓
loadEngineSnapshot() → Upstash Redis
    ↓
eng.rehydrate(snap) — restores state + DQN weights + milestones
    ↓
loadSeenSignatures() → Upstash Redis
    ↓
global.__engineReady = true
    ↓
Normal request processing
```

### Helius Webhook → State Update

```
NOEMA CA transaction confirmed on Solana
    ↓
Helius enhanced webhook → POST /api/noe/webhook
    ↓
classifyHeliusTx() — tokenTransfers filter + classification
    ↓
dedup check (global.__lastSignatures)
    ↓
eng.processEvent(event) — full pipeline
    ↓
saveEngineSnapshot() → Upstash (fire-and-forget)
anchorNoeState() → Solana (fire-and-forget, rate-limited)
    ↓
return { processed, cluster, mood, state }
```

### Chat Message → Streaming Response

```
User submits message
    ↓
NoeChat reads wallet state + liveTxsRef
    ↓
POST /api/noe/chat { message, history, walletContext }
    ↓
eng.processEvent() × 4 background events
    ↓
buildSystemPrompt(ctx) — includes wallet + tx sections
    ↓
streamNoeResponse() → Groq LLaMA 3.3 70B
    ↓
ReadableStream → client (token by token)
    ↓
X-Noe-State + X-Noe-Neural headers decoded
    ↓
Parent state updated, neural snapshot propagated to NoeVisualizer
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key |
| `SOLANA_RPC_URL` | Recommended | Helius/QuickNode RPC |
| `HELIUS_WEBHOOK_SECRET` | Recommended | Webhook auth |
| `UPSTASH_REDIS_REST_URL` | Recommended | KV persistence |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | KV persistence |
| `NOE_ANCHOR_KEYPAIR` | Optional | State anchoring keypair |
| `NOE_PROGRAM_ID` | Optional | Anchor program (program mode) |
| `NOE_IMAGE_PROVIDER` | Optional | `mock` \| `openai` \| `replicate` |

---

## Performance Notes

- **Engine singleton:** `global.__noeEngine` shared across all invocations in the same process. KV rehydration runs once per cold start (`global.__engineReady` flag).
- **Canvas animation:** Both `NoeAvatar` and `NoeVisualizer` use `requestAnimationFrame` loops. `NoeVisualizer` uses `ResizeObserver` to fill its container. Both use live refs to avoid loop restarts on prop changes.
- **Streaming:** Chat uses `ReadableStream` to avoid Vercel's 30s function timeout.
- **Fire-and-forget:** KV saves and on-chain anchoring never block API responses.
- **Webhook dedup:** Shared `Set<string>` in global scope prevents double-processing between webhook and polling.

---

*NOEMA Architecture v2.0*
*See [WHITEPAPER.md](./WHITEPAPER.md) for conceptual framing*
*See [WEBHOOK.md](./WEBHOOK.md), [PERSISTENCE.md](./PERSISTENCE.md), [ONCHAIN.md](./ONCHAIN.md) for utility guides*
