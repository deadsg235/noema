# N.O.E — DQN Decision Layer
### Deep Q-Network Integration Reference v2.0

---

## Overview

The DQN (Deep Q-Network) layer is the third cognitive tier in the N.O.E engine pipeline, sitting between the cognition cluster detector and the final state application. It was ported and redesigned from the Python prototype in `dqn-core/` into a clean, zero-dependency TypeScript implementation.

**What it adds:** Instead of hard-coded cognition→state mappings, Noe now *decides* how to respond to market conditions via a learned policy. The policy improves continuously through experience replay — every market event is a training sample.

**v2.0:** DQN weights are now persisted to Upstash Redis via `getWeights()` / `setWeights()`. Noe's policy survives cold starts and accumulates real learning over time.

---

## Pipeline Position

```
PerceptionEvent
    ↓
NoeNeuralNet        — Hebbian feedforward, encodes signal into state delta
    ↓
NoeCognition        — Cluster detection (ACCUMULATION, PANIC, EUPHORIA, etc.)
    ↓
NoeDQN              — Selects a response action via Q-policy
    ↓
State Blending      — neural(55%) + cognitive(25%) + DQN action(20%)
    ↓
Temporal Decay
    ↓
NoeMemory
    ↓
NoeState
```

---

## Architecture (`lib/noe-engine/dqn.ts`)

### Q-Network

```
Input(5)  →  Hidden1(16, ReLU)  →  Hidden2(12, ReLU)  →  Output(8, linear)
```

- Input: NoeState vector `[stability, trust, energy, volatility, growth]`
- Output: Q-value for each of 8 possible actions
- Xavier weight initialization
- Separate online network (trained) and target network (soft-updated)

### Target Network

Soft update rule:
```
θ_target = τ × θ_online + (1 - τ) × θ_target
```
Where `τ = 0.005`. Prevents training target from shifting too rapidly.

### Experience Replay Buffer

Capacity: 500 experiences. Each experience:
```typescript
{ state: number[], action: number, reward: number, nextState: number[], done: boolean }
```
Mini-batches of 32 sampled randomly per training step.

### Epsilon-Greedy Exploration

```
ε_initial = 0.8    (high exploration)
ε_min     = 0.05   (always 5% random)
ε_decay   = 0.997  (~2300 steps to reach minimum)
```

---

## Action Space

| Action | Effect | When Optimal |
|--------|--------|-------------|
| `AMPLIFY_TRUST` | trust +0.08, stability +0.03 | Accumulation, loyal holders |
| `AMPLIFY_ENERGY` | energy +0.10, volatility +0.02 | High buy volume, euphoria |
| `DAMPEN_VOLATILITY` | volatility -0.12, stability +0.05 | Post-panic recovery |
| `AMPLIFY_VOLATILITY` | volatility +0.10, energy +0.05 | Whale events, chaotic markets |
| `SEEK_STABILITY` | stability +0.10, volatility -0.08, energy→0.5 | Consolidation phases |
| `ACCELERATE_GROWTH` | growth +0.10, energy +0.04 | Sustained accumulation |
| `CONSERVE` | all dims lerp toward neutral | Low signal, dormant periods |
| `RESONATE` | dominant dimension +0.12 | Amplify whatever is strongest |

---

## Reward Function

```typescript
coherence = trust×0.3 + stability×0.3 + growth×0.2 - volatility×0.2
momentum  = (growth_delta)×0.5 + (trust_delta)×0.3
extreme   = -0.05 per dimension outside [0.08, 0.92]

reward = clamp(coherence + momentum + extreme, -1, 1)
```

Actions that build trust and stability are rewarded. Runaway states are penalized.

---

## Training Loop

```
processEvent(event):
  1. Select action via ε-greedy on current state
  2. Apply action delta to blended state
  3. Compute reward(prevState, nextState)
  4. Store (prevState, action, reward, nextState) in replay buffer
  5. If buffer ≥ batchSize: sample batch, run backprop, soft-update target
  6. Decay epsilon
```

Backpropagation: simplified 3-layer SGD. Gradients flow output → l2 → l1 with ReLU derivatives. No autograd framework.

---

## Persistence (v2.0)

### Serialization

