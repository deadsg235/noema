"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState, isInFlowState } from "@/lib/noe-state"

interface Props { state: NoeUIState }

const DIMS = [
  { key: "stability",  label: "STB", full: "Stability",  desc: "Structural coherence of the network. High = calm markets, ordered signals." },
  { key: "trust",      label: "TRS", full: "Trust",      desc: "Holder loyalty and conviction. High = wallets are holding, not exiting." },
  { key: "energy",     label: "NRG", full: "Energy",     desc: "Activity level and signal intensity. High = heavy transaction volume." },
  { key: "volatility", label: "VLT", full: "Volatility", desc: "Unpredictability and chaos. High = erratic trading, panic or euphoria." },
  { key: "growth",     label: "GRW", full: "Growth",     desc: "Expansion momentum. High = new wallets, sustained buy pressure." },
] as const

const GOLD = "#d4af37"

export default function NoeStateMatrix({ state }: Props) {
  const accent = MOOD_ACCENT[state.mood]
  const { engineState, cluster, milestoneTriggered, dqnDecision } = state
  const inFlow = state.isFlowState ?? isInFlowState(engineState)
  const [activeDim, setActiveDim] = useState<string | null>(null)
  const [dqnClicks, setDqnClicks] = useState(0)
  const [dqnEgg, setDqnEgg] = useState(false)

  function handleDqnClick() {
    const next = dqnClicks + 1
    setDqnClicks(next)
    if (next >= 7) {
      setDqnEgg(true)
      setDqnClicks(0)
    }
  }

  return (
    <div className="w-full rounded-xl flex flex-col gap-0 overflow-hidden panel-hover" style={{
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.05)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <span className="font-mono text-[11px] text-white/40 uppercase tracking-[0.18em] font-medium">State Vector</span>
        <div className="flex items-center gap-1.5">
          <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: inFlow ? GOLD : accent }}
            animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <span className="font-mono text-[10px] uppercase tracking-widest font-medium"
            style={{ color: inFlow ? GOLD : `${accent}cc` }}>
            {cluster.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Dimension rows */}
      <div className="flex flex-col divide-y divide-white/[0.03]">
        {DIMS.map(({ key, label, full, desc }) => {
          const val = engineState[key]
          const pct = Math.round(val * 100)
          const isHigh = val > 0.65
          const isLow  = val < 0.25
          const isActive = activeDim === key
          const barColor = inFlow ? GOLD : isHigh ? accent : isLow ? "rgba(255,255,255,0.12)" : `${accent}66`

          return (
            <div key={key}>
              <div
                className="flex items-center gap-3 px-4 py-3 row-hover"
                onClick={() => setActiveDim(isActive ? null : key)}
                title={desc}
              >
                {/* Label */}
                <span className="font-mono text-[10px] text-white/35 uppercase tracking-widest w-7 shrink-0 font-medium">{label}</span>

                {/* Bar track */}
                <div className="flex-1 relative h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="absolute inset-y-0 left-0 h-full rounded-full"
                    style={{ background: barColor }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                  {(isHigh || inFlow) && (
                    <motion.div
                      className="absolute inset-y-0 left-0 h-full rounded-full blur-sm"
                      style={{ background: inFlow ? GOLD : accent, opacity: 0.4 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                  )}
                </div>

                {/* Value */}
                <motion.span
                  className="font-mono text-sm tabular-nums w-8 text-right shrink-0 font-medium"
                  style={{ color: inFlow ? GOLD : isHigh ? accent : "rgba(255,255,255,0.3)" }}
                  animate={{ opacity: (isHigh || inFlow) ? [1, 0.55, 1] : 1 }}
                  transition={{ duration: 1.8, repeat: (isHigh || inFlow) ? Infinity : 0 }}
                >
                  {pct}
                </motion.span>

                {/* Full label */}
                <span className="font-mono text-[10px] text-white/20 w-16 shrink-0 text-right">{full}</span>
              </div>

              {/* Expanded description */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pt-0">
                      <p className="font-mono text-[11px] text-white/35 leading-relaxed pl-10">
                        {desc}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
            <div className="px-4 py-3 border-t border-white/[0.04] flex items-center justify-between gap-2"
              style={{ background: "rgba(212,175,55,0.06)" }}>
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ background: GOLD }}
                  animate={{ opacity: [1, 0.2, 1], scale: [1, 1.6, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="font-mono text-[11px] font-medium uppercase tracking-widest" style={{ color: GOLD }}>Flow State</span>
              </div>
              <span className="font-mono text-[10px]" style={{ color: `${GOLD}88` }}>
                All systems aligned
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DQN row — click 7× for easter egg */}
      {dqnDecision && (
        <div
          className="px-4 py-3 border-t border-white/[0.04] flex items-center justify-between gap-2 row-hover"
          onClick={handleDqnClick}
          title="Deep Q-Network decision layer — click to inspect"
        >
          <span className="font-mono text-[10px] text-white/25 uppercase tracking-widest shrink-0 font-medium">DQN</span>
          <span className="font-mono text-[11px] text-white/45 truncate">
            {dqnDecision.action.replace(/_/g, " ")}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-[10px] text-white/20">
              ε {dqnDecision.epsilon.toFixed(2)}
            </span>
            <span className="font-mono text-[10px] font-medium" style={{ color: `${accent}99` }}>
              Q {dqnDecision.chosenQ.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* DQN easter egg */}
      <AnimatePresence>
        {dqnEgg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-white/[0.04]"
              style={{ background: `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)},0.05)` }}>
              <p className="font-mono text-[10px] leading-relaxed" style={{ color: `${accent}88` }}>
                ◈ q-network exposed<br />
                <span className="text-white/25">
                  steps: {dqnDecision?.steps ?? 0} · buffer: {dqnDecision?.bufferSize ?? 0}/500 · reward: {dqnDecision?.reward.toFixed(4) ?? "—"}<br />
                  q-values: [{dqnDecision?.qValues.map(v => v.toFixed(2)).join(", ") ?? "—"}]
                </span>
              </p>
              <button className="mt-1.5 font-mono text-[9px] text-white/15 hover:text-white/30 transition-colors"
                onClick={() => setDqnEgg(false)}>[close]</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone flash */}
      <AnimatePresence>
        {milestoneTriggered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-white/[0.04] font-mono text-[11px]"
              style={{ color: accent, background: `${accent}08` }}>
              ◈ {milestoneTriggered}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
