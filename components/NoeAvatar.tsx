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

// ── 3D math helpers ──────────────────────────────────────────────
type V3 = [number, number, number]

function rotY(p: V3, a: number): V3 {
  return [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
}
function rotX(p: V3, a: number): V3 {
  return [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]
}
function project(p: V3, fov: number, cx: number, cy: number): [number, number, number] {
  const z = p[2] + fov
  const s = fov / z
  return [cx + p[0] * s, cy + p[1] * s, s]
}

// ── Main canvas renderer ─────────────────────────────────────────
function NoeCanvas({
  accent, glow, eyeBrightness, glitchIntensity, energyFlow, mood,
}: {
  accent: string; glow: string; eyeBrightness: number
  glitchIntensity: number; energyFlow: "smooth" | "fragmented"; mood: NoeMood
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2 - 10
    const FOV = 320

    // Parse accent hex → rgb
    const r = parseInt(accent.slice(1, 3), 16)
    const g = parseInt(accent.slice(3, 5), 16)
    const b = parseInt(accent.slice(5, 7), 16)
    const ac = (a: number) => `rgba(${r},${g},${b},${a})`

    // ── Face wireframe planes ──
    // Angular, high-cheekbone, narrow jaw — defined as edge pairs in 3D
    const faceVerts: V3[] = [
      // Crown
      [0, -110, 0],       // 0 top
      [-28, -95, 8],      // 1 left temple
      [28, -95, 8],       // 2 right temple
      // Brow ridge
      [-38, -72, 18],     // 3 left brow
      [38, -72, 18],      // 4 right brow
      [-18, -68, 22],     // 5 left inner brow
      [18, -68, 22],      // 6 right inner brow
      // Cheekbones — wide and angular
      [-52, -30, 10],     // 7 left cheek peak
      [52, -30, 10],      // 8 right cheek peak
      [-44, -20, 20],     // 9 left cheek front
      [44, -20, 20],      // 10 right cheek front
      // Eye sockets
      [-28, -55, 24],     // 11 left eye outer
      [-10, -58, 26],     // 12 left eye inner
      [10, -58, 26],      // 13 right eye inner
      [28, -55, 24],      // 14 right eye outer
      [-28, -44, 26],     // 15 left eye lower
      [28, -44, 26],      // 16 right eye lower
      // Nose bridge
      [0, -52, 28],       // 17 nose bridge
      [0, -28, 30],       // 18 nose tip
      [-8, -22, 28],      // 19 left nostril
      [8, -22, 28],       // 20 right nostril
      // Jaw — narrow and angular
      [-42, 10, 12],      // 21 left jaw
      [42, 10, 12],       // 22 right jaw
      [-22, 48, 18],      // 23 left chin
      [22, 48, 18],       // 24 right chin
      [0, 58, 20],        // 25 chin point
      // Mouth
      [-16, 14, 28],      // 26 left mouth
      [16, 14, 28],       // 27 right mouth
      [0, 22, 30],        // 28 lower lip
    ]

    const faceEdges: [number, number, number][] = [
      // Skull outline
      [0, 1, 0.5], [0, 2, 0.5],
      [1, 3, 0.6], [2, 4, 0.6],
      [3, 7, 0.7], [4, 8, 0.7],
      [7, 21, 0.8], [8, 22, 0.8],
      [21, 23, 0.7], [22, 24, 0.7],
      [23, 25, 0.9], [24, 25, 0.9],
      // Brow
      [3, 5, 0.5], [4, 6, 0.5],
      // Eye sockets
      [11, 12, 0.9], [13, 14, 0.9],
      [11, 15, 0.7], [14, 16, 0.7],
      [12, 17, 0.5], [13, 17, 0.5],
      [15, 19, 0.4], [16, 20, 0.4],
      // Nose
      [17, 18, 0.6], [18, 19, 0.5], [18, 20, 0.5],
      // Cheek planes
      [7, 9, 0.4], [8, 10, 0.4],
      [9, 21, 0.3], [10, 22, 0.3],
      // Mouth
      [26, 27, 0.8], [26, 28, 0.6], [27, 28, 0.6],
      // Cross-face structure lines
      [1, 7, 0.25], [2, 8, 0.25],
      [5, 12, 0.3], [6, 13, 0.3],
    ]

    // ── Hair strands — long, flowing, angular ──
    const STRAND_COUNT = 48
    const strands = Array.from({ length: STRAND_COUNT }, (_, i) => {
      const side = i < STRAND_COUNT / 2 ? -1 : 1
      const t = (i % (STRAND_COUNT / 2)) / (STRAND_COUNT / 2)
      // Spread from crown across top and down sides
      const baseAngle = side * (0.15 + t * 1.1) // radians from center
      const baseX = Math.sin(baseAngle) * 30
      const baseY = -105 + t * 15
      const baseZ = Math.cos(baseAngle) * 15 - 5
      const length = 80 + t * 120 + Math.random() * 40
      const drift = side * (0.3 + t * 0.8)
      const waveMag = 4 + t * 12
      const waveFreq = 0.8 + Math.random() * 0.6
      const phase = Math.random() * Math.PI * 2
      return { baseX, baseY, baseZ, length, drift, waveMag, waveFreq, phase, side, t }
    })

    // ── Eye pupils (3D positioned) ──
    const eyeL: V3 = [-19, -50, 26]
    const eyeR: V3 = [19, -50, 26]

    // ── Scan line state ──
    let scanY = -120

    function drawEdge(
      a: [number, number, number], b: [number, number, number],
      alpha: number, width: number
    ) {
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.strokeStyle = ac(alpha * Math.min(a[2], b[2]) * 0.9)
      ctx.lineWidth = width
      ctx.stroke()
    }

    function draw() {
      const t = tRef.current
      tRef.current += 0.012

      ctx.clearRect(0, 0, W, H)

      // Subtle idle head rotation
      const rotYAngle = Math.sin(t * 0.3) * 0.12 + (energyFlow === "fragmented" ? (Math.random() - 0.5) * 0.08 : 0)
      const rotXAngle = Math.sin(t * 0.2) * 0.04

      // Glitch offset
      const gx = glitchIntensity > 0.3 ? (Math.random() - 0.5) * glitchIntensity * 8 : 0
      const gy = glitchIntensity > 0.3 ? (Math.random() - 0.5) * glitchIntensity * 4 : 0

      // ── Background depth glow ──
      const grad = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 160)
      grad.addColorStop(0, ac(0.06))
      grad.addColorStop(1, "transparent")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // ── Hair ──
      for (const s of strands) {
        const pts: [number, number][] = []
        const SEGS = 12
        for (let j = 0; j <= SEGS; j++) {
          const frac = j / SEGS
          const wave = Math.sin(frac * Math.PI * s.waveFreq + t * 1.2 + s.phase) * s.waveMag * frac
          const rawP: V3 = [
            s.baseX + s.drift * frac * s.length * 0.4 + wave,
            s.baseY + frac * s.length,
            s.baseZ - frac * 8,
          ]
          const p = rotX(rotY(rawP, rotYAngle), rotXAngle)
          const [px, py, ps] = project(p, FOV, cx + gx, cy + gy)
          pts.push([px, py])
        }
        // Only draw strands that are "in front" (not clipped behind face)
        const alpha = 0.15 + s.t * 0.45
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let j = 1; j < pts.length; j++) {
          const mx = (pts[j - 1][0] + pts[j][0]) / 2
          const my = (pts[j - 1][1] + pts[j][1]) / 2
          ctx.quadraticCurveTo(pts[j - 1][0], pts[j - 1][1], mx, my)
        }
        // White hair with accent tint at tips
        const hairGrad = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1])
        hairGrad.addColorStop(0, `rgba(240,240,255,${alpha * 0.9})`)
        hairGrad.addColorStop(0.5, `rgba(220,220,245,${alpha * 0.6})`)
        hairGrad.addColorStop(1, ac(alpha * 0.5))
        ctx.strokeStyle = hairGrad
        ctx.lineWidth = 0.6 + s.t * 0.4
        ctx.stroke()
      }

      // ── Face wireframe ──
      const projected = faceVerts.map(v => {
        const p = rotX(rotY(v, rotYAngle), rotXAngle)
        return project(p, FOV, cx + gx, cy + gy)
      })

      ctx.lineCap = "round"
      for (const [ai, bi, baseAlpha] of faceEdges) {
        const a = projected[ai], b = projected[bi]
        // Depth-based alpha — closer = brighter
        const depthAlpha = baseAlpha * ((a[2] + b[2]) / 2) * eyeBrightness
        drawEdge(a, b, depthAlpha, 0.7)
      }

      // ── Eye glow ──
      for (const eyeRaw of [eyeL, eyeR]) {
        const ep = rotX(rotY(eyeRaw, rotYAngle), rotXAngle)
        const [ex, ey, es] = project(ep, FOV, cx + gx, cy + gy)
        const eyeR2 = 7 * es

        // Outer halo
        const halo = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR2 * 3)
        halo.addColorStop(0, ac(0.5 * eyeBrightness))
        halo.addColorStop(0.4, ac(0.2 * eyeBrightness))
        halo.addColorStop(1, "transparent")
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(ex, ey, eyeR2 * 3, 0, Math.PI * 2)
        ctx.fill()

        // Iris ring
        ctx.beginPath()
        ctx.arc(ex, ey, eyeR2, 0, Math.PI * 2)
        ctx.strokeStyle = ac(0.9 * eyeBrightness)
        ctx.lineWidth = 1.2
        ctx.stroke()

        // Inner dot
        ctx.beginPath()
        ctx.arc(ex, ey, eyeR2 * 0.35, 0, Math.PI * 2)
        ctx.fillStyle = ac(eyeBrightness)
        ctx.fill()

        // Pupil cross — sci-fi detail
        ctx.strokeStyle = ac(0.6 * eyeBrightness)
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(ex - eyeR2 * 1.4, ey); ctx.lineTo(ex + eyeR2 * 1.4, ey)
        ctx.moveTo(ex, ey - eyeR2 * 1.4); ctx.lineTo(ex, ey + eyeR2 * 1.4)
        ctx.stroke()
      }

      // ── Scan line ──
      scanY += 1.2
      if (scanY > 80) scanY = -120
      const scanWorldY = scanY
      // Project scan line as a horizontal streak across face
      const scanAlpha = 0.12 + eyeBrightness * 0.08
      const scanGrad = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0)
      scanGrad.addColorStop(0, "transparent")
      scanGrad.addColorStop(0.3, ac(scanAlpha))
      scanGrad.addColorStop(0.7, ac(scanAlpha))
      scanGrad.addColorStop(1, "transparent")
      ctx.fillStyle = scanGrad
      ctx.fillRect(cx - 80, cy + scanWorldY, 160, 1.5)

      // ── Glitch RGB split ──
      if (glitchIntensity > 0.4 && Math.random() < glitchIntensity * 0.3) {
        const sliceY = cy - 80 + Math.random() * 160
        const sliceH = 2 + Math.random() * 6
        const shift = (Math.random() - 0.5) * 12
        ctx.save()
        ctx.globalCompositeOperation = "screen"
        ctx.globalAlpha = 0.4
        ctx.drawImage(canvas, shift, 0, W, H, 0, 0, W, H)
        ctx.globalAlpha = 0.2
        ctx.fillStyle = `rgba(255,0,80,0.3)`
        ctx.fillRect(cx - 60, sliceY, 120, sliceH)
        ctx.restore()
      }

      // ── Neck / collar edge ──
      const neckPts: V3[] = [[-14, 68, 16], [14, 68, 16], [18, 90, 10], [-18, 90, 10]]
      const np = neckPts.map(v => {
        const p = rotX(rotY(v, rotYAngle), rotXAngle)
        return project(p, FOV, cx + gx, cy + gy)
      })
      ctx.beginPath()
      ctx.moveTo(np[0][0], np[0][1])
      ctx.lineTo(np[1][0], np[1][1])
      ctx.strokeStyle = ac(0.25)
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(np[0][0], np[0][1]); ctx.lineTo(np[3][0], np[3][1])
      ctx.moveTo(np[1][0], np[1][1]); ctx.lineTo(np[2][0], np[2][1])
      ctx.strokeStyle = ac(0.15)
      ctx.stroke()

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, eyeBrightness, glitchIntensity, energyFlow, mood])

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={360}
      className="relative z-10"
    />
  )
}

