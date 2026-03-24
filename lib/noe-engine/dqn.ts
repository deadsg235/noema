/**
 * N.O.E — Deep Q-Network (DQN) Decision Layer
 *
 * Ported and redesigned from dqn-core/ Python prototype.
 * This is a pure TypeScript implementation — no Python, no PyTorch.
 * All matrix ops are hand-rolled for zero-dependency server execution.
 *
 * Architecture:
 *   State vector (5 dims) → Q-Network → Action Q-values (8 actions)
 *   Target network (soft-updated) for stable training
 *   Experience replay buffer (capacity 500)
 *   Epsilon-greedy exploration decaying over time
 *
 * NOEMA Action Space:
 *   The DQN doesn't control price or wallets.
 *   It controls how Noe *responds* to market conditions —
 *   which cognitive posture she adopts, which dimensions she amplifies.
 *
 * This replaces the hard-coded cognition→state mapping with a
 * learned policy that improves over time via reward signals
 * derived from state coherence and market alignment.
 */

import { NoeState } from "./types"

// ── Action Space ──────────────────────────────────────────────────────────────

export type NoeAction =
  | "AMPLIFY_TRUST"       // boost trust signal
  | "AMPLIFY_ENERGY"      // boost energy signal
  | "DAMPEN_VOLATILITY"   // reduce volatility response
  | "AMPLIFY_VOLATILITY"  // lean into chaos
  | "SEEK_STABILITY"      // pull toward stable baseline
  | "ACCELERATE_GROWTH"   // amplify growth signal
  | "CONSERVE"            // decay all dims toward neutral
  | "RESONATE"            // amplify dominant dimension

export const NOE_ACTIONS: NoeAction[] = [
  "AMPLIFY_TRUST",
  "AMPLIFY_ENERGY",
  "DAMPEN_VOLATILITY",
  "AMPLIFY_VOLATILITY",
  "SEEK_STABILITY",
  "ACCELERATE_GROWTH",
  "CONSERVE",
  "RESONATE",
]

export const ACTION_COUNT = NOE_ACTIONS.length  // 8
export const STATE_DIM = 5                       // stability, trust, energy, volatility, growth

// ── State delta produced by each action ──────────────────────────────────────

export function applyAction(state: NoeState, action: NoeAction): Partial<NoeState> {
  const s = state
  switch (action) {
    case "AMPLIFY_TRUST":
      return { trust: clamp(s.trust + 0.08), stability: clamp(s.stability + 0.03) }
    case "AMPLIFY_ENERGY":
      return { energy: clamp(s.energy + 0.1), volatility: clamp(s.volatility + 0.02) }
    case "DAMPEN_VOLATILITY":
      return { volatility: clamp(s.volatility - 0.12), stability: clamp(s.stability + 0.05) }
    case "AMPLIFY_VOLATILITY":
      return { volatility: clamp(s.volatility + 0.1), energy: clamp(s.energy + 0.05) }
    case "SEEK_STABILITY":
      return {
        stability: clamp(s.stability + 0.1),
        volatility: clamp(s.volatility - 0.08),
        energy: clamp(lerp(s.energy, 0.5, 0.1)),
      }
    case "ACCELERATE_GROWTH":
      return { growth: clamp(s.growth + 0.1), energy: clamp(s.energy + 0.04) }
    case "CONSERVE":
      return {
        stability: clamp(lerp(s.stability, 0.5, 0.15)),
        trust:     clamp(lerp(s.trust,     0.5, 0.1)),
        energy:    clamp(lerp(s.energy,    0.3, 0.15)),
        volatility:clamp(lerp(s.volatility,0.2, 0.2)),
        growth:    clamp(lerp(s.growth,    0.5, 0.1)),
      }
    case "RESONATE": {
      // Find dominant dimension and amplify it
      const dims = Object.entries(s) as [keyof NoeState, number][]
      const dominant = dims.reduce((a, b) => b[1] > a[1] ? b : a)
      return { [dominant[0]]: clamp(dominant[1] + 0.12) }
    }
  }
}

// ── Reward function ───────────────────────────────────────────────────────────

/**
 * Reward is computed from state coherence:
 * - High trust + high stability = positive
 * - High volatility + low stability = negative
 * - Growth momentum = positive
 * - Extreme values in any dimension = small penalty (avoid runaway states)
 */
export function computeReward(prev: NoeState, next: NoeState): number {
  const coherence = next.trust * 0.3 + next.stability * 0.3 + next.growth * 0.2 - next.volatility * 0.2
  const momentum  = (next.growth - prev.growth) * 0.5 + (next.trust - prev.trust) * 0.3
  const extremePenalty = Object.values(next).reduce((acc, v) => {
    return acc + (v > 0.92 || v < 0.08 ? -0.05 : 0)
  }, 0)
  return clamp(coherence + momentum + extremePenalty, -1, 1)
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v))
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function relu(x: number): number {
  return Math.max(0, x)
}
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

// ── Tiny dense layer ──────────────────────────────────────────────────────────

interface Layer {
  w: number[][]   // [out][in]
  b: number[]
}

