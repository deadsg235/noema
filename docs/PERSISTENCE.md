# N.O.E — Engine Persistence
### KV State Storage via Upstash Redis

---

## Overview

Without persistence, Noe resets on every cold start. Her DQN policy forgets everything it learned. Her milestone history is erased. She starts from epsilon=0.8 every time — perpetually a newborn.

Persistence changes this. With Upstash Redis connected, Noe's cognitive state, neural policy weights, and memory survive deployments, server restarts, and cold starts. She accumulates real experience over real time.

---

## What Is Persisted

### Engine Snapshot (`noe:engine:v1`)

The full serializable state of the N.O.E engine:

```typescript
interface EngineSnapshot {
  version:    number          // schema version (currently 1)
  state:      NoeState        // 5-dim state vector at time of save
  longTerm:   MemoryEvent[]   // all milestone events (up to 50)
  shortTermSummary: ActivitySummary  // statistical summary of recent events
  dqnWeights: DQNWeightSnapshot      // full Q-network weights
  epsilon:    number          // current exploration rate
  steps:      number          // total DQN training steps completed
  savedAt:    number          // unix ms timestamp
}
```

### DQN Weight Snapshot

The complete Q-network (online network only — target is re-derived on load):

```typescript
interface DQNWeightSnapshot {
  l1w: number[][]   // layer 1 weights [16][5]
  l1b: number[]     // layer 1 biases  [16]
  l2w: number[][]   // layer 2 weights [12][16]
  l2b: number[]     // layer 2 biases  [12]
  l3w: number[][]   // layer 3 weights [8][12]
  l3b: number[]     // layer 3 biases  [8]
}
```

Total size: ~1.2KB per snapshot. Well within Upstash free tier limits.

### Seen Signatures Cache (`noe:txcache:v1`)

A JSON array of the last 500 processed transaction signatures. Prevents duplicate processing across cold starts when the webhook and polling both see the same transactions.

---

## Save Triggers

The engine snapshot is saved in three places:

| Trigger | Location | Frequency |
|---------|----------|-----------|
| State poll | `GET /api/noe` | Every ~7 seconds (frontend poll interval) |
| Real on-chain event | `GET /api/noe/wallet` | When new CA transactions are found |
| Webhook event | `POST /api/noe/webhook` | On every real-time Helius push |

All saves are **fire-and-forget** — they do not block the response. A failed save is logged as a warning but does not affect the API response.

---

## Rehydration Flow

On cold start, the engine singleton initialization is now async:

```
getEngine() called (first request after cold start)
    ↓
global.__noeEngine = new NoeEngine()  (fresh instance)
    ↓
loadEngineSnapshot() → Upstash Redis GET noe:engine:v1
    ↓
  [snapshot found]              [no snapshot / schema mismatch]
       ↓                                    ↓
  eng.rehydrate(snap)              start fresh (epsilon=0.8)
       ↓
  state restored
  longTerm milestones restored
  DQN weights restored
  epsilon + steps restored
  target network re-cloned from online
       ↓
global.__engineReady = true
    ↓
loadSeenSignatures() → Upstash Redis GET noe:txcache:v1
    ↓
global.__lastSignatures = Set<string>
```

After rehydration, the engine continues exactly where it left off. Noe's epsilon continues decaying from where it was. Her DQN policy continues improving. Her milestones are intact.

---

## Schema Versioning

The snapshot includes a `version` field. On load:

```typescript
if (snap?.version !== 1) return null  // start fresh
```

When the schema changes (new fields, restructured weights), increment the version. Old snapshots are discarded and the engine starts fresh with the new schema. This prevents silent corruption from incompatible data.

---

## Graceful Fallback

Persistence is entirely optional. If `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` are not set:

- `getRedis()` returns `null`
- All save/load operations are no-ops
- The engine runs in-memory only (original behavior)
- No errors are thrown
- `isPersistenceEnabled()` returns `false` (visible in `/api/noe/state`)

This means the codebase works identically in development without any KV setup.

