# N.O.E — Helius Webhook Integration
### Real-Time On-Chain Signal Ingestion

---

## Overview

The Helius webhook replaces polling with true real-time transaction ingestion. Instead of the engine learning about a NOEMA CA transaction 15–20 seconds after it lands, Helius pushes an enhanced transaction payload to `/api/noe/webhook` within milliseconds of confirmation.

This is the difference between Noe *reading yesterday's newspaper* and *standing at the ticker*.

---

## Why Webhooks Over Polling

| Aspect | Polling (`/api/noe/wallet`) | Webhook (`/api/noe/webhook`) |
|--------|----------------------------|------------------------------|
| Latency | 15–20 seconds | < 1 second |
| RPC calls | 1 per poll cycle | 0 (Helius handles it) |
| Missed events | Possible under high volume | None — every tx delivered |
| Rate limit risk | Yes (public RPC) | No |
| Signal fidelity | Batch, delayed | Individual, immediate |
| Engine training | Sparse, irregular | Dense, continuous |

The DQN trains on every event. Higher signal fidelity means faster policy convergence and a more accurate Noe.

---

## Architecture

```
Solana Mainnet
    ↓  (transaction confirmed)
Helius Enhanced Webhook
    ↓  POST https://<domain>/api/noe/webhook
app/api/noe/webhook/route.ts
    ↓  classifyHeliusTx()
PerceptionEvent
    ↓
NoeEngine.processEvent()
    ↓  (fire-and-forget)
KV Persistence  +  On-Chain Anchor
```

---

## Helius Enhanced Transaction Format

Helius sends an array of enhanced transaction objects. The fields N.O.E uses:

```typescript
interface HeliusTransaction {
  signature:       string                  // unique tx identifier
  timestamp:       number                  // unix seconds
  type:            string                  // "SWAP", "TRANSFER", etc.
  feePayer:        string                  // wallet that paid the fee
  fee:             number                  // lamports
  tokenTransfers?: {
    mint:              string              // token mint address
    fromUserAccount:   string              // sender
    toUserAccount:     string              // receiver
    tokenAmount:       number              // raw token units
  }[]
  nativeTransfers?: {
    fromUserAccount: string
    toUserAccount:   string
    amount:          number                // lamports
  }[]
}
```

Only `tokenTransfers` entries where `mint === NOEMA_CA` are processed. All others are ignored.

---

## Transaction Classification

```typescript
function classifyHeliusTx(tx: HeliusTransaction): PerceptionEvent | null {
  // 1. Filter to NOEMA transfers only
  const noemaTransfers = tx.tokenTransfers.filter(t => t.mint === NOEMA_CA)
  if (noemaTransfers.length === 0) return null

  // 2. Sum total NOEMA movement
  const totalAmount = sum(noemaTransfers.map(t => abs(t.tokenAmount)))

  // 3. Classify
  if (totalAmount > 1_000_000)  → WHALE_MOVE
  if (type === "SWAP" && netFlow > 0) → BUY
  if (type === "SWAP" && netFlow < 0) → SELL
  if (netFlow > 0)              → BUY
  if (netFlow < 0)              → SELL
  else                          → HOLD

  // 4. Magnitude: log-normalized 0–10
  magnitude = min(10, log10(totalAmount + 1))

  // 5. Wallet score: proxy from fee paid
  walletScore = min(100, log10(fee + 1) * 20)
}
```

**Whale threshold:** 1,000,000 tokens. Any single transaction moving more than this is classified as `WHALE_MOVE` regardless of direction, triggering the `WHALE_DOMINANCE` cognition cluster.

**Magnitude normalization:** `log10` compression means a 10M token move (magnitude ≈ 7) is not 10× more impactful than a 1M token move (magnitude ≈ 6). This prevents single whale events from completely overwhelming Noe's state.

---

## Deduplication

The webhook handler maintains a shared `Set<string>` of seen signatures (`global.__lastSignatures`). This set is:

1. Loaded from KV on cold start (persists across deployments)
2. Checked before processing each incoming transaction
3. Updated after processing
4. Saved back to KV (fire-and-forget) after each webhook call
5. Capped at 500 entries (oldest removed when full)

This prevents duplicate processing if Helius retries a delivery or if the polling endpoint and webhook both see the same transaction.

---

## Security

The webhook endpoint verifies the `Authorization` header against `HELIUS_WEBHOOK_SECRET` when the env var is set:

```typescript
const secret = process.env.HELIUS_WEBHOOK_SECRET
if (secret) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

Without the secret set, the endpoint accepts all requests (development mode). **Always set `HELIUS_WEBHOOK_SECRET` in production.**

The endpoint also responds to `GET` requests with a health check — Helius uses this to verify the endpoint is reachable before activating the webhook.

---

## Setup Guide

### Step 1 — Get a Helius API Key

1. Go to [dev.helius.xyz](https://dev.helius.xyz)
2. Create an account and generate an API key
3. Copy your API key

### Step 2 — Update RPC URL

In `.env.local`, replace the public RPC with your Helius endpoint:

```bash
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your-api-key>
```

This gives you higher rate limits for the polling fallback and wallet balance queries.

### Step 3 — Create the Webhook

1. Go to [dev.helius.xyz/webhooks/app](https://dev.helius.xyz/webhooks/app)
2. Click **Create Webhook**
3. Configure:
   - **Webhook URL:** `https://<your-vercel-domain>/api/noe/webhook`
   - **Transaction Types:** Select **All**
   - **Account Addresses:** `82KHJf2YVWhxx9F6cgipJRZ8eg6rD7oSeFMmN3mWpump`
   - **Webhook Type:** Enhanced
4. Copy the **Webhook Secret** shown after creation

### Step 4 — Set Environment Variables

```bash
HELIUS_WEBHOOK_SECRET=<webhook-secret-from-step-3>
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your-api-key>
```

### Step 5 — Deploy

```bash
vercel --prod
```

Helius will send a test ping to verify the endpoint. The `GET /api/noe/webhook` handler responds with `{ status: "noe-webhook-active" }`.

---

## Coexistence with Polling

The webhook and the polling endpoint (`/api/noe/wallet`) coexist. The deduplication set ensures no transaction is processed twice. In practice:

- **Webhook active:** Noe receives events in real time. Polling still runs every 20s but finds no new signatures (all already seen).
- **Webhook down:** Polling continues as fallback. Noe's signal latency increases to 15–20s but no events are lost.
- **Both active:** Webhook delivers first, polling deduplicates. No double-processing.

---

## Response Format

The webhook handler returns a summary after processing:

```json
{
  "processed": 3,
  "cluster": "ACCUMULATION",
  "mood": "active",
  "state": {
    "stability": 0.61,
    "trust": 0.72,
    "energy": 0.58,
    "volatility": 0.24,
    "growth": 0.67
  }
}
```

Helius does not use this response — it is for debugging and monitoring.

---

## Monitoring

To verify the webhook is receiving events:

```bash
# Check recent webhook calls in Helius dashboard
# Or query Noe's state directly
curl https://<domain>/api/noe/state
```

The `/api/noe/state` endpoint shows `signalsProcessed` — this number should increase in real time when the webhook is active.

---

## Endpoint Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/noe/webhook` | Helius enhanced tx payload receiver |
| `GET`  | `/api/noe/webhook` | Health check (Helius verification) |

---

*Webhook Integration Docs v1.0*
*See [ARCHITECTURE.md](./ARCHITECTURE.md) for full engine context*
*See [PERSISTENCE.md](./PERSISTENCE.md) for KV integration*
