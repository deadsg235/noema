"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_GLOW, MOOD_ACCENT, type NoeMood, type NoeUIState } from "@/lib/noe-state"
import { NeuralNetSnapshot } from "@/lib/noe-engine/neural"

interface Props {
  mood: NoeMood
  energy: number
  message: string
  expression: NoeUIState["expression"]
  engineState?: NoeUIState["engineState"]
  neuralSnapshot?: NeuralNetSnapshot
}

function NoeCanvas({
  accent, engineState, neuralSnapshot, eyeBrightness, glitchIntensity, energyFlow,
}: {
  accent: string
  engineState: NoeUIState["engineState"]
  neuralSnapshot?: NeuralNetSnapshot
  eyeBrightness: number
  glitchIntensity: number
  energyFlow: "smooth" | "fragmented"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)

  // Live refs so canvas loop always reads latest without restarting
  const stateRef = useRef(engineState)
  const snapRef = useRef(neuralSnapshot)
  const glitchRef = useRef(glitchIntensity)
  const brightnessRef = useRef(eyeBrightness)
  stateRef.current = engineState
  snapRef.current = neuralSnapshot
  glitchRef.current = glitchIntensity
  brightnessRef.current = eyeBrightness

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cv = canvas
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const c = ctx

    const W = cv.width, H = cv.height
    const cx = W / 2, cy = H / 2

    const rr = parseInt(accent.slice(1, 3), 16)
    const gg = parseInt(accent.slice(3, 5), 16)
    const bb = parseInt(accent.slice(5, 7), 16)
    const ac = (a: number) => `rgba(${rr},${gg},${bb},${Math.max(0, Math.min(1, a))})`

    // Floating data particles
    const particles = Array.from({ length: 22 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vy: -(0.15 + Math.random() * 0.4),
      val: Math.floor(Math.random() * 100),
      alpha: 0.06 + Math.random() * 0.12,
      timer: Math.random() * 120,
    }))

    // Waveform ring buffer
    const WAVE_LEN = 100
    const wave = new Float32Array(WAVE_LEN)
    let wHead = 0

    // Volatility field points — a grid that breathes
    const FIELD_COLS = 8, FIELD_ROWS = 8
    const field = Array.from({ length: FIELD_COLS * FIELD_ROWS }, (_, i) => ({
      ox: (i % FIELD_COLS) / (FIELD_COLS - 1) * W,
      oy: Math.floor(i / FIELD_COLS) / (FIELD_ROWS - 1) * H,
      phase: Math.random() * Math.PI * 2,
      freq: 0.5 + Math.random() * 1.0,
    }))

    function draw() {
      const t = tRef.current
      tRef.current += 0.016
      const s = stateRef.current
      const snap = snapRef.current
      const glitch = glitchRef.current
      const bright = brightnessRef.current
      const fragmented = energyFlow === "fragmented"

      // Smooth live values
      const energy     = s?.energy     ?? 0.5
      const trust      = s?.trust      ?? 0.5
      const volatility = s?.volatility ?? 0.2
      const stability  = s?.stability  ?? 0.5
      const growth     = s?.growth     ?? 0.5

      c.clearRect(0, 0, W, H)

      // ── 1. Volatility breathing field ──────────────────────────────
      if (volatility > 0.15) {
        for (const pt of field) {
          const disp = volatility * 14 * Math.sin(t * pt.freq + pt.phase)
          const px = pt.ox + disp
          const py = pt.oy + disp * 0.5
          const dist = Math.hypot(px - cx, py - cy)
          const fade = Math.max(0, 1 - dist / 160)
          c.beginPath()
          c.arc(px, py, 0.8, 0, Math.PI * 2)
          c.fillStyle = ac(volatility * 0.12 * fade * bright)
          c.fill()
        }
      }

      // ── 2. Ambient radial glow (trust-driven warmth) ────────────────
      const bg = c.createRadialGradient(cx, cy, 0, cx, cy, 130)
      bg.addColorStop(0, ac(0.04 + trust * 0.06))
      bg.addColorStop(0.5, ac(0.02 + energy * 0.03))
      bg.addColorStop(1, "transparent")
      c.fillStyle = bg
      c.fillRect(0, 0, W, H)

      // ── 3. Floating data particles (speed = energy) ─────────────────
      c.font = "8px monospace"
      for (const p of particles) {
        p.y += p.vy * (fragmented ? 2.2 : 1 + energy * 0.8)
        p.timer--
        if (p.y < -10 || p.timer <= 0) {
          p.y = H + 5; p.x = 15 + Math.random() * (W - 30)
          p.val = Math.floor(Math.random() * 100); p.timer = 70 + Math.random() * 90
        }
        c.fillStyle = ac(p.alpha * bright)
        c.fillText(p.val.toString().padStart(2, "0"), p.x, p.y)
      }

      // ── 4. Per-dimension arc rings ──────────────────────────────────
      // Each ring = one state dimension, different radius + color tint
      const dims = [
        { val: energy,     r: 108, label: "E", speed:  0.003 },
        { val: trust,      r:  92, label: "T", speed: -0.005 },
        { val: stability,  r:  76, label: "S", speed:  0.008 },
        { val: growth,     r:  60, label: "G", speed: -0.011 },
        { val: volatility, r:  44, label: "V", speed:  0.016 },
      ]
      for (const dim of dims) {
        const segs = 48
        const offset = t * dim.speed * 60
        for (let i = 0; i < segs; i++) {
          const a0 = (i / segs) * Math.PI * 2 + offset
          const a1 = ((i + 0.72) / segs) * Math.PI * 2 + offset
          const active = i / segs < dim.val
          const pulse = active ? 0.08 + dim.val * 0.35 * (1 + 0.25 * Math.sin(t * 2.5 + i * 0.4)) : 0.03
          c.beginPath()
          c.arc(cx, cy, dim.r, a0, a1)
          c.strokeStyle = ac(pulse * bright)
          c.lineWidth = active ? 1.8 : 0.6
          c.stroke()
        }
        // Dim label at top of each ring
        const lx = cx + Math.cos(-Math.PI / 2 + t * dim.speed * 60) * (dim.r + 6)
        const ly = cy + Math.sin(-Math.PI / 2 + t * dim.speed * 60) * (dim.r + 6)
        c.font = "7px monospace"
        c.textAlign = "center"
        c.textBaseline = "middle"
        c.fillStyle = ac(0.25 * bright)
        c.fillText(dim.label, lx, ly)
      }

      // ── 5. Neural net node graph ────────────────────────────────────
      if (snap) {
        const netX = cx, netY = cy
        // Layer positions (relative to center)
        const layers = [
          { nodes: snap.layerA, x: -52, ys: snap.layerA.map((_, i) => -56 + i * 16) },
          { nodes: snap.layerB, x:   0, ys: snap.layerB.map((_, i) => -32 + i * 16) },
          { nodes: snap.output, x:  52, ys: snap.output.map((_, i) => -32 + i * 16) },
        ]

        // Draw edges A→B
        for (let a = 0; a < snap.layerA.length; a++) {
          for (let b = 0; b < snap.layerB.length; b++) {
            const strength = snap.layerA[a] * snap.layerB[b]
            if (strength < 0.1) continue
            c.beginPath()
            c.moveTo(netX + layers[0].x, netY + layers[0].ys[a])
            c.lineTo(netX + layers[1].x, netY + layers[1].ys[b])
            c.strokeStyle = ac(strength * 0.18 * bright)
            c.lineWidth = 0.5
            c.stroke()
          }
        }
        // Draw edges B→output
        for (let b = 0; b < snap.layerB.length; b++) {
          for (let o = 0; o < snap.output.length; o++) {
            const strength = snap.layerB[b] * snap.output[o]
            if (strength < 0.1) continue
            c.beginPath()
            c.moveTo(netX + layers[1].x, netY + layers[1].ys[b])
            c.lineTo(netX + layers[2].x, netY + layers[2].ys[o])
            c.strokeStyle = ac(strength * 0.22 * bright)
            c.lineWidth = 0.5
            c.stroke()
          }
        }
        // Draw nodes
        for (const layer of layers) {
          for (let i = 0; i < layer.nodes.length; i++) {
            const v = layer.nodes[i]
            const nx = netX + layer.x
            const ny = netY + layer.ys[i]
            // Glow
            const grd = c.createRadialGradient(nx, ny, 0, nx, ny, 5)
            grd.addColorStop(0, ac(v * 0.7 * bright))
            grd.addColorStop(1, "transparent")
            c.fillStyle = grd
            c.beginPath(); c.arc(nx, ny, 5, 0, Math.PI * 2); c.fill()
            // Core dot
            c.beginPath(); c.arc(nx, ny, 1.5, 0, Math.PI * 2)
            c.fillStyle = ac(0.4 + v * 0.5)
            c.fill()
          }
        }
      }

      // ── 6. Oscilloscope waveform (stability-driven amplitude) ───────
      const wVal = Math.sin(t * 4.0) * 0.5 + Math.sin(t * 7.3 + 1.2) * 0.3
        + (fragmented ? (Math.random() - 0.5) * volatility * 0.6 : 0)
      wave[wHead % WAVE_LEN] = wVal * energy * (1 - stability * 0.4)
      wHead++

      const wW = 140, wH = 22, wX = cx - wW / 2, wY = cy + 62
      c.beginPath(); c.moveTo(wX, wY); c.lineTo(wX + wW, wY)
      c.strokeStyle = ac(0.05); c.lineWidth = 1; c.stroke()

      c.beginPath()
      for (let i = 0; i < WAVE_LEN; i++) {
        const idx = (wHead - WAVE_LEN + i + WAVE_LEN) % WAVE_LEN
        const x = wX + (i / WAVE_LEN) * wW
        const y = wY - wave[idx] * wH
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
      }
      c.strokeStyle = ac(0.5 * bright); c.lineWidth = 1; c.stroke()
      // Glow pass
      c.beginPath()
      for (let i = 0; i < WAVE_LEN; i++) {
        const idx = (wHead - WAVE_LEN + i + WAVE_LEN) % WAVE_LEN
        const x = wX + (i / WAVE_LEN) * wW
        const y = wY - wave[idx] * wH
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
      }
      c.strokeStyle = ac(0.12 * bright); c.lineWidth = 5; c.stroke()

      // ── 7. Central readout ──────────────────────────────────────────
      const displayE = Math.round(energy * 100)
      const gOff = glitch > 0.3 && Math.random() < glitch * 0.35 ? (Math.random() - 0.5) * 5 : 0

      c.font = "bold 48px monospace"
      c.textAlign = "center"; c.textBaseline = "middle"
      c.shadowColor = accent; c.shadowBlur = 20 * bright
      c.fillStyle = ac(0.12 * bright)
      c.fillText(displayE.toString().padStart(3, "0"), cx + gOff * 2, cy - 2)
      c.shadowBlur = 0
      c.fillStyle = ac(0.88 * bright)
      c.fillText(displayE.toString().padStart(3, "0"), cx + gOff, cy - 2)

      c.font = "10px monospace"
      c.fillStyle = ac(0.35 * bright)
      c.fillText("%", cx + 34, cy + 12)

      c.font = "8px monospace"
      c.fillStyle = ac(0.2)
      c.fillText("ENERGY", cx, cy + 28)

      // ── 8. Growth indicator — vertical bar on right ─────────────────
      const barH = 80, barX = cx + 118, barY = cy - barH / 2
      c.strokeStyle = ac(0.08); c.lineWidth = 1
      c.strokeRect(barX, barY, 4, barH)
      const fillH = barH * growth
      c.fillStyle = ac(0.3 * bright * (1 + 0.2 * Math.sin(t * 2)))
      c.fillRect(barX, barY + barH - fillH, 4, fillH)
      c.font = "7px monospace"; c.textAlign = "center"
      c.fillStyle = ac(0.2)
      c.fillText("G", barX + 2, barY - 6)

      // ── 9. Trust indicator — vertical bar on left ───────────────────
      const tBarX = cx - 122
      c.strokeStyle = ac(0.08); c.lineWidth = 1
      c.strokeRect(tBarX, barY, 4, barH)
      const tFillH = barH * trust
      c.fillStyle = ac(0.3 * bright * (1 + 0.2 * Math.sin(t * 1.5 + 1)))
      c.fillRect(tBarX, barY + barH - tFillH, 4, tFillH)
      c.font = "7px monospace"
      c.fillStyle = ac(0.2)
      c.fillText("T", tBarX + 2, barY - 6)

      // ── 10. Glitch slice ────────────────────────────────────────────
      if (glitch > 0.35 && Math.random() < glitch * 0.22) {
        const sy = cy - 55 + Math.random() * 110
        const sh = 1 + Math.random() * 3
        const sx = (Math.random() - 0.5) * 8
        c.save()
        c.globalCompositeOperation = "screen"
        c.globalAlpha = 0.3
        c.drawImage(cv, sx, 0)
        c.globalAlpha = 0.15
        c.fillStyle = "rgba(255,0,80,0.2)"
        c.fillRect(cx - 65, sy, 130, sh)
        c.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, energyFlow])

  return <canvas ref={canvasRef} width={280} height={280} className="relative z-10" />
}

