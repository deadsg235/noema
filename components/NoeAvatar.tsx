"use client"

import { motion, AnimatePresence } from "framer-motion"
import { MOOD_GLOW, MOOD_ACCENT, type NoeMood, type NoeState } from "@/lib/noe-state"

interface Props {
  mood: NoeMood
  energy: number
  message: string
  expression: NoeState["expression"]
}

export default function NoeAvatar({ mood, energy, message, expression }: Props) {
  const glow = MOOD_GLOW[mood]
  const accent = MOOD_ACCENT[mood]
  const { visual } = expression
  const pulseScale = 1 + (energy / 100) * 0.3

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Orb */}
      <div className="relative flex items-center justify-center w-48 h-48">
        {/* Outer pulse rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{ borderColor: accent, opacity: 0.15 / i }}
            animate={{
              scale: [1, pulseScale + i * 0.15, 1],
              opacity: [0.15 / i, 0.05 / i, 0.15 / i],
              filter: `blur(${visual.glitchIntensity * 2}px)`,
            }}
            transition={{
              duration: visual.energyFlow === "fragmented" ? 1 : 2 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
            initial={{ width: 192 + i * 32, height: 192 + i * 32 }}
          />
        ))}

        {/* Core orb */}
        <motion.div
          className="relative w-36 h-36 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${accent}88, ${accent}22, #000)`,
            boxShadow: `0 0 40px ${glow}, 0 0 80px ${glow}, inset 0 0 30px rgba(0,0,0,0.5)`,
          }}
          animate={{
            scale: [1, 1.04, 1],
            boxShadow: [
              `0 0 ${40 * visual.eyeBrightness}px ${glow}, 0 0 ${80 * visual.eyeBrightness}px ${glow}`,
              `0 0 ${60 * visual.eyeBrightness}px ${glow}, 0 0 ${120 * visual.eyeBrightness}px ${glow}`,
              `0 0 ${40 * visual.eyeBrightness}px ${glow}, 0 0 ${80 * visual.eyeBrightness}px ${glow}`,
            ],
            x: visual.glitchIntensity > 0 ? [0, -2, 2, -1, 0] : 0,
          }}
          transition={{ 
            duration: visual.glitchIntensity > 0 ? 0.2 : 3, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          {/* Inner shimmer */}
          <motion.div
            className="absolute w-8 h-8 rounded-full"
            style={{ background: accent, opacity: 0.6 * visual.eyeBrightness, top: "22%", left: "22%" }}
            animate={{ opacity: [0.6, 0.2, 0.6], scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {/* Energy text */}
          <span className="relative z-10 text-white font-mono text-sm font-bold opacity-80">
            {energy}%
          </span>
        </motion.div>
      </div>

      {/* Mood label */}
      <motion.div
        key={mood}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: accent }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: accent }}>
          {mood}
        </span>
      </motion.div>

      {/* Message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5 }}
          className="text-center text-sm text-white/50 max-w-xs font-mono leading-relaxed"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
