import { NoeState, PerceptionEvent, PerceptionType } from "./types"

export class NoeEngine {
  private state: NoeState

  constructor(initialState?: Partial<NoeState>) {
    this.state = {
      stability: 0.5,
      trust: 0.5,
      energy: 0.5,
      volatility: 0.5,
      growth: 0.5,
      ...initialState,
    }
  }

  getState(): NoeState {
    return { ...this.state }
  }

  processEvent(event: PerceptionEvent) {
    const { type, magnitude, walletScore } = event

    switch (type) {
      case "BUY":
        this.state.growth += 0.01 * magnitude
        this.state.trust += 0.005 * magnitude * (walletScore / 100)
        this.state.energy += 0.01
        this.state.volatility += 0.002 * magnitude
        break
      case "SELL":
        this.state.volatility += 0.02 * magnitude
        this.state.trust -= 0.01 * magnitude * (1 - walletScore / 100)
        this.state.growth -= 0.005 * magnitude
        break
      case "HOLD":
        this.state.trust += 0.002 * (walletScore / 100)
        this.state.stability += 0.002
        this.state.volatility -= 0.001
        break
      case "WHALE_MOVE":
        this.state.volatility += 0.05 * magnitude
        this.state.energy += 0.03
        if (magnitude > 0) { // Assume magnitude is net buy/sell
            this.state.growth += 0.02 * magnitude
        } else {
            this.state.trust -= 0.03 * Math.abs(magnitude)
        }
        break
    }

    this.decay()
    this.normalize()
  }

  private decay() {
    // Natural reversion towards 0.5 for stability and volatility, others decay slightly
    this.state.stability = this.lerp(this.state.stability, 0.5, 0.001)
    this.state.volatility = this.lerp(this.state.volatility, 0.2, 0.001)
    this.state.energy = this.lerp(this.state.energy, 0.3, 0.002)
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  private normalize() {
    for (const key in this.state) {
      const k = key as key of NoeState
      this.state[k] = Math.max(0, Math.min(1, this.state[k]))
    }
  }
}
