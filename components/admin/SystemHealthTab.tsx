'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Activity, Database, Server, RefreshCw, AlertTriangle, CheckCircle, XCircle, Brain, Layers } from 'lucide-react'

interface HealthData {
  database: { status: string; details: string }
  redis: { status: string; details: string }
  pinecone: { status: string; details: string }
  embedding: { status: string; details: string }
  crawlers: { status: string; details: string }
}

export default function SystemHealthTab() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = () => {
    setLoading(true)
    fetch('/api/admin/system-health')
      .then(res => res.json())
      .then(data => {
        setHealth(data)
        setLoading(false)
      })
      .catch(e => {
        console.error(e)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
      case 'running':
        return <CheckCircle className="w-6 h-6 text-emerald-400" />
      case 'degraded':
      case 'paused':
      case 'checking':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />
      case 'down':
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-400" />
      default:
        return <Activity className="w-6 h-6 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'running':
        return 'border-emerald-500/30 bg-emerald-500/5'
      case 'degraded':
      case 'paused':
      case 'checking':
        return 'border-yellow-500/30 bg-yellow-500/5'
      case 'down':
      case 'failed':
        return 'border-red-500/30 bg-red-500/5'
      default:
        return 'border-gray-800 bg-[#141414]'
    }
  }

  if (loading && !health) {
    return <div className="p-12 text-center text-gray-400">Running diagnostics...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">System Health & Diagnostics</h3>
          <p className="text-sm text-gray-400 mt-1">Real-time status of critical infrastructure components.</p>
        </div>
        <button 
          onClick={fetchHealth}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PostgreSQL */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-6 border rounded-xl flex items-start gap-4 transition-colors ${getStatusColor(health?.database.status || 'checking')}`}>
          <div className="p-3 bg-gray-900 rounded-xl">
            <Database className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-lg">Neon PostgreSQL</h4>
              {getStatusIcon(health?.database.status || 'checking')}
            </div>
            <p className="text-sm text-gray-400 mt-1 uppercase tracking-wider font-medium">{health?.database.status}</p>
            <p className="text-sm text-gray-500 mt-2">{health?.database.details}</p>
          </div>
        </motion.div>

        {/* Upstash Redis */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`p-6 border rounded-xl flex items-start gap-4 transition-colors ${getStatusColor(health?.redis.status || 'checking')}`}>
          <div className="p-3 bg-gray-900 rounded-xl">
            <Server className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-lg">Upstash Redis</h4>
              {getStatusIcon(health?.redis.status || 'checking')}
            </div>
            <p className="text-sm text-gray-400 mt-1 uppercase tracking-wider font-medium">{health?.redis.status}</p>
            <p className="text-sm text-gray-500 mt-2">{health?.redis.details}</p>
          </div>
        </motion.div>

        {/* Pinecone */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`p-6 border rounded-xl flex items-start gap-4 transition-colors ${getStatusColor(health?.pinecone.status || 'checking')}`}>
          <div className="p-3 bg-gray-900 rounded-xl">
            <Layers className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-lg">Pinecone Vector DB</h4>
              {getStatusIcon(health?.pinecone.status || 'checking')}
            </div>
            <p className="text-sm text-gray-400 mt-1 uppercase tracking-wider font-medium">{health?.pinecone.status}</p>
            <p className="text-sm text-gray-500 mt-2">{health?.pinecone.details}</p>
          </div>
        </motion.div>

        {/* Embedding Provider */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={`p-6 border rounded-xl flex items-start gap-4 transition-colors ${getStatusColor(health?.embedding.status || 'checking')}`}>
          <div className="p-3 bg-gray-900 rounded-xl">
            <Brain className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-lg">Gemini Embeddings</h4>
              {getStatusIcon(health?.embedding.status || 'checking')}
            </div>
            <p className="text-sm text-gray-400 mt-1 uppercase tracking-wider font-medium">{health?.embedding.status}</p>
            <p className="text-sm text-gray-500 mt-2">{health?.embedding.details}</p>
          </div>
        </motion.div>

        {/* Crawlers */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={`p-6 border rounded-xl flex items-start gap-4 md:col-span-2 transition-colors ${getStatusColor(health?.crawlers.status || 'checking')}`}>
          <div className="p-3 bg-gray-900 rounded-xl">
            <Activity className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-lg">Web Scraper Workers</h4>
              {getStatusIcon(health?.crawlers.status || 'checking')}
            </div>
            <p className="text-sm text-gray-400 mt-1 uppercase tracking-wider font-medium">{health?.crawlers.status}</p>
            <p className="text-sm text-gray-500 mt-2">{health?.crawlers.details}</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
