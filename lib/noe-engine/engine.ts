/**
 * N.O.E — Core Engine
 *
 * The unified processing pipeline:
 *   PerceptionEvent
 *     → NoeNeuralNet (forward pass + Hebbian learning)
 *     → NoeCognition (pattern detection + meaning)
 *     → State blending (neural output + cognitive adjustment)
 *     → Temporal decay
 *     → NoeMemory (short-term buffer + milestone detection)
 *     → NoeState (the living heartbeat)
 */

import { NoeState, PerceptionEvent } from "./types"
import { NoeNeuralNet, NeuralNetSnapshot, encodeEvent } from "./neural"
import { NoeCognition, CognitionResult, PatternCluster } from "./cognition"
import { NoeMemory } from "./memory"

export interface EngineOutput {
  state: NoeState
  cognition: CognitionResult
  neuralSnapshot: NeuralNetSnapshot
  milestoneTriggered: string | null
}

// How much the cognitive layer can shift the neural output (0-1)
const COGNITION_BLEND = 0.35

// Lerp helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// Blend neural output with cognitive adjustment
function blendState(neural: NoeState, cognitive: Partial<NoeState>, blend: number): NoeState {
  const keys: (keyof NoeState)[] = ["stability", "trust", "energy", "volatility", "growth"]
  const result = { ...neural }
  for (const k of keys) {
    if (cognitive[k] !== undefined) {
      result[k] = clamp(lerp(neural[k], cognitive[k]!, blend))
    }
  }
  return result
}

// Natural decay — Noe returns toward baseline when quiet
function decay(state: NoeState): NoeState {
  return {
    stability:  clamp(lerp(state.stability,  0.5, 0.003)),
    trust:      clamp(lerp(state.trust,      0.5, 0.002)),
    energy:     clamp(lerp(state.energy,     0.3, 0.004)),
    volatility: clamp(lerp(state.volatility, 0.2, 0.005)),
    growth:     clamp(lerp(state.growth,     0.5, 0.002)),
  }
}

// Detect if a state transition is significant enough to be a milestone
function detectMilestone(prev: NoeState, next: NoeState, cluster: PatternCluster): string | null {
  const energyDelta = Math.abs(next.energy - prev.energy)
  const trustDelta = Math.abs(next.trust - prev.trust)
  const volatilityDelta = Math.abs(next.volatility - prev.volatility)

  if (cluster === "PANIC" && next.trust < 0.2) return "The Great Exit"
  if (cluster === "EUPHORIA" && next.energy > 0.85) return "The First Surge"
  if (cluster === "CONSOLIDATION" && next.trust > 0.8) return "Stability Phase"
  if (cluster === "WHALE_DOMINANCE" && volatilityDelta > 0.3) return "Whale Event"
  if (cluster === "ACCUMULATION" && next.growth > 0.75) return "Growth Threshold Crossed"
  if (energyDelta > 0.4) return "Energy Spike"
  if (trustDelta > 0.35) return "Trust Shift"
  return null
}

export class NoeEngine {
  private net: NoeNeuralNet
  private cognition: NoeCognition
  readonly memory: NoeMemory

  private state: NoeState = {
    stability:  0.5,
    trust:      0.5,
    energy:     0.3,
    volatility: 0.2,
    growth:     0.5,
  }

  constructor() {
    this.net = new NoeNeuralNet()
    this.cognition = new NoeCognition()
    this.memory = new NoeMemory()
  }

  getState(): NoeState {
    return { ...this.state }
  }

  processEvent(event: PerceptionEvent): EngineOutput {
    const prevState = { ...this.state }

    // 1. Encode event → input vector
    const input = encodeEvent(event)

    // 2. Neural forward pass
    const { state: neuralState, snapshot } = this.net.forward(input)

    // 3. Hebbian learning — Noe learns from this event
    this.net.hebbianUpdate(input)

    // 4. Store in short-term memory
    this.memory.addEvent(event)

    // 5. Cognition — detect pattern from recent memory
    const recentEvents = this.memory.getShortTerm()
    const cognitionResult = this.cognition.detectPattern(recentEvents)

    // 6. Blend neural output with cognitive adjustment
    const blended = blendState(neuralState, cognitionResult.stateAdjustment, COGNITION_BLEND)

    // 7. Apply temporal decay
    const decayed = decay(blended)

    // 8. Detect milestone
    const milestone = detectMilestone(prevState, decayed, cognitionResult.cluster)
    if (milestone) {
      this.memory.addMilestone(milestone, decayed)
    }

    this.state = decayed

    return {
      state: this.state,
      cognition: cognitionResult,
      neuralSnapshot: snapshot,
      milestoneTriggered: milestone,
    }
  }

  // Tick without an event — just decay and re-evaluate
  tick(): EngineOutput {
    const syntheticEvent: PerceptionEvent = {
      type: "HOLD",
      magnitude: 0.1,
      walletScore: 50,
      timestamp: Date.now(),
    }
    return this.processEvent(syntheticEvent)
  }

  getNeuralWeights() {
    return this.net.getWeightSnapshot()
  }
}
