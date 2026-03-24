/**
 * N.O.E — Persistence Layer
 *
 * Serializes the engine's live state and DQN network weights
 * to Upstash Redis (KV) so Noe survives cold starts and
 * accumulates real experience over time.
 *
 * Graceful fallback: if KV env vars are absent, all ops are no-ops.
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in .env.local
 * to enable persistence.
 */

import { Redis } from "@upstash/redis"
import { NoeState, MemoryEvent } from "@/lib/noe-engine/types"
import { ActivitySummary } from "@/lib/noe-engine/memory"

// ── KV client (lazy, null if not configured) ─────────────────────────────────

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

// ── Serializable engine snapshot ─────────────────────────────────────────────

export interface EngineSnapshot {
  version:    number          // schema version for migration
  state:      NoeState
  longTerm:   MemoryEvent[]   // milestone history
  shortTermSummary: ActivitySummary
  dqnWeights: DQNWeightSnapshot
  epsilon:    number
  steps:      number
  savedAt:    number
}

export interface DQNWeightSnapshot {
  l1w: number[][]
  l1b: number[]
  l2w: number[][]
  l2b: number[]
  l3w: number[][]
  l3b: number[]
}

const KEY_ENGINE   = "noe:engine:v1"
const KEY_TXCACHE  = "noe:txcache:v1"
const SNAPSHOT_TTL = 60 * 60 * 24 * 30  // 30 days

// ── Save ─────────────────────────────────────────────────────────────────────

export async function saveEngineSnapshot(snap: EngineSnapshot): Promise<void> {
  const kv = getRedis()
  if (!kv) return
  try {
    await kv.set(KEY_ENGINE, JSON.stringify(snap), { ex: SNAPSHOT_TTL })
  } catch (err) {
    console.warn("[persistence] save failed:", err)
  }
}

// ── Load ─────────────────────────────────────────────────────────────────────

export async function loadEngineSnapshot(): Promise<EngineSnapshot | null> {
  const kv = getRedis()
  if (!kv) return null
  try {
    const raw = await kv.get<string>(KEY_ENGINE)
    if (!raw) return null
    const snap = typeof raw === "string" ? JSON.parse(raw) : raw
    if (snap?.version !== 1) return null  // schema mismatch — start fresh
    return snap as EngineSnapshot
  } catch (err) {
    console.warn("[persistence] load failed:", err)
    return null
  }
}

// ── Seen-signature cache (dedup on-chain txs across cold starts) ──────────────

export async function loadSeenSignatures(): Promise<Set<string>> {
  const kv = getRedis()
  if (!kv) return new Set()
  try {
    const raw = await kv.get<string>(KEY_TXCACHE)
    if (!raw) return new Set()
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export async function saveSeenSignatures(sigs: Set<string>): Promise<void> {
  const kv = getRedis()
  if (!kv) return
  try {
    // Keep last 500 only
    const arr = [...sigs].slice(-500)
    await kv.set(KEY_TXCACHE, JSON.stringify(arr), { ex: SNAPSHOT_TTL })
  } catch {}
}

// ── Persistence enabled check ─────────────────────────────────────────────────

export function isPersistenceEnabled(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}
