'use client'

import { useState, useEffect } from 'react'
import { Database, Trash2, Loader2, ExternalLink, Calendar } from 'lucide-react'
import { getKnowledgeEntries, deleteKnowledgeEntry } from '@/app/actions/admin'

export default function KnowledgeListTab() {
  const [entries, setEntries] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadEntries()
  }, [])

  async function loadEntries() {
    setIsLoading(true)
    const result = await getKnowledgeEntries()
    if (result.success) {
      setEntries(result.data || [])
    }
    setIsLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this entry? It will also be removed from the vector database.')) return
    
    setDeletingId(id)
    const result = await deleteKnowledgeEntry(id)
    if (result.success) {
      setEntries(entries.filter(e => e.id !== id))
    } else {
      alert('Failed to delete entry.')
    }
    setDeletingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cu-gold" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="glass-dark rounded-3xl p-6 flex items-center justify-between" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cu-gold/10 flex items-center justify-center border border-cu-gold/20">
            <Database className="w-6 h-6 text-cu-gold" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-white">Knowledge Base Entries</h2>
            <p className="text-sm text-white/40 font-sans mt-0.5">Manage all ingested documents, URLs, and text snippets.</p>
          </div>
        </div>
        <div className="text-sm font-semibold text-white/50 bg-white/5 px-4 py-2 rounded-xl">
          {entries.length} Total Entries
        </div>
      </div>

      {/* List */}
      <div className="glass-dark rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70 font-sans">
            <thead className="bg-white/5 border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Title</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Updated</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white flex items-center gap-2">
                      {entry.title}
                      {entry.source_url && (
                        <a href={entry.source_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md bg-white/10 text-white/60 text-xs">
                      {entry.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      entry.type === 'document' ? 'bg-blue-500/10 text-blue-400' :
                      entry.type === 'url' ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-purple-500/10 text-purple-400'
                    }`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-1.5 text-white/40 whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(entry.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="p-2 rounded-xl text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      title="Delete Entry"
                    >
                      {deletingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-white/40">
                    No knowledge entries found. Use the Editor or Sync tabs to add some!
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
