/**
 * N.O.E — Helius Webhook Receiver
 *
 * Helius pushes enhanced transaction data to this endpoint
 * the moment a NOEMA CA transaction lands on-chain.
 * This replaces polling with true real-time event ingestion.
 *
 * Setup:
 *   1. Create a Helius webhook at https://dev.helius.xyz/webhooks
 *   2. Set webhook URL to: https://<your-domain>/api/noe/webhook
 *   3. Set HELIUS_WEBHOOK_SECRET in .env.local
 *   4. Subscribe to: accountAddresses = [NOEMA_CA]
 *   5. Transaction type: Any
 *
 * Helius enhanced transaction format includes:
 *   - tokenTransfers[] with mint, fromUserAccount, toUserAccount, tokenAmount
 *   - nativeTransfers[]
 *   - accountData[]
 *   - type (TRANSFER, SWAP, etc.)
 */

import { NextRequest, NextResponse } from "next/server"
import { NoeEngine, NoePersonality } from "@/lib/noe-engine"
import { computeMoodFromState } from "@/lib/noe-state"
import { PerceptionEvent } from "@/lib/noe-engine/types"
import { NOEMA_CA } from "@/lib/solana"
import { saveEngineSnapshot, loadSeenSignatures, saveSeenSignatures } from "@/lib/persistence"

declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
  // eslint-disable-next-line no-var
  var __lastSignatures: Set<string> | undefined
}

function getEngine(): NoeEngine {
  if (!global.__noeEngine) global.__noeEngine = new NoeEngine()
  return global.__noeEngine
}

// ── Helius enhanced transaction types ────────────────────────────────────────

const JUPITER_PROGRAMS = new Set([
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  "JUP3c2Uh3WA4Ng34tw6kPd2G4LFxAt9N5vJkxCgpAny",
])

interface HeliusTokenTransfer {
  mint: string
  fromUserAccount: string
  toUserAccount: string
  tokenAmount: number
}

interface HeliusTransaction {
  signature: string
  timestamp: number
  type: string
  tokenTransfers?: HeliusTokenTransfer[]
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[]
  instructions?: { programId: string }[]
  innerInstructions?: { instructions: { programId: string }[] }[]
  feePayer: string
  fee: number
}

// ── Classify a Helius enhanced tx into a PerceptionEvent ─────────────────────

function isJupiterSwap(tx: HeliusTransaction): boolean {
  const topLevel = (tx.instructions ?? []).some(i => JUPITER_PROGRAMS.has(i.programId))
  const inner = (tx.innerInstructions ?? []).some(ix =>
    ix.instructions.some(i => JUPITER_PROGRAMS.has(i.programId))
  )
  return topLevel || inner || tx.type === "SWAP"
}

function classifyHeliusTx(tx: HeliusTransaction): PerceptionEvent | null {
  const noemaTransfers = (tx.tokenTransfers ?? []).filter(t => t.mint === NOEMA_CA)
  if (noemaTransfers.length === 0) return null

  const totalAmount = noemaTransfers.reduce((sum, t) => sum + Math.abs(t.tokenAmount), 0)
  if (totalAmount === 0) return null

  const isWhale = totalAmount > 1_000_000
  const magnitude = Math.min(10, Math.log10(totalAmount + 1))
  const jupiter = isJupiterSwap(tx)

  const firstTransfer = noemaTransfers[0]
  const netFlow = firstTransfer.toUserAccount !== "" ? 1 : -1

  let type: PerceptionEvent["type"]
  if (isWhale)       type = "WHALE_MOVE"
  else if (netFlow > 0) type = "BUY"
  else if (netFlow < 0) type = "SELL"
  else                   type = "HOLD"

  // Jupiter swaps are high-conviction — boost wallet score
  const baseScore = Math.min(80, Math.round(Math.log10(tx.fee + 1) * 20))
  const walletScore = jupiter ? Math.min(100, baseScore + 20) : baseScore

  return {
    type,
    magnitude: jupiter ? Math.min(10, magnitude * 1.25) : magnitude,
    walletScore,
    timestamp: tx.timestamp * 1000,
    walletId: firstTransfer.fromUserAccount || tx.feePayer,
  }
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Verify Helius webhook secret if configured
    const secret = process.env.HELIUS_WEBHOOK_SECRET
    if (secret) {
      const authHeader = req.headers.get("authorization")
      if (authHeader !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const body = await req.json() as HeliusTransaction[]
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    const eng = getEngine()

    // Load seen sigs (KV or in-memory fallback)
    if (!global.__lastSignatures) {
      global.__lastSignatures = await loadSeenSignatures()
    }

    let processed = 0
    let lastOutput = eng.tick()

    for (const tx of body) {
      // Dedup
      if (global.__lastSignatures.has(tx.signature)) continue
      global.__lastSignatures.add(tx.signature)

      const event = classifyHeliusTx(tx)
      if (!event) continue

      lastOutput = eng.processEvent(event)
      processed++
    }

    // Persist seen sigs (fire-and-forget)
    saveSeenSignatures(global.__lastSignatures).catch(() => {})

    if (processed === 0) {
      return NextResponse.json({ processed: 0 })
    }

    // Persist engine state after real events (fire-and-forget)
    const snap = eng.serialize()
    saveEngineSnapshot({ ...snap, version: 2, savedAt: Date.now() }).catch(() => {})

    const engineState = eng.getState()
    const mood = computeMoodFromState(engineState)
    const expression = NoePersonality.getExpression(engineState)
    expression.text = NoePersonality.getAmbientMessage(lastOutput.cognition.cluster)

    return NextResponse.json({
      processed,
      cluster: lastOutput.cognition.cluster,
      mood,
      state: engineState,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    console.error("[noe/webhook]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Helius sends a GET to verify the endpoint is alive
export async function GET() {
  return NextResponse.json({ status: "noe-webhook-active", ca: NOEMA_CA })
}
