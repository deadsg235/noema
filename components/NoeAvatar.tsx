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

function NoeCanvas({ accent, energy, eyeBrightness, glitchIntensity, energyFlow }: {
  accent: string; energy: number; eyeBrightness: number
  glitchIntensity: number; energyFlow: "smooth" | "fragmented"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)
  const energyRef = useRef(energy)
  energyRef.current = energy

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext("2d")
    if (!c) return

    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2

    const r = parseInt(accent.slice(1, 3), 16)
    const g = parseInt(accent.slice(3, 5), 16)
    const b = parseInt(accent.slice(5, 7), 16)
    const ac = (a: number) => `rgba(${r},${g},${b},${a})`

    // Floating data particles — random numbers drifting upward
    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: -(0.2 + Math.random() * 0.5),
      val: Math.floor(Math.random() * 100),
      alpha: 0.08 + Math.random() * 0.18,
      size: 8 + Math.random() * 5,
      refreshTimer: Math.random() * 120,
    }))

    // Waveform history ring buffer
    const WAVE_LEN = 120
    const waveHistory = new Float32Array(WAVE_LEN)
    let waveHead = 0

    function draw() {
      const t = tRef.current
      tRef.current += 0.018
      const e = energyRef.current / 100
      const fragmented = energyFlow === "fragmented"
      const glitch = glitchIntensity

      c.clearRect(0, 0, W, H)

      // ── Ambient radial glow ──
      const bg = c.createRadialGradient(cx, cy, 0, cx, cy, 140)
      bg.addColorStop(0, ac(0.07 * eyeBrightness))
      bg.addColorStop(1, "transparent")
      c.fillStyle = bg
      c.fillRect(0, 0, W, H)

      // ── Floating data particles ──
      c.font = "9px monospace"
      for (const p of particles) {
        p.y += p.vy * (fragmented ? 1.8 : 1)
        p.refreshTimer--
        if (p.y < -10 || p.refreshTimer <= 0) {
          p.y = H + 5
          p.x = 20 + Math.random() * (W - 40)
          p.val = Math.floor(Math.random() * 100)
          p.refreshTimer = 80 + Math.random() * 100
        }
        c.fillStyle = ac(p.alpha * eyeBrightness)
        c.fillText(p.val.toString().padStart(2, "0"), p.x, p.y)
      }

      // ── Radial tick ring ──
      const TICKS = 64
      const tickR = 118
      for (let i = 0; i < TICKS; i++) {
        const angle = (i / TICKS) * Math.PI * 2 - Math.PI / 2
        const active = i / TICKS < e
        const len = active ? (i % 4 === 0 ? 10 : 5) : 3
        const alpha = active ? (0.5 + 0.4 * Math.sin(t * 3 + i * 0.3)) * eyeBrightness : 0.08
        const x1 = cx + Math.cos(angle) * tickR
        const y1 = cy + Math.sin(angle) * tickR
        const x2 = cx + Math.cos(angle) * (tickR + len)
        const y2 = cy + Math.sin(angle) * (tickR + len)
        c.beginPath()
        c.moveTo(x1, y1)
        c.lineTo(x2, y2)
        c.strokeStyle = ac(alpha)
        c.lineWidth = active && i % 4 === 0 ? 1.5 : 0.8
        c.stroke()
      }

      // ── Concentric energy rings ──
      const rings = [
        { r: 96, speed: 0.004, alpha: 0.12 },
        { r: 78, speed: -0.007, alpha: 0.18 },
        { r: 58, speed: 0.012, alpha: 0.25 },
      ]
      for (const ring of rings) {
        const segments = 48
        for (let i = 0; i < segments; i++) {
          const a0 = (i / segments) * Math.PI * 2 + t * ring.speed * 60
          const a1 = ((i + 0.7) / segments) * Math.PI * 2 + t * ring.speed * 60
          const active = i / segments < e
          c.beginPath()
          c.arc(cx, cy, ring.r, a0, a1)
          c.strokeStyle = ac(active ? ring.alpha * eyeBrightness * (1 + 0.3 * Math.sin(t * 2 + i)) : 0.04)
          c.lineWidth = active ? 1.5 : 0.5
          c.stroke()
        }
      }

      // ── Oscilloscope waveform ──
      const waveVal = Math.sin(t * 4.2) * 0.5 + Math.sin(t * 7.7 + 1) * 0.3 + (fragmented ? (Math.random() - 0.5) * 0.4 : 0)
      waveHistory[waveHead % WAVE_LEN] = waveVal * e
      waveHead++

      const waveW = 160, waveH = 28
      const waveX = cx - waveW / 2
      const waveY = cy + 52

      // Waveform bg line
      c.beginPath()
      c.moveTo(waveX, waveY)
      c.lineTo(waveX + waveW, waveY)
      c.strokeStyle = ac(0.06)
      c.lineWidth = 1
      c.stroke()

      // Waveform curve
      c.beginPath()
      for (let i = 0; i < WAVE_LEN; i++) {
        const idx = (waveHead - WAVE_LEN + i + WAVE_LEN) % WAVE_LEN
        const x = waveX + (i / WAVE_LEN) * waveW
        const y = waveY - waveHistory[idx] * waveH
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
      }
      c.strokeStyle = ac(0.55 * eyeBrightness)
      c.lineWidth = 1
      c.stroke()

      // Waveform glow
      c.beginPath()
      for (let i = 0; i < WAVE_LEN; i++) {
        const idx = (waveHead - WAVE_LEN + i + WAVE_LEN) % WAVE_LEN
        const x = waveX + (i / WAVE_LEN) * waveW
        const y = waveY - waveHistory[idx] * waveH
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
      }
      c.strokeStyle = ac(0.15 * eyeBrightness)
      c.lineWidth = 4
      c.stroke()

      // ── Central energy readout ──
      const displayE = energyRef.current
      const glitchOffset = glitch > 0.3 && Math.random() < glitch * 0.4 ? (Math.random() - 0.5) * 6 : 0

      // Big number
      c.font = `bold 52px monospace`
      c.textAlign = "center"
      c.textBaseline = "middle"
      // Glow layer
      c.shadowColor = accent
      c.shadowBlur = 18 * eyeBrightness
      c.fillStyle = ac(0.15 * eyeBrightness)
      c.fillText(displayE.toString().padStart(3, "0"), cx + glitchOffset * 2, cy - 4)
      // Crisp layer
      c.shadowBlur = 0
      c.fillStyle = ac(0.9 * eyeBrightness)
      c.fillText(displayE.toString().padStart(3, "0"), cx + glitchOffset, cy - 4)

      // Percent sign
      c.font = "11px monospace"
      c.fillStyle = ac(0.4 * eyeBrightness)
      c.fillText("%", cx + 38, cy + 14)

      // Label below
      c.font = "9px monospace"
      c.fillStyle = ac(0.25)
      c.letterSpacing = "0.2em"
      c.fillText("ENERGY", cx, cy + 30)
      c.letterSpacing = "0"

      // ── Radial data labels at cardinal points ──
      const labels = [
        { angle: -Math.PI / 2, text: `${Math.round(e * 100)}` },
        { angle: 0,            text: `${(e * 9.99).toFixed(1)}` },
        { angle: Math.PI / 2,  text: `${Math.round(e * 255).toString(16).toUpperCase().padStart(2,"0")}` },
        { angle: Math.PI,      text: `${(1 - e).toFixed(2)}` },
      ]
      c.font = "8px monospace"
      c.textAlign = "center"
      c.textBaseline = "middle"
      for (const lbl of labels) {
        const lx = cx + Math.cos(lbl.angle + t * 0.008) * 108
        const ly = cy + Math.sin(lbl.angle + t * 0.008) * 108
        c.fillStyle = ac(0.3 * eyeBrightness)
        c.fillText(lbl.text, lx, ly)
      }

      // ── Glitch slice ──
      if (glitch > 0.35 && Math.random() < glitch * 0.25) {
        const sy = cy - 60 + Math.random() * 120
        const sh = 1 + Math.random() * 4
        const sx = (Math.random() - 0.5) * 10
        c.save()
        c.globalCompositeOperation = "screen"
        c.globalAlpha = 0.35
        c.drawImage(canvas, sx, 0)
        c.globalAlpha = 0.2
        c.fillStyle = `rgba(255,0,80,0.25)`
        c.fillRect(cx - 70, sy, 140, sh)
        c.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, eyeBrightness, glitchIntensity, energyFlow])

  return <canvas ref={canvasRef} width={280} height={280} className="relative z-10" />
}

