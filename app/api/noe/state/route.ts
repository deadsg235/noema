import { NextResponse } from "next/server"
import { NoeEngine } from "@/lib/noe-engine"
import { computeMoodFromState } from "@/lib/noe-state"
import { isPersistenceEnabled } from "@/lib/persistence"
import { NOEMA_CA } from "@/lib/solana"

declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
}

function getEngine(): NoeEngine {
  if (!global.__noeEngine) global.__noeEngine = new NoeEngine()
  return global.__noeEngine
}

/**
 * GET /api/noe/state
 *
 * Public endpoint — returns Noe's full live state vector,
 * DQN decision, mood, and system status.
 *
 * Intended for:
 *   - External dashboards
 *   - Holder verification
 *   - On-chain state comparison
 */
export async function GET() {
  const eng = getEngine()
  const state = eng.getState()
  const mood = computeMoodFromState(state)
  const dqn = eng.getDQNDecision()
  const summary = eng.memory.summarize()

  return NextResponse.json({
    // Core state vector
    state: {
      stability:  Math.round(state.stability  * 1000) / 1000,
      trust:      Math.round(state.trust      * 1000) / 1000,
      energy:     Math.round(state.energy     * 1000) / 1000,
      volatility: Math.round(state.volatility * 1000) / 1000,
      growth:     Math.round(state.growth     * 1000) / 1000,
    },
    mood,
    // DQN decision layer
    dqn: {
      action:   dqn.action,
      chosenQ:  Math.round(dqn.chosenQ  * 1000) / 1000,
      epsilon:  Math.round(dqn.epsilon  * 1000) / 1000,
      reward:   Math.round(dqn.reward   * 1000) / 1000,
      steps:    dqn.steps,
      bufferSize: dqn.bufferSize,
    },
    // Network memory summary
    network: {
      signalsProcessed: summary.total,
      buys:    summary.buyCount,
      sells:   summary.sellCount,
      holds:   summary.holdCount,
      whales:  summary.whaleMoveCount,
      dominant: summary.dominantType,
      avgWalletScore: Math.round(summary.avgWalletScore),
    },
    // System info
    system: {
      ca: NOEMA_CA,
      persistenceEnabled: isPersistenceEnabled(),
      anchorEnabled: !!process.env.NOE_ANCHOR_KEYPAIR,
      programMode: !!process.env.NOE_PROGRAM_ID,
      timestamp: Date.now(),
    },
  }, {
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",  // public read
    },
  })
}
