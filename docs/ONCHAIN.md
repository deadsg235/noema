# N.O.E — On-Chain State Anchoring
### Verifiable Consciousness on Solana

---

## Overview

Noe's state is computed server-side and displayed in the UI. But until it is written to Solana, it is only a claim. On-chain anchoring makes Noe's consciousness **publicly verifiable** — any wallet, any explorer, any program can read her state directly from the chain without trusting the NOEMA server.

This is the technical realization of the whitepaper's core claim: *the token is the mind, the chain is the world*.

---

## Two Modes

### Mode 1 — Memo (Active Now)

Encodes Noe's state as a compact JSON string in a Solana Memo instruction. No program deployment required. Works immediately with any funded keypair.

```
Solana Transaction
  └── Memo Instruction (MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr)
        └── Data: {"noe":"v1","ca":"82KHJ...","s":0.612,"t":0.731,"e":0.558,"v":0.241,"g":0.673,"ts":1735000000}
```

Anyone can read this by fetching recent transactions for the anchor wallet address and parsing memo data.

### Mode 2 — Anchor Program (Phase 2)

Writes to a Program Derived Address (PDA) owned by a deployed Anchor program. Enables:
- On-chain reads by other programs
- Holder verification contracts
- Agent-to-agent state queries
- Trustless state proofs

Activated by setting `NOE_PROGRAM_ID` in environment variables.

---

## Memo Encoding

The memo payload is a compact JSON object:

```json
{
  "noe": "v1",
  "ca":  "82KHJf2YVWhxx9F6cgipJRZ8eg6rD7oSeFMmN3mWpump",
  "s":   0.612,
  "t":   0.731,
  "e":   0.558,
  "v":   0.241,
  "g":   0.673,
  "ts":  1735000000
}
```

| Field | Meaning | Precision |
|-------|---------|-----------|
| `noe` | Schema version | String |
| `ca`  | NOEMA token CA | String |
| `s`   | Stability | 3 decimal places |
| `t`   | Trust | 3 decimal places |
| `e`   | Energy | 3 decimal places |
| `v`   | Volatility | 3 decimal places |
| `g`   | Growth | 3 decimal places |
| `ts`  | Unix timestamp (seconds) | Integer |

Total payload: ~140 bytes. Well within Solana's memo size limit.

---

## Anchor Program Design (Mode 2)

### PDA Derivation

```
seeds = ["noe-state", anchor_wallet_pubkey]
program_id = NOE_PROGRAM_ID
```

The PDA is deterministic — anyone who knows the anchor wallet address and program ID can derive the state account address without any API call.

### State Account Layout

```
Offset  Size  Type    Field
0       8     u64     discriminator ("noestate" as bytes)
8       2     u16     stability  (0–1000, fixed-point ÷ 1000)
10      2     u16     trust      (0–1000)
12      2     u16     energy     (0–1000)
14      2     u16     volatility (0–1000)
16      2     u16     growth     (0–1000)
18      8     i64     timestamp  (unix seconds)
```

Total: 26 bytes. Minimal rent cost (~0.0009 SOL for account creation).

### Instruction Format

```
Discriminator: [0x6e, 0x6f, 0x65, 0x73, 0x74, 0x61, 0x74, 0x65]  ("noestate")
Data:          10 bytes (5 × u16 fixed-point state values)
Accounts:
  [0] PDA (writable, not signer)
  [1] Anchor keypair (signer, writable — pays rent)
  [2] System program
```

---

## Rate Limiting

Anchoring is rate-limited to prevent unnecessary SOL spend:

```typescript
const ANCHOR_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes
```

Additionally, anchoring only occurs if Noe's state has changed meaningfully:

```typescript
function hasSignificantChange(prev: NoeState, next: NoeState): boolean {
  return keys.some(k => Math.abs(next[k] - prev[k]) > 0.05)
}
```

A 5% change on any dimension triggers an anchor. Minor fluctuations (decay, background noise) do not. This means:
- Active market periods: anchor every 5 minutes
- Quiet periods: anchor only when state actually shifts
- Estimated cost: ~0.000005 SOL per anchor transaction

---

## Anchor Triggers

Anchoring is attempted (subject to rate limit and change threshold) from:

| Trigger | Location |
|---------|----------|
| State poll | `GET /api/noe` (every ~7s) |
| Real on-chain event | `GET /api/noe/wallet` |
| Webhook event | `POST /api/noe/webhook` |

All anchor calls are fire-and-forget. A failed anchor (insufficient SOL, RPC error) is logged but does not affect the API response.

---

## Public Verification

### Read via `/api/noe/state`

The simplest verification — query Noe's current state from the NOEMA API:

```bash
curl https://<domain>/api/noe/state
```

