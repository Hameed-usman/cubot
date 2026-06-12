'use client'

import { useState, useEffect } from 'react'
import { HelpCircle, CheckCircle, Loader2, Clock } from 'lucide-react'
import { getUnansweredQuestions, resolveUnansweredQuestion } from '@/app/actions/admin'

export default function UnansweredTab() {
  const [questions, setQuestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  useEffect(() => {
    loadQuestions()
  }, [])

  async function loadQuestions() {
    setIsLoading(true)
    const result = await getUnansweredQuestions()
    if (result.success) {
      setQuestions(result.data || [])
    }
    setIsLoading(false)
  }

  async function handleResolve(id: number) {
    setResolvingId(id)
    const result = await resolveUnansweredQuestion(id)
    if (result.success) {
      setQuestions(questions.map(q => q.id === id ? { ...q, is_resolved: true } : q))
    } else {
      alert('Failed to resolve question.')
    }
    setResolvingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cu-gold" />
      </div>
    )
  }

  const unresolvedCount = questions.filter(q => !q.is_resolved).length

  return (
    <div className="flex flex-col gap-6 h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="glass-dark rounded-3xl p-6 flex items-center justify-between" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
            <HelpCircle className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-white">Unanswered Questions</h2>
            <p className="text-sm text-white/40 font-sans mt-0.5">Review user questions that Cubot could not answer.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white/50 bg-white/5 px-4 py-2 rounded-xl">
            {unresolvedCount} Action Required
          </span>
        </div>
      </div>

      {/* List */}
      <div className="glass-dark rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70 font-sans">
            <thead className="bg-white/5 border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Question</th>
                <th className="px-6 py-4 font-semibold">Language / Intent</th>
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {questions.map(q => (
                <tr key={q.id} className={`transition-colors ${q.is_resolved ? 'opacity-50' : 'hover:bg-white/5'}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-white max-w-md truncate" title={q.question_text}>
                      {q.question_text}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-white/50 uppercase tracking-wide">{q.language}</span>
                      <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded w-max text-white/40">
                        {q.persona}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-1.5 text-white/40 whitespace-nowrap h-full mt-2">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(q.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {q.is_resolved ? (
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium flex items-center gap-1 w-max">
                        <CheckCircle className="w-3 h-3" /> Resolved
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400 text-xs font-medium w-max">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!q.is_resolved && (
                      <button
                        onClick={() => handleResolve(q.id)}
                        disabled={resolvingId === q.id}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/10 text-white/60 hover:text-emerald-400 transition-colors text-xs font-medium border border-white/10 hover:border-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                      >
                        {resolvingId === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {questions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-white/40">
                    Hooray! No unanswered questions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
