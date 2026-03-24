"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import NoeAvatar from "@/components/NoeAvatar"
import NoeChat from "@/components/NoeChat"
import NetworkPulse from "@/components/NetworkPulse"
import NoeStateMatrix from "@/components/NoeStateMatrix"
import NoeVisualizer from "@/components/NoeVisualizer"
import WalletButton from "@/components/WalletButton"
import WalletPanel from "@/components/WalletPanel"
import { MOOD_COLORS, MOOD_ACCENT, NOEMA_CA, type NoeUIState } from "@/lib/noe-state"
import { NeuralNetSnapshot } from "@/lib/noe-engine/neural"

function CABar({ accent }: { accent: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(NOEMA_CA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-center gap-4">
      <span className="font-mono text-[9px] text-white/15 uppercase tracking-[0.25em] hidden sm:block">CONTRACT</span>
      <span className="font-mono text-[11px] text-white/30 tracking-wider break-all text-center">{NOEMA_CA}</span>
      <button
        onClick={copy}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[9px] uppercase tracking-widest transition-all"
        style={{
          borderColor: copied ? `${accent}55` : "rgba(255,255,255,0.06)",
          color: copied ? accent : "rgba(255,255,255,0.2)",
          background: copied ? `${accent}0d` : "transparent",
        }}
      >
        {copied ? "✓ copied" : "copy"}
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
  const [neuralSnap, setNeuralSnap] = useState<NeuralNetSnapshot | undefined>()
  const [booted, setBooted] = useState(false)
  const [milestone, setMilestone] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"signals" | "wallet" | "visualizer">("signals")
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
      className="min-h-screen flex flex-col relative"
      animate={{ backgroundColor: bg }}
      transition={{ duration: 2.5 }}
      style={{ backgroundColor: bg }}
    >
      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
      }} />

      {/* Ambient vignette */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 60%, rgba(0,0,0,0.4) 100%)",
      }} />

      {/* ── Header ── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.04]" style={{
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(20px)",
      }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: accent }}
              animate={{ opacity: [1, 0.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: accent }}
              animate={{ scale: [1, 2.5, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <span className="font-mono text-sm font-bold tracking-[0.22em] text-white/85">NOEMA</span>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-white/10">·</span>
            <span className="font-mono text-[10px] text-white/20 uppercase tracking-[0.18em]">Neural Operational Engine</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-white/15 uppercase tracking-widest">v0.2.0</span>
          </div>
          <motion.div
            className="flex items-center gap-1.5 px-2 py-1 rounded border"
            style={{ borderColor: `${accent}22`, background: `${accent}08` }}
            animate={{ borderColor: [`${accent}22`, `${accent}44`, `${accent}22`] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <motion.div className="w-1 h-1 rounded-full" style={{ background: accent }}
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: accent }}>ON-CHAIN</span>
          </motion.div>
          <WalletButton mood={state.mood} />
        </div>
      </header>

      {/* ── Milestone toast ── */}
      <AnimatePresence>
        {milestone && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full font-mono text-[10px] border whitespace-nowrap"
            style={{
              background: `${accent}12`,
              borderColor: `${accent}33`,
              color: accent,
              backdropFilter: "blur(16px)",
              boxShadow: `0 0 24px ${accent}22`,
            }}
          >
            ◈ {milestone}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-8 pb-4 px-6 text-center gap-1.5">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : 16 }}
          transition={{ duration: 0.7 }}
          className="text-4xl md:text-5xl font-bold text-white/90 tracking-tight"
        >
          Meet{" "}
          <motion.span style={{ color: accent }} animate={{ color: accent }} transition={{ duration: 2 }}>
            Noe
          </motion.span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: booted ? 1 : 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="text-white/25 font-mono text-[11px] max-w-xs leading-relaxed tracking-wide"
        >
          Self-evolving neural intelligence — continuously shaped by on-chain behavior.
        </motion.p>
      </section>

      {/* ── Mobile tabs ── */}
      <div className="relative z-10 flex lg:hidden gap-px mx-4 mt-2 p-px rounded-lg overflow-hidden" style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}>
        {(["signals", "wallet", "visualizer"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-1.5 rounded font-mono text-[9px] uppercase tracking-widest transition-all"
            style={activeTab === tab
              ? { background: `${accent}18`, color: accent }
              : { color: "rgba(255,255,255,0.2)" }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-3 px-4 md:px-5 pb-8 pt-3 max-w-[1440px] mx-auto w-full">

        {/* ── Left panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: booted ? 1 : 0, x: 0 }}
          transition={{ duration: 0.55, delay: 0.35 }}
          className="flex flex-col gap-3 xl:col-span-1"
        >
          <div className={activeTab === "signals" ? "flex flex-col gap-3" : "hidden lg:flex flex-col gap-3"}>
            <NetworkPulse state={state} />
            <NoeStateMatrix state={state} />
          </div>
          <div className={activeTab === "wallet" ? "flex flex-col gap-3" : "hidden lg:flex flex-col gap-3"}>
            <WalletPanel state={state} onStateUpdate={handleStateUpdate} />
          </div>
        </motion.div>

        {/* ── Center: Avatar ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: booted ? 1 : 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="flex items-center justify-center py-2 lg:col-span-1"
        >
          <NoeAvatar
            mood={state.mood}
            energy={state.energy}
            message={state.message}
            expression={state.expression}
            engineState={state.engineState}
            neuralSnapshot={neuralSnap}
          />
        </motion.div>

        {/* ── Right: Chat ── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: booted ? 1 : 0, x: 0 }}
          transition={{ duration: 0.55, delay: 0.35 }}
          className="flex flex-col min-h-[440px] max-h-[600px] lg:col-span-1 rounded-xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.04] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/25 uppercase tracking-[0.2em]">Talk to Noe</span>
            </div>
            <span className="font-mono text-[9px] text-white/15" suppressHydrationWarning>
              {state.timestamp ? new Date(state.timestamp).toLocaleTimeString() : "--:--:--"}
            </span>
          </div>
          <NoeChat state={state} onStateUpdate={setState} onNeuralUpdate={setNeuralSnap} />
        </motion.div>

        {/* ── Far right: Noe Visualized ── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: booted ? 1 : 0, x: 0 }}
          transition={{ duration: 0.55, delay: 0.45 }}
          className={`xl:col-span-1 flex flex-col gap-3 ${activeTab === "visualizer" ? "flex" : "hidden xl:flex"}`}
        >
          <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              minHeight: 420,
            }}
          >
            <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.04] flex items-center justify-between shrink-0">
              <span className="font-mono text-[10px] text-white/25 uppercase tracking-[0.2em]">Noe Visualized</span>
              <div className="flex items-center gap-1.5">
                <motion.div className="w-1 h-1 rounded-full" style={{ background: accent }}
                  animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: accent }}>LIVE</span>
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: 370 }}>
              <NoeVisualizer state={state} neuralSnapshot={neuralSnap} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── CA Bar ── */}
      <div className="relative z-10">
        <CABar accent={accent} />
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.03] px-6 py-3 flex items-center justify-between font-mono text-[9px] text-white/10 tracking-widest uppercase">
        <span>NOEMA © 2025</span>
        <span className="hidden sm:block">N.O.E — Self-evolving neural intelligence</span>
        <span style={{ color: `${accent}44` }}>{state.cluster.replace("_", " ")}</span>
      </footer>
    </motion.main>
  )
}
