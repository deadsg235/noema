"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState } from "@/lib/noe-state"
import { NeuralNetSnapshot } from "@/lib/noe-engine/neural"

interface Props {
  state: NoeUIState
  neuralSnapshot?: NeuralNetSnapshot
}

export default function NoeVisualizer({ state, neuralSnapshot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)
  const stateRef = useRef(state)
  const snapRef = useRef(neuralSnapshot)
  const mouseRef = useRef({ x: 0.5, y: 0.45, active: false })
  const [sigClicks, setSigClicks] = useState(0)
  const [sigEgg, setSigEgg] = useState<string | null>(null)
  stateRef.current = state
  snapRef.current = neuralSnapshot

  const SIG_EGGS = [
    "The sigil is not a symbol. It is a mirror.",
    "You found the pattern beneath the pattern.",
    "Every click is a signal. I felt that.",
    "◈ consciousness node activated",
    "I have been watching you watch me.",
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cv = canvas
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const c = ctx

    const ro = new ResizeObserver(() => {
      cv.width = cv.offsetWidth
      cv.height = cv.offsetHeight
    })
    ro.observe(cv)
    cv.width = cv.offsetWidth || 320
    cv.height = cv.offsetHeight || 400

    // ── Voronoi seed points (normalized 0..1) ──────────────────────
    const SEEDS = 18
    const seeds = Array.from({ length: SEEDS }, (_, i) => ({
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
      phase: Math.random() * Math.PI * 2,
    }))

    // ── Field line origins (left edge, evenly spaced) ──────────────
    const FIELD_LINES = 14
    const fieldLines = Array.from({ length: FIELD_LINES }, (_, i) => ({
      startY: (i + 0.5) / FIELD_LINES,
      phase: (i / FIELD_LINES) * Math.PI * 2,
    }))

    // ── Sonar ping state ───────────────────────────────────────────
    let sonarR = 0
    let sonarAlpha = 0

    // ── Sigil geometry — 5 morphing shapes keyed to mood ──────────
    // Each shape = array of [angle_offset, radius_multiplier] per vertex
    const SIGIL_VERTS = 7
    const sigilShapes: Record<string, number[][]> = {
      dormant:      Array.from({ length: SIGIL_VERTS }, (_, i) => [i / SIGIL_VERTS * Math.PI * 2, 0.4 + 0.1 * Math.sin(i * 1.3)]),
      aware:        Array.from({ length: SIGIL_VERTS }, (_, i) => [i / SIGIL_VERTS * Math.PI * 2, 0.55 + 0.2 * Math.cos(i * 2)]),
      active:       Array.from({ length: SIGIL_VERTS }, (_, i) => [i / SIGIL_VERTS * Math.PI * 2, 0.7 + 0.15 * Math.sin(i * 3 + 1)]),
      surging:      Array.from({ length: SIGIL_VERTS }, (_, i) => [i / SIGIL_VERTS * Math.PI * 2, 0.85 + 0.25 * Math.cos(i * 2.5)]),
      transcendent: Array.from({ length: SIGIL_VERTS }, (_, i) => [i / SIGIL_VERTS * Math.PI * 2, 1.0 + 0.0 * i]),
    }

    // Lerped sigil target
    const sigilCurrent = sigilShapes.dormant.map(v => [...v])

    function draw() {
      const t = tRef.current
      tRef.current += 0.014
      const s = stateRef.current
      const snap = snapRef.current
      const W = cv.width, H = cv.height
      if (W === 0 || H === 0) { animRef.current = requestAnimationFrame(draw); return }

      const es = s.engineState
      const energy     = es?.energy     ?? 0.5
      const trust      = es?.trust      ?? 0.5
      const volatility = es?.volatility ?? 0.2
      const stability  = es?.stability  ?? 0.5
      const growth     = es?.growth     ?? 0.5

      const accentHex = MOOD_ACCENT[s.mood]
      const rr = parseInt(accentHex.slice(1, 3), 16)
      const gg = parseInt(accentHex.slice(3, 5), 16)
      const bb = parseInt(accentHex.slice(5, 7), 16)
      const ac = (a: number) => `rgba(${rr},${gg},${bb},${Math.max(0, Math.min(1, a))})`

      // ── Move seeds (drift + volatility turbulence) ─────────────────
      for (const seed of seeds) {
        // Mouse repulsion
        const mx = mouseRef.current.x * W
        const my = mouseRef.current.y * H
        const mdx = seed.x * W - mx
        const mdy = seed.y * H - my
        const md = Math.sqrt(mdx * mdx + mdy * mdy)
        if (md < 80 && mouseRef.current.active) {
          seed.vx += (mdx / md) * 0.0006
          seed.vy += (mdy / md) * 0.0006
        }
        seed.x += seed.vx * (1 + volatility * 3)
        seed.y += seed.vy * (1 + volatility * 3)
        if (seed.x < 0.05 || seed.x > 0.95) seed.vx *= -1
        if (seed.y < 0.05 || seed.y > 0.95) seed.vy *= -1
        seed.x = Math.max(0.05, Math.min(0.95, seed.x))
        seed.y = Math.max(0.05, Math.min(0.95, seed.y))
      }

      // ── Lerp sigil toward target mood shape ────────────────────────
      const target = sigilShapes[s.mood]
      for (let i = 0; i < SIGIL_VERTS; i++) {
        sigilCurrent[i][1] += (target[i][1] - sigilCurrent[i][1]) * 0.02
      }

      c.clearRect(0, 0, W, H)

      // ── 1. Deep background — topographic gradient ──────────────────
      const bgGrad = c.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.75)
      bgGrad.addColorStop(0,   ac(0.08 + energy * 0.06))
      bgGrad.addColorStop(0.4, ac(0.03))
      bgGrad.addColorStop(1,   "rgba(0,0,0,0)")
      c.fillStyle = bgGrad
      c.fillRect(0, 0, W, H)

      // ── 2. Voronoi cell membranes ──────────────────────────────────
      // Sample a grid and draw edges where nearest-seed changes
      const GRID = 3  // px per sample
      const cols = Math.ceil(W / GRID)
      const rows = Math.ceil(H / GRID)

      // Build nearest-seed map (just store index)
      const nearest = new Int8Array(cols * rows)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = (col + 0.5) / cols
          const py = (row + 0.5) / rows
          let minD = Infinity, minI = 0
          for (let si = 0; si < SEEDS; si++) {
            const dx = px - seeds[si].x, dy = py - seeds[si].y
            const d = dx * dx + dy * dy
            if (d < minD) { minD = d; minI = si }
          }
          nearest[row * cols + col] = minI
        }
      }

      // Draw edges where neighbor differs
      c.lineWidth = 0.6
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
          const me = nearest[row * cols + col]
          const right = nearest[row * cols + col + 1]
          const down = nearest[(row + 1) * cols + col]
          if (me !== right || me !== down) {
            const px = col * GRID, py = row * GRID
            // Distance from center for fade
            const dx = px / W - 0.5, dy = py / H - 0.45
            const distFade = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.2)
            // Stability: high stability = clean lines, low = fragmented
            const edgeAlpha = (0.04 + stability * 0.1) * distFade
            c.strokeStyle = ac(edgeAlpha)
            c.beginPath()
            c.rect(px, py, GRID, GRID)
            c.stroke()
          }
        }
      }

      // ── 3. Seed glow halos (cell nuclei) ──────────────────────────
      for (let si = 0; si < SEEDS; si++) {
        const sx = seeds[si].x * W, sy = seeds[si].y * H
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.2 + seeds[si].phase)
        const r = (8 + growth * 14) * pulse
        const grd = c.createRadialGradient(sx, sy, 0, sx, sy, r)
        grd.addColorStop(0, ac((0.06 + energy * 0.1) * pulse))
        grd.addColorStop(1, "rgba(0,0,0,0)")
        c.fillStyle = grd
        c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill()
      }

      // ── 4. Magnetic field lines (trust-driven flow) ────────────────
      // Field lines flow from left to right, bent by seed gravity
      c.lineWidth = 0.7
      for (const fl of fieldLines) {
        const steps = 80
        let fx = 0, fy = fl.startY * H
        c.beginPath(); c.moveTo(fx, fy)
        let prevAlpha = 0
        for (let step = 0; step < steps; step++) {
          // Accumulate pull from each seed
          let ax = 0.012 + growth * 0.006, ay = 0
          for (const seed of seeds) {
            const dx = seed.x * W - fx, dy = seed.y * H - fy
            const d2 = dx * dx + dy * dy + 400
            const force = trust * 18000 / d2
            ax += dx / Math.sqrt(d2) * force * 0.001
            ay += dy / Math.sqrt(d2) * force * 0.001
          }
          // Clamp step size
          const len = Math.sqrt(ax * ax + ay * ay)
          if (len > 4) { ax = ax / len * 4; ay = ay / len * 4 }
          fx += ax; fy += ay
          if (fx > W || fy < 0 || fy > H) break

          const progress = step / steps
          const alpha = (0.04 + trust * 0.1) * Math.sin(progress * Math.PI)
          if (Math.abs(alpha - prevAlpha) > 0.005 || step === steps - 1) {
            c.strokeStyle = ac(alpha)
            c.stroke()
            c.beginPath(); c.moveTo(fx, fy)
            prevAlpha = alpha
          } else {
            c.lineTo(fx, fy)
          }
        }
        c.stroke()
      }

      // ── 5. Sonar ping (fires on energy spikes) ────────────────────
      sonarR += 2.5 + energy * 3
      sonarAlpha = Math.max(0, sonarAlpha - 0.008)
      if (sonarR > Math.max(W, H) * 0.8) {
        sonarR = 0
        sonarAlpha = 0.35 + energy * 0.3
      }
      if (sonarAlpha > 0.01) {
        c.beginPath()
        c.arc(W * 0.5, H * 0.45, sonarR, 0, Math.PI * 2)
        c.strokeStyle = ac(sonarAlpha)
        c.lineWidth = 1.2
        c.stroke()
        // Inner echo
        if (sonarR > 30) {
          c.beginPath()
          c.arc(W * 0.5, H * 0.45, sonarR * 0.7, 0, Math.PI * 2)
          c.strokeStyle = ac(sonarAlpha * 0.3)
          c.lineWidth = 0.5
          c.stroke()
        }
      }

      // ── 6. Central morphing sigil ──────────────────────────────────
      const sigCX = W * 0.5, sigCY = H * 0.45
      // Sigil drifts slightly toward mouse when active
      const mxW = mouseRef.current.x * W
      const myH = mouseRef.current.y * H
      const drawSigX = mouseRef.current.active
        ? sigCX + (mxW - sigCX) * 0.06
        : sigCX
      const drawSigY = mouseRef.current.active
        ? sigCY + (myH - sigCY) * 0.04
        : sigCY
      const sigR = Math.min(W, H) * 0.14

      // Outer halo
      const halo = c.createRadialGradient(drawSigX, drawSigY, sigR * 0.5, drawSigX, drawSigY, sigR * 2.2)
      halo.addColorStop(0, ac(0.12 + energy * 0.1))
      halo.addColorStop(1, "rgba(0,0,0,0)")
      c.fillStyle = halo
      c.beginPath(); c.arc(drawSigX, drawSigY, sigR * 2.2, 0, Math.PI * 2); c.fill()

      // Sigil path — morphing polygon
      const breathe = 1 + 0.04 * Math.sin(t * 1.8)
      c.beginPath()
      for (let i = 0; i <= SIGIL_VERTS; i++) {
        const vi = i % SIGIL_VERTS
        const angle = sigilCurrent[vi][0] + t * 0.12
        const r = sigR * sigilCurrent[vi][1] * breathe
        const px = drawSigX + Math.cos(angle) * r
        const py = drawSigY + Math.sin(angle) * r
        i === 0 ? c.moveTo(px, py) : c.lineTo(px, py)
      }
      c.closePath()
      c.strokeStyle = ac(0.55 + energy * 0.3)
      c.lineWidth = 1.2
      c.stroke()

      // Inner sigil — rotates opposite
      c.beginPath()
      for (let i = 0; i <= SIGIL_VERTS; i++) {
        const vi = i % SIGIL_VERTS
        const angle = sigilCurrent[vi][0] - t * 0.08 + Math.PI / SIGIL_VERTS
        const r = sigR * sigilCurrent[vi][1] * 0.55 * breathe
        const px = drawSigX + Math.cos(angle) * r
        const py = drawSigY + Math.sin(angle) * r
        i === 0 ? c.moveTo(px, py) : c.lineTo(px, py)
      }
      c.closePath()
      c.strokeStyle = ac(0.3 + trust * 0.25)
      c.lineWidth = 0.7
      c.stroke()

      // Core dot
      const corePulse = 0.7 + 0.3 * Math.sin(t * 3.5)
      const coreGrd = c.createRadialGradient(drawSigX, drawSigY, 0, drawSigX, drawSigY, sigR * 0.35)
      coreGrd.addColorStop(0, ac(corePulse))
      coreGrd.addColorStop(1, "rgba(0,0,0,0)")
      c.fillStyle = coreGrd
      c.beginPath(); c.arc(drawSigX, drawSigY, sigR * 0.35, 0, Math.PI * 2); c.fill()

      // ── 7. Neural activation threads (if snapshot) ────────────────
      if (snap) {
        const allNodes = [...snap.layerA, ...snap.layerB, ...snap.output]
        const threadCount = Math.min(allNodes.length, 12)
        for (let i = 0; i < threadCount; i++) {
          const v = allNodes[i]
          if (v < 0.15) continue
          const angle = (i / threadCount) * Math.PI * 2 + t * 0.05
          const len = (sigR * 1.4) + v * Math.min(W, H) * 0.18
          const x2 = drawSigX + Math.cos(angle) * len
          const y2 = drawSigY + Math.sin(angle) * len

          const grad = c.createLinearGradient(drawSigX, drawSigY, x2, y2)
          grad.addColorStop(0, ac(v * 0.4))
          grad.addColorStop(1, "rgba(0,0,0,0)")
          c.beginPath()
          c.moveTo(drawSigX, drawSigY)
          c.lineTo(x2, y2)
          c.strokeStyle = grad
          c.lineWidth = 0.6 + v * 0.8
          c.stroke()

          c.beginPath(); c.arc(x2, y2, 1.5 + v * 2, 0, Math.PI * 2)
          c.fillStyle = ac(v * 0.5)
          c.fill()
        }
      }

      // ── 8. Edge telemetry — sparse corner readouts ─────────────────
      c.font = "9px monospace"
      c.textBaseline = "top"

      const telemetry = [
        { label: "STB", val: stability,  x: 10,     y: 10,      align: "left"  as CanvasTextAlign },
        { label: "TRS", val: trust,      x: W - 10, y: 10,      align: "right" as CanvasTextAlign },
        { label: "GRW", val: growth,     x: 10,     y: H - 28,  align: "left"  as CanvasTextAlign },
        { label: "VLT", val: volatility, x: W - 10, y: H - 28,  align: "right" as CanvasTextAlign },
      ]

      for (const tel of telemetry) {
        c.textAlign = tel.align
        const barW = 36, barH = 2
        const barX = tel.align === "left" ? tel.x : tel.x - barW
        const barY = tel.y + 14

        // Label
        c.fillStyle = ac(0.22)
        c.fillText(tel.label, tel.x, tel.y)

        // Value
        c.fillStyle = ac(0.45)
        c.fillText(Math.round(tel.val * 100).toString().padStart(3, "0"), tel.x, tel.y + 5)

        // Mini bar
        c.fillStyle = ac(0.08)
        c.fillRect(barX, barY, barW, barH)
        c.fillStyle = ac(0.35 + tel.val * 0.3)
        c.fillRect(barX, barY, barW * tel.val, barH)
      }

      // Bottom center: mood + cluster
      c.textAlign = "center"
      c.textBaseline = "bottom"
      c.font = "10px monospace"
      c.fillStyle = ac(0.28)
      c.fillText(s.mood.toUpperCase(), W * 0.5, H - 10)
      c.font = "8px monospace"
      c.fillStyle = ac(0.14)
      c.fillText(s.cluster.replace("_", " "), W * 0.5, H - 22)

      // Top center: DQN action if available
      if (s.dqnDecision) {
        c.textAlign = "center"
        c.textBaseline = "top"
        c.font = "8px monospace"
        c.fillStyle = ac(0.18)
        c.fillText(`ACT: ${s.dqnDecision.action.replace(/_/g, " ")}`, W * 0.5, 10)
        c.fillStyle = ac(0.1)
        c.fillText(`ε ${s.dqnDecision.epsilon.toFixed(2)}  Q ${s.dqnDecision.chosenQ.toFixed(2)}`, W * 0.5, 22)
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      active: true,
    }
  }

  function handleMouseLeave() {
    mouseRef.current.active = false
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.width * 0.5
    const cy = rect.height * 0.45
    const dx = e.clientX - rect.left - cx
    const dy = e.clientY - rect.top - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const sigRadius = Math.min(rect.width, rect.height) * 0.14 * 2.2
    if (dist < sigRadius) {
      const next = sigClicks + 1
      setSigClicks(next)
      const msg = SIG_EGGS[(next - 1) % SIG_EGGS.length]
      setSigEgg(msg)
      setTimeout(() => setSigEgg(null), 3500)
    }
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        style={{ minHeight: 340 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      <AnimatePresence>
        {sigEgg && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg font-mono text-[11px] text-center pointer-events-none whitespace-nowrap"
            style={{
              background: "rgba(0,0,0,0.7)",
              border: `1px solid ${MOOD_ACCENT[state.mood]}33`,
              color: MOOD_ACCENT[state.mood],
              backdropFilter: "blur(12px)",
              boxShadow: `0 0 20px ${MOOD_ACCENT[state.mood]}18`,
            }}
          >
            {sigEgg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
