'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Play, Globe, Search, ArrowRight, AlertTriangle,
  Database, Zap, CheckCircle2, XCircle, SkipForward, Loader2,
  ChevronRight, Target, Hash
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number
  message: string
  status: 'info' | 'success' | 'error' | 'skip' | 'warn'
  url?: string
  chunks?: number
}

interface ScrapeResult {
  total: number
  success: number
  failed: number
  skipped: number
  chunks: number
}

// ─── Status Icon ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: LogEntry['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
  if (status === 'skip') return <SkipForward className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
  return <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
}

// ─── Keyword Scraper Card ────────────────────────────────────────────────────

function KeywordScraperCard({ onComplete }: { onComplete: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [seedUrl, setSeedUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [discoveredCount, setDiscoveredCount] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [currentTotal, setCurrentTotal] = useState<number>(0)
  const logEndRef = useRef<HTMLDivElement>(null)
  const logIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stopScraping = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      addLog({ message: '🛑 Scraping stopping...', status: 'warn' })
    }
  }

  const addLog = (entry: Omit<LogEntry, 'id'>) => {
    setLogs(prev => [...prev, { ...entry, id: ++logIdRef.current }])
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim() || isRunning) return

    // Parse explicit bulk URLs if provided
    const explicitUrls = bulkUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'))

    setIsRunning(true)
    setLogs([])
    setResult(null)
    setDiscoveredCount(null)
    setCurrentIndex(0)
    setCurrentTotal(0)

    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/admin/keyword-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          seedUrl: seedUrl.trim() || undefined,
          urls: explicitUrls.length > 0 ? explicitUrls : undefined,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        addLog({ message: `❌ ${err.error || 'Request failed'}`, status: 'error' })
        setIsRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'log') {
              addLog({ message: data.message, status: data.status, url: data.url, chunks: data.chunks })
            } else if (data.type === 'discovered') {
              setDiscoveredCount(data.count)
            } else if (data.type === 'scraping') {
              setCurrentIndex(data.index)
              setCurrentTotal(data.total)
            } else if (data.type === 'done') {
              setResult({ total: data.total, success: data.success, failed: data.failed, skipped: data.skipped, chunks: data.chunks })
              onComplete()
            }
          } catch {
            // ignore parse errors on partial lines
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog({ message: `❌ Connection error: ${err.message}`, status: 'error' })
      }
    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
    }
  }

  // Quick keyword presets
  const PRESETS = ['fee structure', 'events', 'admissions', 'scholarships', 'results', 'faculty']

  return (
    <div className="bg-[#141414] border border-violet-500/20 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-500/10 rounded-lg">
          <Target className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Targeted Keyword Scraper</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Type any keyword (e.g. <em>events</em>, <em>fee</em>, <em>pharmacy</em>) — the system searches the existing knowledge base and any seed URL you provide, finds all matching pages &amp; PDFs, then scrapes and saves them to the bot&apos;s database automatically.
          </p>
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => setKeyword(p)}
            disabled={isRunning}
            className={`px-3 py-1 rounded-full text-xs border transition-all ${
              keyword === p
                ? 'bg-violet-600/30 border-violet-500/50 text-violet-300'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-violet-500/50 hover:text-violet-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Row 1: Keyword */}
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder='Keyword — e.g. "events", "fee", "admissions", "pharmacy"'
            required
            disabled={isRunning}
            className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 placeholder-gray-600"
          />
        </div>

        {/* Row 2: Optional seed URL */}
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="url"
            value={seedUrl}
            onChange={e => setSeedUrl(e.target.value)}
            placeholder="Optional: Seed URL to discover links from (e.g. https://cu.edu.pk/events)"
            disabled={isRunning}
            className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 placeholder-gray-600"
          />
        </div>

        {/* Row 3: Bulk URLs toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowBulk(v => !v)}
            disabled={isRunning}
            className="text-xs text-gray-500 hover:text-violet-400 transition-colors flex items-center gap-1"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${showBulk ? 'rotate-90' : ''}`} />
            {showBulk ? 'Hide' : 'Paste specific URLs directly (optional)'}
          </button>
          <AnimatePresence>
            {showBulk && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                <textarea
                  value={bulkUrls}
                  onChange={e => setBulkUrls(e.target.value)}
                  placeholder={"Paste one URL per line:\nhttps://cu.edu.pk/.../BS-CS-fee.pdf\nhttps://cu.edu.pk/.../BBA-fee.pdf\nhttps://cu.edu.pk/events.php"}
                  disabled={isRunning}
                  rows={5}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-violet-500 disabled:opacity-50 placeholder-gray-600 resize-none"
                />
                <p className="text-xs text-gray-600 mt-1">These URLs will be scraped immediately regardless of the keyword. Combine with the keyword for the best results.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isRunning ? (
          <button
            type="button"
            onClick={stopScraping}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all bg-red-600 hover:bg-red-500 text-white"
          >
            <XCircle className="w-4 h-4" />
            Stop Scraping
          </button>
        ) : (
          <button
            type="submit"
            disabled={!keyword.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/30 disabled:text-violet-700 text-white"
          >
            <Zap className="w-4 h-4" />
            Find &amp; Scrape All Matching Pages
          </button>
        )}
      </form>


      {/* Progress bar */}
      {isRunning && currentTotal > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span>{currentIndex} / {currentTotal}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full"
              animate={{ width: `${(currentIndex / currentTotal) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Live Log */}
      <AnimatePresence>
        {logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Live Log</span>
              {isRunning && <span className="flex items-center gap-1.5 text-xs text-violet-400"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />Running</span>}
            </div>
            <div className="max-h-60 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
              {logs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2"
                >
                  <StatusIcon status={log.status} />
                  <span className={
                    log.status === 'success' ? 'text-emerald-300' :
                    log.status === 'error' ? 'text-red-300' :
                    log.status === 'skip' ? 'text-yellow-400' :
                    log.status === 'warn' ? 'text-yellow-300' :
                    'text-gray-300'
                  }>
                    {log.message}
                  </span>
                </motion.div>
              ))}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-4 gap-3"
          >
            {[
              { label: 'Discovered', value: result.total, color: 'text-blue-400' },
              { label: 'Scraped', value: result.success, color: 'text-emerald-400' },
              { label: 'Skipped', value: result.skipped, color: 'text-yellow-400' },
              { label: 'Chunks Saved', value: result.chunks, color: 'text-violet-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SyncIntelligenceTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [quickUrl, setQuickUrl] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null)

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/crawl-stats')
      const data = await res.json()
      setStats(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [])

  const triggerFullSync = async () => {
    setIsSyncing(true)
    setSyncStatus({ message: 'Starting full sync...', type: 'info' })
    try {
      const res = await fetch('/api/admin/trigger-crawl', { method: 'POST' })
      const data = await res.json()
      setSyncStatus({ message: data.message, type: data.success ? 'success' : 'error' })
      setTimeout(fetchStats, 2000)
    } catch (e: any) {
      setSyncStatus({ message: e.message || 'Failed to trigger full sync', type: 'error' })
    } finally {
      setIsSyncing(false)
    }
  }

  const triggerQuickSync = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickUrl) return
    setIsSyncing(true)
    setSyncStatus({ message: `Syncing ${quickUrl}...`, type: 'info' })
    try {
      const res = await fetch('/api/admin/sync-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: quickUrl }),
      })
      const data = await res.json()
      setSyncStatus({ message: data.message, type: data.success ? 'success' : 'error' })
      setQuickUrl('')
      setTimeout(fetchStats, 2000)
    } catch (e: any) {
      setSyncStatus({ message: e.message || 'Failed to quick sync URL', type: 'error' })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Row 1: Full Sync + Quick Sync ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Full Sync Card */}
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 text-emerald-400">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Full Website Sync</h3>
            </div>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Crawls the entire university website, processing all pages and documents. This process takes 5–15 minutes and runs in the background.
            </p>
          </div>
          <button
            onClick={triggerFullSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 disabled:text-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {isSyncing ? 'Syncing...' : 'Start Full Sync'}
          </button>
        </div>

        {/* Quick Sync Card */}
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 text-blue-400">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Quick URL Sync</h3>
            </div>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Instantly sync a single page or PDF. Perfect for newly added announcements, updated policies, or specific documents.
            </p>
          </div>
          <form onSubmit={triggerQuickSync} className="flex gap-2">
            <input
              type="url"
              value={quickUrl}
              onChange={e => setQuickUrl(e.target.value)}
              placeholder="https://cusit.edu.pk/..."
              required
              disabled={isSyncing}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSyncing || !quickUrl}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white rounded-lg transition-colors flex items-center justify-center"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Sync status banner */}
      {syncStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 border rounded-xl flex items-center gap-3 text-sm ${
            syncStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            syncStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}
        >
          {syncStatus.type === 'error'
            ? <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            : <RefreshCw className={`w-5 h-5 flex-shrink-0 ${syncStatus.type === 'info' ? 'animate-spin' : ''}`} />}
          {syncStatus.message}
        </motion.div>
      )}

      {/* ── Row 2: Targeted Keyword Scraper ────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 text-gray-500">
          <ChevronRight className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest font-medium">Intelligent Discovery</span>
        </div>
        <KeywordScraperCard onComplete={fetchStats} />
      </div>

      {/* ── Row 3: Crawl Telemetry ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 text-gray-500">
          <ChevronRight className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest font-medium">Crawl Telemetry</span>
        </div>
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-400" /> Web Scraper Stats
            </h4>
            <button onClick={fetchStats} className="text-gray-500 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!stats ? (
            <div className="text-gray-500 text-sm">Loading telemetry...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Status', value: stats.lastRun?.status || 'Idle', special: true },
                { label: 'Pages Crawled', value: stats.lastRun?.pagesCrawled || 0 },
                { label: 'Docs Processed', value: stats.lastRun?.documentsProcessed || 0 },
                { label: 'Chunks Added', value: `+${stats.lastRun?.chunksCreated || 0}`, green: true },
                { label: 'Duration', value: `${stats.lastRun?.durationSeconds || 0}s` },
              ].map((stat: any) => (
                <div key={stat.label} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className={`font-semibold capitalize ${
                    stat.special
                      ? stats.lastRun?.status === 'running' ? 'text-emerald-400' : stats.lastRun?.status === 'failed' ? 'text-red-400' : 'text-gray-200'
                      : stat.green ? 'text-emerald-400' : 'text-gray-200'
                  }`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {stats?.recentFailures && stats.recentFailures.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h5 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Recent Failures
              </h5>
              <div className="space-y-2">
                {stats.recentFailures.slice(0, 3).map((fail: any, i: number) => (
                  <div key={i} className="text-xs flex gap-4 p-2 bg-red-950/20 rounded border border-red-900/30">
                    <span className="text-gray-500 min-w-[120px]">{new Date(fail.attemptedAt).toLocaleString()}</span>
                    <span className="text-gray-300 truncate max-w-xs" title={fail.url}>{fail.url}</span>
                    <span className="text-red-400 truncate">{fail.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