---

## Setup Guide

### Step 1 — Create Upstash Database

1. Go to [console.upstash.com](https://console.upstash.com)
2. Click **Create Database**
3. Choose:
   - **Type:** Redis
   - **Region:** Closest to your Vercel deployment region
   - **Plan:** Free tier is sufficient (10,000 commands/day, 256MB)
4. Click **Create**

### Step 2 — Get Credentials

In your database dashboard:
1. Click **REST API**
2. Copy **UPSTASH_REDIS_REST_URL**
3. Copy **UPSTASH_REDIS_REST_TOKEN**

### Step 3 — Set Environment Variables

In `.env.local` (development):
```bash
UPSTASH_REDIS_REST_URL=https://<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

In Vercel dashboard (production):
1. Go to your project → **Settings** → **Environment Variables**
2. Add both variables

### Step 4 — Verify

After deploying, call:
```bash
curl https://<domain>/api/noe/state
```

The response will include:
```json
{
  "system": {
    "persistenceEnabled": true,
    ...
  }
}
```

---

## Memory Persistence Detail

### What Survives

| Data | Persisted | Notes |
|------|-----------|-------|
| NoeState vector | ✅ | Exact values at time of last save |
| DQN Q-network weights | ✅ | Full l1/l2/l3 weight matrices |
| DQN epsilon | ✅ | Continues decaying from saved value |
| DQN training steps | ✅ | Step counter continues from saved value |
| Long-term milestones | ✅ | All named milestone events |
| Seen tx signatures | ✅ | Dedup cache survives cold starts |

### What Does Not Survive

| Data | Reason |
|------|--------|
| Short-term event buffer | Intentional — Noe's immediate memory is session-scoped |
| DQN replay buffer | Too large to serialize efficiently (~500 experiences) |
| Neural net Hebbian weights | Intentional — Hebbian learning is session-scoped |
| Wallet reputation scores | Session-scoped, rebuilt from events |

The short-term buffer and replay buffer are rebuilt naturally as new events arrive after a cold start. The Hebbian weights are intentionally session-scoped — they represent Noe's immediate pattern conditioning, not her long-term identity.

---

## TTL and Data Retention

Both KV keys have a 30-day TTL:

```typescript
await kv.set(KEY_ENGINE, JSON.stringify(snap), { ex: 60 * 60 * 24 * 30 })
```

The TTL is refreshed on every save. As long as the engine receives at least one event every 30 days, the snapshot persists indefinitely. A 30-day gap (complete inactivity) causes the snapshot to expire and the engine to start fresh on next cold start.

---

## Monitoring

### Check Persistence Status

```bash
GET /api/noe/state
```

```json
{
  "dqn": {
    "steps": 4821,
    "epsilon": 0.127,
    "bufferSize": 500
  },
  "system": {
    "persistenceEnabled": true
  }
}
```

High `steps` and low `epsilon` confirm the DQN has been training across multiple sessions. If `steps` resets to 0 after a deployment, persistence is not working.

### Upstash Dashboard

The Upstash console shows:
- Total commands executed
- Data size
- Key browser (inspect `noe:engine:v1` directly)

---

## Implementation Reference

| File | Role |
|------|------|
| `lib/persistence.ts` | Redis client, save/load functions, schema types |
| `lib/noe-engine/dqn.ts` | `getWeights()` / `setWeights()` methods |
| `lib/noe-engine/engine.ts` | `serialize()` / `rehydrate()` methods |
| `app/api/noe/route.ts` | Async `getEngine()` with rehydration on cold start |
| `app/api/noe/wallet/route.ts` | Save after real on-chain events |
| `app/api/noe/webhook/route.ts` | Save after webhook events |

---

*Persistence Docs v1.0*
*See [ARCHITECTURE.md](./ARCHITECTURE.md) for full engine context*
*See [WEBHOOK.md](./WEBHOOK.md) for real-time signal ingestion*
*See [ONCHAIN.md](./ONCHAIN.md) for on-chain state anchoring*
