'use client'

import { Bot } from 'lucide-react'
import { motion } from 'framer-motion'

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25 }}
      className="flex justify-start"
      role="status"
      aria-label="Cubot is thinking"
    >
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-2xl bg-cu-navy flex items-center justify-center flex-shrink-0 shadow-navy-glow border border-cu-navy-mid/50">
          <Bot className="w-5 h-5 text-cu-gold" aria-hidden="true" />
        </div>

        {/* Dots bubble */}
        <div className="px-5 py-4 glass-dark rounded-2xl rounded-bl-md border border-white/08" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cu-gold bounce-dot-1" />
            <div className="w-2 h-2 rounded-full bg-cu-gold bounce-dot-2" />
            <div className="w-2 h-2 rounded-full bg-cu-gold bounce-dot-3" />
            <span className="ml-2 text-xs text-white/35 font-sans">Cubot is thinking…</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}