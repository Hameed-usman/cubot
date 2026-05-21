'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw, Globe, FileText, Database, AlertTriangle,
  CheckCircle, Clock, Loader2, ExternalLink, Activity,
  BarChart3, Zap
} from 'lucide-react'
import { CrawlDashboardData } from '@/types'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function timeAgo(iso: string): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const PAGE_TYPE_COLORS: Record<string, string> = {
  notice: 'text-amber-400', admissions: 'text-blue-400',
  alumni: 'text-emerald-400', faculty: 'text-purple-400',
  department: 'text-cyan-400', policy: 'text-rose-400',
  academic: 'text-indigo-400', contact: 'text-teal-400',
  scholarship: 'text-yellow-400', general: 'text-white/40',
  event: 'text-orange-400',
}

export default function SyncIntelligenceTab() {
  const [data, setData] = useState<CrawlDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/crawl-stats')
      if (res.ok) setData(await res.json())
    } catch { /* silent */ }
    setLoading(false)
  }

  async function triggerSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/admin/trigger-crawl', { method: 'POST' })
      const json = await res.json()
      setSyncMsg(json.message)
    } catch {
      setSyncMsg('Failed to trigger sync.')
    }
    setSyncing(false)
  }

  useEffect(() => { load() }, [])

  const card = 'glass-dark rounded-2xl p-5 border'
  const borderStyle = { border: '1px solid rgba(255,255,255,0.08)' }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cu-gold" />
      </div>
    )
  }

  const lr = data?.lastRun
  const statusColor = lr?.status === 'completed' ? 'text-emerald-400' : lr?.status === 'failed' ? 'text-red-400' : 'text-amber-400'

  return (
    <div className="space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-lg">Sync Intelligence</h2>
          <p className="text-xs text-white/30 font-sans mt-0.5">Knowledge base crawl status &amp; observability</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-sans text-white/50 hover:text-white/80 transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={triggerSync} disabled={syncing} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold font-display transition-all" style={{ background: '#c9a227', color: '#080d1a' }}>
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {syncing ? 'Triggering…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded-xl px-4 py-3 text-xs font-sans text-emerald-300" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          {syncMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Chunks', value: data?.totalEntries ?? 0, icon: Database },
          { label: 'Pages Crawled', value: lr?.pagesCrawled ?? 0, icon: Globe },
          { label: 'Documents', value: lr?.documentsProcessed ?? 0, icon: FileText },
          { label: 'Failed Pages', value: lr?.pagesFailed ?? 0, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className={card} style={borderStyle}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-sans">{label}</span>
            </div>
            <p className="font-display font-bold text-white text-2xl">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Last run details */}
      {lr && (
        <div className={card} style={borderStyle}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-white/40" />
              <span className="text-sm font-display font-semibold text-white">Last Crawl Run</span>
            </div>
            <span className={`text-xs font-semibold font-display ${statusColor}`}>
              {lr.status === 'completed' ? '✓ Completed' : lr.status === 'failed' ? '✗ Failed' : '⟳ Running'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-sans">
            {[
              ['Started', timeAgo(lr.startedAt)],
              ['Duration', formatDuration(lr.durationSeconds)],
              ['Updated', lr.pagesUpdated],
              ['Skipped', lr.pagesSkipped],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-white/30 mb-0.5">{k}</p>
                <p className="text-white/80 font-medium">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">

        {/* Category breakdown */}
        {data?.byCategory && Object.keys(data.byCategory).length > 0 && (
          <div className={card} style={borderStyle}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-white/40" />
              <span className="text-sm font-display font-semibold text-white">By Category</span>
            </div>
            <div className="space-y-2">
              {Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat, count]) => {
                const max = Math.max(...Object.values(data.byCategory))
                const pct = Math.round((count / max) * 100)
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs font-sans mb-1">
                      <span className="text-white/60">{cat}</span>
                      <span className="text-white/40">{count}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-1 rounded-full bg-cu-gold transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Source type breakdown */}
        {data?.bySourceType && Object.keys(data.bySourceType).length > 0 && (
          <div className={card} style={borderStyle}>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-white/40" />
              <span className="text-sm font-display font-semibold text-white">By Source Type</span>
            </div>
            <div className="space-y-3">
              {Object.entries(data.bySourceType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs font-sans text-white/60 uppercase">{type}</span>
                  <span className="text-xs font-display font-bold text-white/80">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {!lr && (
              <p className="text-xs text-white/25 font-sans mt-4 pt-4 border-t border-white/5">
                Run <code className="text-cu-gold">npm run crawl</code> to populate the knowledge base from the CUSIT website.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Recent updates */}
      {data?.recentUpdates && data.recentUpdates.length > 0 && (
        <div className={card} style={borderStyle}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-white/40" />
            <span className="text-sm font-display font-semibold text-white">Recently Indexed Pages</span>
          </div>
          <div className="space-y-2">
            {data.recentUpdates.slice(0, 8).map((u, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <span className={`text-[10px] font-display font-semibold uppercase ${PAGE_TYPE_COLORS[u.pageType] || 'text-white/30'}`}>{u.pageType}</span>
                <span className="text-xs font-sans text-white/60 flex-1 truncate">{u.title}</span>
                {u.sourceUrl && (
                  <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-cu-gold transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <span className="text-[10px] font-sans text-white/25 flex-shrink-0">{timeAgo(u.updatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed pages */}
      {data?.recentFailures && data.recentFailures.length > 0 && (
        <div className={card} style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400/60" />
            <span className="text-sm font-display font-semibold text-red-300">Failed Pages</span>
          </div>
          <div className="space-y-2">
            {data.recentFailures.slice(0, 5).map((f, i) => (
              <div key={i} className="text-xs font-sans">
                <p className="text-white/50 truncate">{f.url}</p>
                <p className="text-red-400/60">{f.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!lr && !data?.totalEntries && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Globe className="w-12 h-12 text-white/10" />
          <p className="text-white/40 font-sans text-sm">No crawl data yet.</p>
          <p className="text-white/25 font-sans text-xs max-w-sm">
            Run <code className="text-cu-gold">npm run setup-db</code> then <code className="text-cu-gold">npm run crawl</code> to start indexing the CUSIT website.
          </p>
        </div>
      )}
    </div>
  )
}