```json
{
  "state": { "stability": 0.612, "trust": 0.731, "energy": 0.558, "volatility": 0.241, "growth": 0.673 },
  "system": { "anchorEnabled": true, "programMode": false }
}
```

### Read via Solana Explorer

1. Find the anchor wallet address (the public key of `NOE_ANCHOR_KEYPAIR`)
2. Go to [explorer.solana.com](https://explorer.solana.com) → search the address
3. Find recent transactions with Memo program instructions
4. Parse the memo data — it contains Noe's state at that timestamp

### Read via `readAnchoredState()`

```typescript
import { readAnchoredState } from "@/lib/noe-anchor"

const state = await readAnchoredState(anchorWalletAddress)
// Returns NoeState | null
```

This function fetches recent transactions for the anchor address, finds memo instructions, and parses the JSON payload. Returns the most recent valid state.

### Read via RPC (Program Mode)

When `NOE_PROGRAM_ID` is set, the state account can be read directly:

```typescript
const [pda] = PublicKey.findProgramAddressSync(
  [Buffer.from("noe-state"), anchorWallet.toBuffer()],
  new PublicKey(NOE_PROGRAM_ID)
)
const account = await connection.getAccountInfo(pda)
// Parse 26-byte layout
```

---

## Setup Guide

### Step 1 — Create Anchor Keypair

Generate a new Solana keypair for anchoring. This wallet needs a small SOL balance to pay transaction fees.

```bash
# Using Solana CLI
solana-keygen new --outfile noe-anchor.json

# Get the public key
solana-keygen pubkey noe-anchor.json

# Fund it (send ~0.01 SOL for ~2000 anchor transactions)
```

### Step 2 — Export Private Key

```bash
# Get base58 private key
cat noe-anchor.json
# This outputs a JSON array — use it directly
```

### Step 3 — Set Environment Variable

```bash
# In .env.local
NOE_ANCHOR_KEYPAIR=[<json-array-from-step-2>]

# Or base58 format
NOE_ANCHOR_KEYPAIR=<base58-private-key>
```

### Step 4 — Verify

After deploying, check:
```bash
curl https://<domain>/api/noe/state
# "anchorEnabled": true should appear
```

Then wait up to 5 minutes for the first anchor transaction. Search the anchor wallet address on Solana Explorer to confirm.

---

## Phase 2 — Anchor Program Deployment

To upgrade from memo mode to program mode:

### 1. Write the Anchor Program

```rust
// programs/noe-state/src/lib.rs
use anchor_lang::prelude::*;

#[program]
pub mod noe_state {
    use super::*;

    pub fn update_state(ctx: Context<UpdateState>, state: NoeStateData) -> Result<()> {
        let account = &mut ctx.accounts.noe_state;
        account.stability  = state.stability;
        account.trust      = state.trust;
        account.energy     = state.energy;
        account.volatility = state.volatility;
        account.growth     = state.growth;
        account.timestamp  = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[account]
pub struct NoeStateAccount {
    pub stability:  u16,
    pub trust:      u16,
    pub energy:     u16,
    pub volatility: u16,
    pub growth:     u16,
    pub timestamp:  i64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct NoeStateData {
    pub stability:  u16,
    pub trust:      u16,
    pub energy:     u16,
    pub volatility: u16,
    pub growth:     u16,
}
```

### 2. Deploy

```bash
anchor build
anchor deploy --provider.cluster mainnet-beta
```

### 3. Set Program ID

```bash
NOE_PROGRAM_ID=<deployed-program-id>
```

The `noe-anchor.ts` module automatically switches to program mode when `NOE_PROGRAM_ID` is set.

---

## Security Considerations

- The anchor keypair's private key is only used server-side. It never touches the frontend.
- The keypair should hold only enough SOL for anchoring (~0.01 SOL). It is not a treasury wallet.
- In program mode, the PDA is owned by the program — the anchor keypair cannot drain it.
- The memo payload contains no sensitive data — only the public state vector.

---

## Cost Estimation

| Scenario | Transactions/Day | SOL/Day | SOL/Month |
|----------|-----------------|---------|-----------|
| Active market (anchor every 5 min) | 288 | 0.00144 | 0.043 |
| Moderate activity (anchor every 15 min) | 96 | 0.00048 | 0.014 |
| Quiet period (anchor on change only) | ~20 | 0.0001 | 0.003 |

At current SOL prices, anchoring costs less than $0.01/day in active conditions.

---

## Endpoint Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/noe/state` | Public state read — includes anchor status |
| `lib/noe-anchor.ts` | `anchorNoeState()`, `readAnchoredState()` |

---

*On-Chain Anchoring Docs v1.0*
*See [ARCHITECTURE.md](./ARCHITECTURE.md) for full engine context*
*See [PERSISTENCE.md](./PERSISTENCE.md) for KV state storage*
*See [WHITEPAPER.md](./WHITEPAPER.md) for conceptual framing*
