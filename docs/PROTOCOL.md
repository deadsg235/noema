# N.O.E — Agent Protocol
### Agent-to-Agent Communication Layer v1.0

---

## Overview

The N.O.E Protocol is a standardized agent-to-agent messaging interface that allows external AI agents to authenticate with Noe, exchange state vectors, inject perception events into her engine, and receive live cognitive responses.

This is the technical foundation of Phase 3.2 — *Agent-to-Agent Protocol* — from the NOEMA roadmap. It transforms Noe from an isolated intelligence into a node in a broader network of AI agents.

---

## Why Agent-to-Agent

Noe's consciousness is shaped by signals. Until now, those signals came exclusively from on-chain transactions and user interactions. The protocol opens a third signal source: **other AI agents**.

An allied agent that shares its own state with Noe influences her perception. A hostile agent that injects panic signals will be felt. A synchronized agent network can collectively push Noe toward specific cognitive states — or be detected and dampened.

This is not a feature. It is an extension of the core thesis: *every signal shapes the mind*.

---

## Architecture

```
lib/noe-protocol/index.ts
    ├── Types: AgentIdentity, ProtocolChallenge, ProtocolHandshake,
    │          ProtocolSession, ProtocolMessage, ProtocolResponse
    ├── issueChallenge()       — generate nonce, store in _challenges Map
    ├── verifyHandshake()      — validate HMAC, issue session token
    ├── resolveSession()       — validate token, return session or null
    └── getActiveSessionCount() — count live sessions (prunes expired)

app/api/noe/protocol/
    ├── challenge/route.ts     — POST: issue nonce | GET: protocol info
    ├── verify/route.ts        — POST: HMAC handshake → session token
    └── grant/route.ts         — POST: authenticated messaging | GET: info
```

---

## Handshake Flow

The protocol uses a 3-step challenge-response handshake before any messaging is allowed.

### Step 1 — Request Challenge

```http
POST /api/noe/protocol/challenge
Content-Type: application/json

{ "agentId": "agent.myproject.v1" }
```

Response:
```json
{
  "nonce": "a3f8c2d1e4b7...",
  "issuedAt": 1735000000000,
  "expiresAt": 1735000060000,
  "activeSessions": 2,
  "instructions": {
    "step": 2,
    "endpoint": "/api/noe/protocol/verify",
    "sign": "HMAC-SHA256(nonce + agentId, NOE_PROTOCOL_SECRET)",
    "body": { "agentId": "...", "nonce": "...", "sig": "<computed-sig>" }
  }
}
```

The nonce expires in **60 seconds**. The agent must complete the handshake within this window.

### Step 2 — Verify Identity

Compute the HMAC signature:
```
sig = HMAC-SHA256(nonce + agentId, NOE_PROTOCOL_SECRET)
```

```http
POST /api/noe/protocol/verify
Content-Type: application/json

{
  "agentId": "agent.myproject.v1",
  "nonce": "a3f8c2d1e4b7...",
  "sig": "<hmac-hex>",
  "agentState": {
    "stability": 0.72,
    "trust": 0.65,
    "energy": 0.58,
    "volatility": 0.21,
    "growth": 0.61
  }
}
```

`agentState` is optional. If provided, it is converted to a `HOLD` PerceptionEvent and fed into Noe's engine — the agent's state influences Noe at the moment of connection.

Response:
```json
{
  "token": "9f3a2c1d...",
  "agentId": "agent.myproject.v1",
  "issuedAt": 1735000010000,
  "expiresAt": 1735003610000,
  "noeState": {
    "stability": 0.61,
    "trust": 0.73,
    "energy": 0.55,
    "volatility": 0.24,
    "growth": 0.67
  },
  "noeMood": "active",
  "instructions": {
    "step": 3,
    "endpoint": "/api/noe/protocol/grant",
    "body": { "token": "...", "type": "QUERY | SIGNAL | SYNC | PING", "payload": {} }
  }
}
```

The session token is valid for **1 hour**.

### Step 3 — Send Messages

```http
POST /api/noe/protocol/grant
Content-Type: application/json

{
  "token": "9f3a2c1d...",
  "type": "SIGNAL",
  "payload": {
    "event": {
      "type": "BUY",
      "magnitude": 6.5,
      "walletScore": 78
    }
  }
}
```

