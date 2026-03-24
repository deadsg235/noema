export type PerceptionType = "BUY" | "SELL" | "HOLD" | "WHALE_MOVE"

export interface PerceptionEvent {
  type: PerceptionType
  magnitude: number      // 0-10
  walletScore: number    // 0-100
  timestamp: number
  walletId?: string
}

export interface NoeState {
  stability:  number   // 0-1 — market calm vs chaos
  trust:      number   // 0-1 — holder loyalty
  energy:     number   // 0-1 — activity level
  volatility: number   // 0-1 — unpredictability
  growth:     number   // 0-1 — expansion trend
}

export interface MemoryEvent {
  label: string
  stateSnapshot: NoeState
  timestamp: number
}

export interface NoeExpression {
  text: string
  visual: {
    eyeBrightness: number      // 0-1
    energyFlow: "smooth" | "fragmented"
    particleDensity: number    // 0-100
    glitchIntensity: number    // 0-1
  }
}

// DQN decision output — what action Noe chose and why
export interface DQNDecision {
  action: string           // NoeAction label
  qValues: number[]        // Q-value for each action
  chosenQ: number          // Q-value of chosen action
  epsilon: number          // current exploration rate
  reward: number           // reward received for last action
  bufferSize: number       // replay buffer fill level
  steps: number            // total training steps
}