export default function NoeAvatar({ mood, energy, message, expression, engineState, neuralSnapshot }: Props) {
  const glow = MOOD_GLOW[mood]
  const accent = MOOD_ACCENT[mood]
  const { visual } = expression
  const isGlitching = visual.glitchIntensity > 0.3
  const pulseSpeed = visual.energyFlow === "fragmented" ? 0.8 : 3

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>

        {/* Mood-reactive ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 75% 75% at 50% 50%, ${glow}, transparent)`,
          filter: "blur(22px)",
          transition: "background 1.5s ease",
        }} />

        {/* HUD corners */}
        {(["tl","tr","bl","br"] as const).map((corner) => (
          <div key={corner} className="absolute w-4 h-4 pointer-events-none" style={{
            top:    corner[0] === "t" ? 6 : "auto",
            bottom: corner[0] === "b" ? 6 : "auto",
            left:   corner[1] === "l" ? 6 : "auto",
            right:  corner[1] === "r" ? 6 : "auto",
            borderTop:    corner[0] === "t" ? `1px solid ${accent}44` : "none",
            borderBottom: corner[0] === "b" ? `1px solid ${accent}44` : "none",
            borderLeft:   corner[1] === "l" ? `1px solid ${accent}44` : "none",
            borderRight:  corner[1] === "r" ? `1px solid ${accent}44` : "none",
          }} />
        ))}

        {/* Outer pulse ring */}
        <motion.div
          className="absolute rounded-full border pointer-events-none"
          style={{ width: 262, height: 262, borderColor: accent, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
          animate={{ opacity: [0.05, 0.015, 0.05], scale: isGlitching ? [1, 1.025, 0.985, 1] : [1, 1.012, 1] }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        />

        <NoeCanvas
          accent={accent}
          engineState={engineState ?? { stability: 0.5, trust: 0.5, energy: energy / 100, volatility: 0.2, growth: 0.5 }}
          neuralSnapshot={neuralSnapshot}
          eyeBrightness={visual.eyeBrightness}
          glitchIntensity={visual.glitchIntensity}
          energyFlow={visual.energyFlow}
        />
      </div>

      {/* Mood + state inline */}
      <div className="flex items-center gap-3">
        <motion.div key={mood} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: isGlitching ? 0.4 : 1.5, repeat: Infinity }}
          />
          <span className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>{mood}</span>
        </motion.div>
        {engineState && (
          <span className="font-mono text-[9px] text-white/20 tracking-widest">
            S:{Math.round(engineState.stability * 100)} V:{Math.round(engineState.volatility * 100)}
          </span>
        )}
        {visual.energyFlow === "fragmented" && (
          <motion.span
            className="font-mono text-[9px] text-red-400/50 uppercase tracking-widest"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >[UNSTABLE]</motion.span>
        )}
      </div>

      {/* Message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
          transition={{ duration: 0.45 }}
          className="text-center text-sm text-white/40 max-w-[260px] font-mono leading-relaxed"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
