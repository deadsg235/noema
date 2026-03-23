"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MOOD_ACCENT, type NoeUIState } from "@/lib/noe-state"

interface Message {
  role: "user" | "noe"
  text: string
  cluster?: string
  streaming?: boolean
}

interface Props {
  state: NoeUIState
  onStateUpdate: (state: NoeUIState) => void
}

export default function NoeChat({ state, onStateUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "noe", text: state.message, cluster: state.cluster },
  ])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const accent = MOOD_ACCENT[state.mood]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Build history for LLM context (exclude the initial ambient message)
  const getHistory = useCallback(() => {
    return messages.slice(1).map((m) => ({ role: m.role, text: m.text }))
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    setInput("")
    setMessages((m) => [...m, { role: "user", text }])
    setStreaming(true)

    // Add empty Noe message that we'll stream into
    setMessages((m) => [...m, { role: "noe", text: "", streaming: true }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/noe/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: getHistory() }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Parse updated engine state from header
      const rawState = res.headers.get("X-Noe-State")
      if (rawState) {
        try {
          onStateUpdate(JSON.parse(decodeURIComponent(rawState)))
        } catch {}
      }

      // Stream tokens into the last message
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error("No response body")

      let fullText = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setMessages((m) => {
          const updated = [...m]
          updated[updated.length - 1] = {
            role: "noe",
            text: fullText,
            cluster: state.cluster,
            streaming: true,
          }
          return updated
        })
      }

      // Mark streaming done
      setMessages((m) => {
        const updated = [...m]
        updated[updated.length - 1] = {
          role: "noe",
          text: fullText,
          cluster: state.cluster,
          streaming: false,
        }
        return updated
      })
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setMessages((m) => {
        const updated = [...m]
        updated[updated.length - 1] = {
          role: "noe",
          text: "Signal lost. Try again.",
          cluster: state.cluster,
          streaming: false,
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages((m) => {
      const updated = [...m]
      const last = updated[updated.length - 1]
      if (last?.streaming) updated[updated.length - 1] = { ...last, streaming: false }
      return updated
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "noe" ? (
                <div
                  className="max-w-[88%] px-3 py-2 font-mono text-sm leading-relaxed text-white/70"
                  style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 12 }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>
                      Noe
                    </span>
                    {msg.cluster && (
                      <span className="text-[9px] text-white/20 uppercase tracking-widest">
                        [{msg.cluster.replace("_", " ")}]
                      </span>
                    )}
                  </div>

                  {/* Text with streaming cursor */}
                  <span className="whitespace-pre-wrap break-words">
                    {msg.text}
                    {msg.streaming && (
                      <motion.span
                        className="inline-block w-[2px] h-[14px] ml-[2px] align-middle"
                        style={{ background: accent }}
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                      />
                    )}
                  </span>
                </div>
              ) : (
                <div className="max-w-[88%] px-3 py-2 rounded-xl bg-white/[0.05] font-mono text-sm text-white/70 border border-white/[0.06] break-words">
                  {msg.text}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 font-mono text-sm text-white/80 placeholder-white/15 outline-none focus:border-white/20 transition-colors"
            placeholder="Ask Noe anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            disabled={streaming}
          />
          {streaming ? (
            <button
              onClick={stop}
              className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest border transition-all"
              style={{ borderColor: `${accent}44`, color: accent }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest font-bold transition-all disabled:opacity-20"
              style={{ background: accent, color: "#000" }}
            >
              Send
            </button>
          )}
        </div>
        <p className="font-mono text-[10px] text-white/15 mt-2 text-center">
          llama-3.3-70b · groq · streaming
        </p>
      </div>
    </div>
  )
}
