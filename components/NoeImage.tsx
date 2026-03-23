"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, MOOD_GLOW, type NoeUIState } from "@/lib/noe-state"

interface Props {
  state: NoeUIState
  autoRefreshMs?: number   // 0 = manual only
}

interface ImageResult {
  imageUrl: string
  prompt: string
  provider: string
}

export default function NoeImage({ state, autoRefreshMs = 0 }: Props) {
  const [result, setResult] = useState<ImageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accent = MOOD_ACCENT[state.mood]
  const glow = MOOD_GLOW[state.mood]

  const generate = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/noe/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engineState: state.engineState,
          mood: state.mood,
          cluster: state.cluster,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setLoading(false)
    }
  }, [state.engineState, state.mood, state.cluster, loading])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefreshMs) return
    timerRef.current = setTimeout(generate, autoRefreshMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [autoRefreshMs, generate])

  // Generate on first mount
  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Image frame */}
      <div
        className="relative w-full aspect-square rounded-xl overflow-hidden border"
        style={{ borderColor: `${accent}33`, boxShadow: `0 0 30px ${glow}` }}
      >
        {/* Loading shimmer */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
              style={{ background: "#0d0d1a" }}
            >
              {/* Animated scan lines */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${accent}08 2px, ${accent}08 4px)`,
                }}
                animate={{ backgroundPositionY: ["0px", "100px"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="w-16 h-16 rounded-full border-2"
                style={{ borderColor: `${accent}44`, borderTopColor: accent }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="font-mono text-xs uppercase tracking-widest z-10" style={{ color: accent }}>
                Noe is forming...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image */}
        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.img
              key={result.imageUrl}
              src={result.imageUrl}
              alt={`Noe — ${state.mood}`}
              className="w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-xs text-white/20">No image yet</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <span className="font-mono text-xs text-red-400/60 text-center">{error}</span>
          </div>
        )}

        {/* Mood overlay badge */}
        {result && !loading && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded"
              style={{ background: `${accent}22`, color: accent, backdropFilter: "blur(8px)" }}
            >
              {state.mood}
            </span>
            <span
              className="font-mono text-[10px] text-white/30 px-2 py-1 rounded"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
            >
              {result.provider}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={generate}
          disabled={loading}
          className="flex-1 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all disabled:opacity-30 border"
          style={{ borderColor: `${accent}44`, color: accent, background: `${accent}11` }}
        >
          {loading ? "Generating..." : "↺ Regenerate"}
        </button>
        {result && (
          <button
            onClick={() => setShowPrompt((v) => !v)}
            className="px-3 py-2 rounded-lg font-mono text-xs text-white/30 border border-white/5 hover:border-white/10 transition-colors"
          >
            {showPrompt ? "Hide" : "Prompt"}
          </button>
        )}
      </div>

      {/* Prompt reveal */}
      <AnimatePresence>
        {showPrompt && result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="font-mono text-[10px] text-white/25 leading-relaxed p-3 rounded-lg border border-white/5 bg-white/[0.02]">
              {result.prompt}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
