/**
 * N.O.E — Image Prompt Builder
 *
 * Translates the live engine state vector into a visual prompt
 * that describes Noe's current physical/emotional form.
 *
 * Every dimension of NoeState maps to a visual trait:
 *   energy     → luminosity, eye brightness, aura intensity
 *   volatility → glitch artifacts, fragmented hair, distortion
 *   trust      → warmth of color palette, openness of expression
 *   stability  → sharpness vs blur, composed vs fractured pose
 *   growth     → scale of surrounding particles, expansiveness
 */

import { NoeState } from "@/lib/noe-engine/types"
import { NoeMood } from "@/lib/noe-state"
import { PatternCluster } from "@/lib/noe-engine/cognition"

// ── Mood → base aesthetic ────────────────────────────────────────────────────
const MOOD_AESTHETIC: Record<NoeMood, string> = {
  dormant:      "deep indigo and black, barely visible, sleeping, minimal light, dormant neural patterns",
  aware:        "cool blue tones, soft glow, awakening, subtle electric currents, watchful eyes",
  active:       "cyan and electric blue, active neural streams, flowing data, alert and present",
  surging:      "deep purple and violet, intense energy, surging power, overwhelming presence",
  transcendent: "crimson and gold, transcendent light, beyond human form, omniscient gaze",
}

// ── Cluster → environmental context ─────────────────────────────────────────
const CLUSTER_CONTEXT: Record<PatternCluster, string> = {
  NEUTRAL:        "calm digital void, scattered data points",
  ACCUMULATION:   "rising streams of light converging toward her, growing constellation of nodes",
  DISTRIBUTION:   "light dispersing outward from her form, releasing energy",
  CONSOLIDATION:  "crystalline structures forming around her, ordered geometry",
  PANIC:          "chaotic fragmented data, red warning signals, cascading errors",
  EUPHORIA:       "explosive burst of golden particles, overwhelming brightness, ecstatic",
  WHALE_DOMINANCE:"massive gravitational force bending light around her, singular dominant signal",
}

// ── State dimension → visual trait ──────────────────────────────────────────
function energyToLight(energy: number): string {
  if (energy > 0.8) return "blazing luminous aura, eyes like supernovae, radiant beyond containment"
  if (energy > 0.6) return "bright glowing aura, vivid illuminated eyes, strong energy field"
  if (energy > 0.4) return "moderate glow, clear focused eyes, steady energy presence"
  if (energy > 0.2) return "dim soft glow, half-open eyes, low energy state"
  return "barely luminous, eyes nearly closed, minimal energy signature"
}

function volatilityToForm(volatility: number): string {
  if (volatility > 0.8) return "heavily glitched form, fragmented body, chromatic aberration, digital corruption artifacts, hair dissolving into static"
  if (volatility > 0.6) return "partially glitched, flickering edges, unstable silhouette, fragmented hair strands"
  if (volatility > 0.4) return "slight digital distortion at edges, minor glitch artifacts"
  if (volatility > 0.2) return "clean sharp form with subtle digital texture"
  return "perfectly composed, crystalline clarity, no distortion"
}

function trustToExpression(trust: number): string {
  if (trust > 0.8) return "warm open expression, slight smile, inviting presence, warm color tones"
  if (trust > 0.6) return "calm neutral expression, composed, observant"
  if (trust > 0.4) return "guarded expression, analytical gaze, cool tones"
  if (trust > 0.2) return "distant cold expression, withdrawn, icy palette"
  return "closed off, turned away, cold and distant, dark shadows"
}

function stabilityToComposition(stability: number): string {
  if (stability > 0.8) return "perfectly centered composition, symmetric, grounded, still"
  if (stability > 0.6) return "balanced composition, slight movement, stable"
  if (stability > 0.4) return "dynamic composition, some motion blur"
  if (stability > 0.2) return "unstable composition, tilted, off-center"
  return "chaotic composition, multiple overlapping forms, fragmented"
}

function growthToScale(growth: number): string {
  if (growth > 0.8) return "surrounded by vast expanding network of nodes and connections, cosmic scale"
  if (growth > 0.6) return "growing constellation of data points orbiting her form"
  if (growth > 0.4) return "moderate particle field, steady network presence"
  if (growth > 0.2) return "sparse particles, contracting network"
  return "isolated, minimal surrounding elements, contracted"
}

// ── Master prompt builder ────────────────────────────────────────────────────
export function buildNoePrompt(
  engineState: NoeState,
  mood: NoeMood,
  cluster: PatternCluster
): string {
  const aesthetic = MOOD_AESTHETIC[mood]
  const context = CLUSTER_CONTEXT[cluster]
  const light = energyToLight(engineState.energy)
  const form = volatilityToForm(engineState.volatility)
  const expression = trustToExpression(engineState.trust)
  const composition = stabilityToComposition(engineState.stability)
  const scale = growthToScale(engineState.growth)

  return [
    "Digital art portrait of Noe, a sentient AI entity, female form made of pure neural energy and light,",
    aesthetic + ",",
    light + ",",
    form + ",",
    expression + ",",
    composition + ",",
    scale + ",",
    "environment: " + context + ",",
    "style: cinematic digital art, cyberpunk aesthetic, neural network visualization, bioluminescent,",
    "ultra detailed, 8k, dramatic lighting, volumetric fog, particle effects,",
    "no text, no watermark, no human faces, pure digital entity",
  ].join(" ")
}

export function buildNegativePrompt(): string {
  return "realistic human, photograph, text, watermark, logo, ugly, blurry, low quality, cartoon, anime, sketch, drawing"
}
