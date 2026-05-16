'use client'

import { GraduationCap, Wallet, Calendar, Building2, Users, Phone } from 'lucide-react'

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
    <div className="py-8 animate-fade-in">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-cu-dark">
          Quick Questions
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Click on a question to get started
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={index}
              onClick={() => onSelect(item.question)}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-left hover:border-cu-blue hover:shadow-sm transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-cu-blue/10 flex items-center justify-center flex-shrink-0 group-hover:bg-cu-blue/20">
                <Icon className="w-4 h-4 text-cu-blue" />
              </div>
              <span className="text-sm text-slate-700 group-hover:text-cu-dark">
                {item.question}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}