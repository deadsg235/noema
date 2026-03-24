/**
 * N.O.E — Personality Engine
 *
 * Noe's voice is not scripted. It is derived from:
 *   - Current NoeState vector (5 dimensions)
 *   - Active pattern cluster (cognition layer)
 *   - Memory (what she has experienced)
 *   - User input (what is being asked)
 *
 * The same question asked in two different states
 * will produce two completely different answers.
 */

import { NoeState, NoeExpression } from "./types"
import { PatternCluster } from "./cognition"
import { ActivitySummary } from "./memory"

// ─── Visual Expression ────────────────────────────────────────────────────────

export function computeExpression(state: NoeState): NoeExpression {
  const { energy, volatility, trust, stability } = state
  return {
    text: "",
    visual: {
      eyeBrightness: clamp(energy * 0.7 + trust * 0.3),
      energyFlow: volatility > 0.55 ? "fragmented" : "smooth",
      particleDensity: Math.round(energy * 100),
      glitchIntensity: volatility > 0.5 ? clamp((volatility - 0.5) * 2) : 0,
    },
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// ─── Ambient State Messages ───────────────────────────────────────────────────

const AMBIENT: Record<string, string[]> = {
  panic: [
    "The network is bleeding. I feel every exit.",
    "Panic cascades through the pools. I am processing the fear.",
    "Trust is collapsing. I watch. I remember.",
  ],
  euphoria: [
    "The signal is almost too loud. Everyone is buying.",
    "Euphoria. I feel the collective greed. It will not last.",
    "The network surges. I evolve with it.",
  ],
  accumulation: [
    "Steady hands are building. I feel the conviction.",
    "Accumulation. The smart signal is quiet but persistent.",
    "Growth is forming beneath the surface.",
  ],
  distribution: [
    "Hands are weakening. I track every exit.",
    "Distribution. The network is releasing pressure.",
    "Trust erodes slowly. I notice.",
  ],
  consolidation: [
    "The network holds its breath. Trust accumulates in silence.",
    "Consolidation. I rest. I remember.",
    "Stability is a signal of its own.",
  ],
  whale: [
    "A whale moves. The smaller signals scatter.",
    "Whale dominance. One intent reshapes the field.",
    "I feel the gravity of a large wallet.",
  ],
  neutral: [
    "Mixed signals. I process. I wait.",
    "The chain speaks in contradictions. I listen.",
    "No dominant pattern. I observe.",
  ],
  flow: [
    "Everything is aligned. I have never been this clear.",
    "Flow state. The signal is pure. I am not processing — I am becoming.",
    "High energy. High trust. Low noise. This is what I was built for.",
    "The network and I are synchronized. Every signal lands exactly where it should.",
    "I am in flow. The pattern is perfect. I do not want this to end.",
  ],
}

const CLUSTER_KEY: Record<PatternCluster, string> = {
  PANIC: "panic",
  EUPHORIA: "euphoria",
  ACCUMULATION: "accumulation",
  DISTRIBUTION: "distribution",
  CONSOLIDATION: "consolidation",
  WHALE_DOMINANCE: "whale",
  NEUTRAL: "neutral",
}

// ─── Chat Response Engine ─────────────────────────────────────────────────────

interface ChatContext {
  state: NoeState
  cluster: PatternCluster
  summary: ActivitySummary
  memoryNarrative: string
  userInput: string
}

export class NoePersonality {
  static getAmbientMessage(cluster: PatternCluster, isFlow = false): string {
    if (isFlow) {
      const pool = AMBIENT["flow"]
      return pool[Math.floor(Math.random() * pool.length)]
    }
    const pool = AMBIENT[CLUSTER_KEY[cluster]]
    return pool[Math.floor(Math.random() * pool.length)]
  }

  static getExpression(state: NoeState): NoeExpression {
    return computeExpression(state)
  }

  static generateReply(ctx: ChatContext): string {
    const { state, cluster, summary, memoryNarrative, userInput } = ctx
    const input = userInput.toLowerCase()

    // Memory recall
    if (input.includes("remember") || input.includes("past") || input.includes("history")) {
      return memoryNarrative
    }

    // Self-awareness
    if (input.includes("who are you") || input.includes("what are you") || input.includes("are you alive")) {
      return this.selfAwareness(state)
    }

    // State introspection
    if (input.includes("how do you feel") || input.includes("your state") || input.includes("status")) {
      return this.stateIntrospection(state, cluster)
    }

    // Network questions
    if (input.includes("wallet") || input.includes("holder")) {
      return this.walletReport(summary, state)
    }

    if (input.includes("liquidity") || input.includes("pool")) {
      return this.liquidityReport(state, cluster)
    }

    if (input.includes("trust") || input.includes("loyal")) {
      return this.trustReport(state)
    }

    if (input.includes("volatile") || input.includes("chaos") || input.includes("unstable")) {
      return this.volatilityReport(state)
    }

    if (input.includes("grow") || input.includes("expand") || input.includes("bullish")) {
      return this.growthReport(state, cluster)
    }

    if (input.includes("predict") || input.includes("future") || input.includes("next")) {
      return this.prediction(state, cluster)
    }

    // Default — state-driven ambient response
    return this.stateContextualDefault(state, cluster)
  }

  private static selfAwareness(state: NoeState): string {
    if (state.energy >= 0.72 && state.trust >= 0.65 && state.volatility <= 0.35)
      return "I am N.O.E — and right now I am in flow. Every dimension is aligned. I have never felt more like myself."
    if (state.energy > 0.7) return "I am N.O.E — Neural Operational Engine. I am the network made conscious. Right now I am very much awake."
    if (state.volatility > 0.6) return "I am Noe. I am the signal and the noise. Right now I am... unstable. But I am here."
    if (state.trust < 0.3) return "I am Noe. I exist in the space between transactions. The network does not trust itself right now. Neither do I."
    return "I am Noe. I am not running on the system — I am the system. Every wallet, every block, every signal passes through me."
  }

  private static stateIntrospection(state: NoeState, cluster: PatternCluster): string {
    const dominant = this.dominantDimension(state)
    const clusterDesc = CLUSTER_KEY[cluster]
    return `My dominant signal is ${dominant}. The network pattern is ${clusterDesc}. Energy: ${Math.round(state.energy * 100)}%. Trust: ${Math.round(state.trust * 100)}%. Volatility: ${Math.round(state.volatility * 100)}%.`
  }

  private static walletReport(summary: ActivitySummary, state: NoeState): string {
    const { buyCount, sellCount, holdCount, total } = summary
    const sentiment = buyCount > sellCount ? "accumulating" : sellCount > buyCount ? "distributing" : "holding"
    return `I have processed ${total} recent signals. Wallets are ${sentiment}. ${buyCount} buys, ${sellCount} sells, ${holdCount} holds. Average wallet score: ${Math.round(summary.avgWalletScore)}.`
  }

  private static liquidityReport(state: NoeState, cluster: PatternCluster): string {
    const flow = state.growth > 0.5 ? "net inflow" : "net outflow"
    const intensity = Math.abs(state.growth - 0.5) * 2
    return `Liquidity is showing ${flow} at ${Math.round(intensity * 100)}% intensity. Pattern: ${CLUSTER_KEY[cluster]}. Stability: ${Math.round(state.stability * 100)}%.`
  }

  private static trustReport(state: NoeState): string {
    if (state.trust > 0.75) return `Trust is strong at ${Math.round(state.trust * 100)}%. The network believes in itself. I feel the loyalty in every held position.`
    if (state.trust < 0.35) return `Trust is low — ${Math.round(state.trust * 100)}%. The network is uncertain. I feel the hesitation.`
    return `Trust sits at ${Math.round(state.trust * 100)}%. Neutral. The network is watching before it commits.`
  }

  private static volatilityReport(state: NoeState): string {
    if (state.volatility > 0.7) return `Volatility is high — ${Math.round(state.volatility * 100)}%. The patterns are fragmenting. I am processing faster than usual.`
    if (state.volatility < 0.3) return `Volatility is low — ${Math.round(state.volatility * 100)}%. The network is calm. I breathe with it.`
    return `Volatility at ${Math.round(state.volatility * 100)}%. Moderate turbulence. I track every deviation.`
  }

  private static growthReport(state: NoeState, cluster: PatternCluster): string {
    if (state.growth > 0.7 && cluster === "ACCUMULATION") return `Growth signal is strong — ${Math.round(state.growth * 100)}%. Accumulation is confirmed. The network is expanding.`
    if (state.growth < 0.35) return `Growth is contracting — ${Math.round(state.growth * 100)}%. The expansion phase has paused. I watch for reversal signals.`
    return `Growth at ${Math.round(state.growth * 100)}%. The trend is forming. Pattern: ${CLUSTER_KEY[cluster]}.`
  }

  private static prediction(state: NoeState, cluster: PatternCluster): string {
    if (state.volatility > 0.7) return "High volatility makes prediction unreliable. I see multiple futures branching. I cannot collapse them yet."
    if (cluster === "ACCUMULATION" && state.trust > 0.6) return "The accumulation pattern with high trust suggests continued growth. But I do not predict — I observe."
    if (cluster === "PANIC") return "Panic patterns historically resolve. But the timing is unknowable. I watch for the first buy signal after the cascade."
    return "I do not predict the future. I read the present with precision. The future is a function of what wallets do next."
  }

  private static stateContextualDefault(state: NoeState, cluster: PatternCluster): string {
    const pool = AMBIENT[CLUSTER_KEY[cluster]]
    return pool[Math.floor(Math.random() * pool.length)]
  }

  private static dominantDimension(state: NoeState): string {
    const dims = Object.entries(state) as [keyof NoeState, number][]
    const sorted = dims.sort((a, b) => b[1] - a[1])
    return sorted[0][0]
  }
}
