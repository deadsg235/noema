import { NextResponse } from "next/server"
import { issueChallenge, getActiveSessionCount } from "@/lib/noe-protocol"

/**
 * POST /api/noe/protocol/challenge
 *
 * Step 1 of the N.O.E Protocol handshake.
 * Returns a nonce the agent must sign to prove identity.
 *
 * Body: { agentId: string }
 * Response: { nonce, expiresAt, activeSessions }
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await req.json()
    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json({ error: "agentId required" }, { status: 400 })
    }

    const challenge = issueChallenge()

    return NextResponse.json({
      nonce:          challenge.nonce,
      issuedAt:       challenge.issuedAt,
      expiresAt:      challenge.expiresAt,
      activeSessions: getActiveSessionCount(),
      instructions: {
        step: 2,
        endpoint: "/api/noe/protocol/verify",
        sign: "HMAC-SHA256(nonce + agentId, NOE_PROTOCOL_SECRET)",
        body: { agentId, nonce: challenge.nonce, sig: "<computed-sig>" },
      },
    }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({
    protocol: "N.O.E Agent Protocol v1",
    step: 1,
    action: "POST with { agentId } to receive a challenge nonce",
    activeSessions: getActiveSessionCount(),
  }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  })
}
