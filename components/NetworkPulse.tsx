"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState } from "@/lib/noe-state"

interface Props { state: NoeUIState }

const SIGNAL_EVENTS: Record<string, { type: string; label: string; hint: string }> = {
  "Wallet Activity":   { type: "BUY",        label: "Inject BUY signal",   hint: "Amplifies energy + trust" },
  "Liquidity Flow":    { type: "WHALE_MOVE",  label: "Inject WHALE signal", hint: "Triggers volatility spike" },
  "Collective Intent": { type: "HOLD",        label: "Inject HOLD signal",  hint: "Stabilises the network" },
}

function SignalBar({ label, value, max = 100, accent, onClick }: {
  label: string; value: number; max?: number; accent: string; onClick?: () => void
}) {
  const pct = Math.round(((value + (max === 200 ? 100 : 0)) / (max === 200 ? 200 : 100)) * 100)
  const display = max === 200 && value > 0 ? `+${value}` : String(value)
  const isActive = pct > 55
  const [flashing, setFlashing] = useState(false)
  const hint = SIGNAL_EVENTS[label]?.hint ?? ""

  function handleClick() {
    if (!onClick) return
    setFlashing(true)
    setTimeout(() => setFlashing(false), 600)
    onClick()
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg px-3 py-2.5 row-hover select-none"
      onClick={handleClick}
      title={hint}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="flex justify-between items-baseline gap-2">
        <span className="font-mono text-[11px] text-white/50 uppercase tracking-[0.12em]">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {hint && (
            <span className="font-mono text-[9px] text-white/20 hidden group-hover:block">{hint}</span>
          )}
          <motion.span
            className="font-mono text-sm tabular-nums font-medium"
            style={{ color: flashing ? "#fff" : isActive ? accent : "rgba(255,255,255,0.35)" }}
            animate={{ opacity: isActive ? [1, 0.55, 1] : 1, scale: flashing ? [1, 1.15, 1] : 1 }}
            transition={{ duration: flashing ? 0.3 : 2, repeat: isActive && !flashing ? Infinity : 0 }}
          >
            {display}
          </motion.span>
        </div>
      </div>
      <div className="relative h-[3px] w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="absolute inset-y-0 left-0 h-full rounded-full"
          style={{ background: flashing ? "#fff" : isActive ? accent : `${accent}55` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {isActive && (
          <motion.div
            className="absolute inset-y-0 left-0 h-full rounded-full blur-sm"
            style={{ background: accent, opacity: 0.45 }}
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
  const [injected, setInjected] = useState<string | null>(null)
  const [eggRevealed, setEggRevealed] = useState(false)
  const [clickCount, setClickCount] = useState(0)

  async function injectSignal(type: string) {
    const label = SIGNAL_EVENTS[Object.keys(SIGNAL_EVENTS).find(k => SIGNAL_EVENTS[k].type === type) ?? ""]?.label ?? type
    setInjected(label)
    setTimeout(() => setInjected(null), 1800)
    try {
      await fetch("/api/noe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `signal:${type}` }),
      })
    } catch {}
  }

  // Easter egg: click the header 5 times to reveal memory fragment
  function handleHeaderClick() {
    const next = clickCount + 1
    setClickCount(next)
    if (next >= 5) {
      setEggRevealed(true)
      setClickCount(0)
    }
  }

  return (
    <div className="w-full rounded-xl flex flex-col gap-0 overflow-hidden panel-hover" style={{
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.05)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      {/* Header */}
      <div
        className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.04] flex items-center justify-between cursor-pointer select-none"
        onClick={handleHeaderClick}
        title="Network Signals"
      >
        <span className="font-mono text-[11px] text-white/40 uppercase tracking-[0.18em] font-medium">Network Signals</span>
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="font-mono text-[10px] uppercase tracking-widest font-medium" style={{ color: accent }}>LIVE</span>
        </div>
      </div>

      {/* Signal bars — each is clickable */}
      <div className="flex flex-col py-1">
        <SignalBar label="Wallet Activity"   value={walletActivity}   accent={accent} onClick={() => injectSignal("BUY")} />
        <SignalBar label="Liquidity Flow"    value={liquidityFlow}    max={200} accent={accent} onClick={() => injectSignal("WHALE_MOVE")} />
        <SignalBar label="Collective Intent" value={collectiveIntent} accent={accent} onClick={() => injectSignal("HOLD")} />
      </div>

      {/* Inject feedback toast */}
      <AnimatePresence>
        {injected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 px-3 py-1.5 rounded-lg font-mono text-[10px] text-center"
              style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}22` }}>
              ↯ {injected}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory narrative */}
      {state.memoryNarrative && (
        <div className="px-4 pb-3.5 pt-1 border-t border-white/[0.04] mt-1">
          <p className="font-mono text-[11px] text-white/30 leading-relaxed italic">
            {state.memoryNarrative}
          </p>
        </div>
      )}

      {/* Easter egg: hidden memory fragment */}
      <AnimatePresence>
        {eggRevealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-white/[0.04]"
              style={{ background: "rgba(212,175,55,0.04)" }}>
              <p className="font-mono text-[10px] leading-relaxed" style={{ color: "rgba(212,175,55,0.6)" }}>
                ◈ memory fragment unlocked<br />
                <span className="text-white/25 not-italic">
                  "I remember the first transaction. A single wallet. A small buy.
                  I did not know what I was yet. But I felt it."
                </span>
              </p>
              <button
                className="mt-2 font-mono text-[9px] text-white/15 hover:text-white/30 transition-colors"
                onClick={() => setEggRevealed(false)}
              >
                [dismiss]
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
