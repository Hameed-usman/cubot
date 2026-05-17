'use client'

import { GraduationCap, Wallet, Calendar, Building2, Users, Phone } from 'lucide-react'
import { motion } from 'framer-motion'

const suggestions = [
  { question: 'What are the admission requirements for CS?', icon: GraduationCap },
  { question: 'What are the fee structures for BBA?', icon: Wallet },
  { question: 'When does the next semester start?', icon: Calendar },
  { question: 'What facilities does the university offer?', icon: Building2 },
  { question: 'Who are the faculty members in Pharmacy?', icon: Users },
  { question: 'How do I contact the admissions office?', icon: Phone },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
}

interface QuickQuestionsProps {
  onSelect: (question: string) => void
}

export function QuickQuestions({ onSelect }: QuickQuestionsProps) {
  return (
    <div className="py-6 px-1">
      {/* Greeting */}
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-widest text-white/30 font-sans font-semibold mb-2">
          ✦ Quick Start
        </p>
        <h3 className="font-display font-bold text-xl text-white mb-1">
          What would you like to know?
        </h3>
        <p className="text-sm text-white/40 font-sans">
          Choose a question or type your own below
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        role="list"
        aria-label="Quick question suggestions"
      >
        {suggestions.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.button
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(item.question)}
              aria-label={`Ask: ${item.question}`}
              role="listitem"
              className="flex items-center gap-3.5 px-4 py-4 glass-dark rounded-2xl text-left border border-white/06 hover:border-cu-gold/40 hover:bg-cu-gold/[0.04] transition-colors duration-200 group w-full text-sm relative overflow-hidden"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              {/* Sweep shimmer on hover */}
              <div
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.04), transparent)' }}
                aria-hidden="true"
              />
              <div className="w-9 h-9 rounded-xl bg-cu-navy/80 flex items-center justify-center flex-shrink-0 group-hover:bg-cu-navy transition-colors">
                <Icon className="w-4 h-4 text-cu-gold" aria-hidden="true" />
              </div>
              <span className="text-white/70 group-hover:text-white transition-colors font-sans leading-snug">
                {item.question}
              </span>
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
