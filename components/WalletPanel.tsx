"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useWallet } from "@/lib/wallet-store"
import { MOOD_ACCENT, NOEMA_CA, type NoeUIState } from "@/lib/noe-state"

interface LiveTx {
  signature: string
  type: "BUY" | "SELL" | "HOLD" | "WHALE_MOVE"
  uiAmount: number
  wallet: string
  timestamp: number
}

interface Props {
  state: NoeUIState
  onStateUpdate: (state: NoeUIState) => void
}

const TYPE_COLOR: Record<LiveTx["type"], string> = {
  BUY:        "#40c4ff",
  SELL:       "#e94560",
  HOLD:       "#9333ea",
  WHALE_MOVE: "#f59e0b",
}

const TYPE_LABEL: Record<LiveTx["type"], string> = {
  BUY:        "BUY",
  SELL:       "SELL",
  HOLD:       "HOLD",
  WHALE_MOVE: "WHALE",
}

export default function WalletPanel({ state, onStateUpdate }: Props) {
  const { connected, address, tokenBalance, solBalance, hasTokens } = useWallet()
  const [liveTxs, setLiveTxs] = useState<LiveTx[]>([])
  const [syncing, setSyncing] = useState(false)
  const accent = MOOD_ACCENT[state.mood]

  const syncChain = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch("/api/noe/wallet")
      if (!res.ok) return
      const data = await res.json()
      if (data.skipped || data.newEvents === 0) return
      if (data.transactions?.length) {
        setLiveTxs((prev) => {
          const merged = [...data.transactions, ...prev]
          return merged.slice(0, 12)
        })
      }
      if (data.state) onStateUpdate(data.state)
    } catch {} finally {
      setSyncing(false)
    }
  }, [syncing, onStateUpdate])

  // Poll on-chain every 20s
  useEffect(() => {
    syncChain()
    const interval = setInterval(syncChain, 20_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/30 uppercase tracking-widest">On-Chain Feed</span>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: syncing ? "#f59e0b" : accent }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: syncing ? 0.4 : 2, repeat: Infinity }}
          />
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
            {syncing ? "SYNCING" : "LIVE"}
          </span>
        </div>
      </div>

      {/* Connected wallet info */}
      {connected && address && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-white/5 bg-white/[0.03] p-3 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Your Wallet</span>
            {hasTokens && (
              <span
                className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${accent}22`, color: accent }}
              >
                NOEMA Holder
              </span>
            )}
          </div>
          <div className="flex justify-between font-mono text-xs">
            <span className="text-white/40">Address</span>
            <span className="text-white/60">{address.slice(0, 6)}...{address.slice(-6)}</span>
          </div>
          <div className="flex justify-between font-mono text-xs">
            <span className="text-white/40">SOL</span>
            <span style={{ color: accent }}>{solBalance.toFixed(4)}</span>
          </div>
          <div className="flex justify-between font-mono text-xs">
            <span className="text-white/40">NOEMA</span>
            <span style={{ color: accent }}>
              {tokenBalance > 0 ? tokenBalance.toLocaleString() : "—"}
            </span>
          </div>
        </motion.div>
      )}

      {/* Not connected nudge */}
      {!connected && (
        <p className="font-mono text-[11px] text-white/20 leading-relaxed">
          Connect your Phantom wallet to let Noe read your NOEMA holdings and stabilize her trust signal.
        </p>
      )}

      {/* Live transaction feed */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest mb-1">
          CA Transactions
        </span>
        {liveTxs.length === 0 ? (
          <p className="font-mono text-[11px] text-white/15 italic">
            Waiting for on-chain activity...
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {liveTxs.map((tx) => (
              <motion.div
                key={tx.signature}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[10px] font-bold uppercase w-10"
                    style={{ color: TYPE_COLOR[tx.type] }}
                  >
                    {TYPE_LABEL[tx.type]}
                  </span>
                  <span className="font-mono text-[10px] text-white/30">{tx.wallet}</span>
                </div>
                <span className="font-mono text-[10px]" style={{ color: TYPE_COLOR[tx.type] }}>
                  {tx.uiAmount > 1_000_000
                    ? `${(tx.uiAmount / 1_000_000).toFixed(2)}M`
                    : tx.uiAmount > 1_000
                    ? `${(tx.uiAmount / 1_000).toFixed(1)}K`
                    : tx.uiAmount.toFixed(0)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* CA reference */}
      <div className="pt-1 border-t border-white/5">
        <p className="font-mono text-[9px] text-white/15 break-all">
          {NOEMA_CA}
        </p>
      </div>
    </div>
  )
}