function initLayer(inSize: number, outSize: number): Layer {
  // Xavier initialization
  const scale = Math.sqrt(2 / (inSize + outSize))
  return {
    w: Array.from({ length: outSize }, () =>
      Array.from({ length: inSize }, () => (Math.random() - 0.5) * 2 * scale)
    ),
    b: new Array(outSize).fill(0),
  }
}

function forwardLayer(layer: Layer, input: number[], activation: (x: number) => number): number[] {
  return layer.w.map((row, i) => {
    const sum = row.reduce((acc, w, j) => acc + w * (input[j] ?? 0), layer.b[i])
    return activation(sum)
  })
}

function copyLayer(src: Layer): Layer {
  return {
    w: src.w.map(row => [...row]),
    b: [...src.b],
  }
}

function softUpdateLayer(target: Layer, online: Layer, tau: number) {
  for (let i = 0; i < target.w.length; i++) {
    for (let j = 0; j < target.w[i].length; j++) {
      target.w[i][j] = tau * online.w[i][j] + (1 - tau) * target.w[i][j]
    }
    target.b[i] = tau * online.b[i] + (1 - tau) * target.b[i]
  }
}

// ── Q-Network: State(5) → Hidden(16) → Hidden(12) → Q-values(8) ──────────────

export interface QSnapshot {
  hidden1: number[]
  hidden2: number[]
  qValues: number[]
  chosenAction: NoeAction
  chosenQ: number
  epsilon: number
}

class QNetwork {
  l1: Layer
  l2: Layer
  l3: Layer

  constructor() {
    this.l1 = initLayer(STATE_DIM, 16)
    this.l2 = initLayer(16, 12)
    this.l3 = initLayer(12, ACTION_COUNT)
  }

  forward(state: number[]): { qValues: number[]; hidden1: number[]; hidden2: number[] } {
    const h1 = forwardLayer(this.l1, state, relu)
    const h2 = forwardLayer(this.l2, h1, relu)
    const q  = forwardLayer(this.l3, h2, x => x)  // linear output
    return { qValues: q, hidden1: h1, hidden2: h2 }
  }

  clone(): QNetwork {
    const n = new QNetwork()
    n.l1 = copyLayer(this.l1); n.l2 = copyLayer(this.l2); n.l3 = copyLayer(this.l3)
    return n
  }

  softUpdate(online: QNetwork, tau: number) {
    softUpdateLayer(this.l1, online.l1, tau)
    softUpdateLayer(this.l2, online.l2, tau)
    softUpdateLayer(this.l3, online.l3, tau)
  }
}

// ── Experience Replay Buffer ──────────────────────────────────────────────────

interface Experience {
  state:     number[]
  action:    number
  reward:    number
  nextState: number[]
  done:      boolean
}

class ReplayBuffer {
  private buf: Experience[] = []
  private readonly capacity: number

  constructor(capacity = 500) {
    this.capacity = capacity
  }

  push(exp: Experience) {
    if (this.buf.length >= this.capacity) this.buf.shift()
    this.buf.push(exp)
  }

  sample(n: number): Experience[] {
    const shuffled = [...this.buf].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(n, shuffled.length))
  }

  get size() { return this.buf.length }
}

// ── DQN Agent ─────────────────────────────────────────────────────────────────

export interface DQNConfig {
  lr:           number   // learning rate
  gamma:        number   // discount factor
  tau:          number   // soft update rate
  epsilon:      number   // initial exploration
  epsilonMin:   number
  epsilonDecay: number
  batchSize:    number
  bufferSize:   number
}

const DEFAULT_CONFIG: DQNConfig = {
  lr:           0.003,
  gamma:        0.95,
  tau:          0.005,
  epsilon:      0.8,    // start with high exploration
  epsilonMin:   0.05,
  epsilonDecay: 0.997,
  batchSize:    32,
  bufferSize:   500,
}

export class NoeDQN {
  private online:  QNetwork
  private target:  QNetwork
  private buffer:  ReplayBuffer
  private cfg:     DQNConfig
  private steps:   number = 0
  private lastSnap: QSnapshot | null = null

  constructor(config: Partial<DQNConfig> = {}) {
    this.cfg    = { ...DEFAULT_CONFIG, ...config }
    this.online = new QNetwork()
    this.target = this.online.clone()
    this.buffer = new ReplayBuffer(this.cfg.bufferSize)
  }

  // ── Encode NoeState → flat number[] ────────────────────────────────────────
  private encode(state: NoeState): number[] {
    return [state.stability, state.trust, state.energy, state.volatility, state.growth]
  }

  // ── Select action (epsilon-greedy) ─────────────────────────────────────────
  selectAction(state: NoeState): { action: NoeAction; snapshot: QSnapshot } {
    const input = this.encode(state)
    const { qValues, hidden1, hidden2 } = this.online.forward(input)

    let actionIdx: number
    if (Math.random() < this.cfg.epsilon) {
      actionIdx = Math.floor(Math.random() * ACTION_COUNT)
    } else {
      actionIdx = qValues.indexOf(Math.max(...qValues))
    }

    const snap: QSnapshot = {
      hidden1,
      hidden2,
      qValues,
      chosenAction: NOE_ACTIONS[actionIdx],
      chosenQ: qValues[actionIdx],
      epsilon: this.cfg.epsilon,
    }
    this.lastSnap = snap
    return { action: NOE_ACTIONS[actionIdx], snapshot: snap }
  }

