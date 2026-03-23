"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_GLOW, MOOD_ACCENT, type NoeMood, type NoeUIState } from "@/lib/noe-state"

interface Props {
  mood: NoeMood
  energy: number
  message: string
  expression: NoeUIState["expression"]
}

// Canvas particle system driven by engine state
function ParticleCanvas({
  density,
  glitch,
  accent,
  energyFlow,
}: {
  density: number
  glitch: number
  accent: string
  energyFlow: "smooth" | "fragmented"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2

    const count = Math.max(8, Math.round(density * 0.6))
    const particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const r = 70 + Math.random() * 40
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * (energyFlow === "fragmented" ? 1.5 : 0.4),
        vy: (Math.random() - 0.5) * (energyFlow === "fragmented" ? 1.5 : 0.4),
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.5,
        angle,
        orbitR: r,
        orbitSpeed: (energyFlow === "fragmented" ? 0.02 : 0.005) * (Math.random() > 0.5 ? 1 : -1),
      }
    })

    let t = 0
    function draw() {
      ctx!.clearRect(0, 0, W, H)
      t += 0.016

      for (const p of particles) {
        if (energyFlow === "smooth") {
          p.angle += p.orbitSpeed
          p.x = cx + Math.cos(p.angle) * p.orbitR
          p.y = cy + Math.sin(p.angle) * p.orbitR
        } else {
          // Fragmented — chaotic drift
          p.x += p.vx + (Math.random() - 0.5) * glitch * 3
          p.y += p.vy + (Math.random() - 0.5) * glitch * 3
          // Bounce back toward center
          const dx = cx - p.x
          const dy = cy - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 120) {
            p.vx += dx * 0.002
            p.vy += dy * 0.002
          }
        }

        const flicker = energyFlow === "fragmented" ? Math.random() : 1
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fillStyle = accent + Math.round(p.alpha * flicker * 255).toString(16).padStart(2, "0")
        ctx!.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [density, glitch, accent, energyFlow])

  return <canvas ref={canvasRef} width={240} height={240} className="absolute inset-0 pointer-events-none" />
}

export default function NoeAvatar({ mood, energy, message, expression }: Props) {
  const glow = MOOD_GLOW[mood]
  const accent = MOOD_ACCENT[mood]
  const { visual } = expression
  const isGlitching = visual.glitchIntensity > 0.3
  const pulseSpeed = visual.energyFlow === "fragmented" ? 0.8 : 3

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Avatar container */}
      <div className="relative flex items-center justify-center w-60 h-60">
        {/* Particle system */}
        <ParticleCanvas
          density={visual.particleDensity}
          glitch={visual.glitchIntensity}
          accent={accent}
          energyFlow={visual.energyFlow}
        />

        {/* Outer rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: 144 + i * 28,
              height: 144 + i * 28,
              borderColor: accent,
            }}
            animate={{
              opacity: [0.12 / i, 0.04 / i, 0.12 / i],
              scale: isGlitching
                ? [1, 1.05 + i * 0.02, 0.97, 1.03, 1]
                : [1, 1.06 + i * 0.03, 1],
              rotate: isGlitching ? [0, 3, -3, 1, 0] : 0,
            }}
            transition={{
              duration: pulseSpeed + i * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}

        {/* Core orb */}
        <motion.div
          className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: `radial-gradient(circle at 32% 32%, ${accent}99, ${accent}33, #000)`,
            boxShadow: `0 0 ${40 * visual.eyeBrightness}px ${glow}, 0 0 ${80 * visual.eyeBrightness}px ${glow}, inset 0 0 30px rgba(0,0,0,0.6)`,
          }}
          animate={{
            scale: isGlitching ? [1, 1.02, 0.98, 1.01, 1] : [1, 1.03, 1],
            x: isGlitching ? [0, -3, 3, -1, 2, 0] : 0,
            y: isGlitching ? [0, 1, -2, 1, 0] : 0,
          }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Eye glow */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 48,
              height: 48,
              background: `radial-gradient(circle, ${accent}, transparent)`,
              top: "18%",
              left: "18%",
              opacity: visual.eyeBrightness,
            }}
            animate={{
              opacity: isGlitching
                ? [visual.eyeBrightness, 0.1, visual.eyeBrightness, 0.4, visual.eyeBrightness]
                : [visual.eyeBrightness, visual.eyeBrightness * 0.4, visual.eyeBrightness],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: isGlitching ? 0.3 : 2, repeat: Infinity }}
          />

          {/* Energy % */}
          <span className="relative z-10 font-mono text-sm font-bold text-white/90">
            {energy}%
          </span>
          <span className="relative z-10 font-mono text-[10px] text-white/30 uppercase tracking-widest mt-0.5">
            energy
          </span>
        </motion.div>
      </div>

      {/* Mood badge */}
      <motion.div
        key={mood}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: accent }}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: isGlitching ? 0.4 : 1.5, repeat: Infinity }}
        />
        <span className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>
          {mood}
        </span>
        {visual.energyFlow === "fragmented" && (
          <motion.span
            className="font-mono text-[10px] text-red-400/60 uppercase tracking-widest"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            [UNSTABLE]
          </motion.span>
        )}
      </motion.div>

      {/* Message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.5 }}
          className="text-center text-sm text-white/50 max-w-[260px] font-mono leading-relaxed"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
