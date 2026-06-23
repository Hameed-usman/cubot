'use client'

import { useState, useEffect, useRef } from 'react'
import {
  RefreshCw, Globe, FileText, Database, AlertTriangle,
  CheckCircle, Clock, Loader2, ExternalLink, Activity,
  Zap, Link2, Info, ChevronDown, ChevronUp
} from 'lucide-react'
import { CrawlDashboardData } from '@/types'

function formatDuration(seconds: number): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function timeAgo(iso: string): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
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
  const [quickSyncing, setQuickSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ text: string; success: boolean } | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [showFailures, setShowFailures] = useState(false)
  const syncMsgTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/crawl-stats')
      if (res.ok) setData(await res.json())
    } catch { /* silent */ }
    setLoading(false)
  }

  function showMsg(text: string, success: boolean) {
    setSyncMsg({ text, success })
    if (syncMsgTimeout.current) clearTimeout(syncMsgTimeout.current)
    syncMsgTimeout.current = setTimeout(() => setSyncMsg(null), 8000)
  }

  async function triggerFullSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/trigger-crawl', { method: 'POST' })
      const json = await res.json()
      showMsg(json.message || (res.ok ? 'Sync started!' : 'Sync failed.'), res.ok && json.success)
      if (res.ok) setTimeout(load, 3000) // Refresh stats after a moment
    } catch {
      showMsg('Could not connect to sync API. Check your server.', false)
    }
    setSyncing(false)
  }

  async function triggerQuickSync() {
    const url = urlInput.trim()
    if (!url) return
    if (!url.startsWith('http')) {
      showMsg('Please enter a valid URL starting with http:// or https://', false)
      return
    }
    setQuickSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/sync-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        showMsg(`✓ Synced successfully! The bot now knows about: ${url}`, true)
        setUrlInput('')
        load()
      } else {
        showMsg(json.error || json.message || 'Sync failed.', false)
      }
    } catch {
      showMsg('Connection failed. Make sure the dev server is running.', false)
    }
    setQuickSyncing(false)
  }

  async function triggerStopSync() {
    setSyncing(true) // Disable buttons temporarily
    try {
      const res = await fetch('/api/admin/stop-crawl', { method: 'POST' })
      const json = await res.json()
      showMsg(json.message || (res.ok ? 'Stop signal sent!' : 'Failed to stop.'), res.ok && json.success)
      if (res.ok) setTimeout(load, 3000)
    } catch {
      showMsg('Could not connect to stop API.', false)
    }
    setSyncing(false)
  }

  useEffect(() => { load() }, [])

  const lr = data?.lastRun
  const statusColor = lr?.status === 'completed'
    ? 'text-emerald-400' : lr?.status === 'failed'
    ? 'text-red-400' : 'text-amber-400'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cu-gold" />
        <p className="text-white/30 text-sm font-sans">Loading sync data…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-lg">Knowledge Sync Center</h2>
          <p className="text-xs text-white/30 font-sans mt-0.5">
            Control what Cubot knows — sync website pages into the AI knowledge base
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-sans text-white/50 hover:text-white/80 transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* How it works banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <Info className="w-4 h-4 text-blue-400/70 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-sans text-white/40 leading-relaxed">
          <span className="text-white/60 font-semibold">How this works: </span>
          Cubot reads CUSIT website pages and converts them into searchable AI knowledge. When you sync a page,
          the bot learns everything on that page and can answer questions about it instantly.
          Use <span className="text-white/60">Full Sync</span> to update everything, or{' '}
          <span className="text-white/60">Quick Sync</span> to add a specific missing page.
        </div>
      </div>

      {/* Status message */}
      {syncMsg && (
        <div className="rounded-xl px-4 py-3 text-xs font-sans flex items-start gap-2"
          style={{
            background: syncMsg.success ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${syncMsg.success ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
            color: syncMsg.success ? '#34d399' : '#f87171'
          }}>
          {syncMsg.success
            ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span>{syncMsg.text}</span>
        </div>
      )}

      {/* Two sync cards */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Full Site Sync */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'rgba(201,162,39,0.04)', border: '1px solid rgba(201,162,39,0.2)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(201,162,39,0.15)' }}>
                <Globe className="w-4 h-4 text-cu-gold" />
              </div>
              <h3 className="font-display font-bold text-white text-sm">Full Site Sync</h3>
            </div>
            <p className="text-xs text-white/40 font-sans leading-relaxed">
              Crawls the entire CUSIT website and updates all knowledge. Takes 3–8 minutes.
              Run this when major content changes happen (new semester, fee revision, etc.)
            </p>
          </div>
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-black/20 border border-white/5 text-xs font-sans">
            <div className="flex justify-between items-center">
              <span className="text-white/40">Status:</span>
              <span className={`font-semibold ${statusColor}`}>
                {lr?.status === 'completed' ? '✓ Completed' : lr?.status === 'failed' ? '✗ Failed' : lr?.status ? '⟳ Running' : 'Ready'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Pages Processed:</span>
              <span className="text-white/80 font-mono">
                {lr ? lr.pagesCrawled : 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Last Crawl:</span>
              <span className="text-white/80">
                {lr?.startedAt ? new Date(lr.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Never'}
              </span>
            </div>
          </div>
          {lr?.status && lr.status !== 'completed' && lr.status !== 'failed' ? (
            <button
              onClick={triggerStopSync}
              disabled={syncing}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold font-display transition-all"
              style={{
                background: syncing ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
                opacity: syncing ? 0.7 : 1,
              }}>
              {syncing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Stopping…</>
                : <><AlertTriangle className="w-4 h-4" /> Stop Syncing</>}
            </button>
          ) : (
            <button
              onClick={triggerFullSync}
              disabled={syncing}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold font-display transition-all"
              style={{
                background: syncing ? 'rgba(201,162,39,0.2)' : '#c9a227',
                color: syncing ? '#c9a227' : '#080d1a',
                opacity: syncing ? 0.7 : 1,
              }}>
              {syncing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting Sync…</>
                : <><Zap className="w-4 h-4" /> Sync Entire Website</>}
            </button>
          )}
        </div>

        {/* Quick Single-URL Sync */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Link2 className="w-4 h-4 text-white/60" />
              </div>
              <h3 className="font-display font-bold text-white text-sm">Quick Page Sync</h3>
            </div>
            <p className="text-xs text-white/40 font-sans leading-relaxed">
              Paste a specific page URL to instantly teach Cubot about it.
              Use this when the bot doesn't know about a teacher, department, or program.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && triggerQuickSync()}
              placeholder="https://cusit.edu.pk/cusitnew/..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-all font-sans"
            />
            <button
              onClick={triggerQuickSync}
              disabled={quickSyncing || !urlInput.trim()}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold font-display transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: !urlInput.trim() ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)',
                cursor: !urlInput.trim() ? 'not-allowed' : 'pointer',
              }}>
              {quickSyncing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing page…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Sync This Page</>}
            </button>
          </div>
          <p className="text-[10px] text-white/20 font-sans">
            Tip: If a student asks about something the bot doesn't know, copy that page URL from the CUSIT website and paste it here.
          </p>
        </div>
      </div>

      {/* Knowledge Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Knowledge Chunks', value: (data?.totalEntries ?? 0).toLocaleString(), icon: Database, desc: 'Pieces of info the bot knows' },
          { label: 'Pages Crawled', value: (lr?.pagesCrawled ?? 0).toLocaleString(), icon: Globe, desc: 'Website pages ever indexed' },
          { label: 'Documents', value: (lr?.documentsProcessed ?? 0).toLocaleString(), icon: FileText, desc: 'PDFs and docs indexed' },
          { label: 'Failed Pages', value: (lr?.pagesFailed ?? 0).toLocaleString(), icon: AlertTriangle, desc: 'Pages that failed to load' },
        ].map(({ label, value, icon: Icon, desc }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5 text-white/25" />
              <span className="text-[10px] uppercase tracking-widest text-white/25 font-sans font-bold">{label}</span>
            </div>
            <p className="font-display font-bold text-white text-2xl">{value}</p>
            <p className="text-[10px] text-white/20 font-sans mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Last Crawl Run details */}
      {lr && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-white/30" />
              <span className="text-sm font-display font-semibold text-white">Last Full Sync Details</span>
            </div>
            <span className={`text-xs font-semibold font-display ${statusColor}`}>
              {lr.status === 'completed' ? '✓ Completed' : lr.status === 'failed' ? '✗ Failed' : '⟳ Running'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
            {[
              ['Started', timeAgo(lr.startedAt)],
              ['Duration', formatDuration(lr.durationSeconds)],
              ['Pages Updated', lr.pagesUpdated],
              ['Pages Skipped', lr.pagesSkipped],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-white/25 mb-1">{k}</p>
                <p className="text-white/80 font-semibold">{String(v ?? '—')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {data?.byCategory && Object.keys(data.byCategory).length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-white/30" />
            <span className="text-sm font-display font-semibold text-white">Knowledge by Category</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat, count]) => {
              const max = Math.max(...Object.values(data.byCategory))
              const pct = Math.round((count / max) * 100)
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs font-sans mb-1">
                    <span className="text-white/50 capitalize">{cat.replace(/_/g, ' ')}</span>
                    <span className="text-white/30 font-mono">{count} chunks</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full bg-cu-gold transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recently indexed pages */}
      {data?.recentUpdates && data.recentUpdates.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-white/30" />
            <span className="text-sm font-display font-semibold text-white">Recently Synced Pages</span>
          </div>
          <div className="space-y-1">
            {data.recentUpdates.slice(0, 8).map((u, i) => (
              <div key={i} className="flex items-center gap-3 py-2 rounded-xl px-2 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className={`text-[10px] font-semibold uppercase w-16 flex-shrink-0 ${PAGE_TYPE_COLORS[u.pageType] || 'text-white/25'}`}>
                  {u.pageType}
                </span>
                <span className="text-xs font-sans text-white/55 flex-1 truncate">{u.title}</span>
                {u.sourceUrl && (
                  <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-white/15 hover:text-cu-gold transition-colors flex-shrink-0">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <span className="text-[10px] font-sans text-white/20 flex-shrink-0">{timeAgo(u.updatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed pages (collapsible) */}
      {data?.recentFailures && data.recentFailures.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <button
            onClick={() => setShowFailures(!showFailures)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-red-950/10 transition-colors">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400/60" />
              <span className="text-sm font-display font-semibold text-red-300/80">
                {data.recentFailures.length} Failed Pages
              </span>
              <span className="text-xs text-white/25 font-sans">(click to see which pages couldn't be synced)</span>
            </div>
            {showFailures ? <ChevronUp className="w-4 h-4 text-white/25" /> : <ChevronDown className="w-4 h-4 text-white/25" />}
          </button>
          {showFailures && (
            <div className="px-4 pb-4 space-y-2">
              {data.recentFailures.slice(0, 5).map((f, i) => (
                <div key={i} className="rounded-xl p-3 text-xs font-sans"
                  style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <p className="text-white/50 truncate mb-0.5">{f.url}</p>
                  <p className="text-red-400/60">{f.error}</p>
                </div>
              ))}
              <p className="text-[10px] text-white/20 font-sans pt-1">
                Try pasting these URLs into the Quick Page Sync box above to retry them.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!lr && !data?.totalEntries && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Globe className="w-12 h-12 text-white/10" />
          <div>
            <p className="text-white/40 font-sans text-sm font-semibold mb-1">Knowledge base is empty</p>
            <p className="text-white/20 font-sans text-xs max-w-sm">
              Click <strong className="text-white/40">Sync Entire Website</strong> above to start indexing CUSIT.
              This will take about 5–10 minutes but only needs to be done once.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