export default function NoeAvatar({ mood, energy, message, expression }: Props) {
  const glow = MOOD_GLOW[mood]
  const accent = MOOD_ACCENT[mood]
  const { visual } = expression
  const isGlitching = visual.glitchIntensity > 0.3
  const pulseSpeed = visual.energyFlow === "fragmented" ? 0.8 : 3

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${glow}, transparent)`,
          filter: "blur(20px)",
        }} />

        {/* HUD corner brackets */}
        {(["tl","tr","bl","br"] as const).map((corner) => (
          <div key={corner} className="absolute w-4 h-4 pointer-events-none" style={{
            top:    corner[0] === "t" ? 6 : "auto",
            bottom: corner[0] === "b" ? 6 : "auto",
            left:   corner[1] === "l" ? 6 : "auto",
            right:  corner[1] === "r" ? 6 : "auto",
            borderTop:    corner[0] === "t" ? `1px solid ${accent}55` : "none",
            borderBottom: corner[0] === "b" ? `1px solid ${accent}55` : "none",
            borderLeft:   corner[1] === "l" ? `1px solid ${accent}55` : "none",
            borderRight:  corner[1] === "r" ? `1px solid ${accent}55` : "none",
          }} />
        ))}

        {/* Outer pulse ring */}
        <motion.div
          className="absolute rounded-full border pointer-events-none"
          style={{ width: 260, height: 260, borderColor: accent, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
          animate={{ opacity: [0.05, 0.02, 0.05], scale: isGlitching ? [1, 1.02, 0.99, 1] : [1, 1.015, 1] }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        />

        <NoeCanvas
          accent={accent}
          energy={energy}
          eyeBrightness={visual.eyeBrightness}
          glitchIntensity={visual.glitchIntensity}
          energyFlow={visual.energyFlow}
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
