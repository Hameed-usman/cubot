'use client'

import { GraduationCap, Wallet, Calendar, Building2, Users, Phone } from 'lucide-react'
import { motion } from 'framer-motion'

const suggestions = [
  {
    question: 'What are the admission requirements for CS?',
    icon: GraduationCap,
  },
  {
    question: 'What are the fee structures for BBA?',
    icon: Wallet,
  },
  {
    question: 'When does the next semester start?',
    icon: Calendar,
  },
  {
    question: 'What facilities does the university offer?',
    icon: Building2,
  },
  {
    question: 'Who are the faculty members in Pharmacy?',
    icon: Users,
  },
  {
    question: 'How do I contact the admissions office?',
    icon: Phone,
  },
]

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="py-8">
      <div className="text-center mb-6 animate-fade-in">
        <h3 className="text-xl font-bold text-cu-blue">
          Quick Questions
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Click on a question to get started
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {suggestions.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={index}
              onClick={() => onSelect(item.question)}
              className="flex items-center gap-3 px-4 py-4 bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl text-left hover:border-cu-gold/50 hover:shadow-[0_8px_30px_rgb(200,150,12,0.15)] transition-all group relative overflow-hidden"
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cu-gold/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              
              <div className="w-10 h-10 rounded-xl bg-cu-blue/5 flex items-center justify-center flex-shrink-0 group-hover:bg-cu-blue/10 transition-colors z-10">
                <Icon className="w-5 h-5 text-cu-blue" />
              </div>
              <span className="text-sm font-medium text-slate-700 group-hover:text-cu-dark transition-colors z-10">
                {item.question}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}