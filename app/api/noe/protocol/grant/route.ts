import { NextResponse } from "next/server"
import { resolveSession, ProtocolMessage } from "@/lib/noe-protocol"
import { NoeEngine, NoePersonality } from "@/lib/noe-engine"
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
 * POST /api/noe/protocol/grant
 *
 * Step 3 — authenticated agent messaging.
 * Requires a valid session token from /verify.
 *
 * Message types:
 *   PING   — health check, returns state
 *   QUERY  — ask Noe a question, returns LLM reply + state
 *   SIGNAL — inject a PerceptionEvent into the engine
 *   SYNC   — agent shares its state, Noe responds with hers
 *
 * Body: ProtocolMessage
 * Response: ProtocolResponse
 */
export async function POST(req: Request) {
  try {
    const body: ProtocolMessage = await req.json()
    const { token, type, payload } = body

    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 401 })
    }

    const session = resolveSession(token)
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
    }

    const eng = getEngine()
    let lastOutput = eng.tick()
    let reply: string | undefined

    if (type === "SIGNAL" && payload?.event) {
      const { type: evType, magnitude, walletScore } = payload.event
      lastOutput = eng.processEvent({
        type: evType,
        magnitude: Math.min(10, Math.max(0, magnitude)),
        walletScore: Math.min(100, Math.max(0, walletScore)),
        timestamp: Date.now(),
        walletId: `agent:${session.agentId}`,
      })
    }

    if (type === "SYNC" && payload?.agentState) {
      const { energy = 0.5, trust = 0.5 } = payload.agentState
      lastOutput = eng.processEvent({
        type: "HOLD",
        magnitude: Math.min(10, (energy + trust) * 5),
        walletScore: Math.round(trust * 100),
        timestamp: Date.now(),
        walletId: `agent:${session.agentId}`,
      })
    }

    if (type === "QUERY" && payload?.question) {
      const engineState = eng.getState()
      const summary = eng.memory.summarize()
      const memoryNarrative = eng.memory.recallNarrative()
      reply = NoePersonality.generateReply({
        state: engineState,
        cluster: lastOutput.cognition.cluster,
        summary,
        memoryNarrative,
        userInput: `[Agent ${session.agentId}]: ${payload.question}`,
      })
    }

    const noeState = eng.getState()
    const noeMood  = computeMoodFromState(noeState)

    return NextResponse.json({
      noeState,
      noeMood,
      cluster:         lastOutput.cognition.cluster,
      dqnAction:       lastOutput.dqnDecision.action,
      memoryNarrative: eng.memory.recallNarrative(),
      ...(reply !== undefined && { reply }),
      timestamp: Date.now(),
      session: {
        agentId:   session.agentId,
        expiresAt: session.expiresAt,
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
    step: 3,
    action: "POST with { token, type, payload } to interact with Noe",
    types: ["PING", "QUERY", "SIGNAL", "SYNC"],
  }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  })
}