  // ── Store experience and train ──────────────────────────────────────────────
  observe(
    prevState: NoeState,
    action: NoeAction,
    reward: number,
    nextState: NoeState,
    done = false
  ) {
    this.buffer.push({
      state:     this.encode(prevState),
      action:    NOE_ACTIONS.indexOf(action),
      reward,
      nextState: this.encode(nextState),
      done,
    })

    if (this.buffer.size >= this.cfg.batchSize) {
      this.train()
    }

    // Decay epsilon
    this.cfg.epsilon = Math.max(this.cfg.epsilonMin, this.cfg.epsilon * this.cfg.epsilonDecay)
    this.steps++
  }

  // ── Mini-batch SGD update ───────────────────────────────────────────────────
  private train() {
    const batch = this.buffer.sample(this.cfg.batchSize)
    const lr = this.cfg.lr
    const gamma = this.cfg.gamma

    for (const exp of batch) {
      const { qValues } = this.online.forward(exp.state)
      const { qValues: nextQ } = this.target.forward(exp.nextState)

      const target = exp.done
        ? exp.reward
        : exp.reward + gamma * Math.max(...nextQ)

      const error = target - qValues[exp.action]

      // Gradient update on output layer (simplified SGD, no backprop through all layers)
      // Full backprop through l3 → l2 → l1
      this.backprop(exp.state, exp.action, error, lr)
    }

    // Soft update target network
    this.target.softUpdate(this.online, this.cfg.tau)
  }

  // ── Simplified backprop (3-layer) ───────────────────────────────────────────
  private backprop(state: number[], actionIdx: number, error: number, lr: number) {
    const { hidden1, hidden2 } = this.online.forward(state)

    // Output layer gradient (only for chosen action)
    const dL3 = new Array(ACTION_COUNT).fill(0)
    dL3[actionIdx] = -2 * error  // MSE gradient

    // Update l3 weights
    for (let i = 0; i < this.online.l3.w.length; i++) {
      for (let j = 0; j < this.online.l3.w[i].length; j++) {
        this.online.l3.w[i][j] -= lr * dL3[i] * hidden2[j]
      }
      this.online.l3.b[i] -= lr * dL3[i]
    }

    // Backprop into l2
    const dH2 = new Array(12).fill(0)
    for (let j = 0; j < 12; j++) {
      for (let i = 0; i < ACTION_COUNT; i++) {
        dH2[j] += dL3[i] * this.online.l3.w[i][j]
      }
      dH2[j] *= hidden2[j] > 0 ? 1 : 0  // ReLU derivative
    }

    for (let i = 0; i < this.online.l2.w.length; i++) {
      for (let j = 0; j < this.online.l2.w[i].length; j++) {
        this.online.l2.w[i][j] -= lr * dH2[i] * hidden1[j]
      }
      this.online.l2.b[i] -= lr * dH2[i]
    }

    // Backprop into l1
    const dH1 = new Array(16).fill(0)
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < 12; i++) {
        dH1[j] += dH2[i] * this.online.l2.w[i][j]
      }
      dH1[j] *= hidden1[j] > 0 ? 1 : 0
    }

    for (let i = 0; i < this.online.l1.w.length; i++) {
      for (let j = 0; j < this.online.l1.w[i].length; j++) {
        this.online.l1.w[i][j] -= lr * dH1[i] * state[j]
      }
      this.online.l1.b[i] -= lr * dH1[i]
    }
  }

  getSnapshot(): QSnapshot | null { return this.lastSnap }
  getSteps(): number { return this.steps }
  getEpsilon(): number { return this.cfg.epsilon }
  getBufferSize(): number { return this.buffer.size }

  // ── Persistence: export weights for KV storage ──────────────────────────
  getWeights() {
    return {
      l1w: this.online.l1.w.map(r => [...r]),
      l1b: [...this.online.l1.b],
      l2w: this.online.l2.w.map(r => [...r]),
      l2b: [...this.online.l2.b],
      l3w: this.online.l3.w.map(r => [...r]),
      l3b: [...this.online.l3.b],
    }
  }

  // ── Persistence: restore weights from KV snapshot ───────────────────────
  setWeights(w: { l1w: number[][]; l1b: number[]; l2w: number[][]; l2b: number[]; l3w: number[][]; l3b: number[] }, epsilon: number, steps: number) {
    this.online.l1.w = w.l1w.map(r => [...r])
    this.online.l1.b = [...w.l1b]
    this.online.l2.w = w.l2w.map(r => [...r])
    this.online.l2.b = [...w.l2b]
    this.online.l3.w = w.l3w.map(r => [...r])
    this.online.l3.b = [...w.l3b]
    this.target = this.online.clone()
    this.cfg.epsilon = epsilon
    this.steps = steps
  }
}