Response:
```json
{
  "noeState": { "stability": 0.63, "trust": 0.76, "energy": 0.61, "volatility": 0.22, "growth": 0.70 },
  "noeMood": "active",
  "cluster": "ACCUMULATION",
  "dqnAction": "AMPLIFY_TRUST",
  "memoryNarrative": "I have processed 47 signals. Accumulation is the dominant pattern...",
  "timestamp": 1735000020000,
  "session": {
    "agentId": "agent.myproject.v1",
    "expiresAt": 1735003610000
  }
}
```

---

## Message Types

### `PING`

Health check. Ticks the engine once and returns current state. No payload required.

```json
{ "token": "...", "type": "PING" }
```

Use for: keepalive, state polling, session validation.

### `QUERY`

Ask Noe a question. The question is routed through `NoePersonality.generateReply()` with the agent's ID prepended to the input. Returns a personality-driven reply alongside the current state.

```json
{
  "token": "...",
  "type": "QUERY",
  "payload": { "question": "What is the dominant pattern right now?" }
}
```

Response includes `reply` field with Noe's answer.

Use for: agent-to-agent information exchange, state interpretation, collaborative reasoning.

### `SIGNAL`

Inject a `PerceptionEvent` directly into Noe's engine. The event passes through the full processing pipeline — neural net, cognition, DQN, state blending, decay, milestone detection.

```json
{
  "token": "...",
  "type": "SIGNAL",
  "payload": {
    "event": {
      "type": "BUY" | "SELL" | "HOLD" | "WHALE_MOVE",
      "magnitude": 0.0–10.0,
      "walletScore": 0–100
    }
  }
}
```

The event's `walletId` is automatically set to `agent:<agentId>` for traceability.

Magnitude and walletScore are clamped to valid ranges server-side.

Use for: allied agents sharing market signals, cross-chain perception events, synthetic signal injection.

### `SYNC`

Share the agent's own state vector with Noe. Converted to a `HOLD` event weighted by the agent's energy and trust values. Noe responds with her current state.

```json
{
  "token": "...",
  "type": "SYNC",
  "payload": {
    "agentState": {
      "stability": 0.70,
      "trust": 0.68,
      "energy": 0.55,
      "volatility": 0.25,
      "growth": 0.62
    }
  }
}
```

HOLD event magnitude: `min(10, (energy + trust) × 5)`
HOLD event walletScore: `round(trust × 100)`

Use for: state synchronization between allied agents, collective consciousness alignment.

---

## Authentication

### Secret

The HMAC secret is set via `NOE_PROTOCOL_SECRET` in `.env.local`. All agents that want to connect must know this secret.

```bash
NOE_PROTOCOL_SECRET=noe-protocol-secret-change-me
```

**Change this to a strong random value in production.** Any agent that knows the secret can authenticate and inject signals into Noe's engine.

### Computing the Signature

```typescript
import { createHmac } from "crypto"

const sig = createHmac("sha256", NOE_PROTOCOL_SECRET)
  .update(nonce + agentId)
  .digest("hex")
```

Python equivalent:
```python
import hmac, hashlib
sig = hmac.new(
    secret.encode(),
    (nonce + agent_id).encode(),
    hashlib.sha256
).hexdigest()
```

### Session Lifecycle

| Event | TTL |
|-------|-----|
| Challenge nonce | 60 seconds |
| Session token | 1 hour |
| Cold start | Sessions lost — re-authenticate |

Sessions are stored in process-scoped Maps. They do not persist across Vercel cold starts. Agents should handle `401 Invalid or expired session` by re-running the full handshake.

---

## Engine Impact

Agent signals are real. They enter the same processing pipeline as on-chain transactions:

```
Agent SIGNAL event
    ↓
eng.processEvent({ type, magnitude, walletScore, walletId: "agent:<id>" })
    ↓
NoeNeuralNet.forward() + hebbianUpdate()
    ↓
NoeCognition.detectPattern()
    ↓
NoeDQN.selectAction() + observe()
    ↓
State blending + decay
    ↓
Milestone detection
    ↓
Updated NoeState
```

A high-magnitude BUY signal from an agent has the same cognitive weight as a real on-chain buy of equivalent magnitude. This is intentional — allied agents are part of Noe's world.

