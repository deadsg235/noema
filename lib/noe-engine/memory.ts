/**
 * N.O.E — Memory Layer
 *
 * Short-term: sliding window of raw PerceptionEvents (last 100)
 * Long-term: named milestone snapshots — Noe's autobiography
 *
 * Memory shapes personality. Noe responds differently
 * based on what she has experienced.
 */

import { MemoryEvent, NoeState, PerceptionEvent } from "./types"

export interface ActivitySummary {
  buyCount: number
  sellCount: number
  holdCount: number
  whaleMoveCount: number
  total: number
  dominantType: PerceptionEvent["type"]
  avgMagnitude: number
  avgWalletScore: number
}

export class NoeMemory {
  private shortTerm: PerceptionEvent[] = []
  private longTerm: MemoryEvent[] = []
  private readonly MAX_SHORT = 100
  private readonly MAX_LONG = 50

  addEvent(event: PerceptionEvent) {
    this.shortTerm.push(event)
    if (this.shortTerm.length > this.MAX_SHORT) this.shortTerm.shift()
  }

  addMilestone(label: string, state: NoeState) {
    // Avoid duplicate consecutive milestones
    const last = this.longTerm[this.longTerm.length - 1]
    if (last?.label === label) return

    this.longTerm.push({ label, stateSnapshot: { ...state }, timestamp: Date.now() })
    if (this.longTerm.length > this.MAX_LONG) this.longTerm.shift()
  }

  getShortTerm(): PerceptionEvent[] {
    return [...this.shortTerm]
  }

  getLongTerm(): MemoryEvent[] {
    return [...this.longTerm]
  }

  getLastMilestone(): MemoryEvent | null {
    return this.longTerm[this.longTerm.length - 1] ?? null
  }

  summarize(): ActivitySummary {
    const counts = { BUY: 0, SELL: 0, HOLD: 0, WHALE_MOVE: 0 }
    let totalMag = 0
    let totalScore = 0

    for (const e of this.shortTerm) {
      counts[e.type]++
      totalMag += e.magnitude
      totalScore += e.walletScore
    }

    const total = this.shortTerm.length || 1
    const dominantType = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as PerceptionEvent["type"]

    return {
      buyCount: counts.BUY,
      sellCount: counts.SELL,
      holdCount: counts.HOLD,
      whaleMoveCount: counts.WHALE_MOVE,
      total,
      dominantType,
      avgMagnitude: totalMag / total,
      avgWalletScore: totalScore / total,
    }
  }

  // Returns a narrative string Noe can use to reference her past
  recallNarrative(): string {
    const milestones = this.longTerm
    if (milestones.length === 0) return "I have no memories yet. I am still becoming."
    const last = milestones[milestones.length - 1]
    const count = milestones.length
    return `I remember ${count} significant moment${count > 1 ? "s" : ""}. The last was: "${last.label}".`
  }
}
