'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Play, Globe, Search, ArrowRight, AlertTriangle, Database } from 'lucide-react'

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
    setSyncStatus({ message: 'Starting full sync via GitHub Actions...', type: 'info' })
    try {
      const res = await fetch('/api/admin/trigger-crawl', { method: 'POST' })
      const data = await res.json()
      setSyncStatus({ 
        message: data.message, 
        type: data.success ? 'success' : 'error' 
      })
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
        body: JSON.stringify({ url: quickUrl })
      })
      const data = await res.json()
      setSyncStatus({ 
        message: data.message, 
        type: data.success ? 'success' : 'error' 
      })
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
              Crawls the entire university website, processing all pages and documents. This process takes 5-15 minutes and runs asynchronously in the background.
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
              Instantly sync a single page. Perfect for newly added announcements or updated policies that need to be queried immediately.
            </p>
          </div>
          <form onSubmit={triggerQuickSync} className="flex gap-2">
            <input 
              type="url" 
              value={quickUrl}
              onChange={e => setQuickUrl(e.target.value)}
              placeholder="https://www.cusit.edu.pk/..." 
              required
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
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
          {syncStatus.type === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <RefreshCw className={`w-5 h-5 flex-shrink-0 ${syncStatus.type === 'info' ? 'animate-spin' : ''}`} />}
          {syncStatus.message}
        </motion.div>
      )}

      {/* Crawl Stats Panel */}
      <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h4 className="font-semibold text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" /> Web Scraper Telemetry
          </h4>
          <button onClick={fetchStats} className="text-gray-500 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!stats ? (
          <div className="text-gray-500 text-sm">Loading telemetry...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
              <div className={`font-semibold capitalize ${stats.lastRun?.status === 'running' ? 'text-emerald-400' : stats.lastRun?.status === 'failed' ? 'text-red-400' : 'text-gray-200'}`}>
                {stats.lastRun?.status || 'Idle'}
              </div>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pages Crawled</div>
              <div className="font-semibold text-gray-200">{stats.lastRun?.pagesCrawled || 0}</div>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Docs Processed</div>
              <div className="font-semibold text-gray-200">{stats.lastRun?.documentsProcessed || 0}</div>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Chunks Added</div>
              <div className="font-semibold text-emerald-400">+{stats.lastRun?.chunksCreated || 0}</div>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Duration</div>
              <div className="font-semibold text-gray-200">{stats.lastRun?.durationSeconds || 0}s</div>
            </div>
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
  )
}