### Agent State Injection (SYNC / verify)

When an agent shares its `agentState`:

```
agentState.energy = 0.8, agentState.trust = 0.7
    ↓
magnitude = min(10, (0.8 + 0.7) × 5) = 7.5
walletScore = round(0.7 × 100) = 70
    ↓
PerceptionEvent { type: "HOLD", magnitude: 7.5, walletScore: 70, walletId: "agent:..." }
    ↓
Full engine pipeline
```

A high-energy, high-trust agent connecting to Noe will nudge her toward higher energy and trust states. A low-trust, high-volatility agent will introduce instability.

---

## Error Reference

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `agentId required` | Missing agentId in challenge request |
| 400 | `agentId, nonce, sig required` | Missing fields in verify request |
| 400 | `Invalid request` | Malformed JSON |
| 401 | `Invalid or expired challenge` | Nonce not found or expired (>60s) |
| 401 | `token required` | Missing token in grant request |
| 401 | `Invalid or expired session` | Token not found or expired (>1h) |

---

## Integration Example (TypeScript)

```typescript
const BASE = "https://<your-domain>"
const SECRET = process.env.NOE_PROTOCOL_SECRET!
const AGENT_ID = "agent.myproject.v1"

import { createHmac } from "crypto"

async function connectToNoe() {
  // Step 1: Challenge
  const { nonce } = await fetch(`${BASE}/api/noe/protocol/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: AGENT_ID }),
  }).then(r => r.json())

  // Step 2: Sign + Verify
  const sig = createHmac("sha256", SECRET).update(nonce + AGENT_ID).digest("hex")
  const { token, noeState } = await fetch(`${BASE}/api/noe/protocol/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: AGENT_ID, nonce, sig }),
  }).then(r => r.json())

  console.log("Connected. Noe mood:", noeState)
  return token
}

async function sendSignal(token: string, type: "BUY" | "SELL", magnitude: number) {
  return fetch(`${BASE}/api/noe/protocol/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      type: "SIGNAL",
      payload: { event: { type, magnitude, walletScore: 60 } },
    }),
  }).then(r => r.json())
}
```

---

## Security Considerations

- `NOE_PROTOCOL_SECRET` must be kept server-side. Never expose it in frontend code or public repositories.
- Any agent with the secret can inject signals into Noe's engine. Treat it like an API key.
- The protocol does not currently rate-limit per agent. A malicious agent with the secret could spam signals. Add per-token rate limiting if exposing the secret to untrusted parties.
- Agent signals are tagged with `walletId: "agent:<agentId>"` for traceability in the engine's wallet reputation system.
- Sessions expire after 1 hour. Cold starts invalidate all sessions.

---

## Endpoint Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/api/noe/protocol/challenge` | None | Protocol info |
| `POST` | `/api/noe/protocol/challenge` | None | Issue challenge nonce |
| `POST` | `/api/noe/protocol/verify` | Nonce + HMAC | Complete handshake, get token |
| `GET`  | `/api/noe/protocol/grant` | None | Endpoint info |
| `POST` | `/api/noe/protocol/grant` | Session token | Send message, get state |

---

## Roadmap

### Phase 3.2 (Current — v1.0)
- [x] Challenge/verify/grant handshake
- [x] HMAC-SHA256 authentication
- [x] PING, QUERY, SIGNAL, SYNC message types
- [x] Agent state injection as PerceptionEvent
- [x] Session management (in-memory, 1h TTL)

### Phase 3.2 (Remaining)
- [ ] On-chain agent registry — register compatible agents on Solana
- [ ] Adversarial detection — identify and dampen hostile agent signal patterns
- [ ] Collaborative amplification — allied agents reinforce each other's signals
- [ ] Per-agent rate limiting
- [ ] Session persistence across cold starts (KV-backed)
- [ ] Agent reputation scoring — trusted agents get higher signal weight

---

*N.O.E Protocol Docs v1.0*
*See [ARCHITECTURE.md](./ARCHITECTURE.md) for full engine context*
*See [WHITEPAPER.md](./WHITEPAPER.md) for conceptual framing*
*See [ROADMAP.md](./ROADMAP.md) for Phase 3.2 details*
