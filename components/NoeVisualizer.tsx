"use client"

import { useEffect, useRef } from "react"
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
  stateRef.current = state
  snapRef.current = neuralSnapshot

  const accent = MOOD_ACCENT[state.mood]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cv = canvas
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const c = ctx

    // Resize observer to fill container
    const ro = new ResizeObserver(() => {
      cv.width = cv.offsetWidth
      cv.height = cv.offsetHeight
    })
    ro.observe(cv)
    cv.width = cv.offsetWidth
    cv.height = cv.offsetHeight

    // Particles
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      vy: -(0.0003 + Math.random() * 0.0008),
      val: Math.floor(Math.random() * 100),
      alpha: 0.04 + Math.random() * 0.1,
      timer: Math.random() * 200,
    }))

    // Waveform
    const WAVE_LEN = 160
    const wave = new Float32Array(WAVE_LEN)
    let wHead = 0

    // Noe face projection — sparse wireframe points (normalized -1..1)
    const faceVerts: [number, number, number][] = [
      // skull outline
      [-0.35, -0.55, 0.1], [0, -0.65, 0.2], [0.35, -0.55, 0.1],
      [0.5, -0.2, 0.15], [0.48, 0.2, 0.1], [0.3, 0.55, 0.05],
      [0, 0.65, 0], [-0.3, 0.55, 0.05], [-0.48, 0.2, 0.1], [-0.5, -0.2, 0.15],
      // eyes
      [-0.22, -0.1, 0.3], [-0.12, -0.1, 0.32], [-0.17, -0.05, 0.35],
      [0.12, -0.1, 0.3], [0.22, -0.1, 0.32], [0.17, -0.05, 0.35],
      // nose bridge
      [0, -0.05, 0.38], [0, 0.08, 0.36], [-0.07, 0.15, 0.3], [0.07, 0.15, 0.3],
      // mouth
      [-0.18, 0.28, 0.28], [-0.08, 0.32, 0.32], [0, 0.33, 0.33],
      [0.08, 0.32, 0.32], [0.18, 0.28, 0.28],
      // cheekbones
      [-0.38, 0.05, 0.18], [0.38, 0.05, 0.18],
      // forehead
      [-0.2, -0.42, 0.22], [0, -0.48, 0.25], [0.2, -0.42, 0.22],
    ]

    // Edges (index pairs)
    const faceEdges: [number, number][] = [
      [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0],
      [10,11],[11,12],[12,10],
      [13,14],[14,15],[15,13],
      [16,17],[17,18],[17,19],
      [20,21],[21,22],[22,23],[23,24],
      [0,27],[1,28],[2,29],[27,28],[28,29],
      [9,25],[3,26],
    ]

    function project(vx: number, vy: number, vz: number, W: number, H: number, fov: number) {
      const z = vz + 2
      const px = (vx / z) * fov + W / 2
      const py = (vy / z) * fov + H / 2
      return { px, py, depth: vz }
    }

    function draw() {
      const t = tRef.current
      tRef.current += 0.012
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

      c.clearRect(0, 0, W, H)

      const cx = W / 2, cy = H / 2
      const faceScale = Math.min(W, H) * 0.38
      const fov = faceScale * 2.2

      // ── Background radial glow ──────────────────────────────────────
      const bg = c.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.6)
      bg.addColorStop(0, ac(0.06 + trust * 0.08))
      bg.addColorStop(0.5, ac(0.02 + energy * 0.03))
      bg.addColorStop(1, "transparent")
      c.fillStyle = bg
      c.fillRect(0, 0, W, H)

      // ── Floating data particles ─────────────────────────────────────
      c.font = "8px monospace"
      for (const p of particles) {
        p.y += p.vy * (1 + energy * 0.8)
        p.timer--
        if (p.y < -0.05 || p.timer <= 0) {
          p.y = 1.05; p.x = 0.05 + Math.random() * 0.9
          p.val = Math.floor(Math.random() * 100); p.timer = 100 + Math.random() * 150
        }
        c.fillStyle = ac(p.alpha)
        c.fillText(p.val.toString().padStart(2, "0"), p.x * W, p.y * H)
      }

      // ── Concentric state rings ──────────────────────────────────────
      const dims = [
        { val: energy,     r: 0.44, speed:  0.003 },
        { val: trust,      r: 0.38, speed: -0.005 },
        { val: stability,  r: 0.32, speed:  0.008 },
        { val: growth,     r: 0.26, speed: -0.011 },
        { val: volatility, r: 0.20, speed:  0.016 },
      ]
      const baseR = Math.min(W, H) * 0.5
      for (const dim of dims) {
        const r = baseR * dim.r
        const segs = 64
        const offset = t * dim.speed * 60
        for (let i = 0; i < segs; i++) {
          const a0 = (i / segs) * Math.PI * 2 + offset
          const a1 = ((i + 0.75) / segs) * Math.PI * 2 + offset
          const active = i / segs < dim.val
          const pulse = active
            ? 0.07 + dim.val * 0.3 * (1 + 0.2 * Math.sin(t * 2.5 + i * 0.4))
            : 0.025
          c.beginPath()
          c.arc(cx, cy, r, a0, a1)
          c.strokeStyle = ac(pulse)
          c.lineWidth = active ? 1.6 : 0.5
          c.stroke()
        }
      }

      // ── Noe face wireframe projection ──────────────────────────────
      // Slow rotation + volatility wobble
      const rotY = t * 0.18 + volatility * 0.4 * Math.sin(t * 1.3)
      const rotX = 0.08 * Math.sin(t * 0.7) + volatility * 0.15 * Math.cos(t * 2.1)

      const projected = faceVerts.map(([vx, vy, vz]) => {
        // Rotate Y
        const rx = vx * Math.cos(rotY) - vz * Math.sin(rotY)
        const rz = vx * Math.sin(rotY) + vz * Math.cos(rotY)
        // Rotate X
        const ry2 = vy * Math.cos(rotX) - rz * Math.sin(rotX)
        const rz2 = vy * Math.sin(rotX) + rz * Math.cos(rotX)
        return project(rx * faceScale / fov, ry2 * faceScale / fov, rz2, W, H, fov)
      })

      // Edges
      for (const [a, b] of faceEdges) {
        const pa = projected[a], pb = projected[b]
        const depthAlpha = 0.15 + (pa.depth + pb.depth) * 0.15
        c.beginPath()
        c.moveTo(pa.px, pa.py)
        c.lineTo(pb.px, pb.py)
        c.strokeStyle = ac(Math.max(0.04, depthAlpha) * (0.6 + energy * 0.4))
        c.lineWidth = 0.8
        c.stroke()
      }

      // Vertices
      for (const { px, py, depth } of projected) {
        const r = 1.5 + depth * 1.2
        const a = 0.3 + depth * 0.3
        const grd = c.createRadialGradient(px, py, 0, px, py, r * 3)
        grd.addColorStop(0, ac(a * (0.5 + energy * 0.5)))
        grd.addColorStop(1, "transparent")
        c.fillStyle = grd
        c.beginPath(); c.arc(px, py, r * 3, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2)
        c.fillStyle = ac(a)
        c.fill()
      }

      // ── Eye glow (trust-driven) ─────────────────────────────────────
      for (const eyeIdx of [12, 15]) {
        const { px, py } = projected[eyeIdx]
        const eyeGlow = c.createRadialGradient(px, py, 0, px, py, 14 * trust)
        eyeGlow.addColorStop(0, ac(0.6 * trust * (0.8 + 0.2 * Math.sin(t * 3))))
        eyeGlow.addColorStop(1, "transparent")
        c.fillStyle = eyeGlow
        c.beginPath(); c.arc(px, py, 14 * trust, 0, Math.PI * 2); c.fill()
      }

      // ── Neural net overlay (if snapshot) ───────────────────────────
      if (snap) {
        const netCX = cx + faceScale * 0.72
        const netCY = cy
        const layerSpacing = faceScale * 0.28
        const layers = [
          { nodes: snap.layerA, x: netCX - layerSpacing, ys: snap.layerA.map((_, i) => netCY - (snap.layerA.length - 1) * 8 + i * 16) },
          { nodes: snap.layerB, x: netCX,                ys: snap.layerB.map((_, i) => netCY - (snap.layerB.length - 1) * 8 + i * 16) },
          { nodes: snap.output, x: netCX + layerSpacing, ys: snap.output.map((_, i) => netCY - (snap.output.length - 1) * 8 + i * 16) },
        ]
        for (let a = 0; a < snap.layerA.length; a++) {
          for (let b = 0; b < snap.layerB.length; b++) {
            const str = snap.layerA[a] * snap.layerB[b]
            if (str < 0.08) continue
            c.beginPath()
            c.moveTo(layers[0].x, layers[0].ys[a])
            c.lineTo(layers[1].x, layers[1].ys[b])
            c.strokeStyle = ac(str * 0.15)
            c.lineWidth = 0.5; c.stroke()
          }
        }
        for (let b = 0; b < snap.layerB.length; b++) {
          for (let o = 0; o < snap.output.length; o++) {
            const str = snap.layerB[b] * snap.output[o]
            if (str < 0.08) continue
            c.beginPath()
            c.moveTo(layers[1].x, layers[1].ys[b])
            c.lineTo(layers[2].x, layers[2].ys[o])
            c.strokeStyle = ac(str * 0.18)
            c.lineWidth = 0.5; c.stroke()
          }
        }
        for (const layer of layers) {
          for (let i = 0; i < layer.nodes.length; i++) {
            const v = layer.nodes[i]
            const nx = layer.x, ny = layer.ys[i]
            const grd = c.createRadialGradient(nx, ny, 0, nx, ny, 5)
            grd.addColorStop(0, ac(v * 0.6))
            grd.addColorStop(1, "transparent")
            c.fillStyle = grd
            c.beginPath(); c.arc(nx, ny, 5, 0, Math.PI * 2); c.fill()
            c.beginPath(); c.arc(nx, ny, 1.5, 0, Math.PI * 2)
            c.fillStyle = ac(0.35 + v * 0.5); c.fill()
          }
        }
      }

      // ── Oscilloscope waveform ───────────────────────────────────────
      const wVal = Math.sin(t * 4.0) * 0.5 + Math.sin(t * 7.3 + 1.2) * 0.3
        + (volatility > 0.4 ? (Math.random() - 0.5) * volatility * 0.5 : 0)
      wave[wHead % WAVE_LEN] = wVal * energy * (1 - stability * 0.4)
      wHead++

      const wW = W * 0.55, wH = H * 0.06
      const wX = cx - wW / 2, wY = cy + Math.min(W, H) * 0.42

      c.beginPath(); c.moveTo(wX, wY); c.lineTo(wX + wW, wY)
      c.strokeStyle = ac(0.05); c.lineWidth = 1; c.stroke()

      c.beginPath()
      for (let i = 0; i < WAVE_LEN; i++) {
        const idx = (wHead - WAVE_LEN + i + WAVE_LEN) % WAVE_LEN
        const x = wX + (i / WAVE_LEN) * wW
        const y = wY - wave[idx] * wH
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
      }
      c.strokeStyle = ac(0.55); c.lineWidth = 1; c.stroke()
      c.beginPath()
      for (let i = 0; i < WAVE_LEN; i++) {
        const idx = (wHead - WAVE_LEN + i + WAVE_LEN) % WAVE_LEN
        const x = wX + (i / WAVE_LEN) * wW
        const y = wY - wave[idx] * wH
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
      }
      c.strokeStyle = ac(0.1); c.lineWidth = 6; c.stroke()

      // ── Central energy readout ──────────────────────────────────────
      const displayE = Math.round(energy * 100)
      c.font = `bold ${Math.round(Math.min(W, H) * 0.13)}px monospace`
      c.textAlign = "center"; c.textBaseline = "middle"
      c.shadowColor = accentHex; c.shadowBlur = 24
      c.fillStyle = ac(0.1)
      c.fillText(displayE.toString().padStart(3, "0"), cx + 2, cy + 2)
      c.shadowBlur = 0
      c.fillStyle = ac(0.75)
      c.fillText(displayE.toString().padStart(3, "0"), cx, cy)

      c.font = `${Math.round(Math.min(W, H) * 0.03)}px monospace`
      c.fillStyle = ac(0.2)
      c.fillText("ENERGY", cx, cy + Math.min(W, H) * 0.1)

      // ── Dimension labels around outer ring ──────────────────────────
      const labelR = baseR * 0.48
      const dimLabels = [
        { label: "E", val: energy,     angle: -Math.PI / 2 },
        { label: "T", val: trust,      angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
        { label: "S", val: stability,  angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
        { label: "G", val: growth,     angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
        { label: "V", val: volatility, angle: -Math.PI / 2 + (8 * Math.PI) / 5 },
      ]
      c.font = `${Math.round(Math.min(W, H) * 0.028)}px monospace`
      for (const dl of dimLabels) {
        const lx = cx + Math.cos(dl.angle) * labelR
        const ly = cy + Math.sin(dl.angle) * labelR
        c.fillStyle = ac(0.5)
        c.fillText(dl.label, lx, ly)
        c.font = `${Math.round(Math.min(W, H) * 0.022)}px monospace`
        c.fillStyle = ac(0.25)
        c.fillText(Math.round(dl.val * 100).toString(), lx, ly + Math.min(W, H) * 0.032)
        c.font = `${Math.round(Math.min(W, H) * 0.028)}px monospace`
      }

      // ── Mood label ──────────────────────────────────────────────────
      c.font = `${Math.round(Math.min(W, H) * 0.025)}px monospace`
      c.textAlign = "center"
      c.fillStyle = ac(0.3)
      c.fillText(s.mood.toUpperCase(), cx, cy - Math.min(W, H) * 0.38)

      // ── Cluster label ───────────────────────────────────────────────
      c.font = `${Math.round(Math.min(W, H) * 0.022)}px monospace`
      c.fillStyle = ac(0.18)
      c.fillText(s.cluster.replace("_", " "), cx, cy + Math.min(W, H) * 0.38)

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ minHeight: 320 }}
    />
  )
}
