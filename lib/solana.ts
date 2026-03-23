/**
 * N.O.E — Solana On-Chain Layer
 *
 * Reads real transaction data from the NOEMA token CA
 * and converts them into PerceptionEvents for the engine.
 *
 * Token: 82KHJf2YVWhxx9F6cgipJRZ8eg6rD7oSeFMmN3mWpump
 */

import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo,
} from "@solana/web3.js"
import { PerceptionEvent } from "@/lib/noe-engine/types"

export const NOEMA_CA = "82KHJf2YVWhxx9F6cgipJRZ8eg6rD7oSeFMmN3mWpump"
export const NOEMA_MINT = new PublicKey(NOEMA_CA)

// Use public Solana mainnet RPC — swap for a dedicated endpoint in production
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"

export function getConnection(): Connection {
  return new Connection(RPC_URL, { commitment: "confirmed" })
}

export interface ParsedTx {
  signature: string
  type: "BUY" | "SELL" | "HOLD" | "WHALE_MOVE"
  magnitude: number       // normalized 0-10
  walletScore: number     // 0-100
  walletAddress: string
  timestamp: number
  uiAmount: number        // raw token amount
}

// Fetch recent signatures for the token mint
export async function fetchRecentSignatures(limit = 20): Promise<ConfirmedSignatureInfo[]> {
  const conn = getConnection()
  try {
    return await conn.getSignaturesForAddress(NOEMA_MINT, { limit })
  } catch {
    return []
  }
}

// Parse a single transaction into a typed event
export async function parseTransaction(
  conn: Connection,
  sig: string
): Promise<ParsedTx | null> {
  try {
    const tx = await conn.getParsedTransaction(sig, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    })
    if (!tx || !tx.meta) return null
    return classifyTransaction(tx, sig)
  } catch {
    return null
  }
}

function classifyTransaction(
  tx: ParsedTransactionWithMeta,
  sig: string
): ParsedTx | null {
  const meta = tx.meta!
  const timestamp = (tx.blockTime ?? Date.now() / 1000) * 1000

  // Find token balance changes for our mint
  const preBalances = meta.preTokenBalances ?? []
  const postBalances = meta.postTokenBalances ?? []

  let maxDelta = 0
  let dominantWallet = ""
  let netFlow = 0 // positive = tokens received (buy), negative = tokens sent (sell)

  for (const post of postBalances) {
    if (post.mint !== NOEMA_CA) continue
    const pre = preBalances.find(
      (p) => p.accountIndex === post.accountIndex && p.mint === NOEMA_CA
    )
    const preAmt = pre?.uiTokenAmount.uiAmount ?? 0
    const postAmt = post.uiTokenAmount.uiAmount ?? 0
    const delta = postAmt - preAmt

    if (Math.abs(delta) > Math.abs(maxDelta)) {
      maxDelta = delta
      netFlow = delta
      dominantWallet = tx.transaction.message.accountKeys[post.accountIndex]?.pubkey.toString() ?? ""
    }
  }

  if (maxDelta === 0) return null

  const absAmount = Math.abs(maxDelta)

  // Classify by amount thresholds
  const isWhale = absAmount > 1_000_000
  const magnitude = Math.min(10, Math.log10(absAmount + 1))

  let type: ParsedTx["type"]
  if (isWhale) {
    type = "WHALE_MOVE"
  } else if (netFlow > 0) {
    type = "BUY"
  } else if (netFlow < 0) {
    type = "SELL"
  } else {
    type = "HOLD"
  }

  // Wallet score: based on SOL balance proxy (fee payer balance)
  const feePayerIndex = 0
  const solBalance = (meta.postBalances[feePayerIndex] ?? 0) / 1e9
  const walletScore = Math.min(100, Math.round(Math.log10(solBalance + 1) * 40))

  return {
    signature: sig,
    type,
    magnitude,
    walletScore,
    walletAddress: dominantWallet,
    timestamp,
    uiAmount: absAmount,
  }
}

// Convert ParsedTx[] → PerceptionEvent[]
export function toPerceptionEvents(txs: ParsedTx[]): PerceptionEvent[] {
  return txs.map((tx) => ({
    type: tx.type,
    magnitude: tx.magnitude,
    walletScore: tx.walletScore,
    timestamp: tx.timestamp,
    walletId: tx.walletAddress,
  }))
}

// Get token balance for a wallet address
export async function getTokenBalance(walletAddress: string): Promise<number> {
  try {
    const conn = getConnection()
    const wallet = new PublicKey(walletAddress)
    const accounts = await conn.getParsedTokenAccountsByOwner(wallet, {
      mint: NOEMA_MINT,
    })
    if (accounts.value.length === 0) return 0
    return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0
  } catch {
    return 0
  }
}

// Get SOL balance for a wallet
export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    const conn = getConnection()
    const wallet = new PublicKey(walletAddress)
    const lamports = await conn.getBalance(wallet)
    return lamports / 1e9
  } catch {
    return 0
  }
}
