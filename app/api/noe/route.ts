import { NextRequest, NextResponse } from "next/server"
import { computeMoodFromState, getMoodMessage, type NoeState } from "@/lib/noe-state"
import { NoeEngine, NoePersonality, PerceptionEvent } from "@/lib/noe-engine"

// In a real app, this would be persisted in a DB or Redis
let globalEngine = new NoeEngine()

function generateRandomEvent(): PerceptionEvent {
  const types: PerceptionEvent["type"][] = ["BUY", "SELL", "HOLD", "WHALE_MOVE"]
  return {
    type: types[Math.floor(Math.random() * types.length)],
    magnitude: Math.random() * 10,
    walletScore: Math.random() * 100,
    timestamp: Date.now(),
  }
}

function getSystemState(): NoeState {
  const engineState = globalEngine.getState()
  const mood = computeMoodFromState(engineState)
  const expression = NoePersonality.getExpression(engineState)

  return {
    mood,
    energy: Math.round(engineState.energy * 100),
    networkSignals: {
      walletActivity: Math.round(engineState.energy * 100),
      liquidityFlow: Math.round((engineState.growth - 0.5) * 200),
      collectiveIntent: Math.round(engineState.trust * 100),
    },
    message: expression.text,
    timestamp: Date.now(),
    engineState,
    expression,
  }
}

export async function GET() {
  // Simulate an event on every tick for now
  globalEngine.processEvent(generateRandomEvent())
  
  return NextResponse.json(getSystemState())
}

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  // Process a few random events to simulate activity on interaction
  for (let i = 0; i < 3; i++) {
    globalEngine.processEvent(generateRandomEvent())
  }

  const state = getSystemState()

  return NextResponse.json({
    state,
    reply: state.expression.text,
  })
}
