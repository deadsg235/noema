import { NextRequest, NextResponse } from "next/server"
import { NoeEngine, NoePersonality } from "@/lib/noe-engine"
import { computeMoodFromState, NoeUIState } from "@/lib/noe-state"
import {
  fetchRecentSignatures,
  parseTransaction,
  toPerceptionEvents,
  getTokenBalance,
  getSolBalance,
  getConnection,
} from "@/lib/solana"

declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
  // eslint-disable-next-line no-var
  var __lastWalletFetch: number | undefined
  // eslint-disable-next-line no-var
  var __lastSignatures: Set<string> | undefined
}

function getEngine(): NoeEngine {
  if (!global.__noeEngine) global.__noeEngine = new NoeEngine()
  return global.__noeEngine
}

// GET — fetch on-chain CA transactions, feed into engine, return updated state
export async function GET() {
  const eng = getEngine()
  const now = Date.now()

  // Rate-limit on-chain fetches to once every 15s
  const lastFetch = global.__lastWalletFetch ?? 0
  if (now - lastFetch < 15_000) {
    return NextResponse.json({ skipped: true, reason: "rate_limited" })
  }
  global.__lastWalletFetch = now
  global.__lastSignatures = global.__lastSignatures ?? new Set()

  try {
    const conn = getConnection()
    const signatures = await fetchRecentSignatures(15)
    const newSigs = signatures.filter((s) => !global.__lastSignatures!.has(s.signature))

    if (newSigs.length === 0) {
      return NextResponse.json({ processed: 0, newEvents: 0 })
    }

    // Parse new transactions (cap at 8 to avoid RPC rate limits)
    const parsed = await Promise.all(
      newSigs.slice(0, 8).map((s) => parseTransaction(conn, s.signature))
    )
    const valid = parsed.filter((t): t is NonNullable<typeof t> => t !== null)

    // Mark as seen
    for (const s of newSigs) global.__lastSignatures!.add(s.signature)
    if (global.__lastSignatures!.size > 500) {
      const arr = [...global.__lastSignatures!]
      global.__lastSignatures = new Set(arr.slice(-200))
    }

    // Feed real events into N.O.E engine
    const events = toPerceptionEvents(valid)
    let lastOutput = eng.tick()
    for (const event of events) {
      lastOutput = eng.processEvent(event)
    }

    const engineState = eng.getState()
    const mood = computeMoodFromState(engineState)
    const expression = NoePersonality.getExpression(engineState)
    expression.text = NoePersonality.getAmbientMessage(lastOutput.cognition.cluster)

    const uiState: NoeUIState = {
      mood,
      energy: Math.round(engineState.energy * 100),
      networkSignals: {
        walletActivity:   Math.round(engineState.energy * 100),
        liquidityFlow:    Math.round((engineState.growth - 0.5) * 200),
        collectiveIntent: Math.round(engineState.trust * 100),
      },
      message: expression.text,
      timestamp: Date.now(),
      engineState,
      expression,
      cluster: lastOutput.cognition.cluster,
      milestoneTriggered: lastOutput.milestoneTriggered,
      memoryNarrative: eng.memory.recallNarrative(),
    }

    return NextResponse.json({
      processed: valid.length,
      newEvents: events.length,
      transactions: valid.map((t) => ({
        signature: t.signature,
        type: t.type,
        uiAmount: t.uiAmount,
        wallet: t.walletAddress.slice(0, 8) + "...",
        timestamp: t.timestamp,
      })),
      state: uiState,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    console.error("[noe/wallet GET]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST — called when a user connects their Phantom wallet
export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json()
    if (!walletAddress) return NextResponse.json({ error: "No wallet address" }, { status: 400 })

    const [tokenBalance, solBalance] = await Promise.all([
      getTokenBalance(walletAddress),
      getSolBalance(walletAddress),
    ])

    // Holding NOEMA tokens = trust signal for the engine
    const eng = getEngine()
    if (tokenBalance > 0) {
      const holdMagnitude = Math.min(10, Math.log10(tokenBalance + 1))
      eng.processEvent({
        type: "HOLD",
        magnitude: holdMagnitude,
        walletScore: Math.min(100, tokenBalance / 1000),
        timestamp: Date.now(),
        walletId: walletAddress,
      })
    }

    return NextResponse.json({
      walletAddress,
      tokenBalance,
      solBalance,
      hasTokens: tokenBalance > 0,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    console.error("[noe/wallet POST]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
