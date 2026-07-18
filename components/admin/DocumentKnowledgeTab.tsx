'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Link2, FileText, Trash2, ArchiveRestore, CheckCircle2,
  XCircle, AlertTriangle, Loader2, RefreshCw, ChevronDown,
  Database, Layers, BarChart3, Clock, Hash, BookOpen,
  Eye, EyeOff, SkipForward, RotateCcw, Search, File,
  Zap,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number
  message: string
  status: 'info' | 'success' | 'error' | 'warn'
}

interface IngestionResult {
  documentId: string
  totalPages: number
  totalChunks: number
  totalTokens: number
  embeddingTimeMs: number
  namespaceDistribution: Record<string, number>
  duplicateChunksRemoved: number
  status: 'completed' | 'failed'
}

interface DocumentRecord {
  id: string
  name: string
  version: string
  source_type: string
  source_url: string | null
  file_name: string | null
  file_size_bytes: number
  status: string
  is_active: boolean
  total_pages: number
  total_chunks: number
  total_tokens: number
  embedding_time_ms: number
  namespace_distribution: Record<string, number>
  duplicate_chunks_removed: number
  error_message: string | null
  created_at: string
  updated_at: string
}

interface ConflictInfo {
  message: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    completed: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Completed' },
    failed: { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Failed' },
    processing: { color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', label: 'Processing' },
  }
  const cfg = map[status] || { color: 'text-gray-400 bg-gray-800 border-gray-700', label: status }
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function LogIcon({ status }: { status: LogEntry['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
  if (status === 'error')   return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
  if (status === 'warn')    return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
  return <Loader2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const NS_COLORS: Record<string, string> = {
  finance: 'bg-green-500/20 text-green-300 border-green-500/30',
  scholarships: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  admissions: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  policies: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  academic: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  facilities: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  faculty: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  events: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  notices: 'bg-red-500/20 text-red-300 border-red-500/30',
  general: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}
function NsBadge({ ns, count }: { ns: string; count: number }) {
  const cls = NS_COLORS[ns] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${cls}`}>
      {ns} ({count})
    </span>
  )
}

// ─── Ingestion Panel ─────────────────────────────────────────────────────────

function IngestionPanel({ onIngestionComplete }: { onIngestionComplete: () => void }) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [docName, setDocName] = useState('')
  const [docVersion, setDocVersion] = useState('1.0')
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<IngestionResult | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number; stage: string } | null>(null)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)
  const logIdRef = useRef(0)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (message: string, status: LogEntry['status'] = 'info') => {
    setLogs(prev => [...prev, { id: ++logIdRef.current, message, status }])
  }

  const reset = () => {
    setLogs([])
    setResult(null)
    setProgress(null)
    setConflict(null)
  }

  const handleFileChange = (f: File) => {
    setFile(f)
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') handleFileChange(f)
  }

  const runIngestion = async (conflictResolution = 'ask') => {
    if (isRunning) return
    reset()
    setIsRunning(true)
    setConflict(null)

    try {
      let body: FormData | string
      let headers: Record<string, string> = {}

      if (mode === 'upload') {
        if (!file) { addLog('❌ No file selected', 'error'); setIsRunning(false); return }
        const fd = new FormData()
        fd.append('file', file)
        fd.append('name', docName || file.name)
        fd.append('version', docVersion)
        fd.append('conflictResolution', conflictResolution)
        body = fd
      } else {
        if (!url.trim()) { addLog('❌ No URL entered', 'error'); setIsRunning(false); return }
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({ url: url.trim(), name: docName, version: docVersion, conflictResolution })
      }

      const res = await fetch('/api/admin/ingest-pdf', {
        method: 'POST',
        headers,
        body,
      })

      if (!res.ok || !res.body) {
        addLog('❌ Server error — check console', 'error')
        setIsRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          try {
            const data = JSON.parse(part.slice(6))
            if (data.type === 'log') {
              addLog(data.message, data.status)
            } else if (data.type === 'progress') {
              setProgress({ current: data.current, total: data.total, stage: data.stage })
            } else if (data.type === 'conflict') {
              setConflict({ message: data.message })
              setIsRunning(false)
              return
            } else if (data.type === 'done') {
              if (data.result) {
                setResult(data.result)
                onIngestionComplete()
              }
            }
          } catch { /* partial line */ }
        }
      }
    } catch (err: any) {
      addLog(`❌ Connection error: ${err.message}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Mode Toggle */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
        {(['upload', 'url'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); reset() }}
            disabled={isRunning}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === m
                ? 'bg-violet-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {m === 'upload' ? <Upload className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {m === 'upload' ? 'Upload File' : 'Import via URL'}
          </button>
        ))}
      </div>

      {/* Upload Zone */}
      {mode === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-violet-500 bg-violet-500/5'
              : file
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-gray-700 hover:border-violet-500/50'
          }`}
          onClick={() => document.getElementById('pdf-file-input')?.click()}
        >
          <input
            id="pdf-file-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }}
          />
          {file ? (
            <div className="space-y-2">
              <FileText className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="font-medium text-emerald-300">{file.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(file.size)} — click to change</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-sm text-gray-400">Drag & drop a PDF here, or <span className="text-violet-400">browse files</span></p>
              <p className="text-xs text-gray-600">Supports PDF documents up to 40+ pages</p>
            </div>
          )}
        </div>
      )}

      {/* URL Input */}
      {mode === 'url' && (
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://university.edu/student-handbook.pdf"
            disabled={isRunning}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 placeholder-gray-600"
          />
        </div>
      )}

      {/* Metadata Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={docName}
            onChange={e => setDocName(e.target.value)}
            placeholder="Document name"
            disabled={isRunning}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 placeholder-gray-600"
          />
        </div>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={docVersion}
            onChange={e => setDocVersion(e.target.value)}
            placeholder="Version (e.g. 2025)"
            disabled={isRunning}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 placeholder-gray-600"
          />
        </div>
      </div>

      {/* Conflict Resolution UI */}
      <AnimatePresence>
        {conflict && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-300">Duplicate Document Detected</p>
                <p className="text-xs text-yellow-400/80 mt-1">{conflict.message}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConflict(null)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip
              </button>
              <button
                onClick={() => runIngestion('replace')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-300 hover:bg-orange-600/30 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Replace
              </button>
              <button
                onClick={() => runIngestion('reindex')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" /> New Version
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      {!conflict && (
        <button
          onClick={() => runIngestion('ask')}
          disabled={isRunning || (mode === 'upload' ? !file : !url.trim())}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white shadow-lg shadow-violet-500/20"
        >
          {isRunning
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
            : <><Zap className="w-4 h-4" /> Ingest Document</>
          }
        </button>
      )}

      {/* Progress Bar */}
      {isRunning && progress && progress.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span className="capitalize">{progress.stage}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full"
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Live Log Terminal */}
      <AnimatePresence>
        {logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Live Log</span>
              {isRunning && (
                <span className="flex items-center gap-1.5 text-xs text-violet-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  Running
                </span>
              )}
            </div>
            <div className="max-h-56 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
              {logs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2"
                >
                  <LogIcon status={log.status} />
                  <span className={
                    log.status === 'success' ? 'text-emerald-300' :
                    log.status === 'error'   ? 'text-red-300' :
                    log.status === 'warn'    ? 'text-yellow-300' :
                    'text-gray-300'
                  }>{log.message}</span>
                </motion.div>
              ))}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Summary */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">Ingestion Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pages', value: result.totalPages, icon: FileText },
                { label: 'Chunks', value: result.totalChunks, icon: Layers },
                { label: 'Est. Tokens', value: result.totalTokens.toLocaleString(), icon: Hash },
                { label: 'Embed Time', value: formatMs(result.embeddingTimeMs), icon: Clock },
                { label: 'Duplicates', value: result.duplicateChunksRemoved, icon: SkipForward },
                { label: 'Namespaces', value: Object.keys(result.namespaceDistribution).length, icon: Database },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 rounded-lg p-3 text-center">
                  <s.icon className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                  <div className="text-sm font-bold text-white">{s.value}</div>
                  <div className="text-[10px] text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(result.namespaceDistribution).map(([ns, count]) => (
                <NsBadge key={ns} ns={ns} count={count} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Document Library ─────────────────────────────────────────────────────────

function DocumentLibrary({ refreshTrigger }: { refreshTrigger: number }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedChunks, setExpandedChunks] = useState<any[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/documents?${params}`)
      const data = await res.json()
      setDocuments(data.documents || [])
      setStats(data.stats || {})
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchDocuments() }, [refreshTrigger, fetchDocuments])

  const toggleExpand = async (doc: DocumentRecord) => {
    if (expandedId === doc.id) {
      setExpandedId(null)
      setExpandedChunks([])
      return
    }
    setExpandedId(doc.id)
    setLoadingChunks(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`)
      const data = await res.json()
      setExpandedChunks(data.chunks || [])
    } catch { setExpandedChunks([]) }
    finally { setLoadingChunks(false) }
  }

  const deleteDocument = async (id: string) => {
    if (!confirm('Delete this document and all its chunks from the knowledge base?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id))
        if (expandedId === id) { setExpandedId(null); setExpandedChunks([]) }
      }
    } catch { } finally { setDeletingId(null) }
  }

  const toggleActive = async (doc: DocumentRecord) => {
    setTogglingId(doc.id)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !doc.is_active }),
      })
      if (res.ok) {
        const data = await res.json()
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, is_active: data.document.is_active } : d))
      }
    } catch { } finally { setTogglingId(null) }
  }

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Docs', value: stats.total || 0, color: 'text-white' },
          { label: 'Completed', value: stats.completed || 0, color: 'text-emerald-400' },
          { label: 'Total Pages', value: stats.total_pages || 0, color: 'text-blue-400' },
          { label: 'Total Chunks', value: stats.total_chunks || 0, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{Number(s.value).toLocaleString()}</div>
            <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600"
          />
        </div>
        <button
          onClick={fetchDocuments}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Document Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-600">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-14 text-gray-600">
          <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents ingested yet</p>
          <p className="text-sm mt-1">Upload a PDF or import via URL to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <motion.div
              key={doc.id}
              layout
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-violet-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-white truncate">{doc.name}</span>
                    <span className="text-[10px] text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded-full">
                      v{doc.version}
                    </span>
                    <StatusBadge status={doc.status} />
                    {!doc.is_active && (
                      <span className="text-[10px] text-gray-500 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded-full">
                        Archived
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                    <span>{doc.total_pages} pages</span>
                    <span>{doc.total_chunks} chunks</span>
                    <span>{doc.total_tokens?.toLocaleString()} tokens</span>
                    <span>{formatMs(doc.embedding_time_ms)}</span>
                    {doc.file_name && <span className="truncate max-w-[120px]">{doc.file_name}</span>}
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                  {doc.namespace_distribution && Object.keys(doc.namespace_distribution).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(doc.namespace_distribution).slice(0, 5).map(([ns, count]) => (
                        <NsBadge key={ns} ns={ns} count={count as number} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleExpand(doc)}
                    title="View chunks"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                  >
                    {expandedId === doc.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleActive(doc)}
                    disabled={togglingId === doc.id}
                    title={doc.is_active ? 'Archive' : 'Activate'}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-40"
                  >
                    {togglingId === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ArchiveRestore className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    disabled={deletingId === doc.id}
                    title="Delete document"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {deletingId === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Chunk Expansion */}
              <AnimatePresence>
                {expandedId === doc.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-gray-800"
                  >
                    <div className="p-4">
                      {loadingChunks ? (
                        <div className="text-center py-6 text-gray-600">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading chunks...
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {expandedChunks.map((chunk, i) => (
                            <div key={chunk.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-[10px] text-gray-500 font-mono">#{chunk.chunk_index}</span>
                                <span className="text-[10px] font-medium text-white truncate">{chunk.title}</span>
                                <NsBadge ns={chunk.pinecone_namespace || 'general'} count={0} />
                                {chunk.page_number && (
                                  <span className="text-[10px] text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded-full">
                                    Page {chunk.page_number}
                                  </span>
                                )}
                                {chunk.section_heading && (
                                  <span className="text-[10px] text-blue-400/80 border border-blue-500/20 px-1.5 py-0.5 rounded-full truncate max-w-[160px]">
                                    {chunk.section_heading}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 line-clamp-2 font-mono leading-relaxed">
                                {chunk.content?.slice(0, 200)}...
                              </p>
                            </div>
                          ))}
                          {expandedChunks.length === 0 && (
                            <p className="text-xs text-gray-600 text-center py-4">No chunks found</p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function DocumentKnowledgeTab() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activePanel, setActivePanel] = useState<'ingest' | 'library'>('ingest')

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <BookOpen className="w-5 h-5 text-violet-400" />
            </div>
            Document Knowledge System
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Ingest PDFs with per-chunk classification into the RAG pipeline
          </p>
        </div>
        <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-xl gap-1">
          {(['ingest', 'library'] as const).map(p => (
            <button
              key={p}
              onClick={() => setActivePanel(p)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activePanel === p
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {p === 'ingest' ? '⚡ Ingest' : '📚 Library'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activePanel}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {activePanel === 'ingest' ? (
            <div className="bg-[#141414] border border-violet-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <Zap className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Document Ingestion Pipeline</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically parses, chunks, classifies per chunk, and embeds into Neon + Pinecone
                  </p>
                </div>
              </div>
              <IngestionPanel onIngestionComplete={() => setRefreshTrigger(t => t + 1)} />
            </div>
          ) : (
            <div className="bg-[#141414] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Document Library</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    All ingested documents — real data from PostgreSQL
                  </p>
                </div>
              </div>
              <DocumentLibrary refreshTrigger={refreshTrigger} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
