import { NextResponse } from "next/server"
import { NoeEngine, NoePersonality } from "@/lib/noe-engine"
import { computeMoodFromState, isInFlowState } from "@/lib/noe-state"

declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
}

function getEngine(): NoeEngine {
  if (!global.__noeEngine) global.__noeEngine = new NoeEngine()
  return global.__noeEngine
}

export const dynamic = "force-dynamic"

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const interval = setInterval(() => {
        try {
          const eng = getEngine()
          const output = eng.tick()
          const engineState = eng.getState()
          const mood = computeMoodFromState(engineState)
          const isFlow = isInFlowState(engineState)
          const expression = NoePersonality.getExpression(engineState)

          send({
            mood,
            isFlowState: isFlow,
            engineState,
            cluster: output.cognition.cluster,
            dqnDecision: eng.getDQNDecision(),
            milestoneTriggered: output.milestoneTriggered,
            expression,
            timestamp: Date.now(),
          })
        } catch {
          clearInterval(interval)
          controller.close()
        }
      }, 3000)

      // Clean up on disconnect
      const cleanup = () => {
        clearInterval(interval)
        controller.close()
      }

      // Attach cleanup to controller cancel
      return cleanup
    },
    cancel() {
      // interval cleaned up via return value above
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
