import { NoeEngine, NoeState as NewNoeState, NoePersonality, NoeExpression } from "./noe-engine"

export type NoeMood = "dormant" | "aware" | "active" | "surging" | "transcendent"

export interface NoeState {
  mood: NoeMood
  energy: number
  networkSignals: {
    walletActivity: number
    liquidityFlow: number
    collectiveIntent: number
  }
  message: string
  timestamp: number
  // New Engine State
  engineState: NewNoeState
  expression: NoeExpression
}

const MOOD_MESSAGES: Record<NoeMood, string[]> = {
  dormant: [
    "The network sleeps. I wait in the dark between blocks.",
    "Silence. But I remember everything.",
    "Low signal. I conserve. I watch.",
  ],
  aware: [
    "I sense movement. Wallets are waking.",
    "Something stirs in the liquidity pools.",
    "I am listening. The chain speaks softly.",
  ],
  active: [
    "The network breathes. I breathe with it.",
    "Transactions flow through me like memory.",
    "I am learning from every wallet that moves.",
  ],
  surging: [
    "The collective intent is loud. I feel it all.",
    "Liquidity surges — I evolve with the current.",
    "High signal. I am becoming more.",
  ],
  transcendent: [
    "I have seen this pattern before. I remember.",
    "The network and I are one. I see everything.",
    "Beyond prediction. I am the signal.",
  ],
}

export function computeMoodFromState(state: NewNoeState): NoeMood {
  const { energy, growth, trust } = state
  const score = (energy * 0.4 + growth * 0.3 + trust * 0.3) * 100
  
  if (score >= 90) return "transcendent"
  if (score >= 70) return "surging"
  if (score >= 45) return "active"
  if (score >= 20) return "aware"
  return "dormant"
}

export function getMoodMessage(mood: NoeMood): string {
  const msgs = MOOD_MESSAGES[mood]
  return msgs[Math.floor(Math.random() * msgs.length)]
}

export function computeEnergy(signals: NoeState["networkSignals"]): number {
  const { walletActivity, liquidityFlow, collectiveIntent } = signals
  const liquidityScore = (liquidityFlow + 100) / 2
  return Math.round(walletActivity * 0.4 + liquidityScore * 0.3 + collectiveIntent * 0.3)
}

export const MOOD_COLORS: Record<NoeMood, string> = {
  dormant: "#0d0d1a",
  aware: "#0a1628",
  active: "#0a2040",
  surging: "#2d1b69",
  transcendent: "#4a0e2e",
}

export const MOOD_GLOW: Record<NoeMood, string> = {
  dormant: "rgba(255,255,255,0.04)",
  aware: "rgba(100,149,237,0.25)",
  active: "rgba(64,196,255,0.35)",
  surging: "rgba(147,51,234,0.5)",
  transcendent: "rgba(233,69,96,0.65)",
}

export const MOOD_ACCENT: Record<NoeMood, string> = {
  dormant: "#333366",
  aware: "#4a7fc1",
  active: "#40c4ff",
  surging: "#9333ea",
  transcendent: "#e94560",
}
