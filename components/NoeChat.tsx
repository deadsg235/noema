"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, type NoeState } from "@/lib/noe-state"

interface Message {
  role: "user" | "noe"
  text: string
  timestamp: number
}

interface Props {
  state: NoeState
  onStateUpdate: (state: NoeState) => void
}

export default function NoeChat({ state, onStateUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "noe", text: state.message, timestamp: Date.now() },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const accent = MOOD_ACCENT[state.mood]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    setMessages((m) => [...m, { role: "user", text, timestamp: Date.now() }])
    setLoading(true)

    try {
      const res = await fetch("/api/noe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      onStateUpdate(data.state)
      setMessages((m) => [...m, { role: "noe", text: data.reply, timestamp: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl font-mono text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-white/10 text-white/80"
                    : "text-white/70"
                }`}
                style={msg.role === "noe" ? { borderLeft: `2px solid ${accent}`, paddingLeft: 12 } : {}}
              >
                {msg.role === "noe" && (
                  <span className="text-xs uppercase tracking-widest block mb-1" style={{ color: accent }}>
                    Noe
                  </span>
                )}
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="px-3 py-2 font-mono text-sm" style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 12 }}>
              <span className="text-xs uppercase tracking-widest block mb-1" style={{ color: accent }}>Noe</span>
              <motion.span
                className="text-white/40"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                processing signal...
              </motion.span>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20 transition-colors"
            placeholder="Ask Noe anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all disabled:opacity-30"
            style={{ background: accent, color: "#000" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
