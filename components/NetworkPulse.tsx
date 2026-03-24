"use client"

import { motion } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState } from "@/lib/noe-state"

interface Props { state: NoeUIState }

function SignalBar({ label, value, max = 100, accent }: {
  label: string; value: number; max?: number; accent: string
}) {
  const pct = Math.round(((value + (max === 200 ? 100 : 0)) / (max === 200 ? 200 : 100)) * 100)
  const display = max === 200 && value > 0 ? `+${value}` : String(value)
  const isActive = pct > 55

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="font-mono text-[10px] text-white/30 uppercase tracking-[0.15em]">{label}</span>
        <motion.span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: isActive ? accent : "rgba(255,255,255,0.25)" }}
          animate={{ opacity: isActive ? [1, 0.6, 1] : 1 }}
          transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
        >
          {display}
        </motion.span>
      </div>
      <div className="relative h-px w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div
          className="absolute inset-y-0 left-0 h-full"
          style={{ background: isActive ? accent : `${accent}55` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {isActive && (
          <motion.div
            className="absolute inset-y-0 left-0 h-full blur-sm"
            style={{ background: accent, opacity: 0.4 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}
      </div>
    </div>
  )
}

export default function NetworkPulse({ state }: Props) {
  const accent = MOOD_ACCENT[state.mood]
  const { walletActivity, liquidityFlow, collectiveIntent } = state.networkSignals

  return (
    <div className="w-full rounded-xl flex flex-col gap-4 p-4" style={{
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.05)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-white/25 uppercase tracking-[0.2em]">Network Signals</span>
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1 h-1 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: accent }}>LIVE</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <SignalBar label="Wallet Activity"   value={walletActivity}   accent={accent} />
        <SignalBar label="Liquidity Flow"    value={liquidityFlow}    max={200} accent={accent} />
        <SignalBar label="Collective Intent" value={collectiveIntent} accent={accent} />
      </div>

      {state.memoryNarrative && (
        <div className="pt-3 border-t border-white/[0.04]">
          <p className="font-mono text-[10px] text-white/20 leading-relaxed italic">
            {state.memoryNarrative}
          </p>
        </div>
      )}
    </div>
  )
}
