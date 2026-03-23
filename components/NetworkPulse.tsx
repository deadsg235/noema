"use client"

import { motion } from "framer-motion"
import { MOOD_ACCENT, type NoeState } from "@/lib/noe-state"

interface Props {
  state: NoeState
}

function Bar({ label, value, max = 100, accent }: { label: string; value: number; max?: number; accent: string }) {
  const pct = Math.round(((value + (max === 200 ? 100 : 0)) / (max === 200 ? 200 : 100)) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-xs text-white/40">
        <span>{label}</span>
        <span style={{ color: accent }}>{value > 0 && max === 200 ? `+${value}` : value}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accent }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

export default function NetworkPulse({ state }: Props) {
  const accent = MOOD_ACCENT[state.mood]
  const { walletActivity, liquidityFlow, collectiveIntent } = state.networkSignals

  return (
    <div className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/30 uppercase tracking-widest">Network Signals</span>
        <motion.span
          className="font-mono text-xs"
          style={{ color: accent }}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          LIVE
        </motion.span>
      </div>
      <Bar label="Wallet Activity" value={walletActivity} accent={accent} />
      <Bar label="Liquidity Flow" value={liquidityFlow} max={200} accent={accent} />
      <Bar label="Collective Intent" value={collectiveIntent} accent={accent} />
    </div>
  )
}
