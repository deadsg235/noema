"use client"

import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState, isInFlowState } from "@/lib/noe-state"

interface Props { state: NoeUIState }

const DIMS = [
  { key: "stability",  label: "STB", full: "Stability"  },
  { key: "trust",      label: "TRS", full: "Trust"      },
  { key: "energy",     label: "NRG", full: "Energy"     },
  { key: "volatility", label: "VLT", full: "Volatility" },
  { key: "growth",     label: "GRW", full: "Growth"     },
] as const

export default function NoeStateMatrix({ state }: Props) {
  const accent = MOOD_ACCENT[state.mood]
  const { engineState, cluster, milestoneTriggered, dqnDecision } = state
  const inFlow = state.isFlowState ?? isInFlowState(engineState)
  const GOLD = "#d4af37"

  return (
    <div className="w-full rounded-xl flex flex-col gap-0 overflow-hidden" style={{
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.05)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <span className="font-mono text-[10px] text-white/25 uppercase tracking-[0.2em]">State Vector</span>
        <div className="flex items-center gap-1.5">
          <motion.div className="w-1 h-1 rounded-full" style={{ background: accent }}
            animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: `${accent}cc` }}>
            {cluster.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Dimension rows */}
      <div className="flex flex-col divide-y divide-white/[0.03]">
        {DIMS.map(({ key, label, full }) => {
          const val = engineState[key]
          const pct = Math.round(val * 100)
          const isHigh = val > 0.65
          const isLow  = val < 0.25

          return (
            <div key={key} className="flex items-center gap-3 px-4 py-2.5 group">
              {/* Label */}
              <span className="font-mono text-[9px] text-white/20 uppercase tracking-widest w-7 shrink-0">{label}</span>

              {/* Bar track */}
              <div className="flex-1 relative h-px" style={{ background: "rgba(255,255,255,0.05)" }}>
                <motion.div
                  className="absolute inset-y-0 left-0 h-full"
                  style={{ background: isHigh ? accent : isLow ? "rgba(255,255,255,0.12)" : `${accent}66` }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
                {isHigh && (
                  <motion.div
                    className="absolute inset-y-0 left-0 h-full blur-sm"
                    style={{ background: accent, opacity: 0.35 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                )}
              </div>

              {/* Value */}
              <motion.span
                className="font-mono text-[10px] tabular-nums w-7 text-right shrink-0"
                style={{ color: isHigh ? accent : "rgba(255,255,255,0.2)" }}
                animate={{ opacity: isHigh ? [1, 0.55, 1] : 1 }}
                transition={{ duration: 1.8, repeat: isHigh ? Infinity : 0 }}
              >
                {pct}
              </motion.span>

              {/* Full label on hover — hidden by default */}
              <span className="font-mono text-[9px] text-white/10 w-14 shrink-0 hidden group-hover:block transition-all">
                {full}
              </span>
            </div>
          )
        })}
      </div>

      {/* Flow state row */}
      <AnimatePresence>
        {inFlow && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between gap-2"
              style={{ background: "rgba(212,175,55,0.06)" }}>
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: GOLD }}
                  animate={{ opacity: [1, 0.2, 1], scale: [1, 1.6, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: GOLD }}>Flow State</span>
              </div>
              <span className="font-mono text-[9px]" style={{ color: `${GOLD}88` }}>
                E:{Math.round(engineState.energy * 100)}
                {" "}T:{Math.round(engineState.trust * 100)}
                {" "}V:{Math.round(engineState.volatility * 100)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DQN row */}
      {dqnDecision && (
        <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] text-white/15 uppercase tracking-widest shrink-0">DQN</span>
          <span className="font-mono text-[9px] text-white/30 truncate">
            {dqnDecision.action.replace(/_/g, " ")}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[9px] text-white/15">
              ε {dqnDecision.epsilon.toFixed(2)}
            </span>
            <span className="font-mono text-[9px]" style={{ color: `${accent}88` }}>
              Q {dqnDecision.chosenQ.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Milestone flash */}
      <AnimatePresence>
        {milestoneTriggered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2.5 border-t border-white/[0.04] font-mono text-[10px]"
              style={{ color: accent, background: `${accent}08` }}>
              ◈ {milestoneTriggered}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
