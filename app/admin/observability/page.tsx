'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Play, Pause, Trash, Database, Globe, AlertCircle, Search } from 'lucide-react'

export default function ObservabilityDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
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

  const handleAction = async (action: string) => {
    try {
      await fetch('/api/admin/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      fetchStats()
    } catch (e) {
      console.error(e)
    }
  }

  const handleEnqueue = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const url = formData.get('url') as string
    if (!url) return
    try {
      await fetch('/api/admin/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enqueue', url, priority: 5 })
      })
      fetchStats()
      ;(e.target as HTMLFormElement).reset()
    } catch (e) {
      console.error(e)
    }
  }

  if (!stats) return <div className="p-8 text-center text-white">Loading dashboard...</div>

  const pendingCount = stats.queue.find((q: any) => q.status === 'pending')?.count || 0
  const processingCount = stats.queue.find((q: any) => q.status === 'processing')?.count || 0
  const activeRun = stats.runs[0] || {}

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              AI Observability
            </h1>
            <p className="text-gray-400 mt-1">Real-time telemetry and ingestion control</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => handleAction('start')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
              <Play className="w-4 h-4" /> Start Worker
            </button>
            <button onClick={() => handleAction('pause')} className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-medium transition-colors">
              <Pause className="w-4 h-4" /> Pause
            </button>
            <button onClick={() => handleAction('clear')} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">
              <Trash className="w-4 h-4" /> Clear Queue
            </button>
            <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <div className="flex items-center gap-3 text-blue-400 mb-2">
              <Globe className="w-5 h-5" />
              <h3 className="font-semibold">Crawl Queue</h3>
            </div>
            <div className="text-3xl font-bold">{pendingCount} <span className="text-sm text-gray-500 font-normal">pending</span></div>
            <div className="text-sm text-emerald-400 mt-2">{processingCount} processing right now</div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
              <Database className="w-5 h-5" />
              <h3 className="font-semibold">Vector Chunks</h3>
            </div>
            <div className="text-3xl font-bold">{stats.chunks} <span className="text-sm text-gray-500 font-normal">total embedded</span></div>
            <div className="text-sm text-gray-400 mt-2">Latest model: text-embedding-3-small</div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl col-span-2">
            <div className="flex items-center gap-3 text-yellow-400 mb-2">
              <Play className="w-5 h-5" />
              <h3 className="font-semibold">Active Run</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-xs text-gray-500 uppercase">Status</div>
                <div className={`font-semibold capitalize ${activeRun.status === 'running' ? 'text-emerald-400' : 'text-yellow-400'}`}>{activeRun.status || 'None'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Pages Crawled</div>
                <div className="font-semibold">{activeRun.pages_crawled || 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Chunks Generated</div>
                <div className="font-semibold">{activeRun.chunks_created || 0}</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column */}
          <div className="space-y-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Search className="w-5 h-5 text-purple-400"/> Recent Retrievals</h2>
              <div className="space-y-4">
                {stats.retrievals.length === 0 ? <p className="text-gray-500 text-sm">No recent queries.</p> : 
                  stats.retrievals.map((r: any) => (
                    <div key={r.id} className="p-4 bg-[#141414] rounded-xl border border-gray-800">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium">"{r.query}"</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${r.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400' : r.confidence === 'medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                          {r.confidence}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Intent: {r.intent}</span>
                        <span>Latency: {r.retrieval_ms}ms</span>
                        <span>{new Date(r.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4">Enqueue URL</h2>
              <form onSubmit={handleEnqueue} className="flex gap-2">
                <input 
                  type="url" 
                  name="url" 
                  placeholder="https://www.cusit.edu.pk/..." 
                  className="flex-1 bg-[#141414] border border-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  required
                />
                <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors">
                  Add
                </button>
              </form>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-400"/> Failed URLs</h2>
              <div className="space-y-3">
                {stats.failedUrls.length === 0 ? <p className="text-gray-500 text-sm">No failed URLs recently.</p> :
                  stats.failedUrls.map((f: any) => (
                    <div key={f.id} className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-sm">
                      <div className="flex justify-between text-red-400 mb-1">
                        <span className="font-semibold uppercase text-xs tracking-wider">{f.error_category}</span>
                        <span className="text-xs text-gray-500">{new Date(f.attempted_at).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-300 truncate" title={f.url}>{f.url}</p>
                      <p className="text-gray-500 text-xs mt-1 truncate">{f.error_details}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
