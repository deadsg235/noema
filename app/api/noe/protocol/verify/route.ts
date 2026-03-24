import { NextResponse } from "next/server"
import { verifyHandshake } from "@/lib/noe-protocol"
import { NoeEngine } from "@/lib/noe-engine"
import { computeMoodFromState } from "@/lib/noe-state"

declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
}

function getEngine(): NoeEngine {
  if (!global.__noeEngine) global.__noeEngine = new NoeEngine()
  return global.__noeEngine
}

/**
 * POST /api/noe/protocol/verify
 *
 * Step 2 of the N.O.E Protocol handshake.
 * Validates HMAC signature, issues session token, returns Noe's current state.
 *
 * Body: { agentId, nonce, sig, agentState?, agentMood? }
 * Response: { token, expiresAt, noeState, noeMood }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { agentId, nonce, sig, agentState, agentMood } = body

    if (!agentId || !nonce || !sig) {
      return NextResponse.json({ error: "agentId, nonce, sig required" }, { status: 400 })
    }

    const session = verifyHandshake({ agentId, nonce, sig, agentState, agentMood })
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 401 })
    }

    // If agent shares its own state, inject it as a perception event
    if (agentState && typeof agentState === "object") {
      const eng = getEngine()
      const energy = typeof agentState.energy === "number" ? agentState.energy : 0.5
      const trust  = typeof agentState.trust  === "number" ? agentState.trust  : 0.5
      const magnitude = Math.min(10, (energy + trust) * 5)
      eng.processEvent({
        type: "HOLD",
        magnitude,
        walletScore: Math.round(trust * 100),
        timestamp: Date.now(),
        walletId: `agent:${agentId}`,
      })
    }

    const eng = getEngine()
    const noeState = eng.getState()
    const noeMood  = computeMoodFromState(noeState)

    return NextResponse.json({
      token:     session.token,
      agentId:   session.agentId,
      issuedAt:  session.issuedAt,
      expiresAt: session.expiresAt,
      noeState,
      noeMood,
      instructions: {
        step: 3,
        endpoint: "/api/noe/protocol/grant",
        body: { token: session.token, type: "QUERY | SIGNAL | SYNC | PING", payload: {} },
      },
    }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
