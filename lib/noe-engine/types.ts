export type PerceptionType = "BUY" | "SELL" | "HOLD" | "WHALE_MOVE"

export interface PerceptionEvent {
  type: PerceptionType
  magnitude: number
  walletScore: number
  timestamp: number
}

export interface NoeState {
  stability: number    // market calm vs chaos (0-1)
  trust: number        // holder loyalty (0-1)
  energy: number       // activity level (0-1)
  volatility: number   // unpredictability (0-1)
  growth: number       // expansion trend (0-1)
}

export interface MemoryEvent {
  label: string
  stateSnapshot: NoeState
  timestamp: number
}

export type NoeExpression = {
  text: string
  visual: {
    eyeBrightness: number
    energyFlow: "smooth" | "fragmented"
    particleDensity: number
    glitchIntensity: number
  }
}