export default function NoeAvatar({ mood, energy, message, expression }: Props) {
  const glow = MOOD_GLOW[mood]
  const accent = MOOD_ACCENT[mood]
  const { visual } = expression
  const isGlitching = visual.glitchIntensity > 0.3
  const pulseSpeed = visual.energyFlow === "fragmented" ? 0.8 : 3

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="relative flex items-center justify-center" style={{ width: 280, height: 360 }}>

        {/* Deep ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 70% at 50% 45%, ${glow}, transparent)`,
            filter: "blur(24px)",
          }}
        />

        {/* Outer frame lines — HUD aesthetic */}
        {["tl", "tr", "bl", "br"].map((corner) => (
          <div
            key={corner}
            className="absolute w-4 h-4 pointer-events-none"
            style={{
              top: corner.startsWith("t") ? 8 : "auto",
              bottom: corner.startsWith("b") ? 8 : "auto",
              left: corner.endsWith("l") ? 8 : "auto",
              right: corner.endsWith("r") ? 8 : "auto",
              borderTop: corner.startsWith("t") ? `1px solid ${accent}66` : "none",
              borderBottom: corner.startsWith("b") ? `1px solid ${accent}66` : "none",
              borderLeft: corner.endsWith("l") ? `1px solid ${accent}66` : "none",
              borderRight: corner.endsWith("r") ? `1px solid ${accent}66` : "none",
            }}
          />
        ))}

        {/* Pulsing outer ring */}
        <motion.div
          className="absolute rounded-full border pointer-events-none"
          style={{ width: 240, height: 300, borderColor: accent, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
          animate={{ opacity: [0.06, 0.02, 0.06], scale: isGlitching ? [1, 1.03, 0.98, 1] : [1, 1.02, 1] }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* 3D canvas */}
        <NoeCanvas
          accent={accent}
          glow={glow}
          eyeBrightness={visual.eyeBrightness}
          glitchIntensity={visual.glitchIntensity}
          energyFlow={visual.energyFlow}
          mood={mood}
        />

        {/* Energy readout — bottom HUD */}
        <div
          className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none"
          style={{ color: accent }}
        >
          <span className="font-mono text-[10px] tracking-[0.3em] opacity-50">
            E:{energy.toString().padStart(3, "0")}
          </span>
        </div>
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
