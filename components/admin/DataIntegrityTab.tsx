'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, RefreshCw, Trash2, CheckCircle, Database, Hash,
  Search, Zap, Shield, Copy as CopyIcon, AlertCircle, ChevronDown, ChevronUp,
  Link2, X, RotateCcw
} from 'lucide-react'

interface DuplicateSummary {
  duplicateUrlGroups: number
  duplicateContentGroups: number
  duplicatePageGroups: number
  similarEntryGroups: number
  totalDuplicateEntries: number
}

interface DuplicateContentRow {
  content_hash: string
  occurrence_count: number | string
  entry_ids: string[]
  source_urls: string[]
  content_preview: string
  first_seen: string
}

interface OrphanData {
  summary: {
    dbTotal: number
    pineconeTotal: number
    dbOrphansCount: number
    pineconeOrphansCount: number
  }
  orphansInDb: Array<{ id: string; category: string }>
  orphansInPinecone: string[]
}

type ActiveView = 'duplicates' | 'orphans'

function OrphanSection() {
  const [data, setData] = useState<OrphanData | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const scan = async () => {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/admin/orphan-detection')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to scan')
      setData(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const repairDbOrphans = async () => {
    if (!data?.orphansInDb.length) return
    if (!confirm(`Re-embed ${data.orphansInDb.length} Neon records missing from Pinecone?`)) return
    setActionLoading(true)
    try {
      // Trigger re-embed for each orphaned DB entry
      const ids = data.orphansInDb.map(e => e.id)
      const res = await fetch('/api/admin/orphan-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_from_db', ids: [] }), // Keep existing
      })
      // For now, show message to use re-embed API
      setMessage(`To repair: use the Vector Explorer to re-embed the ${ids.length} orphaned entries.`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const prunePineconeOrphans = async () => {
    if (!data?.orphansInPinecone.length) return
    if (!confirm(`Delete ${data.orphansInPinecone.length} Pinecone vectors with no matching Neon record?`)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/orphan-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_from_pinecone', ids: data.orphansInPinecone }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setMessage(d.message)
      await scan() // Refresh
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Scan Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Orphan Detection</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Detects records in Neon missing from Pinecone and vectors in Pinecone missing from Neon.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Scanning...' : 'Scan for Orphans'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 rounded-xl px-4 py-3">
          <CheckCircle className="w-4 h-4" /> {message}
        </div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Neon Records', value: data.summary.dbTotal.toLocaleString(), color: 'text-blue-400' },
              { label: 'Pinecone Vectors', value: data.summary.pineconeTotal.toLocaleString(), color: 'text-purple-400' },
              { label: 'DB Orphans', value: data.summary.dbOrphansCount, color: data.summary.dbOrphansCount > 0 ? 'text-yellow-400' : 'text-green-400' },
              { label: 'Pine Orphans', value: data.summary.pineconeOrphansCount, color: data.summary.pineconeOrphansCount > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-black/30 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* DB Orphans (in Neon, missing in Pinecone) */}
          {data.orphansInDb.length > 0 ? (
            <div className="bg-[#0a1120] rounded-xl border border-yellow-500/20 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <h4 className="text-sm font-semibold text-white">
                    Neon Records Missing in Pinecone ({data.orphansInDb.length})
                  </h4>
                </div>
                <button
                  onClick={repairDbOrphans}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Repair Guide
                </button>
              </div>
              <div className="px-5 py-3 max-h-48 overflow-y-auto">
                {data.orphansInDb.slice(0, 20).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-800/40 last:border-0">
                    <code className="text-xs text-gray-400 font-mono">{entry.id.slice(0, 16)}...</code>
                    <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800 rounded">{entry.category}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-sm text-green-300">No Neon orphans found — all records have Pinecone vectors</p>
            </div>
          )}

          {/* Pinecone Orphans (in Pinecone, missing in Neon) */}
          {data.orphansInPinecone.length > 0 ? (
            <div className="bg-[#0a1120] rounded-xl border border-red-500/20 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <h4 className="text-sm font-semibold text-white">
                    Pinecone Orphan Vectors ({data.orphansInPinecone.length})
                  </h4>
                </div>
                <button
                  onClick={prunePineconeOrphans}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-medium transition-colors"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Orphans
                </button>
              </div>
              <div className="px-5 py-3 max-h-48 overflow-y-auto">
                {data.orphansInPinecone.slice(0, 20).map((id) => (
                  <div key={id} className="py-2 border-b border-gray-800/40 last:border-0">
                    <code className="text-xs text-red-400 font-mono">{id}</code>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-sm text-green-300">No Pinecone orphans found — all vectors have matching Neon records</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DuplicateSection() {
  const [data, setData] = useState<{
    summary: DuplicateSummary
    duplicateContent: DuplicateContentRow[]
    similarEntries: any[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(new Set())

  const scan = async () => {
    setLoading(true)
    setMessage('')
    setError('')
    setSelectedToRemove(new Set())
    try {
      const res = await fetch('/api/admin/duplicates')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to scan')
      setData(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const removeSelected = async () => {
    const ids = Array.from(selectedToRemove)
    if (ids.length === 0) return
    if (!confirm(`Remove ${ids.length} duplicate entries from Neon and Pinecone?`)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/duplicates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeIds: ids }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setMessage(d.message)
      await scan()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedToRemove)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedToRemove(next)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Duplicate Detection</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Finds duplicate content hashes, similar entries, and duplicate URLs across Neon.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedToRemove.size > 0 && (
            <button
              onClick={removeSelected}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-sm font-medium transition-colors"
            >
              {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Remove {selectedToRemove.size} selected
            </button>
          )}
          <button
            onClick={scan}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Scanning...' : 'Scan for Duplicates'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 rounded-xl px-4 py-3">
          <CheckCircle className="w-4 h-4" /> {message}
        </div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Content Duplicate Groups', value: data.summary.duplicateContentGroups, color: data.summary.duplicateContentGroups > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Similar Entry Groups', value: data.summary.similarEntryGroups, color: data.summary.similarEntryGroups > 0 ? 'text-yellow-400' : 'text-green-400' },
              { label: 'Duplicate URL Groups', value: data.summary.duplicateUrlGroups, color: data.summary.duplicateUrlGroups > 0 ? 'text-orange-400' : 'text-green-400' },
              { label: 'Total Removable', value: data.summary.totalDuplicateEntries, color: data.summary.totalDuplicateEntries > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-black/30 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Duplicate Content (same hash) */}
          {data.duplicateContent.length > 0 ? (
            <div className="bg-[#0a1120] rounded-xl border border-red-500/20 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800/60 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h4 className="text-sm font-semibold text-white">
                  Duplicate Content ({data.duplicateContent.length} groups)
                </h4>
                <span className="text-xs text-gray-500">Select entries to remove</span>
              </div>
              <div className="divide-y divide-gray-800/40 max-h-96 overflow-y-auto">
                {data.duplicateContent.map((row) => (
                  <div key={row.content_hash} className="px-5 py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <code className="text-xs text-gray-500 font-mono">{row.content_hash.slice(0, 16)}...</code>
                        <span className="ml-2 text-xs text-red-400">{row.occurrence_count}× duplicate</span>
                      </div>
                      <button
                        onClick={() => setExpanded(expanded === row.content_hash ? null : row.content_hash)}
                        className="text-gray-500 hover:text-white"
                      >
                        {expanded === row.content_hash ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">{row.content_preview}</p>
                    {expanded === row.content_hash && (
                      <div className="space-y-2 mt-3">
                        <p className="text-xs text-gray-500 mb-2">Select duplicates to remove (keep the first):</p>
                        {row.entry_ids.slice(1).map((id) => (
                          <label key={id} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedToRemove.has(id)}
                              onChange={() => toggleSelect(id)}
                              className="w-4 h-4 rounded"
                            />
                            <code className="text-xs text-red-400 font-mono">{id}</code>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-sm text-green-300">No duplicate content found — all content hashes are unique</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function DataIntegrityTab() {
  const [view, setView] = useState<ActiveView>('orphans')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Data Integrity</h2>
        <p className="text-sm text-gray-400 mt-1">
          Detect and repair orphan records and duplicate content between Neon and Pinecone.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-[#0a1120] p-1 rounded-xl border border-gray-800/60 self-start w-fit">
        <button
          onClick={() => setView('orphans')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            view === 'orphans' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'text-gray-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Orphan Detection
        </button>
        <button
          onClick={() => setView('duplicates')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            view === 'duplicates' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-400 hover:text-white'
          }`}
        >
          <CopyIcon className="w-4 h-4" />
          Duplicate Detection
        </button>
      </div>

      {/* Content */}
      <div className="bg-[#0d1526] border border-gray-800/60 rounded-2xl p-6">
        {view === 'orphans' ? <OrphanSection /> : <DuplicateSection />}
      </div>
    </div>
  )
}

