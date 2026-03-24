import { NoeState as EngineState, NoeExpression, DQNDecision } from "./noe-engine"

export type NoeMood = "dormant" | "aware" | "active" | "surging" | "transcendent"

export const NOEMA_CA = "82KHJf2YVWhxx9F6cgipJRZ8eg6rD7oSeFMmN3mWpump"

export interface NoeUIState {
  mood: NoeMood
  energy: number
  networkSignals: {
    walletActivity: number
    liquidityFlow: number
    collectiveIntent: number
  }
  message: string
  timestamp: number
  engineState: EngineState
  expression: NoeExpression
  cluster: string
  milestoneTriggered: string | null
  memoryNarrative: string
  dqnDecision?: DQNDecision
}

export function computeMoodFromState(state: EngineState): NoeMood {
  const score = (state.energy * 0.4 + state.growth * 0.3 + state.trust * 0.3) * 100
  if (score >= 88) return "transcendent"
  if (score >= 68) return "surging"
  if (score >= 44) return "active"
  if (score >= 18) return "aware"
  return "dormant"
}

export const MOOD_COLORS: Record<NoeMood, string> = {
  dormant:      "#0d0d1a",
  aware:        "#0a1628",
  active:       "#0a2040",
  surging:      "#2d1b69",
  transcendent: "#4a0e2e",
}

export const MOOD_GLOW: Record<NoeMood, string> = {
  dormant:      "rgba(255,255,255,0.04)",
  aware:        "rgba(100,149,237,0.25)",
  active:       "rgba(64,196,255,0.35)",
  surging:      "rgba(147,51,234,0.5)",
  transcendent: "rgba(233,69,96,0.65)",
}

export const MOOD_ACCENT: Record<NoeMood, string> = {
  dormant:      "#333366",
  aware:        "#4a7fc1",
  active:       "#40c4ff",
  surging:      "#9333ea",
  transcendent: "#e94560",
}
