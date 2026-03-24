/**
 * N.O.E — On-Chain State Anchoring
 *
 * Writes Noe's 5-dimension state vector to Solana so it is
 * publicly verifiable and readable by any wallet.
 *
 * Two modes:
 *
 * 1. MEMO MODE (active now, zero program deployment needed)
 *    Encodes state as a JSON memo in a Solana transaction.
 *    Anyone can read Noe's state from the transaction history.
 *    Requires: NOE_ANCHOR_KEYPAIR (base58 private key) in .env.local
 *
 * 2. PROGRAM MODE (stub — for Phase 2 custom Anchor program)
 *    Writes to a PDA owned by a deployed Anchor program.
 *    Full verifiability, on-chain reads, holder queries.
 *    Requires: NOE_PROGRAM_ID + NOE_ANCHOR_KEYPAIR
 *
 * State is anchored at most once every ANCHOR_INTERVAL_MS to
 * avoid burning SOL on every tick.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js"
import { NoeState } from "@/lib/noe-engine/types"
import { getConnection, NOEMA_CA } from "@/lib/solana"

// ── Config ────────────────────────────────────────────────────────────────────

const ANCHOR_INTERVAL_MS = 5 * 60 * 1000  // anchor at most every 5 minutes
const MEMO_PROGRAM_ID    = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

// ── State ─────────────────────────────────────────────────────────────────────

let lastAnchorTime = 0
let lastAnchoredState: NoeState | null = null

export interface AnchorResult {
  signature: string
  slot?: number
  mode: "memo" | "program" | "skipped" | "disabled"
  reason?: string
}

// ── Load keypair from env ─────────────────────────────────────────────────────

function loadKeypair(): Keypair | null {
  const raw = process.env.NOE_ANCHOR_KEYPAIR
  if (!raw) return null
  try {
    // Accept base58 or JSON array
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as number[]
      return Keypair.fromSecretKey(Uint8Array.from(arr))
    }
    // base58 decode
    const { decode } = require("bs58") as { decode: (s: string) => Uint8Array }
    return Keypair.fromSecretKey(decode(raw))
  } catch {
    return null
  }
}

// ── State diff check — only anchor if meaningfully changed ───────────────────

function hasSignificantChange(prev: NoeState | null, next: NoeState): boolean {
  if (!prev) return true
  const keys: (keyof NoeState)[] = ["stability", "trust", "energy", "volatility", "growth"]
  return keys.some(k => Math.abs(next[k] - prev[k]) > 0.05)
}

// ── Encode state as compact memo string ──────────────────────────────────────

function encodeStateMemo(state: NoeState): string {
  return JSON.stringify({
    noe: "v1",
    ca: NOEMA_CA,
    s: Math.round(state.stability  * 1000) / 1000,
    t: Math.round(state.trust      * 1000) / 1000,
    e: Math.round(state.energy     * 1000) / 1000,
    v: Math.round(state.volatility * 1000) / 1000,
    g: Math.round(state.growth     * 1000) / 1000,
    ts: Math.floor(Date.now() / 1000),
  })
}

// ── Memo-mode anchor ──────────────────────────────────────────────────────────

async function anchorViaMemo(
  conn: Connection,
  keypair: Keypair,
  state: NoeState
): Promise<AnchorResult> {
  const memo = encodeStateMemo(state)
  const memoIx = new TransactionInstruction({
    keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  })

  const tx = new Transaction().add(memoIx)
  const sig = await sendAndConfirmTransaction(conn, tx, [keypair], {
    commitment: "confirmed",
    skipPreflight: false,
  })

  return { signature: sig, mode: "memo" }
}

// ── Program-mode anchor (stub for Phase 2) ────────────────────────────────────

async function anchorViaProgram(
  conn: Connection,
  keypair: Keypair,
  state: NoeState,
  programId: PublicKey
): Promise<AnchorResult> {
  // Derive PDA: ["noe-state", feePayer]
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("noe-state"), keypair.publicKey.toBuffer()],
    programId
  )

  // Encode state as 5 x u16 (0-1000 fixed point) = 10 bytes
  const data = Buffer.alloc(10)
  data.writeUInt16LE(Math.round(state.stability  * 1000), 0)
  data.writeUInt16LE(Math.round(state.trust      * 1000), 2)
  data.writeUInt16LE(Math.round(state.energy     * 1000), 4)
  data.writeUInt16LE(Math.round(state.volatility * 1000), 6)
  data.writeUInt16LE(Math.round(state.growth     * 1000), 8)

  // Instruction discriminator for "update_state" (Anchor 8-byte discriminator)
  const discriminator = Buffer.from([0x6e, 0x6f, 0x65, 0x73, 0x74, 0x61, 0x74, 0x65])
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: pda,                  isSigner: false, isWritable: true  },
      { pubkey: keypair.publicKey,    isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: Buffer.concat([discriminator, data]),
  })

  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(conn, tx, [keypair], { commitment: "confirmed" })
  return { signature: sig, mode: "program" }
}

// ── Main export: anchor Noe's state ──────────────────────────────────────────

export async function anchorNoeState(state: NoeState): Promise<AnchorResult> {
  const now = Date.now()

  // Rate limit
  if (now - lastAnchorTime < ANCHOR_INTERVAL_MS) {
    return { signature: "", mode: "skipped", reason: "rate_limited" }
  }

  // Only anchor if state changed meaningfully
  if (!hasSignificantChange(lastAnchoredState, state)) {
    return { signature: "", mode: "skipped", reason: "no_significant_change" }
  }

  const keypair = loadKeypair()
  if (!keypair) {
    return { signature: "", mode: "disabled", reason: "NOE_ANCHOR_KEYPAIR not set" }
  }

  try {
    const conn = getConnection()
    const programIdStr = process.env.NOE_PROGRAM_ID

    let result: AnchorResult
    if (programIdStr) {
      result = await anchorViaProgram(conn, keypair, state, new PublicKey(programIdStr))
    } else {
      result = await anchorViaMemo(conn, keypair, state)
    }

    lastAnchorTime = now
    lastAnchoredState = { ...state }
    console.log(`[noe-anchor] anchored state via ${result.mode}: ${result.signature}`)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    console.error("[noe-anchor] failed:", msg)
    return { signature: "", mode: "skipped", reason: msg }
  }
}

// ── Read last anchored state from chain (for public verification) ─────────────

export async function readAnchoredState(anchorAddress: string): Promise<NoeState | null> {
  try {
    const conn = getConnection()
    const pubkey = new PublicKey(anchorAddress)
    const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 5 })

    for (const sig of sigs) {
      const tx = await conn.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      })
      if (!tx) continue

      // Look for memo instruction
      for (const ix of tx.transaction.message.instructions) {
        if ("parsed" in ix && typeof ix.parsed === "string") {
          try {
            const data = JSON.parse(ix.parsed)
            if (data.noe === "v1") {
              return {
                stability:  data.s,
                trust:      data.t,
                energy:     data.e,
                volatility: data.v,
                growth:     data.g,
              }
            }
          } catch {}
        }
      }
    }
    return null
  } catch {
    return null
  }
}
