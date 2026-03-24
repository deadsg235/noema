import { NextRequest, NextResponse } from "next/server"
import { NoeEngine, NoePersonality, PerceptionEvent } from "@/lib/noe-engine"
import { computeMoodFromState, isInFlowState, NoeUIState } from "@/lib/noe-state"
import { loadEngineSnapshot, saveEngineSnapshot, loadSeenSignatures, appendStateHistory } from "@/lib/persistence"
import { anchorNoeState } from "@/lib/noe-anchor"

declare global {
  // eslint-disable-next-line no-var
  var __noeEngine: NoeEngine | undefined
  // eslint-disable-next-line no-var
  var __engineReady: boolean | undefined
  // eslint-disable-next-line no-var
  var __lastSignatures: Set<string> | undefined
}

// ── Engine singleton with KV rehydration on cold start ───────────────────────

async function getEngine(): Promise<NoeEngine> {
  if (global.__noeEngine && global.__engineReady) return global.__noeEngine

  const eng = global.__noeEngine ?? new NoeEngine()
  global.__noeEngine = eng

  if (!global.__engineReady) {
    // Attempt to rehydrate from KV
    try {
      const snap = await loadEngineSnapshot()
      if (snap) {
        eng.rehydrate(snap)
        console.log(`[noe] rehydrated from KV — steps: ${snap.steps}, epsilon: ${snap.epsilon.toFixed(3)}`)
      }
    } catch (err) {
      console.warn("[noe] rehydration failed, starting fresh:", err)
    }

    // Load seen signatures into memory
    try {
      global.__lastSignatures = await loadSeenSignatures()
    } catch {}

    global.__engineReady = true
  }

  return eng
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

function buildUIState(eng: NoeEngine, cluster: string, milestone: string | null): NoeUIState {
  const engineState = eng.getState()
  const mood = computeMoodFromState(engineState)
  const flowState = isInFlowState(engineState)
  const expression = NoePersonality.getExpression(engineState)
  expression.text = NoePersonality.getAmbientMessage(cluster as any, flowState)

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
    memoryNarrative: eng.memory.recallNarrative(),
    dqnDecision: eng.getDQNDecision(),
    isFlowState: flowState,
  }
}

export async function GET() {
  const eng = await getEngine()
  const events = generateSignalBatch(3)
  let lastOutput = eng.tick()

  for (const event of events) {
    lastOutput = eng.processEvent(event)
  }

  const uiState = buildUIState(eng, lastOutput.cognition.cluster, lastOutput.milestoneTriggered)

  // Persist engine state (fire-and-forget, every ~7s poll)
  const snap = eng.serialize()
  const uiMood = uiState.mood
  const uiCluster = uiState.cluster
  saveEngineSnapshot({ ...snap, version: 2, savedAt: Date.now() }).catch(() => {})
  appendStateHistory({ state: eng.getState(), mood: uiMood, cluster: uiCluster, savedAt: Date.now() }).catch(() => {})

  // Anchor on-chain (rate-limited internally to every 5 min)
  anchorNoeState(eng.getState()).catch(() => {})

  return NextResponse.json(uiState)
}

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  const eng = await getEngine()

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