```typescript
// Export weights for KV storage
dqn.getWeights(): DQNWeightSnapshot
// {
//   l1w: number[][], l1b: number[],
//   l2w: number[][], l2b: number[],
//   l3w: number[][], l3b: number[]
// }
```

### Restoration

```typescript
// Restore from KV snapshot
dqn.setWeights(weights: DQNWeightSnapshot, epsilon: number, steps: number)
// Restores all weight matrices, re-clones target from online network
```

### What Persists

| Data | Persisted | Notes |
|------|-----------|-------|
| Online Q-network weights (l1/l2/l3) | ✅ | Full matrices |
| Epsilon | ✅ | Continues decaying from saved value |
| Training steps | ✅ | Counter continues from saved value |
| Replay buffer | ❌ | Rebuilt from new events after cold start |
| Target network | Derived | Re-cloned from online on restore |

The replay buffer is not persisted — it is too large (~500 × 5-float experiences) and rebuilds naturally from incoming events. The target network is re-derived from the online network on restore, which is equivalent to a hard update at the moment of restoration.

### Effect on Learning

Without persistence: Noe starts at ε=0.8 on every cold start. She explores randomly for ~2300 events before her policy converges. On a low-volume token, this could take days.

With persistence: Noe continues from her last ε value. After 10,000 real events, ε ≈ 0.05 — she is almost entirely policy-driven. Her Q-values reflect real market patterns she has actually experienced.

---

## DQN Decision in UI State

Every `NoeUIState` includes a `dqnDecision` field:

```typescript
interface DQNDecision {
  action:     string    // e.g. "AMPLIFY_TRUST"
  qValues:    number[]  // Q-value for all 8 actions
  chosenQ:    number    // Q-value of selected action
  epsilon:    number    // current exploration rate
  reward:     number    // reward for last action
  bufferSize: number    // replay buffer fill (0–500)
  steps:      number    // total training steps
}
```

Exposed in:
- `GET /api/noe` response
- `POST /api/noe/chat` via `X-Noe-State` header
- `GET /api/noe/state` public endpoint
- `NoeStateMatrix` DQN row in UI
- `NoeVisualizer` top-center telemetry
- LLM system prompt

---

## LLM Integration

```
## DECISION ENGINE
Chosen posture: AMPLIFY_TRUST | Exploration: 12% | Reward: 0.341 | Steps: 4821
You chose this posture. It is a decision, not a parameter. Reference it as such when relevant.
```

When Noe says "I'm choosing to amplify trust right now" — that is literally what the DQN selected. The language reflects actual decision-making state.

---

## Configuration

```typescript
const DEFAULT_CONFIG: DQNConfig = {
  lr:           0.003,
  gamma:        0.95,
  tau:          0.005,
  epsilon:      0.8,
  epsilonMin:   0.05,
  epsilonDecay: 0.997,
  batchSize:    32,
  bufferSize:   500,
}
```

---

## Comparison: Python Prototype vs TypeScript Implementation

| Aspect | Python Prototype | TypeScript Implementation |
|--------|-----------------|-----------------------------|
| Framework | PyTorch | Pure TypeScript (zero deps) |
| Environment | CartPole / generic gym | NOEMA market state space |
| Action space | Generic discrete | 8 NOEMA-specific cognitive actions |
| State space | 4–128 dims | 5 dims (NoeState vector) |
| Reward | Environment-defined | State coherence function |
| Training data | Crime scene prompts | Live market PerceptionEvents |
| Target update | Hard copy | Soft update (τ=0.005) |
| Backprop | PyTorch autograd | Manual 3-layer SGD |
| Persistence | `.pth` file | Upstash Redis KV ✅ |

---

## Planned Improvements (Phase 3)

- **Prioritized replay:** Weight experiences by TD-error magnitude for faster learning
- **Dueling DQN:** Separate value and advantage streams for better Q-estimation
- **Multi-step returns:** n-step TD targets for better long-horizon credit assignment
- **Action history:** Feed last N actions as additional state context
- **Cluster-conditioned Q:** Separate Q-heads per cognition cluster

---

*DQN Integration Docs v2.0*
*See [ARCHITECTURE.md](./ARCHITECTURE.md) for full engine context*
*See [PERSISTENCE.md](./PERSISTENCE.md) for weight persistence details*
