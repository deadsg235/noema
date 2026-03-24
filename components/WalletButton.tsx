"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useWallet } from "@/lib/wallet-store"
import { MOOD_ACCENT, type NoeMood } from "@/lib/noe-state"

interface Props { mood: NoeMood }

export default function WalletButton({ mood }: Props) {
  const { connected, address, connecting, error, connect, disconnect } = useWallet()
  const accent = MOOD_ACCENT[mood]
  const short = address ? `${address.slice(0, 4)}···${address.slice(-4)}` : null

  return (
    <div className="flex flex-col items-end gap-1">
      <motion.button
        onClick={connected ? disconnect : connect}
        disabled={connecting}
        whileTap={{ scale: 0.96 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all disabled:opacity-30"
        style={connected
          ? { border: `1px solid ${accent}33`, color: accent, background: `${accent}0d` }
          : { border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.02)" }
        }
      >
        {/* Phantom icon */}
        <svg width="12" height="12" viewBox="0 0 128 128" fill="currentColor" style={{ opacity: 0.7 }}>
          <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm0 112c-26.5 0-48-21.5-48-48S37.5 16 64 16s48 21.5 48 48-21.5 48-48 48zm-16-52a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm32 0a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM64 88c-8.8 0-16-4.5-16-10h32c0 5.5-7.2 10-16 10z"/>
        </svg>

        {connecting ? (
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
            connecting
          </motion.span>
        ) : connected ? (
          <>
            <span>{short}</span>
            <motion.div className="w-1 h-1 rounded-full" style={{ background: accent }}
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          </>
        ) : (
          <span>connect wallet</span>
        )}
      </motion.button>

      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-mono text-[9px] text-red-400/50 max-w-[180px] text-right"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
