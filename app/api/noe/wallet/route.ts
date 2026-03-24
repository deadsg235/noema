import { NextRequest, NextResponse } from "next/server"
import { NoeEngine, NoePersonality } from "@/lib/noe-engine"
import { computeMoodFromState, isInFlowState, NoeUIState } from "@/lib/noe-state"
import {
  fetchRecentSignatures,
  parseTransaction,
  toPerceptionEvents,
  getTokenBalance,
  getSolBalance,
  getConnection,
} from "@/lib/solana"
import { saveEngineSnapshot, loadSeenSignatures, saveSeenSignatures } from "@/lib/persistence"
import { anchorNoeState } from "@/lib/noe-anchor"
import { getTier, getCaps, TIER_LABELS } from "@/lib/noe-tiers"

declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
  // eslint-disable-next-line no-var
  var __engineReady: boolean | undefined
  // eslint-disable-next-line no-var
  var __lastWalletFetch: number | undefined
  // eslint-disable-next-line no-var
  var __lastSignatures: Set<string> | undefined
}

function getEngine(): NoeEngine {
  if (!global.__noeEngine) global.__noeEngine = new NoeEngine()
  return global.__noeEngine
}

async function getSeenSigs(): Promise<Set<string>> {
  if (!global.__lastSignatures) {
    global.__lastSignatures = await loadSeenSignatures()
  }
  return global.__lastSignatures
}

export async function GET() {
  const eng = getEngine()
  const now = Date.now()

  const lastFetch = global.__lastWalletFetch ?? 0
  if (now - lastFetch < 10_000) {
    return NextResponse.json({ skipped: true, reason: "rate_limited" })
  }
  global.__lastWalletFetch = now

  try {
    const conn = getConnection()
    const seenSigs = await getSeenSigs()
    const signatures = await fetchRecentSignatures(25)
    const newSigs = signatures.filter((s) => !seenSigs.has(s.signature))

    if (newSigs.length === 0) {
      return NextResponse.json({ processed: 0, newEvents: 0 })
    }

    const parsed = await Promise.all(
      newSigs.slice(0, 10).map((s) => parseTransaction(conn, s.signature))
    )
    const valid = parsed.filter((t): t is NonNullable<typeof t> => t !== null)

    for (const s of newSigs) seenSigs.add(s.signature)
    saveSeenSignatures(seenSigs).catch(() => {})

    const events = toPerceptionEvents(valid)
    let lastOutput = eng.tick()
    for (const event of events) {
      lastOutput = eng.processEvent(event)
    }

    // Persist after real on-chain events
    if (events.length > 0) {
      const snap = eng.serialize()
      saveEngineSnapshot({ ...snap, version: 2, savedAt: Date.now() }).catch(() => {})
      anchorNoeState(eng.getState()).catch(() => {})
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
      isFlowState: isInFlowState(engineState),
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

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json()
    if (!walletAddress) return NextResponse.json({ error: "No wallet address" }, { status: 400 })

    const [tokenBalance, solBalance] = await Promise.all([
      getTokenBalance(walletAddress),
      getSolBalance(walletAddress),
    ])

    const tier = getTier(tokenBalance)
    const caps = getCaps(tokenBalance)

    const eng = getEngine()
    if (tokenBalance > 0) {
      const holdMagnitude = Math.min(10, Math.log10(tokenBalance + 1))
      eng.processEvent({
        type: "HOLD",
        magnitude: Math.min(10, holdMagnitude * caps.prioritySignal),
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
      tier,
      tierLabel: TIER_LABELS[tier],
      capabilities: caps,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    console.error("[noe/wallet POST]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
