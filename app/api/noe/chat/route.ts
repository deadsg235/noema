import { NextRequest } from "next/server"
import { NoeEngine, NoePersonality, PerceptionEvent } from "@/lib/noe-engine"
import { computeMoodFromState, NoeUIState } from "@/lib/noe-state"
import { streamNoeResponse, ChatMessage } from "@/lib/noe-llm"
import { PatternCluster } from "@/lib/noe-engine/cognition"

// Share the same engine singleton as the main route
declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
}

function getEngine(): NoeEngine {
  if (!global.__noeEngine) global.__noeEngine = new NoeEngine()
  return global.__noeEngine
}

function generateSignalBatch(count = 3): PerceptionEvent[] {
  const types: PerceptionEvent["type"][] = ["BUY", "SELL", "HOLD", "WHALE_MOVE"]
  const weights = [0.35, 0.25, 0.30, 0.10]
  const cumulative = weights.reduce<number[]>((acc, w, i) => {
    acc.push((acc[i - 1] ?? 0) + w)
    return acc
  }, [])
  return Array.from({ length: count }, () => {
    const r = Math.random()
    const typeIdx = cumulative.findIndex((c) => r <= c)
    return {
      type: types[typeIdx] ?? "HOLD",
      magnitude: Math.random() * 10,
      walletScore: Math.random() * 100,
      timestamp: Date.now(),
      walletId: `0x${Math.random().toString(16).slice(2, 10)}`,
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json() as {
      message: string
      history: ChatMessage[]
    }

    const eng = getEngine()

    const events = generateSignalBatch(4)
    let lastOutput = eng.tick()
    for (const event of events) {
      lastOutput = eng.processEvent(event)
    }

    const engineState = eng.getState()
    const mood = computeMoodFromState(engineState)
    const summary = eng.memory.summarize()
    const memoryNarrative = eng.memory.recallNarrative()
    const cluster = lastOutput.cognition.cluster as PatternCluster

    const expression = NoePersonality.getExpression(engineState)
    const uiState: NoeUIState = {
      mood,
      energy: Math.round(engineState.energy * 100),
      networkSignals: {
        walletActivity:   Math.round(engineState.energy * 100),
        liquidityFlow:    Math.round((engineState.growth - 0.5) * 200),
        collectiveIntent: Math.round(engineState.trust * 100),
      },
      message: NoePersonality.getAmbientMessage(cluster),
      timestamp: Date.now(),
      engineState,
      expression,
      cluster,
      milestoneTriggered: lastOutput.milestoneTriggered,
      memoryNarrative,
    }

    const stream = await streamNoeResponse({
      engineState,
      mood,
      cluster,
      summary,
      memoryNarrative,
      history,
      userInput: message,
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Noe-State": encodeURIComponent(JSON.stringify(uiState)),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[noe/chat]", msg)
    const encoder = new TextEncoder()
    const errStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`Signal disrupted: ${msg}`))
        controller.close()
      },
    })
    return new Response(errStream, {
      status: 200, // keep 200 so the client reads the stream
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}
