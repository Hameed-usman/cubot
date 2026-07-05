'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Database, Filter, RefreshCw, Trash2, Edit3, Plus, Eye,
  ChevronDown, ChevronUp, Copy, Check, AlertCircle, Zap, Globe, Hash,
  Clock, FileText, Box, X, Save, MoreHorizontal
} from 'lucide-react'

interface VectorEntry {
  id: string
  title: string
  content: string
  category: string
  source_url: string | null
  source_type: string
  page_type: string
  chunk_index: number
  total_chunks: number
  content_hash: string
  pinecone_vector_id: string | null
  pinecone_namespace: string | null
  embedding_model: string | null
  pinecone_synced_at: string | null
  created_at: string
  updated_at: string
  char_count: number
  approx_token_count: number
}

interface Namespace {
  namespace: string
  count: number
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-gray-500 hover:text-blue-400 transition-colors ml-1">
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

function NamespaceBadge({ ns }: { ns: string }) {
  const colors: Record<string, string> = {
    'finance': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    'admissions': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    'faculty': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    'scholarships': 'bg-green-500/15 text-green-300 border-green-500/30',
    'notices': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    'policies': 'bg-red-500/15 text-red-300 border-red-500/30',
    'facilities': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    'academic': 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    'general': 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  }
  const color = colors[ns] || 'bg-gray-500/15 text-gray-300 border-gray-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {ns}
    </span>
  )
}

function EditModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: VectorEntry | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [category, setCategory] = useState(entry?.category || '')
  const [sourceUrl, setSourceUrl] = useState(entry?.source_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isNew = !entry

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !category.trim()) {
      setError('Title, content, and category are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      let res
      if (isNew) {
        res = await fetch('/api/admin/vectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, category, source_url: sourceUrl, source_type: 'manual' }),
        })
      } else {
        res = await fetch(`/api/admin/knowledge/${entry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, namespace: category, source_url: sourceUrl }),
        })
      }
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to save')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0d1526] border border-gray-700/50 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              {isNew ? <Plus className="w-4 h-4 text-blue-400" /> : <Edit3 className="w-4 h-4 text-blue-400" />}
            </div>
            <h2 className="text-lg font-semibold text-white">
              {isNew ? 'Create New Vector Entry' : 'Edit Knowledge Entry'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!isNew && (
            <div className="bg-[#0a1120] rounded-lg p-3 flex items-start gap-3">
              <Zap className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-400">
                Saving will <span className="text-yellow-300">re-embed this content</span> and replace the vector in Pinecone namespace{' '}
                <NamespaceBadge ns={entry?.pinecone_namespace || 'general'} />.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Title</label>
            <input
              className="w-full bg-[#0a1120] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entry title..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Category / Namespace</label>
            <input
              className="w-full bg-[#0a1120] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. finance, admissions, faculty..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Source URL (optional)</label>
            <input
              className="w-full bg-[#0a1120] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Content</label>
            <textarea
              rows={8}
              className="w-full bg-[#0a1120] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 resize-none font-mono"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Knowledge content to embed..."
            />
            <p className="text-xs text-gray-600 mt-1">
              ~{Math.round(content.length / 4)} tokens · {content.length} chars
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {isNew ? 'Creating...' : 'Saving & Re-embedding...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isNew ? 'Create Entry' : 'Save & Re-embed'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function VectorDetailDrawer({ entry, onClose, onEdit, onDelete }: {
  entry: VectorEntry
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete "${entry.title}"? This will remove it from both Neon and Pinecone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/admin/knowledge/${entry.id}`, { method: 'DELETE' })
      onDelete()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0d1526] border-l border-gray-700/50 h-full overflow-y-auto">
        <div className="sticky top-0 bg-[#0d1526] border-b border-gray-800 p-5 flex items-start justify-between z-10">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <NamespaceBadge ns={entry.pinecone_namespace || 'general'} />
              <span className="text-xs text-gray-500">{entry.source_type}</span>
            </div>
            <h3 className="text-base font-semibold text-white leading-snug">{entry.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Vector IDs */}
          <div className="bg-[#0a1120] rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-3.5 h-3.5" /> Vector Mapping
            </h4>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Knowledge Entry ID</p>
                <div className="flex items-center gap-1">
                  <code className="text-xs text-blue-300 font-mono break-all">{entry.id}</code>
                  <CopyButton text={entry.id} />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Pinecone Vector ID</p>
                <div className="flex items-center gap-1">
                  <code className="text-xs text-emerald-300 font-mono break-all">{entry.pinecone_vector_id || '—'}</code>
                  {entry.pinecone_vector_id && <CopyButton text={entry.pinecone_vector_id} />}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Namespace</p>
                <code className="text-xs text-purple-300 font-mono">{entry.pinecone_namespace || '—'}</code>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Embedding Model</p>
                <code className="text-xs text-yellow-300 font-mono">{entry.embedding_model || 'gemini-embedding-001'}</code>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-[#0a1120] rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Metadata
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Category</p>
                <p className="text-white mt-0.5 font-mono">{entry.category}</p>
              </div>
              <div>
                <p className="text-gray-500">Source Type</p>
                <p className="text-white mt-0.5 font-mono">{entry.source_type}</p>
              </div>
              <div>
                <p className="text-gray-500">Chunk</p>
                <p className="text-white mt-0.5">{entry.chunk_index + 1} of {entry.total_chunks}</p>
              </div>
              <div>
                <p className="text-gray-500">Size</p>
                <p className="text-white mt-0.5">~{entry.approx_token_count} tokens · {entry.char_count} chars</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">Content Hash</p>
                <code className="text-gray-400 text-xs font-mono">{entry.content_hash?.slice(0, 24)}...</code>
              </div>
              {entry.source_url && (
                <div className="col-span-2">
                  <p className="text-gray-500">Source URL</p>
                  <a href={entry.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-xs break-all">
                    {entry.source_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-[#0a1120] rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Timestamps
            </h4>
            {[
              { label: 'Created', val: entry.created_at },
              { label: 'Updated', val: entry.updated_at },
              { label: 'Pinecone Synced', val: entry.pinecone_synced_at },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-gray-500">{label}</span>
                <span className="text-gray-300">{val ? new Date(val).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>

          {/* Content Preview */}
          <div className="bg-[#0a1120] rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" /> Chunk Content
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
              {entry.content}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-medium transition-colors"
            >
              <Edit3 className="w-4 h-4" /> Edit & Re-embed
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm transition-colors"
            >
              {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VectorExplorerTab() {
  const [entries, setEntries] = useState<VectorEntry[]>([])
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedNamespace, setSelectedNamespace] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<VectorEntry | null>(null)
  const [editEntry, setEditEntry] = useState<VectorEntry | null | 'new'>()
  const [page, setPage] = useState(0)
  const [searchDraft, setSearchDraft] = useState('')
  const limit = 50

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      })
      if (search) params.set('search', search)
      if (selectedNamespace) params.set('namespace', selectedNamespace)

      const res = await fetch(`/api/admin/vectors?${params}`)
      const data = await res.json()
      if (res.ok) {
        setEntries(data.entries || [])
        setTotal(data.total || 0)
        setNamespaces(data.namespaces || [])
      }
    } finally {
      setLoading(false)
    }
  }, [search, selectedNamespace, page])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchDraft)
    setPage(0)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Vector Explorer</h2>
          <p className="text-sm text-gray-400 mt-1">
            {total.toLocaleString()} vectors across {namespaces.length} namespaces — all sourced from Neon + Pinecone
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEntries}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors border border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setEditEntry('new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: total.toLocaleString(), icon: Database, color: 'text-blue-400' },
          { label: 'Namespaces', value: namespaces.length, icon: Box, color: 'text-purple-400' },
          { label: 'Showing', value: `${Math.min(page * limit + 1, total)}–${Math.min((page + 1) * limit, total)}`, icon: Eye, color: 'text-emerald-400' },
          { label: 'Page', value: `${page + 1} / ${totalPages || 1}`, icon: FileText, color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0d1526] border border-gray-800/60 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-800/80 rounded-lg flex items-center justify-center">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search by title, content, URL, vector ID..."
              className="w-full bg-[#0d1526] border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-medium transition-colors"
          >
            Search
          </button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchDraft(''); setPage(0) }}
              className="px-3 py-2.5 text-gray-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        <select
          value={selectedNamespace}
          onChange={(e) => { setSelectedNamespace(e.target.value); setPage(0) }}
          className="bg-[#0d1526] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/60 min-w-[160px]"
        >
          <option value="">All Namespaces</option>
          {namespaces.map((ns: any) => (
            <option key={ns.namespace} value={ns.namespace}>
              {ns.namespace} ({ns.count})
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0d1526] border border-gray-800/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/60 bg-[#0a1120]">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3.5">Entry</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5">Namespace</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5 hidden md:table-cell">Source</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5 hidden lg:table-cell">Size</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3.5 hidden xl:table-cell">Synced</th>
                <th className="text-right px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <RefreshCw className="w-6 h-6 text-gray-600 animate-spin mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Loading vectors...</p>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Database className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500">No entries found</p>
                  </td>
                </tr>
              ) : entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-blue-500/5 cursor-pointer transition-colors group"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <td className="px-5 py-4">
                    <div className="max-w-xs">
                      <p className="text-white font-medium text-sm truncate">{entry.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">
                        {entry.content.slice(0, 80)}...
                      </p>
                      <code className="text-gray-700 text-xs font-mono">{entry.id.slice(0, 8)}...</code>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <NamespaceBadge ns={entry.pinecone_namespace || 'general'} />
                    <p className="text-xs text-gray-600 mt-1">chunk {entry.chunk_index + 1}/{entry.total_chunks}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    {entry.source_url ? (
                      <div className="max-w-[180px]">
                        <p className="text-xs text-gray-400 truncate">{entry.source_url}</p>
                        <span className={`inline-block text-xs mt-0.5 ${
                          entry.source_type === 'manual' ? 'text-purple-400' : 'text-emerald-400'
                        }`}>
                          {entry.source_type}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">manual entry</span>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-xs text-gray-300">~{entry.approx_token_count} tk</p>
                    <p className="text-xs text-gray-600">{entry.char_count} ch</p>
                  </td>
                  <td className="px-4 py-4 hidden xl:table-cell">
                    {entry.pinecone_synced_at ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.pinecone_synced_at).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                        <span className="text-xs text-gray-500">pending</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditEntry(entry) }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-blue-400 transition-all rounded-lg hover:bg-blue-500/10"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800/60">
            <p className="text-xs text-gray-500">
              Showing {Math.min(page * limit + 1, total).toLocaleString()}–{Math.min((page + 1) * limit, total).toLocaleString()} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-500 px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedEntry && !editEntry && (
        <VectorDetailDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onEdit={() => setEditEntry(selectedEntry)}
          onDelete={() => { fetchEntries(); setSelectedEntry(null) }}
        />
      )}

      {/* Edit Modal */}
      {editEntry !== undefined && (
        <EditModal
          entry={editEntry === 'new' ? null : (editEntry as VectorEntry)}
          onClose={() => setEditEntry(undefined)}
          onSaved={() => { fetchEntries(); setSelectedEntry(null) }}
        />
      )}
    </div>
  )
}
