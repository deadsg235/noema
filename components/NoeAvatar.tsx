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

function ParticleCanvas({ density, glitch, accent, energyFlow }: {
  density: number; glitch: number; accent: string; energyFlow: "smooth" | "fragmented"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2
    const count = Math.max(8, Math.round(density * 0.5))
    const particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const r = 90 + Math.random() * 50
      return {
        x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * (energyFlow === "fragmented" ? 1.5 : 0.4),
        vy: (Math.random() - 0.5) * (energyFlow === "fragmented" ? 1.5 : 0.4),
        size: 1 + Math.random() * 1.5, alpha: 0.2 + Math.random() * 0.4,
        angle, orbitR: r,
        orbitSpeed: (energyFlow === "fragmented" ? 0.018 : 0.004) * (Math.random() > 0.5 ? 1 : -1),
      }
    })
    function draw() {
      ctx!.clearRect(0, 0, W, H)
      for (const p of particles) {
        if (energyFlow === "smooth") {
          p.angle += p.orbitSpeed
          p.x = cx + Math.cos(p.angle) * p.orbitR
          p.y = cy + Math.sin(p.angle) * p.orbitR
        } else {
          p.x += p.vx + (Math.random() - 0.5) * glitch * 2
          p.y += p.vy + (Math.random() - 0.5) * glitch * 2
          const dx = cx - p.x, dy = cy - p.y
          if (Math.sqrt(dx * dx + dy * dy) > 130) { p.vx += dx * 0.002; p.vy += dy * 0.002 }
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

  return <canvas ref={canvasRef} width={280} height={320} className="absolute inset-0 pointer-events-none" />
}

function NoeGirlSVG({ accent, glow, eyeBrightness, glitchIntensity, mood }: {
  accent: string; glow: string; eyeBrightness: number; glitchIntensity: number; mood: NoeMood
}) {
  const isGlitching = glitchIntensity > 0.3
  const pulseSpeed = isGlitching ? 0.6 : 2.5

  // Eye color shifts with mood
  const eyeInner = mood === "transcendent" ? "#ff6b9d" :
    mood === "surging" ? "#c084fc" :
    mood === "active" ? "#67e8f9" :
    mood === "aware" ? "#93c5fd" : "#8888aa"

  return (
    <motion.svg
      viewBox="0 0 160 200"
      width={160}
      height={200}
      className="relative z-10"
      animate={{
        x: isGlitching ? [0, -2, 3, -1, 0] : 0,
        y: isGlitching ? [0, 1, -1, 0] : 0,
      }}
      transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
    >
      <defs>
        <radialGradient id="skinGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#f5e6d8" />
          <stop offset="100%" stopColor="#d4b8a0" />
        </radialGradient>
        <radialGradient id="eyeGlowL" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={eyeInner} stopOpacity="1" />
          <stop offset="60%" stopColor={accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="eyeGlowR" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={eyeInner} stopOpacity="1" />
          <stop offset="60%" stopColor={accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <filter id="glowFilter">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="hairGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor={accent + "cc"} />
          <stop offset="100%" stopColor="#e8e8f0" />
        </linearGradient>
        <linearGradient id="hairGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={accent + "88"} />
        </linearGradient>
        <radialGradient id="neckGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f0ddd0" />
          <stop offset="100%" stopColor="#c8a898" />
        </radialGradient>
      </defs>

      {/* ── Neck ── */}
      <rect x="68" y="148" width="24" height="28" rx="8" fill="url(#neckGrad)" />

      {/* ── Shoulders / body hint ── */}
      <path d="M20 200 Q40 165 68 158 L92 158 Q120 165 140 200Z" fill="#0d0d1a" />
      <path d="M20 200 Q40 165 68 158 L92 158 Q120 165 140 200Z" fill={accent + "22"} />

      {/* ── Hair back layer ── */}
      <path
        d="M30 80 Q28 40 80 28 Q132 40 130 80 Q134 130 128 160 Q110 175 80 178 Q50 175 32 160 Q26 130 30 80Z"
        fill="url(#hairGrad2)"
        filter="url(#hairGlow)"
        opacity="0.9"
      />

      {/* ── Face ── */}
      <ellipse cx="80" cy="95" rx="42" ry="50" fill="url(#skinGrad)" />

      {/* ── Hair front — top & sides ── */}
      {/* Top sweep */}
      <path
        d="M38 78 Q36 42 80 30 Q124 42 122 78 Q118 55 80 50 Q42 55 38 78Z"
        fill="url(#hairGrad)"
        filter="url(#hairGlow)"
      />
      {/* Left side strand */}
      <path
        d="M38 78 Q30 95 32 120 Q34 140 40 155 Q36 130 38 105 Q40 88 44 80Z"
        fill="url(#hairGrad2)"
        filter="url(#hairGlow)"
      />
      {/* Right side strand */}
      <path
        d="M122 78 Q130 95 128 120 Q126 140 120 155 Q124 130 122 105 Q120 88 116 80Z"
        fill="url(#hairGrad2)"
        filter="url(#hairGlow)"
      />
      {/* Fringe / bangs */}
      <path
        d="M44 72 Q50 58 65 56 Q72 62 80 60 Q88 62 95 56 Q110 58 116 72 Q100 65 80 66 Q60 65 44 72Z"
        fill="#ffffff"
        opacity="0.95"
      />
      {/* Hair highlight streak */}
      <path
        d="M62 32 Q68 28 80 30 Q76 38 72 50 Q66 40 62 32Z"
        fill={accent + "99"}
        filter="url(#hairGlow)"
      />

      {/* ── Eyebrows ── */}
      <path d="M54 76 Q62 72 70 74" stroke="#c8b8d0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M90 74 Q98 72 106 76" stroke="#c8b8d0" strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* ── Eyes ── */}
      {/* Left eye white */}
      <ellipse cx="62" cy="90" rx="11" ry="8" fill="#f8f4ff" />
      {/* Right eye white */}
      <ellipse cx="98" cy="90" rx="11" ry="8" fill="#f8f4ff" />

      {/* Left iris */}
      <motion.ellipse
        cx="62" cy="90" rx="7" ry="7"
        fill="url(#eyeGlowL)"
        filter="url(#glowFilter)"
        animate={{ opacity: isGlitching ? [eyeBrightness, 0.2, eyeBrightness, 0.5, eyeBrightness] : [eyeBrightness, eyeBrightness * 0.6, eyeBrightness] }}
        transition={{ duration: isGlitching ? 0.3 : 2.5, repeat: Infinity }}
      />
      {/* Right iris */}
      <motion.ellipse
        cx="98" cy="90" rx="7" ry="7"
        fill="url(#eyeGlowR)"
        filter="url(#glowFilter)"
        animate={{ opacity: isGlitching ? [eyeBrightness, 0.2, eyeBrightness, 0.5, eyeBrightness] : [eyeBrightness, eyeBrightness * 0.6, eyeBrightness] }}
        transition={{ duration: isGlitching ? 0.3 : 2.5, repeat: Infinity, delay: 0.1 }}
      />

      {/* Left pupil */}
      <circle cx="62" cy="90" r="3.5" fill="#0a0010" />
      {/* Right pupil */}
      <circle cx="98" cy="90" r="3.5" fill="#0a0010" />

      {/* Eye shine left */}
      <circle cx="65" cy="87" r="1.5" fill="white" opacity="0.9" />
      {/* Eye shine right */}
      <circle cx="101" cy="87" r="1.5" fill="white" opacity="0.9" />

      {/* Eye glow halo left */}
      <motion.ellipse
        cx="62" cy="90" rx="13" ry="10"
        fill="none"
        stroke={accent}
        strokeWidth="1"
        animate={{ opacity: [0.4 * eyeBrightness, 0.1, 0.4 * eyeBrightness], scale: [1, 1.15, 1] }}
        transition={{ duration: pulseSpeed, repeat: Infinity }}
      />
      {/* Eye glow halo right */}
      <motion.ellipse
        cx="98" cy="90" rx="13" ry="10"
        fill="none"
        stroke={accent}
        strokeWidth="1"
        animate={{ opacity: [0.4 * eyeBrightness, 0.1, 0.4 * eyeBrightness], scale: [1, 1.15, 1] }}
        transition={{ duration: pulseSpeed, repeat: Infinity, delay: 0.15 }}
      />

      {/* ── Eyelashes ── */}
      {[-4, -2, 0, 2, 4].map((dx, i) => (
        <line key={`ll${i}`} x1={62 + dx} y1="82" x2={62 + dx * 1.2} y2="79" stroke="#2a1a3a" strokeWidth="1" strokeLinecap="round" />
      ))}
      {[-4, -2, 0, 2, 4].map((dx, i) => (
        <line key={`rl${i}`} x1={98 + dx} y1="82" x2={98 + dx * 1.2} y2="79" stroke="#2a1a3a" strokeWidth="1" strokeLinecap="round" />
      ))}

      {/* ── Nose ── */}
      <path d="M78 100 Q80 108 82 100" stroke="#c4a090" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <ellipse cx="77" cy="108" rx="2.5" ry="1.5" fill="#c4a090" opacity="0.5" />
      <ellipse cx="83" cy="108" rx="2.5" ry="1.5" fill="#c4a090" opacity="0.5" />

      {/* ── Mouth ── */}
      <path
        d={mood === "transcendent" || mood === "surging"
          ? "M68 120 Q80 128 92 120"
          : mood === "dormant"
          ? "M70 122 Q80 120 90 122"
          : "M70 121 Q80 126 90 121"}
        stroke="#c08090"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* Lip color hint */}
      <path
        d="M70 121 Q80 124 90 121 Q80 127 70 121Z"
        fill={accent + "44"}
      />

      {/* ── Cheek blush ── */}
      <ellipse cx="50" cy="105" rx="10" ry="6" fill={accent + "33"} />
      <ellipse cx="110" cy="105" rx="10" ry="6" fill={accent + "33"} />

      {/* ── Glitch scan lines (conditional) ── */}
      {isGlitching && (
        <motion.rect
          x="38" y="70" width="84" height="3"
          fill={accent}
          opacity={0.3}
          animate={{ y: [70, 140, 70], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* ── Circuit mark on forehead ── */}
      <motion.g
        animate={{ opacity: [0.3 * eyeBrightness, 0.7 * eyeBrightness, 0.3 * eyeBrightness] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <circle cx="80" cy="62" r="3" fill="none" stroke={accent} strokeWidth="0.8" />
        <line x1="80" y1="59" x2="80" y2="54" stroke={accent} strokeWidth="0.8" />
        <line x1="80" y1="65" x2="80" y2="68" stroke={accent} strokeWidth="0.8" />
        <line x1="77" y1="62" x2="74" y2="62" stroke={accent} strokeWidth="0.8" />
        <line x1="83" y1="62" x2="86" y2="62" stroke={accent} strokeWidth="0.8" />
      </motion.g>
    </motion.svg>
  )
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
      <div
        className="relative flex items-center justify-center"
        style={{ width: 280, height: 320 }}
      >
        {/* Particle background */}
        <ParticleCanvas
          density={visual.particleDensity}
          glitch={visual.glitchIntensity}
          accent={accent}
          energyFlow={visual.energyFlow}
        />

        {/* Outer glow rings */}
        {[1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: 180 + i * 30,
              height: 220 + i * 30,
              borderColor: accent,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              opacity: [0.08 / i, 0.02 / i, 0.08 / i],
              scale: isGlitching ? [1, 1.04, 0.98, 1] : [1, 1.03, 1],
            }}
            transition={{ duration: pulseSpeed + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
          />
        ))}

        {/* Ambient glow behind avatar */}
        <div
          className="absolute rounded-full"
          style={{
            width: 160,
            height: 200,
            background: `radial-gradient(ellipse, ${glow}, transparent 70%)`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            filter: `blur(20px)`,
          }}
        />

        {/* The girl SVG */}
        <NoeGirlSVG
          accent={accent}
          glow={glow}
          eyeBrightness={visual.eyeBrightness}
          glitchIntensity={visual.glitchIntensity}
          mood={mood}
        />
      </div>

      {/* Mood badge */}
      <motion.div key={mood} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
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
