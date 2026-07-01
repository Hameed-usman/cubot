'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Trash2, Edit2, Plus } from 'lucide-react'

export default function UnansweredTab() {
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'unresolved' | 'resolved'>('unresolved')
  
  // Resolve Form State
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveAnswer, setResolveAnswer] = useState('')
  const [resolveCategory, setResolveCategory] = useState('general')
  const [isResolving, setIsResolving] = useState(false)

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/unanswered?resolved=${filter === 'resolved'}`)
      const data = await res.json()
      setQuestions(data.unanswered || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [filter])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record forever?')) return
    try {
      await fetch(`/api/admin/unanswered/${id}`, { method: 'DELETE' })
      fetchQuestions()
    } catch (e) {
      console.error(e)
    }
  }

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingId || !resolveAnswer) return

    setIsResolving(true)
    try {
      const q = questions.find(q => q.id === resolvingId)
      
      // 1. Create Knowledge Entry
      const knowledgeRes = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Answer: ${q.question_text.slice(0, 50)}...`,
          content: `Q: ${q.question_text}\n\nA: ${resolveAnswer}`,
          namespace: resolveCategory,
          tags: 'faq'
        })
      })
      const knowledgeData = await knowledgeRes.json()

      // 2. Mark question as resolved
      if (knowledgeData.success) {
        await fetch(`/api/admin/unanswered/${resolvingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resolved: true,
            resolved_entry_id: knowledgeData.entry?.id
          })
        })
        setResolvingId(null)
        setResolveAnswer('')
        fetchQuestions()
      } else {
        alert('Failed to create knowledge entry: ' + knowledgeData.error)
      }
    } catch (err) {
      console.error(err)
      alert('Error during resolution workflow')
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#141414] p-4 rounded-xl border border-gray-800">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unresolved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'unresolved' ? 'bg-red-900/40 text-red-400 border border-red-500/30' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            Needs Answer
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'resolved' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            Resolved
          </button>
        </div>
      </div>

      {resolvingId && (
        <div className="bg-[#141414] border border-blue-500/30 rounded-xl p-6 shadow-lg mb-6">
          <h4 className="text-lg font-semibold mb-2">Resolve Question & Add to Knowledge Base</h4>
          <p className="text-gray-400 text-sm mb-4">
            Question: <span className="text-white">"{questions.find(q => q.id === resolvingId)?.question_text}"</span>
          </p>
          <form onSubmit={handleResolve} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Answer Context (will be embedded)</label>
              <textarea 
                required 
                rows={4}
                value={resolveAnswer}
                onChange={e => setResolveAnswer(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 font-mono text-sm" 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select required value={resolveCategory} onChange={e => setResolveCategory(e.target.value)} className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
                <option value="general">General</option>
                <option value="admissions">Admissions</option>
                <option value="faculty">Faculty</option>
                <option value="dept-cs">CS & IT</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setResolvingId(null)} className="px-4 py-2 hover:bg-gray-800 rounded-lg text-sm text-gray-400">Cancel</button>
              <button type="submit" disabled={isResolving} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium flex items-center gap-2">
                {isResolving ? 'Resolving...' : 'Save & Resolve'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-800">
            <tr>
              <th className="px-6 py-4">Question</th>
              <th className="px-6 py-4">Context</th>
              <th className="px-6 py-4">Asked At</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading questions...</td></tr>
            ) : questions.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No {filter} questions found.</td></tr>
            ) : (
              questions.map(q => (
                <tr key={q.id} className="hover:bg-gray-800/20">
                  <td className="px-6 py-4 font-medium text-gray-200 max-w-md">
                    {q.question_text}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Lang: {q.language || 'unknown'}</span>
                      <span className="text-xs text-gray-500">Tier: {q.tier_reached || 'tier1'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(q.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {filter === 'unresolved' && (
                        <button 
                          onClick={() => setResolvingId(q.id)} 
                          className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 rounded-md transition-colors flex items-center gap-1 text-xs font-medium"
                        >
                          <Plus className="w-3 h-3" /> Resolve
                        </button>
                      )}
                      <button onClick={() => handleDelete(q.id)} className="p-1.5 hover:bg-red-900/30 text-red-400 rounded-md transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
