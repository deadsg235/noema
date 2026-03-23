"use client"

import { motion } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState } from "@/lib/noe-state"

interface Props {
  state: NoeUIState
}

const DIMENSIONS = [
  { key: "stability",  label: "Stability",  desc: "Market calm" },
  { key: "trust",      label: "Trust",      desc: "Holder loyalty" },
  { key: "energy",     label: "Energy",     desc: "Activity level" },
  { key: "volatility", label: "Volatility", desc: "Unpredictability" },
  { key: "growth",     label: "Growth",     desc: "Expansion trend" },
] as const

function StateBar({
  label,
  desc,
  value,
  accent,
  isHigh,
}: {
  label: string
  desc: string
  value: number
  accent: string
  isHigh: boolean
}) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-xs text-white/60">{label}</span>
          <span className="font-mono text-[10px] text-white/20">{desc}</span>
        </div>
        <motion.span
          className="font-mono text-xs font-bold"
          style={{ color: isHigh ? accent : "rgba(255,255,255,0.3)" }}
          animate={{ opacity: isHigh ? [1, 0.6, 1] : 1 }}
          transition={{ duration: 1.5, repeat: isHigh ? Infinity : 0 }}
        >
          {pct}%
        </motion.span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: isHigh ? accent : `${accent}55` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

export default function NoeStateMatrix({ state }: Props) {
  const accent = MOOD_ACCENT[state.mood]
  const { engineState, cluster, milestoneTriggered } = state

  return (
    <div className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/30 uppercase tracking-widest">N.O.E State Matrix</span>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
            {cluster.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* 5-axis state vector */}
      <div className="flex flex-col gap-3">
        {DIMENSIONS.map(({ key, label, desc }) => {
          const value = engineState[key]
          const isHigh = value > 0.65
          return (
            <StateBar
              key={key}
              label={label}
              desc={desc}
              value={value}
              accent={accent}
              isHigh={isHigh}
            />
          )
        })}
      </div>

      {/* Milestone flash */}
      {milestoneTriggered && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-lg border px-3 py-2 font-mono text-xs"
          style={{ borderColor: `${accent}44`, background: `${accent}11`, color: accent }}
        >
          ◈ MILESTONE: {milestoneTriggered}
        </motion.div>
      )}
    </div>
  )
}
