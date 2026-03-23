"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import NoeAvatar from "@/components/NoeAvatar"
import NoeChat from "@/components/NoeChat"
import NetworkPulse from "@/components/NetworkPulse"
import NoeStateMatrix from "@/components/NoeStateMatrix"
import NoeImage from "@/components/NoeImage"
import WalletButton from "@/components/WalletButton"
import WalletPanel from "@/components/WalletPanel"
import { MOOD_COLORS, MOOD_ACCENT, NOEMA_CA, type NoeUIState } from "@/lib/noe-state"

function CABar({ accent }: { accent: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(NOEMA_CA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="border-t border-white/5 px-4 py-3 flex items-center justify-center gap-3">
      <span className="font-mono text-[10px] text-white/25 uppercase tracking-widest hidden sm:block">CA</span>
      <span className="font-mono text-xs text-white/40 tracking-wider break-all text-center">{NOEMA_CA}</span>
      <button
        onClick={copy}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-[10px] uppercase tracking-widest transition-all"
        style={{
          borderColor: copied ? `${accent}66` : "rgba(255,255,255,0.08)",
          color: copied ? accent : "rgba(255,255,255,0.3)",
          background: copied ? `${accent}11` : "transparent",
        }}
      >
        {copied ? (
          <>
            <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-[10px]">✓</motion.span>
            Copied
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  )
}

const BOOT_STATE: NoeUIState = {
  mood: "dormant",
  energy: 0,
  networkSignals: { walletActivity: 0, liquidityFlow: 0, collectiveIntent: 0 },
  message: "Initializing N.O.E...",
  timestamp: 0,
  engineState: { stability: 0.5, trust: 0.5, energy: 0.3, volatility: 0.2, growth: 0.5 },
  expression: { text: "", visual: { eyeBrightness: 0.3, energyFlow: "smooth", particleDensity: 10, glitchIntensity: 0 } },
  cluster: "NEUTRAL",
  milestoneTriggered: null,
  memoryNarrative: "",
}

export default function Home() {
  const [state, setState] = useState<NoeUIState>(BOOT_STATE)
  const [booted, setBooted] = useState(false)
  const [milestone, setMilestone] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"signals" | "wallet" | "image">("signals")
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleStateUpdate = useCallback((data: NoeUIState) => {
    setState(data)
    if (data.milestoneTriggered) {
      setMilestone(data.milestoneTriggered)
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current)
      milestoneTimer.current = setTimeout(() => setMilestone(null), 4000)
    }
  }, [])

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/noe")
      const data: NoeUIState = await res.json()
      handleStateUpdate(data)
    } catch {}
  }, [handleStateUpdate])

  useEffect(() => {
    fetchState().then(() => setBooted(true))
    const interval = setInterval(fetchState, 7000)
    return () => {
      clearInterval(interval)
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current)
    }
  }, [fetchState])

  const bg = MOOD_COLORS[state.mood]
  const accent = MOOD_ACCENT[state.mood]

  return (
    <motion.main
      className="min-h-screen flex flex-col"
      animate={{ backgroundColor: bg }}
      transition={{ duration: 2.5 }}
      style={{ backgroundColor: bg }}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="font-mono text-sm font-bold tracking-[0.2em] text-white/80">NOEMA</span>
          <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest hidden md:block">
            Neural Operational Engine
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-white/20 hidden sm:block">v0.2.0</span>
          <motion.span
            className="font-mono text-xs"
            style={{ color: accent }}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ON-CHAIN
          </motion.span>
          <WalletButton mood={state.mood} />
        </div>
      </header>

      {/* ── Milestone toast ── */}
      <AnimatePresence>
        {milestone && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full font-mono text-xs border whitespace-nowrap"
            style={{
              background: `${accent}18`,
              borderColor: `${accent}44`,
              color: accent,
              backdropFilter: "blur(12px)",
            }}
          >
            ◈ MILESTONE: {milestone}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center pt-10 pb-6 px-6 text-center gap-2">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : 20 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-5xl font-bold text-white tracking-tight"
        >
          Meet{" "}
          <motion.span style={{ color: accent }} animate={{ color: accent }} transition={{ duration: 2 }}>
            Noe
          </motion.span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: booted ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-white/30 font-mono text-xs max-w-sm leading-relaxed"
        >
          Neural Operational Engine — continuously evolving intelligence mapped to blockchain behavior.
        </motion.p>
      </section>

      {/* ── Main grid ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4 md:px-6 pb-10 max-w-[1400px] mx-auto w-full">

        {/* ── Left panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: booted ? 1 : 0, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col gap-3 xl:col-span-1"
        >
          {/* Mobile tabs */}
          <div className="flex lg:hidden gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/5">
            {(["signals", "wallet", "image"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest transition-all"
                style={activeTab === tab
                  ? { background: `${accent}22`, color: accent }
                  : { color: "rgba(255,255,255,0.3)" }
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={activeTab === "signals" ? "flex flex-col gap-3" : "hidden lg:flex flex-col gap-3"}>
            <NetworkPulse state={state} />
            <NoeStateMatrix state={state} />
          </div>

          {/* Wallet panel — visible on desktop always, mobile via tab */}
          <div className={activeTab === "wallet" ? "flex flex-col gap-3" : "hidden lg:flex flex-col gap-3"}>
            <WalletPanel state={state} onStateUpdate={handleStateUpdate} />
          </div>
        </motion.div>

        {/* ── Center: Avatar ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: booted ? 1 : 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="flex items-center justify-center py-4 lg:col-span-1"
        >
          <NoeAvatar
            mood={state.mood}
            energy={state.energy}
            message={state.message}
            expression={state.expression}
          />
        </motion.div>

        {/* ── Right: Chat ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: booted ? 1 : 0, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="rounded-xl border border-white/5 bg-white/[0.02] flex flex-col min-h-[420px] max-h-[580px] lg:col-span-1"
        >
          <div className="px-4 pt-4 pb-2 border-b border-white/5 flex items-center justify-between">
            <span className="font-mono text-xs text-white/30 uppercase tracking-widest">Talk to Noe</span>
            <span className="font-mono text-[10px] text-white/20" suppressHydrationWarning>
              {state.timestamp ? new Date(state.timestamp).toLocaleTimeString() : "--:--:--"}
            </span>
          </div>
          <NoeChat state={state} onStateUpdate={setState} />
        </motion.div>

        {/* ── Far right: Image panel ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: booted ? 1 : 0, x: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className={`xl:col-span-1 flex flex-col gap-3 ${activeTab === "image" ? "flex" : "hidden xl:flex"}`}
        >
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-white/30 uppercase tracking-widest">Noe Visualized</span>
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
                {state.cluster.replace("_", " ")}
              </span>
            </div>
            <NoeImage state={state} autoRefreshMs={0} />
          </div>
        </motion.div>
      </div>

      {/* ── CA Bar ── */}
      <CABar accent={accent} />

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-4 flex items-center justify-between font-mono text-[11px] text-white/15">
        <span>NOEMA-AGENT © 2025</span>
        <span className="hidden sm:block">N.O.E — Self-evolving neural intelligence on-chain</span>
        <span style={{ color: `${accent}55` }}>{state.cluster.replace("_", " ")}</span>
      </footer>
    </motion.main>
  )
}
