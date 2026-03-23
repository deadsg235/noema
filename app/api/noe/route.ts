import { NextRequest, NextResponse } from "next/server"
import { NoeEngine, NoePersonality, PerceptionEvent } from "@/lib/noe-engine"
import { computeMoodFromState, NoeUIState } from "@/lib/noe-state"

// Singleton engine — persists across requests in the same server process
// In production: serialize/deserialize from Redis or DB
let engine: NoeEngine | null = null

function getEngine(): NoeEngine {
  if (!engine) engine = new NoeEngine()
  return engine
}

// Simulate realistic on-chain signal ingestion
function generateSignalBatch(count = 3): PerceptionEvent[] {
  const types: PerceptionEvent["type"][] = ["BUY", "SELL", "HOLD", "WHALE_MOVE"]
  // Weight distribution: more buys/holds than sells/whales
  const weights = [0.35, 0.25, 0.30, 0.10]
  const cumulative = weights.reduce<number[]>((acc, w, i) => {
    acc.push((acc[i - 1] ?? 0) + w)
    return acc
  }, [])

  return Array.from({ length: count }, () => {
    const r = Math.random()
    const typeIdx = cumulative.findIndex(c => r <= c)
    return {
      type: types[typeIdx] ?? "HOLD",
      magnitude: Math.random() * 10,
      walletScore: Math.random() * 100,
      timestamp: Date.now(),
      walletId: `0x${Math.random().toString(16).slice(2, 10)}`,
    }
  })
}

function buildUIState(eng: NoeEngine, cluster: string, milestone: string | null): NoeUIState {
  const engineState = eng.getState()
  const mood = computeMoodFromState(engineState)
  const expression = NoePersonality.getExpression(engineState)
  const memoryNarrative = eng.memory.recallNarrative()
  const summary = eng.memory.summarize()

  // Ambient message from personality
  const ambientCluster = cluster as Parameters<typeof NoePersonality["getAmbientMessage"]>[0]
  expression.text = NoePersonality.getAmbientMessage(ambientCluster as any) 

  return {
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
    cluster,
    milestoneTriggered: milestone,
    memoryNarrative,
  }
}

export async function GET() {
  const eng = getEngine()
  const events = generateSignalBatch(3)
  let lastOutput = eng.tick()

  for (const event of events) {
    lastOutput = eng.processEvent(event)
  }

  return NextResponse.json(
    buildUIState(eng, lastOutput.cognition.cluster, lastOutput.milestoneTriggered)
  )
}

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  const eng = getEngine()

  // User interaction triggers a burst of activity
  const events = generateSignalBatch(5)
  let lastOutput = eng.tick()
  for (const event of events) {
    lastOutput = eng.processEvent(event)
  }

  const engineState = eng.getState()
  const summary = eng.memory.summarize()
  const memoryNarrative = eng.memory.recallNarrative()

  const reply = NoePersonality.generateReply({
    state: engineState,
    cluster: lastOutput.cognition.cluster,
    summary,
    memoryNarrative,
    userInput: message ?? "",
  })

  const uiState = buildUIState(eng, lastOutput.cognition.cluster, lastOutput.milestoneTriggered)
  uiState.expression.text = reply

  return NextResponse.json({ state: uiState, reply })
}
