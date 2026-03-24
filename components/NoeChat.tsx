"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState } from "@/lib/noe-state"
import { NeuralNetSnapshot } from "@/lib/noe-engine/neural"
import { useWallet } from "@/lib/wallet-store"

interface Message {
  role: "user" | "noe"
  text: string
  cluster?: string
  streaming?: boolean
  neural?: NeuralNetSnapshot
  stateDelta?: { dim: string; delta: number }[]
}

interface Props {
  state: NoeUIState
  onStateUpdate: (state: NoeUIState) => void
  onNeuralUpdate?: (snap: NeuralNetSnapshot) => void
}

function NeuralBar({ snap, accent }: { snap: NeuralNetSnapshot; accent: string }) {
  const layers = [
    { label: "A", nodes: snap.layerA },
    { label: "B", nodes: snap.layerB },
    { label: "O", nodes: snap.output },
  ]
  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
      <span className="font-mono text-[8px] text-white/10 uppercase tracking-widest shrink-0">net</span>
      <div className="flex items-center gap-2">
        {layers.map((layer) => (
          <div key={layer.label} className="flex items-end gap-[2px]">
            {layer.nodes.map((v, i) => (
              <motion.div
                key={i}
                className="w-[2px] rounded-sm"
                style={{ background: accent, opacity: 0.1 + v * 0.75 }}
                animate={{ height: Math.max(2, v * 12) }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            ))}
            <span className="font-mono text-[6px] text-white/10 ml-0.5">{layer.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StateDelta({ deltas, accent }: { deltas: { dim: string; delta: number }[]; accent: string }) {
  const sig = deltas.filter(d => Math.abs(d.delta) > 1)
  if (!sig.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {sig.map(d => (
        <span
          key={d.dim}
          className="font-mono text-[8px] px-1.5 py-0.5 rounded"
          style={{
            background: d.delta > 0 ? `${accent}14` : "rgba(233,69,96,0.1)",
            color: d.delta > 0 ? accent : "#e94560",
            border: `1px solid ${d.delta > 0 ? accent + "28" : "rgba(233,69,96,0.2)"}`,
          }}
        >
          {d.dim} {d.delta > 0 ? "+" : ""}{d.delta}
        </span>
      ))}
    </div>
  )
}

export default function NoeChat({ state, onStateUpdate, onNeuralUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const prevStateRef = useRef(state.engineState)
  const accent = MOOD_ACCENT[state.mood]
  const wallet = useWallet()
  const liveTxsRef = useRef<{ type: "BUY"|"SELL"|"HOLD"|"WHALE_MOVE"; uiAmount: number; wallet: string; timestamp: number }[]>([])

  useEffect(() => {
    if (!wallet.connected) return
    const poll = async () => {
      try {
        const res = await fetch("/api/noe/wallet")
        if (!res.ok) return
        const data = await res.json()
        if (data.transactions?.length) {
          liveTxsRef.current = [...data.transactions, ...liveTxsRef.current].slice(0, 12)
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 20_000)
    return () => clearInterval(id)
  }, [wallet.connected])

  useEffect(() => {
    setMessages([{ role: "noe", text: state.message, cluster: state.cluster }])
    setMounted(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const getHistory = useCallback(() =>
    messages.slice(1).map(m => ({ role: m.role, text: m.text }))
  , [messages])

  function computeDeltas(prev: NoeUIState["engineState"], next: NoeUIState["engineState"]) {
    if (!prev || !next) return []
    return (["stability", "trust", "energy", "volatility", "growth"] as const).map(dim => ({
      dim: dim[0].toUpperCase(),
      delta: Math.round((next[dim] - prev[dim]) * 100),
    }))
  }

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    setInput("")
    const prevState = { ...state.engineState }
    prevStateRef.current = prevState

    setMessages(m => [...m, { role: "user", text }])
    setStreaming(true)
    setMessages(m => [...m, { role: "noe", text: "", streaming: true }])

    abortRef.current = new AbortController()

    try {
      const walletContext = {
        connected: wallet.connected,
        address: wallet.address ?? undefined,
        solBalance: wallet.solBalance,
        tokenBalance: wallet.tokenBalance,
        hasTokens: wallet.hasTokens,
        recentTxs: liveTxsRef.current,
      }

      const res = await fetch("/api/noe/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: getHistory(), walletContext }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      let newState: NoeUIState | null = null
      let neuralSnap: NeuralNetSnapshot | null = null

      const rawState = res.headers.get("X-Noe-State")
      if (rawState) { try { newState = JSON.parse(decodeURIComponent(rawState)) } catch {} }
      const rawNeural = res.headers.get("X-Noe-Neural")
      if (rawNeural) { try { neuralSnap = JSON.parse(decodeURIComponent(rawNeural)) } catch {} }

      if (newState) onStateUpdate(newState)
      if (neuralSnap && onNeuralUpdate) onNeuralUpdate(neuralSnap)

      const deltas = newState ? computeDeltas(prevState, newState.engineState) : []

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error("No body")

      let fullText = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setMessages(m => {
          const u = [...m]
          u[u.length - 1] = { role: "noe", text: fullText, cluster: state.cluster, streaming: true, neural: neuralSnap ?? undefined }
          return u
        })
      }

      setMessages(m => {
        const u = [...m]
        u[u.length - 1] = {
          role: "noe", text: fullText,
          cluster: newState?.cluster ?? state.cluster,
          streaming: false,
          neural: neuralSnap ?? undefined,
          stateDelta: deltas,
        }
        return u
      })
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setMessages(m => {
        const u = [...m]
        u[u.length - 1] = { role: "noe", text: "Signal lost.", streaming: false }
        return u
      })
    } finally {
      setStreaming(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages(m => {
      const u = [...m]
      const last = u[u.length - 1]
      if (last?.streaming) u[u.length - 1] = { ...last, streaming: false }
      return u
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Engine state strip */}
      {mounted && (
        <div className="px-4 py-2 border-b border-white/[0.04] flex items-center gap-3 shrink-0">
          <span className="font-mono text-[8px] text-white/10 uppercase tracking-widest shrink-0">n.o.e</span>
          <div className="flex items-end gap-1 flex-1">
            {(["stability","trust","energy","volatility","growth"] as const).map(dim => (
              <div key={dim} className="flex flex-col items-center gap-0.5 flex-1">
                <motion.div
                  className="w-full rounded-sm"
                  style={{ background: accent, minHeight: 1 }}
                  animate={{
                    height: Math.max(1, state.engineState[dim] * 18),
                    opacity: 0.15 + state.engineState[dim] * 0.65,
                  }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
                <span className="font-mono text-[6px] text-white/10">{dim[0].toUpperCase()}</span>
              </div>
            ))}
          </div>
          <span className="font-mono text-[8px] shrink-0 text-white/15">
            {state.cluster.replace("_", " ")}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-4 min-h-0">
        {!mounted ? (
          <div className="flex justify-start">
            <div className="px-3 py-2 font-mono text-sm text-white/20"
              style={{ borderLeft: `1px solid ${accent}44`, paddingLeft: 12 }}>
              <span className="text-[9px] uppercase tracking-widest block mb-1" style={{ color: `${accent}88` }}>Noe</span>
              Initializing...
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "noe" ? (
                  <div
                    className="max-w-[92%] px-3 py-2.5 font-mono text-[13px] leading-relaxed text-white/60"
                    style={{ borderLeft: `1px solid ${accent}44`, paddingLeft: 12 }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] uppercase tracking-widest" style={{ color: `${accent}99` }}>Noe</span>
                      {msg.cluster && (
                        <span className="text-[8px] text-white/10 uppercase tracking-widest">
                          {msg.cluster.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <span className="whitespace-pre-wrap break-words">
                      {msg.text}
                      {msg.streaming && (
                        <motion.span
                          className="inline-block w-[1.5px] h-[12px] ml-[2px] align-middle"
                          style={{ background: accent }}
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        />
                      )}
                    </span>
                    {!msg.streaming && msg.stateDelta && <StateDelta deltas={msg.stateDelta} accent={accent} />}
                    {!msg.streaming && msg.neural && <NeuralBar snap={msg.neural} accent={accent} />}
                  </div>
                ) : (
                  <div
                    className="max-w-[88%] px-3 py-2 rounded-lg font-mono text-[13px] text-white/50 break-words"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {msg.text}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.04] shrink-0">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg px-3 py-2 font-mono text-[13px] text-white/70 placeholder-white/10 outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            placeholder="transmit..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            disabled={streaming}
            onFocus={e => (e.target.style.borderColor = `${accent}44`)}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
          />
          {streaming ? (
            <button
              onClick={stop}
              className="px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest border transition-all"
              style={{ borderColor: `${accent}33`, color: `${accent}88` }}
            >
              ■
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-20"
              style={{ background: accent, color: "#000" }}
            >
              TX
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-mono text-[8px] text-white/10">llama-3.3-70b · groq</span>
          <span className="font-mono text-[8px] text-white/10">{state.mood} · {state.energy}%</span>
        </div>
      </div>
    </div>
  )
}
