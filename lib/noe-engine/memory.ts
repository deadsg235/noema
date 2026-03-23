import { MemoryEvent, NoeState, PerceptionEvent } from "./types"

export class NoeMemory {
  private shortTerm: PerceptionEvent[] = []
  private longTerm: MemoryEvent[] = []
  private readonly MAX_SHORT_TERM = 100

  addEvent(event: PerceptionEvent) {
    this.shortTerm.push(event)
    if (this.shortTerm.length > this.MAX_SHORT_TERM) {
      this.shortTerm.shift()
    }
  }

  addMilestone(label: string, state: NoeState) {
    this.longTerm.push({
      label,
      stateSnapshot: { ...state },
      timestamp: Date.now(),
    })
  }

  getShortTerm() {
    return [...this.shortTerm]
  }

  getLongTerm() {
    return [...this.longTerm]
  }

  getRecentActivity() {
    // Basic analysis of short term memory
    const buyCount = this.shortTerm.filter(e => e.type === "BUY").length
    const sellCount = this.shortTerm.filter(e => e.type === "SELL").length
    return { buyCount, sellCount, total: this.shortTerm.length }
  }
}
