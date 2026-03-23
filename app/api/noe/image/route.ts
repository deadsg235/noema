import { NextRequest, NextResponse } from "next/server"
import { NoeEngine, NoePersonality } from "@/lib/noe-engine"
import { computeMoodFromState } from "@/lib/noe-state"
import { buildNoePrompt, buildNegativePrompt } from "@/lib/noe-image-prompt"
import { PatternCluster } from "@/lib/noe-engine/cognition"

// Re-use the same engine singleton from the main route
// In production this would be a shared module — for now we import state via POST body
const PROVIDER = process.env.NOE_IMAGE_PROVIDER ?? "mock"

// ── Mock provider — returns a deterministic placeholder SVG data URL ─────────
function mockImage(mood: string): string {
  const colors: Record<string, string> = {
    dormant:      "#333366",
    aware:        "#4a7fc1",
    active:       "#40c4ff",
    surging:      "#9333ea",
    transcendent: "#e94560",
  }
  const c = colors[mood] ?? "#333366"
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${c}" stop-opacity="0.8"/>
        <stop offset="60%" stop-color="${c}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#000" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" fill="#0d0d1a"/>
    <circle cx="256" cy="256" r="200" fill="url(#g)"/>
    <circle cx="256" cy="256" r="80" fill="${c}" opacity="0.15"/>
    <circle cx="220" cy="230" r="18" fill="${c}" opacity="0.9"/>
    <circle cx="292" cy="230" r="18" fill="${c}" opacity="0.9"/>
    <text x="256" y="380" text-anchor="middle" fill="${c}" opacity="0.4" font-family="monospace" font-size="14">NOE [${mood.toUpperCase()}]</text>
  </svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

// ── OpenAI DALL-E 3 ──────────────────────────────────────────────────────────
async function generateOpenAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY not set")

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error: ${err}`)
  }

  const data = await res.json()
  return data.data[0].url as string
}

// ── Replicate SDXL ───────────────────────────────────────────────────────────
async function generateReplicate(prompt: string, negative: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error("REPLICATE_API_TOKEN not set")

  // Start prediction
  const startRes = await fetch("https://api.replicate.com/v1/models/stability-ai/sdxl/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "wait=30",
    },
    body: JSON.stringify({
      input: {
        prompt,
        negative_prompt: negative,
        width: 1024,
        height: 1024,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    }),
  })

  if (!startRes.ok) {
    const err = await startRes.text()
    throw new Error(`Replicate error: ${err}`)
  }

  const prediction = await startRes.json()

  // If Prefer: wait didn't resolve it, poll
  if (prediction.status === "succeeded") {
    return prediction.output[0] as string
  }

  // Poll up to 30s
  const pollUrl = prediction.urls?.get
  if (!pollUrl) throw new Error("No poll URL from Replicate")

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const poll = await pollRes.json()
    if (poll.status === "succeeded") return poll.output[0] as string
    if (poll.status === "failed") throw new Error("Replicate prediction failed")
  }

  throw new Error("Replicate timed out")
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { engineState, mood, cluster } = body

    if (!engineState || !mood) {
      return NextResponse.json({ error: "Missing engineState or mood" }, { status: 400 })
    }

    const prompt = buildNoePrompt(engineState, mood, cluster ?? "NEUTRAL")
    const negative = buildNegativePrompt()

    let imageUrl: string

    switch (PROVIDER) {
      case "openai":
        imageUrl = await generateOpenAI(prompt)
        break
      case "replicate":
        imageUrl = await generateReplicate(prompt, negative)
        break
      default:
        // mock — instant, no API key needed
        imageUrl = mockImage(mood)
    }

    return NextResponse.json({ imageUrl, prompt, provider: PROVIDER })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[noe/image]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
