"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useWallet } from "@/lib/wallet-store"
import { MOOD_ACCENT, type NoeMood } from "@/lib/noe-state"

interface Props {
  mood: NoeMood
}

export default function WalletButton({ mood }: Props) {
  const { connected, address, connecting, error, connect, disconnect } = useWallet()
  const accent = MOOD_ACCENT[mood]

  const short = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : null

  return (
    <div className="flex flex-col items-end gap-1">
      <motion.button
        onClick={connected ? disconnect : connect}
        disabled={connecting}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs uppercase tracking-widest transition-all disabled:opacity-40"
        style={connected
          ? { borderColor: `${accent}55`, color: accent, background: `${accent}11` }
          : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", background: "transparent" }
        }
      >
        {/* Phantom ghost icon */}
        <svg width="14" height="14" viewBox="0 0 128 128" fill="currentColor">
          <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm0 112c-26.5 0-48-21.5-48-48S37.5 16 64 16s48 21.5 48 48-21.5 48-48 48zm-16-52a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm32 0a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM64 88c-8.8 0-16-4.5-16-10h32c0 5.5-7.2 10-16 10z"/>
        </svg>

        {connecting ? (
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
            Connecting...
          </motion.span>
        ) : connected ? (
          <span>{short}</span>
        ) : (
          <span>Connect Wallet</span>
        )}

        {connected && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-mono text-[10px] text-red-400/60 max-w-[200px] text-right"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
