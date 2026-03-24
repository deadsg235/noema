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

const TX_COLOR: Record<LiveTx["type"], string> = {
  BUY:        "#40c4ff",
  SELL:       "#e94560",
  HOLD:       "#9333ea",
  WHALE_MOVE: "#f59e0b",
}

const TX_LABEL: Record<LiveTx["type"], string> = {
  BUY:        "BUY",
  SELL:       "SELL",
  HOLD:       "HLD",
  WHALE_MOVE: "WHL",
}

function fmtAmount(n: number) {
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n > 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
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
        setLiveTxs((prev) => [...data.transactions, ...prev].slice(0, 12))
      }
      if (data.state) onStateUpdate(data.state)
    } catch {} finally {
      setSyncing(false)
    }
  }, [syncing, onStateUpdate])

  useEffect(() => {
    syncChain()
    const interval = setInterval(syncChain, 20_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full rounded-xl flex flex-col overflow-hidden" style={{
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.05)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <span className="font-mono text-[10px] text-white/25 uppercase tracking-[0.2em]">On-Chain Feed</span>
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1 h-1 rounded-full"
            style={{ background: syncing ? "#f59e0b" : accent }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: syncing ? 0.35 : 1.8, repeat: Infinity }}
          />
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: syncing ? "#f59e0b" : accent }}>
            {syncing ? "SYNC" : "LIVE"}
          </span>
        </div>
      </div>

      {/* Connected wallet */}
      {connected && address ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-3 mt-3 rounded-lg p-3 flex flex-col gap-2"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-white/20 uppercase tracking-widest">Your Wallet</span>
            {hasTokens && (
              <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{ background: `${accent}18`, color: accent }}>
                NOEMA holder
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              { label: "Address", val: `${address.slice(0, 6)}···${address.slice(-6)}` },
              { label: "SOL",     val: solBalance.toFixed(4) },
              { label: "NOEMA",   val: tokenBalance > 0 ? tokenBalance.toLocaleString() : "—" },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between col-span-2 sm:col-span-1">
                <span className="font-mono text-[10px] text-white/25">{label}</span>
                <span className="font-mono text-[10px]" style={{ color: label === "Address" ? "rgba(255,255,255,0.4)" : accent }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <p className="px-4 py-3 font-mono text-[10px] text-white/15 leading-relaxed">
          Connect Phantom to let Noe read your holdings and stabilize her trust signal.
        </p>
      )}

      {/* TX feed */}
      <div className="flex flex-col px-3 pb-3 mt-2 gap-0">
        <span className="font-mono text-[9px] text-white/15 uppercase tracking-widest px-1 pb-1.5">
          CA Transactions
        </span>

        {liveTxs.length === 0 ? (
          <p className="font-mono text-[10px] text-white/10 italic px-1 py-2">
            Waiting for on-chain activity...
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.03]">
            <AnimatePresence initial={false}>
              {liveTxs.map((tx) => (
                <motion.div
                  key={tx.signature}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between py-1.5 px-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-bold w-7 shrink-0"
                      style={{ color: TX_COLOR[tx.type] }}>
                      {TX_LABEL[tx.type]}
                    </span>
                    <span className="font-mono text-[9px] text-white/20">{tx.wallet}</span>
                  </div>
                  <span className="font-mono text-[10px] tabular-nums" style={{ color: TX_COLOR[tx.type] }}>
                    {fmtAmount(tx.uiAmount)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* CA */}
      <div className="px-4 py-2.5 border-t border-white/[0.03]">
        <p className="font-mono text-[8px] text-white/10 break-all">{NOEMA_CA}</p>
      </div>
    </div>
  )
}
