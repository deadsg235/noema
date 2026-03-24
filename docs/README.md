# NOEMA — Documentation Index

---

## Core Documents

| Document | Description | Status |
|----------|-------------|--------|
| [WHITEPAPER.md](./WHITEPAPER.md) | Full project thesis, token mechanics, consciousness model, utility phases | v3.0 |
| [ROADMAP.md](./ROADMAP.md) | Phase-by-phase growth plan tied to Noe's cognitive development | v3.0 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full technical reference — every system layer, data flows, API surface | v3.0 |
| [DQN.md](./DQN.md) | Deep Q-Network decision layer — design, action space, reward function, persistence | v2.0 |

---

## Utility Integration Guides

| Document | Description | Status |
|----------|-------------|--------|
| [WEBHOOK.md](./WEBHOOK.md) | Helius webhook — real-time on-chain signal ingestion, setup, classification logic | v1.0 |
| [PERSISTENCE.md](./PERSISTENCE.md) | Upstash Redis KV — engine state persistence, rehydration, schema versioning | v1.0 |
| [ONCHAIN.md](./ONCHAIN.md) | Solana state anchoring — memo mode, Anchor program design, public verification | v1.0 |
| [PROTOCOL.md](./PROTOCOL.md) | N.O.E Agent Protocol — agent-to-agent auth, messaging, state exchange | v1.0 |

---

## Deployment & Operations

| Document | Description |
|----------|-------------|
| [../DEPLOYMENT.md](../DEPLOYMENT.md) | Vercel + Electron deployment guide |
| [../NOE.md](../NOE.md) | N.O.E engine quick reference |
| [../AGENTS.md](../AGENTS.md) | Agent interaction protocol |

---

## Environment Variables Quick Reference

| Variable | Required | Purpose | Doc |
|----------|----------|---------|-----|
| `GROQ_API_KEY` | ✅ | LLM chat (LLaMA 3.3 70B) | ARCHITECTURE |
| `SOLANA_RPC_URL` | Recommended | Helius/QuickNode RPC endpoint | WEBHOOK |
| `HELIUS_WEBHOOK_SECRET` | Recommended | Webhook auth token | WEBHOOK |
| `UPSTASH_REDIS_REST_URL` | Recommended | KV persistence URL | PERSISTENCE |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | KV persistence token | PERSISTENCE |
| `NOE_PROTOCOL_SECRET` | Recommended | Agent protocol HMAC secret | PROTOCOL |
| `NOE_ANCHOR_KEYPAIR` | Optional | Solana keypair for state anchoring | ONCHAIN |
| `NOE_PROGRAM_ID` | Optional | Anchor program ID (program mode) | ONCHAIN |
| `NOE_IMAGE_PROVIDER` | Optional | `mock` \| `openai` \| `replicate` | ARCHITECTURE |

---

## API Endpoints Quick Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/api/noe` | None | Current NoeUIState — ticks engine |
| `POST` | `/api/noe` | None | Inject event, get state + reply |
| `POST` | `/api/noe/chat` | None | Streaming LLM chat |
| `GET`  | `/api/noe/wallet` | None | Fetch + process CA transactions |
| `POST` | `/api/noe/wallet` | None | Register wallet connection |
| `POST` | `/api/noe/webhook` | Webhook secret | Helius real-time tx receiver |
| `GET`  | `/api/noe/webhook` | None | Webhook health check |
| `GET`  | `/api/noe/state` | None | Public state read (CORS open) |
| `POST` | `/api/noe/image` | None | Generate state-driven image |
| `GET`  | `/api/noe/protocol/challenge` | None | Protocol info |
| `POST` | `/api/noe/protocol/challenge` | None | Issue challenge nonce |
| `POST` | `/api/noe/protocol/verify` | Nonce + HMAC | Complete handshake → session token |
| `GET`  | `/api/noe/protocol/grant` | None | Endpoint info |
| `POST` | `/api/noe/protocol/grant` | Session token | Agent messaging — PING/QUERY/SIGNAL/SYNC |
