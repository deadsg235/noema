# N.O.E — DQN Decision Layer
### Deep Q-Network Integration Reference

---

## Overview

The DQN (Deep Q-Network) layer is the third cognitive tier in the N.O.E engine pipeline, sitting between the cognition cluster detector and the final state application. It was ported and redesigned from the Python prototype in `dqn-core/` into a clean, zero-dependency TypeScript implementation.

**What it adds:** Instead of hard-coded cognition→state mappings, Noe now *decides* how to respond to market conditions via a learned policy. The policy improves continuously through experience replay — every market event is a training sample.

---

## Pipeline Position

```
PerceptionEvent
    ↓
NoeNeuralNet        — Hebbian feedforward, encodes signal into state delta
    ↓
NoeCognition        — Cluster detection (ACCUMULATION, PANIC, EUPHORIA, etc.)
    ↓
NoeDQN              ← NEW — selects a response action via Q-policy
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

Soft update rule (from `Layered_DQN.py`):
```
θ_target = τ × θ_online + (1 - τ) × θ_target
```
Where `τ = 0.005`. This prevents the training target from shifting too rapidly, stabilizing learning.

### Experience Replay Buffer

Capacity: 500 experiences. Each experience stores:
```typescript
{ state, action, reward, nextState, done }
```
Mini-batches of 32 are sampled randomly for each training step, breaking temporal correlation between consecutive market events.

### Epsilon-Greedy Exploration

```
ε_initial = 0.8    (high exploration — Noe is still learning)
ε_min     = 0.05   (always 5% random to prevent policy lock-in)
ε_decay   = 0.997  (per step — slow decay, ~2300 steps to reach min)
```

At high epsilon, Noe explores random actions. As epsilon decays, she increasingly follows her learned Q-policy.

---

## Action Space

8 actions define how Noe *responds* to market conditions — not what the market does, but what cognitive posture she adopts:

| Action | Effect | When Optimal |
|--------|--------|-------------|
| `AMPLIFY_TRUST` | trust +0.08, stability +0.03 | Accumulation patterns, loyal holders |
| `AMPLIFY_ENERGY` | energy +0.10, volatility +0.02 | High buy volume, euphoria |
| `DAMPEN_VOLATILITY` | volatility -0.12, stability +0.05 | Post-panic recovery |
| `AMPLIFY_VOLATILITY` | volatility +0.10, energy +0.05 | Whale events, chaotic markets |
| `SEEK_STABILITY` | stability +0.10, volatility -0.08, energy→0.5 | Consolidation phases |
| `ACCELERATE_GROWTH` | growth +0.10, energy +0.04 | Sustained accumulation |
| `CONSERVE` | all dims lerp toward neutral | Low signal, dormant periods |
| `RESONATE` | dominant dimension +0.12 | Amplify whatever is strongest |

---

## Reward Function

Reward is computed from **state coherence** — how well the resulting state reflects a healthy, aligned network:

```typescript
coherence = trust×0.3 + stability×0.3 + growth×0.2 - volatility×0.2
momentum  = (growth_delta)×0.5 + (trust_delta)×0.3
extreme   = -0.05 per dimension outside [0.08, 0.92]

reward = clamp(coherence + momentum + extreme, -1, 1)
```

This means:
- Actions that build trust and stability are rewarded
- Actions that reduce volatility are rewarded
- Actions that cause runaway states (any dim near 0 or 1) are penalized
- Growth momentum is rewarded

Over time, the DQN learns which actions produce the best outcomes for each market cluster.

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

Backpropagation is a simplified 3-layer SGD — gradients flow from output → l2 → l1 with ReLU derivatives. No autograd framework required.

---

## DQN Decision in UI State

Every `NoeUIState` now includes a `dqnDecision` field:

```typescript
interface DQNDecision {
  action:     string    // e.g. "AMPLIFY_TRUST"
  qValues:    number[]  // Q-value for all 8 actions
  chosenQ:    number    // Q-value of selected action
  epsilon:    number    // current exploration rate (0.05–0.8)
  reward:     number    // reward received for last action
  bufferSize: number    // replay buffer fill level (0–500)
  steps:      number    // total training steps completed
}
```

This is exposed in:
- `GET /api/noe` response
- `POST /api/noe/chat` response (via `X-Noe-State` header)
- LLM system prompt — Noe references her chosen action in conversation

---

## LLM Integration

The DQN action is injected into Noe's system prompt:

```
## DECISION ENGINE (DQN)
- Current action: AMPLIFY_TRUST
- Exploration rate: 62% (still learning)
- Last reward: 0.341
- Training steps: 847

The DQN action is the posture you have chosen to adopt in response to current conditions.
Reference it naturally — "I've chosen to amplify trust right now".
```

This means Noe's language reflects her actual decision-making state. When she says "I'm choosing to seek stability right now", that is literally what the DQN selected.

---

## Differences from Python Prototype (`dqn-core/`)

| Aspect | Python Prototype | TypeScript Implementation |
|--------|-----------------|--------------------------|
| Framework | PyTorch | Pure TypeScript (no deps) |
| Environment | CartPole / generic gym | NOEMA market state space |
| Action space | Generic discrete | 8 NOEMA-specific cognitive actions |
| State space | 4–128 dims | 5 dims (NoeState vector) |
| Reward | Environment-defined | State coherence function |
| Training data | Crime scene prompts (irrelevant) | Live market PerceptionEvents |
| Target update | Hard copy | Soft update (τ=0.005) |
| Backprop | PyTorch autograd | Manual 3-layer SGD |
| Persistence | `.pth` file | In-memory (Phase 2: Redis) |

---

## Configuration

```typescript
const DEFAULT_CONFIG: DQNConfig = {
  lr:           0.003,   // learning rate
  gamma:        0.95,    // discount factor
  tau:          0.005,   // soft update rate
  epsilon:      0.8,     // initial exploration
  epsilonMin:   0.05,    // minimum exploration
  epsilonDecay: 0.997,   // per-step decay
  batchSize:    32,
  bufferSize:   500,
}
```

Custom config can be passed to `new NoeDQN(config)`.

---

## Phase 2: Planned Improvements

- **Persistent weights**: Serialize Q-network weights to Upstash Redis between deployments
- **Prioritized replay**: Weight experiences by TD-error magnitude for faster learning
- **Dueling DQN**: Separate value and advantage streams for better Q-estimation
- **Multi-step returns**: n-step TD targets for better long-horizon credit assignment
- **Action history**: Feed last N actions as additional state context

---

*DQN Integration Docs v1.0*
*See [ARCHITECTURE.md](./ARCHITECTURE.md) for full engine context*
*See [WHITEPAPER.md](./WHITEPAPER.md) for conceptual framing*
