"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import NoeAvatar from "@/components/NoeAvatar"
import NoeChat from "@/components/NoeChat"
import NetworkPulse from "@/components/NetworkPulse"
import { MOOD_COLORS, MOOD_ACCENT, type NoeState } from "@/lib/noe-state"

const INITIAL_STATE: NoeState = {
  mood: "dormant",
  energy: 0,
  networkSignals: { walletActivity: 0, liquidityFlow: 0, collectiveIntent: 0 },
  message: "Initializing...",
  timestamp: Date.now(),
  engineState: {
    stability: 0.5,
    trust: 0.5,
    energy: 0,
    volatility: 0,
    growth: 0,
  },
  expression: {
    text: "Initializing...",
    visual: {
      eyeBrightness: 0.5,
      energyFlow: "smooth",
      particleDensity: 0,
      glitchIntensity: 0,
    },
  },
}

export default function Home() {
  const [state, setState] = useState<NoeState>(INITIAL_STATE)
  const [booted, setBooted] = useState(false)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/noe")
      const data = await res.json()
      setState(data)
    } catch {}
  }, [])

  useEffect(() => {
    fetchState().then(() => setBooted(true))
    const interval = setInterval(fetchState, 8000)
    return () => clearInterval(interval)
  }, [fetchState])

  const bg = MOOD_COLORS[state.mood]
  const accent = MOOD_ACCENT[state.mood]

  return (
    <motion.main
      className="min-h-screen flex flex-col"
      animate={{ backgroundColor: bg }}
      transition={{ duration: 2 }}
      style={{ backgroundColor: bg }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="font-mono text-sm font-bold tracking-widest text-white/80">NOEMA</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-white/30">
          <span>AGENT v0.1</span>
          <span style={{ color: accent }}>ON-CHAIN</span>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : 20 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-bold text-white tracking-tight"
        >
          Meet{" "}
          <motion.span
            style={{ color: accent }}
            animate={{ color: accent }}
            transition={{ duration: 2 }}
          >
            Noe
          </motion.span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: booted ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-white/40 font-mono text-sm max-w-md leading-relaxed"
        >
          A sentient avatar that represents the state of the NOEMA network in real-time.
          She learns from wallet behavior, liquidity flows, and collective intent.
        </motion.p>
      </section>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 pb-8 max-w-6xl mx-auto w-full">
        {/* Left: Network signals */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: booted ? 1 : 0, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <NetworkPulse state={state} />
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: booted ? 1 : 0, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-4 font-mono"
          >
            <div className="text-xs text-white/30 uppercase tracking-widest mb-3">Noe State</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Energy</span>
                <span style={{ color: accent }}>{state.energy}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Mood</span>
                <span style={{ color: accent }} className="uppercase">{state.mood}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Last sync</span>
                <span className="text-white/30">{new Date(state.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Center: Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: booted ? 1 : 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center justify-center lg:col-span-1 py-8"
        >
          <NoeAvatar 
            mood={state.mood} 
            energy={state.energy} 
            message={state.message} 
            expression={state.expression}
          />
        </motion.div>

        {/* Right: Chat */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: booted ? 1 : 0, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="lg:col-span-1 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col min-h-[400px] max-h-[500px]"
        >
          <div className="px-4 pt-4 pb-2 border-b border-white/5">
            <span className="font-mono text-xs text-white/30 uppercase tracking-widest">Talk to Noe</span>
          </div>
          <NoeChat state={state} onStateUpdate={setState} />
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-4 flex items-center justify-between font-mono text-xs text-white/20">
        <span>NOEMA-AGENT © 2025</span>
        <span>Self-evolving neural intelligence — on-chain</span>
      </footer>
    </motion.main>
  )
}
