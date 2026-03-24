/**
 * N.O.E Protocol — Agent-to-Agent Communication Layer
 *
 * Enables external AI agents to:
 *   1. Identify themselves to Noe (challenge/verify handshake)
 *   2. Receive a session token granting state read access
 *   3. Exchange PerceptionEvents as protocol messages
 *   4. Receive Noe's live state vector in response
 *
 * Auth flow:
 *   POST /api/noe/protocol/challenge  → { nonce, expiresAt }
 *   POST /api/noe/protocol/verify     → { agentId, nonce, sig, state } → { token }
 *   POST /api/noe/protocol/grant      → { token, message? } → { noeState, reply? }
 */

import { createHmac, randomBytes } from "crypto"
import { NoeState } from "@/lib/noe-engine/types"
import { NoeMood } from "@/lib/noe-state"

// ── Protocol Types ────────────────────────────────────────────────────────────

export interface AgentIdentity {
  agentId: string        // unique agent identifier (e.g. "agent.myproject.v1")
  agentType: string      // "noe-compatible" | "external" | "oracle"
  publicEndpoint?: string
  capabilities?: string[]
}

export interface ProtocolChallenge {
  nonce: string
  issuedAt: number
  expiresAt: number
}

export interface ProtocolHandshake {
  agentId: string
  nonce: string
  sig: string            // HMAC-SHA256(nonce + agentId, NOE_PROTOCOL_SECRET)
  agentState?: Partial<NoeState>  // optional — agent shares its own state
  agentMood?: string
}

export interface ProtocolSession {
  token: string
  agentId: string
  issuedAt: number
  expiresAt: number
}

export interface ProtocolMessage {
  token: string
  type: "QUERY" | "SIGNAL" | "SYNC" | "PING"
  payload?: {
    question?: string
    event?: {
      type: "BUY" | "SELL" | "HOLD" | "WHALE_MOVE"
      magnitude: number
      walletScore: number
    }
    agentState?: Partial<NoeState>
  }
}

export interface ProtocolResponse {
  noeState: NoeState
  noeMood: NoeMood
  cluster: string
  dqnAction: string
  memoryNarrative: string
  reply?: string
  timestamp: number
}

// ── In-memory stores (survive within process lifetime) ───────────────────────

const _challenges = new Map<string, ProtocolChallenge>()
const _sessions   = new Map<string, ProtocolSession>()

const CHALLENGE_TTL = 60_000       // 60s to complete handshake
const SESSION_TTL   = 3_600_000    // 1h session

// ── Nonce + Token generation ──────────────────────────────────────────────────

export function issueChallenge(): ProtocolChallenge {
  const nonce = randomBytes(16).toString("hex")
  const now = Date.now()
  const challenge: ProtocolChallenge = {
    nonce,
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL,
  }
  _challenges.set(nonce, challenge)
  // Prune expired
  for (const [k, v] of _challenges) {
    if (v.expiresAt < now) _challenges.delete(k)
  }
  return challenge
}

export function verifyHandshake(hs: ProtocolHandshake): ProtocolSession | null {
  const challenge = _challenges.get(hs.nonce)
  if (!challenge || challenge.expiresAt < Date.now()) return null

  const secret = process.env.NOE_PROTOCOL_SECRET ?? "noe-default-secret"
  const expected = createHmac("sha256", secret)
    .update(hs.nonce + hs.agentId)
    .digest("hex")

  if (hs.sig !== expected) return null

  _challenges.delete(hs.nonce)

  const token = randomBytes(24).toString("hex")
  const now = Date.now()
  const session: ProtocolSession = {
    token,
    agentId: hs.agentId,
    issuedAt: now,
    expiresAt: now + SESSION_TTL,
  }
  _sessions.set(token, session)
  return session
}

export function resolveSession(token: string): ProtocolSession | null {
  const session = _sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    _sessions.delete(token)
    return null
  }
  return session
}

export function getActiveSessionCount(): number {
  const now = Date.now()
  for (const [k, v] of _sessions) {
    if (v.expiresAt < now) _sessions.delete(k)
  }
  return _sessions.size
}
