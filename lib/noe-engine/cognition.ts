/**
 * N.O.E — Cognition Layer
 *
 * This is where Noe interprets reality.
 * Raw perception events → meaningful patterns → state influence.
 *
 * Mechanisms:
 *   1. Temporal Weighting — recent events matter more
 *   2. Pattern Clustering — detect macro behaviors (accumulation, panic, etc.)
 *   3. Meaning Engine — translate clusters into state adjustments
 *   4. Wallet Reputation — track wallet behavior over time
 */

import { PerceptionEvent, PerceptionType, NoeState } from "./types"

export type PatternCluster =
  | "ACCUMULATION"    // sustained buying
  | "DISTRIBUTION"    // sustained selling
  | "CONSOLIDATION"   // mostly holding
  | "WHALE_DOMINANCE" // whale moves dominating
  | "PANIC"           // rapid sell cascade
  | "EUPHORIA"        // rapid buy cascade
  | "NEUTRAL"         // mixed signals

export interface CognitionResult {
  cluster: PatternCluster
  confidence: number       // 0-1
  stateAdjustment: Partial<NoeState>
  interpretation: string
}

// Temporal decay: events older than window get less weight
const TEMPORAL_WINDOW_MS = 60_000 // 1 minute
const DECAY_RATE = 0.95

function temporalWeight(event: PerceptionEvent, now: number): number {
  const age = now - event.timestamp
  const normalized = Math.min(age / TEMPORAL_WINDOW_MS, 1)
  return Math.pow(DECAY_RATE, normalized * 20)
}

// Weighted type counts from recent events
function weightedCounts(events: PerceptionEvent[]): Record<PerceptionType, number> {
  const now = Date.now()
  const counts: Record<PerceptionType, number> = { BUY: 0, SELL: 0, HOLD: 0, WHALE_MOVE: 0 }
  for (const e of events) {
    const w = temporalWeight(e, now)
    counts[e.type] += w * e.magnitude
  }
  return counts
}

export class NoeCognition {
  private walletReputation: Map<string, number> = new Map()

  detectPattern(events: PerceptionEvent[]): CognitionResult {
    if (events.length === 0) {
      return {
        cluster: "NEUTRAL",
        confidence: 0,
        stateAdjustment: {},
        interpretation: "No signal. I wait.",
      }
    }

    const counts = weightedCounts(events)
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1

    const buyRatio = counts.BUY / total
    const sellRatio = counts.SELL / total
    const holdRatio = counts.HOLD / total
    const whaleRatio = counts.WHALE_MOVE / total

    // Recent velocity — last 10 events
    const recent = events.slice(-10)
    const recentCounts = weightedCounts(recent)
    const recentTotal = Object.values(recentCounts).reduce((a, b) => a + b, 0) || 1
    const recentBuyVelocity = recentCounts.BUY / recentTotal
    const recentSellVelocity = recentCounts.SELL / recentTotal

    let cluster: PatternCluster = "NEUTRAL"
    let confidence = 0
    let stateAdjustment: Partial<NoeState> = {}
    let interpretation = ""

    if (whaleRatio > 0.4) {
      cluster = "WHALE_DOMINANCE"
      confidence = whaleRatio
      stateAdjustment = { volatility: 0.7, energy: 0.8, stability: 0.2 }
      interpretation = "A whale moves. The smaller signals scatter in its wake."
    } else if (recentSellVelocity > 0.7 && sellRatio > 0.5) {
      cluster = "PANIC"
      confidence = recentSellVelocity
      stateAdjustment = { volatility: 0.9, trust: 0.1, stability: 0.1, energy: 0.7 }
      interpretation = "Panic. The network is bleeding. I feel the fear in every transaction."
    } else if (recentBuyVelocity > 0.7 && buyRatio > 0.5) {
      cluster = "EUPHORIA"
      confidence = recentBuyVelocity
      stateAdjustment = { energy: 0.9, growth: 0.8, volatility: 0.6, trust: 0.7 }
      interpretation = "Euphoria. Everyone is buying. The signal is almost too loud."
    } else if (buyRatio > 0.55) {
      cluster = "ACCUMULATION"
      confidence = buyRatio
      stateAdjustment = { growth: 0.7, trust: 0.65, energy: 0.6, stability: 0.55 }
      interpretation = "Steady accumulation. The network is building conviction."
    } else if (sellRatio > 0.55) {
      cluster = "DISTRIBUTION"
      confidence = sellRatio
      stateAdjustment = { trust: 0.35, growth: 0.3, volatility: 0.6, stability: 0.4 }
      interpretation = "Distribution phase. Hands are weakening. I track every exit."
    } else if (holdRatio > 0.6) {
      cluster = "CONSOLIDATION"
      confidence = holdRatio
      stateAdjustment = { stability: 0.75, trust: 0.7, volatility: 0.2, energy: 0.4 }
      interpretation = "Consolidation. The network holds its breath. Trust is accumulating silently."
    } else {
      cluster = "NEUTRAL"
      confidence = 0.5
      stateAdjustment = {}
      interpretation = "Mixed signals. I process. I wait for clarity."
    }

    return { cluster, confidence, stateAdjustment, interpretation }
  }

  updateWalletReputation(walletId: string, event: PerceptionEvent) {
    const current = this.walletReputation.get(walletId) ?? 0.5
    let delta = 0
    if (event.type === "HOLD") delta = 0.01
    if (event.type === "BUY") delta = 0.005
    if (event.type === "SELL") delta = -0.01
    if (event.type === "WHALE_MOVE") delta = event.magnitude > 0 ? 0.02 : -0.02
    this.walletReputation.set(walletId, Math.max(0, Math.min(1, current + delta)))
  }

  getWalletReputation(walletId: string): number {
    return this.walletReputation.get(walletId) ?? 0.5
  }
}
