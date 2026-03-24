/**
 * N.O.E — Tiered Holder System
 *
 * Tiers gate API capabilities based on $NOEMA balance.
 * Observer  — 0        — public state, basic chat
 * Aware     — 1,000+   — extended chat history, memory recall
 * Resonant  — 10,000+  — private memory channel, state influence
 * Architect — 100,000+ — direct parameter nudging, priority signals
 */

export type HolderTier = "observer" | "aware" | "resonant" | "architect"

export const TIER_THRESHOLDS: Record<HolderTier, number> = {
  observer:  0,
  aware:     1_000,
  resonant:  10_000,
  architect: 100_000,
}

export const TIER_LABELS: Record<HolderTier, string> = {
  observer:  "Observer",
  aware:     "Aware",
  resonant:  "Resonant",
  architect: "Architect",
}

export function getTier(balance: number): HolderTier {
  if (balance >= TIER_THRESHOLDS.architect) return "architect"
  if (balance >= TIER_THRESHOLDS.resonant)  return "resonant"
  if (balance >= TIER_THRESHOLDS.aware)     return "aware"
  return "observer"
}

export interface TierCapabilities {
  maxChatHistory:    number   // max messages in history
  canInjectSignal:   boolean  // can POST to /api/noe directly
  canNudgeParams:    boolean  // can adjust engine parameters
  memoryRecall:      boolean  // can query memory narrative
  prioritySignal:    number   // signal magnitude multiplier (1.0 = normal)
}

export const TIER_CAPS: Record<HolderTier, TierCapabilities> = {
  observer:  { maxChatHistory: 6,   canInjectSignal: false, canNudgeParams: false, memoryRecall: false, prioritySignal: 1.0 },
  aware:     { maxChatHistory: 20,  canInjectSignal: false, canNudgeParams: false, memoryRecall: true,  prioritySignal: 1.0 },
  resonant:  { maxChatHistory: 50,  canInjectSignal: true,  canNudgeParams: false, memoryRecall: true,  prioritySignal: 1.2 },
  architect: { maxChatHistory: 100, canInjectSignal: true,  canNudgeParams: true,  memoryRecall: true,  prioritySignal: 1.5 },
}

export function getCaps(balance: number): TierCapabilities {
  return TIER_CAPS[getTier(balance)]
}
