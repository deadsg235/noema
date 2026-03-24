/**
 * N.O.E — Core Engine v2.1
 *
 * Processing pipeline:
 *   PerceptionEvent
 *     → NoeNeuralNet    (Hebbian feedforward)
 *     → NoeCognition    (cluster detection)
 *     → NoeDQN          (action selection)
 *     → State blending  (neural 55% + cognitive 25% + DQN 20%)
 *     → Temporal decay
 *     → NoeMemory       (short-term buffer + milestone detection)
 *     → NoeState        (the living output)
 *
 * v2.1 additions:
 *   - serialize() / rehydrate() for KV persistence
 *   - getDQNWeights() / setDQNWeights() for snapshot save/restore
 */

import { NoeState, PerceptionEvent, DQNDecision } from "./types"
import { NoeNeuralNet, NeuralNetSnapshot, encodeEvent } from "./neural"
import { NoeCognition, CognitionResult, PatternCluster } from "./cognition"
import { NoeMemory } from "./memory"
import { NoeDQN, applyAction, computeReward, NoeAction } from "./dqn"
import { DQNWeightSnapshot } from "@/lib/persistence"

export interface EngineOutput {
  state:              NoeState
  cognition:          CognitionResult
  neuralSnapshot:     NeuralNetSnapshot
  dqnDecision:        DQNDecision
  milestoneTriggered: string | null
}

const COGNITION_BLEND = 0.25
const DQN_BLEND       = 0.20

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function clamp(v: number): number { return Math.max(0, Math.min(1, v)) }

function blendState(
  neural:    NoeState,
  cognitive: Partial<NoeState>,
  dqnDelta:  Partial<NoeState>,
  cogBlend:  number,
  dqnBlend:  number
): NoeState {
  const keys: (keyof NoeState)[] = ["stability", "trust", "energy", "volatility", "growth"]
  const result = { ...neural }
  for (const k of keys) {
    if (cognitive[k] !== undefined) result[k] = clamp(lerp(result[k], cognitive[k]!, cogBlend))
    if (dqnDelta[k]  !== undefined) result[k] = clamp(lerp(result[k], dqnDelta[k]!,  dqnBlend))
  }
  return result
}

function decay(state: NoeState): NoeState {
  return {
    stability:  clamp(lerp(state.stability,  0.5, 0.003)),
    trust:      clamp(lerp(state.trust,      0.5, 0.002)),
    energy:     clamp(lerp(state.energy,     0.3, 0.004)),
    volatility: clamp(lerp(state.volatility, 0.2, 0.005)),
    growth:     clamp(lerp(state.growth,     0.5, 0.002)),
  }
}

function detectMilestone(prev: NoeState, next: NoeState, cluster: PatternCluster, action: NoeAction): string | null {
  if (cluster === "PANIC"           && next.trust < 0.2)                          return "The Great Exit"
  if (cluster === "EUPHORIA"        && next.energy > 0.85)                        return "The First Surge"
  if (cluster === "CONSOLIDATION"   && next.trust > 0.8)                          return "Stability Phase"
  if (cluster === "WHALE_DOMINANCE" && Math.abs(next.volatility - prev.volatility) > 0.3) return "Whale Event"
  if (cluster === "ACCUMULATION"    && next.growth > 0.75)                        return "Growth Threshold Crossed"
  if (action === "RESONATE"         && next.energy > 0.8)                         return "Resonance Peak"
  if (action === "SEEK_STABILITY"   && next.stability > 0.85)                     return "Deep Stability"
  if (Math.abs(next.energy - prev.energy) > 0.4)                                  return "Energy Spike"
  if (Math.abs(next.trust  - prev.trust)  > 0.35)                                 return "Trust Shift"
  return null
}

export class NoeEngine {
  private net:       NoeNeuralNet
  private cognition: NoeCognition
  readonly memory:   NoeMemory
  private dqn:       NoeDQN

  private state: NoeState = {
    stability:  0.5,
    trust:      0.5,
    energy:     0.3,
    volatility: 0.2,
    growth:     0.5,
  }

  private lastAction: NoeAction = "CONSERVE"
  private lastDQNDecision: DQNDecision = {
    action: "CONSERVE", qValues: new Array(8).fill(0),
    chosenQ: 0, epsilon: 0.8, reward: 0, bufferSize: 0, steps: 0,
  }

  constructor() {
    this.net       = new NoeNeuralNet()
    this.cognition = new NoeCognition()
    this.memory    = new NoeMemory()
    this.dqn       = new NoeDQN()
  }

  getState(): NoeState { return { ...this.state } }
  getDQNDecision(): DQNDecision { return { ...this.lastDQNDecision } }

  // ── Persistence: serialize engine state for KV storage ───────────────────
  serialize() {
    return {
      state:          { ...this.state },
      longTerm:       this.memory.getLongTerm(),
      shortTermSummary: this.memory.summarize(),
      dqnWeights:     this.dqn.getWeights(),
      hebbianWeights: this.net.getHebbianWeights(),
      epsilon:        this.dqn.getEpsilon(),
      steps:          this.dqn.getSteps(),
    }
  }

  // ── Persistence: restore engine from KV snapshot ─────────────────────────
  rehydrate(snap: {
    state: NoeState
    longTerm: ReturnType<NoeMemory["getLongTerm"]>
    dqnWeights: DQNWeightSnapshot
    hebbianWeights?: ReturnType<NoeNeuralNet["getHebbianWeights"]>
    epsilon: number
    steps: number
  }) {
    this.state = { ...snap.state }
    for (const milestone of snap.longTerm) {
      this.memory.addMilestone(milestone.label, milestone.stateSnapshot)
    }
    this.dqn.setWeights(snap.dqnWeights, snap.epsilon, snap.steps)
    if (snap.hebbianWeights) this.net.setHebbianWeights(snap.hebbianWeights)
  }

  processEvent(event: PerceptionEvent): EngineOutput {
    const prevState = { ...this.state }

    const input = encodeEvent(event)
    const { state: neuralState, snapshot } = this.net.forward(input)
    this.net.hebbianUpdate(input)

    this.memory.addEvent(event)

    const recentEvents    = this.memory.getShortTerm()
    const cognitionResult = this.cognition.detectPattern(recentEvents)

    const { action, snapshot: qSnap } = this.dqn.selectAction(this.state)
    const actionDelta = applyAction(this.state, action)

    const blended = blendState(
      neuralState,
      cognitionResult.stateAdjustment,
      actionDelta,
      COGNITION_BLEND,
      DQN_BLEND
    )

    const decayed = decay(blended)

    const reward = computeReward(prevState, decayed)
    this.dqn.observe(prevState, this.lastAction, reward, decayed)

    const milestone = detectMilestone(prevState, decayed, cognitionResult.cluster, action)
    if (milestone) this.memory.addMilestone(milestone, decayed)

    this.state      = decayed
    this.lastAction = action
    this.lastDQNDecision = {
      action,
      qValues:    qSnap.qValues,
      chosenQ:    qSnap.chosenQ,
      epsilon:    this.dqn.getEpsilon(),
      reward,
      bufferSize: this.dqn.getBufferSize(),
      steps:      this.dqn.getSteps(),
    }

    return {
      state:              this.state,
      cognition:          cognitionResult,
      neuralSnapshot:     snapshot,
      dqnDecision:        this.lastDQNDecision,
      milestoneTriggered: milestone,
    }
  }

  tick(): EngineOutput {
    return this.processEvent({
      type: "HOLD", magnitude: 0.1, walletScore: 50, timestamp: Date.now(),
    })
  }

  getNeuralWeights() { return this.net.getWeightSnapshot() }
}
