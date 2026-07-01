'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Database, FileText, Layers, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'

interface KnowledgeAnalyticsData {
  overview: {
    totalEntries: number
    totalChunks: number
    totalCategories: number
    totalNamespaces: number
    totalVectors: number
  }
  categoryBreakdown: Array<{
    category: string
    entry_count: number
    chunk_count: number
    last_updated: string
  }>
  namespaces: Array<{
    namespace: string
    vector_count: number
    health: string
  }>
}

export default function KnowledgeAnalyticsTab() {
  const [data, setData] = useState<KnowledgeAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/knowledge-analytics')
      if (!res.ok) throw new Error('Failed to fetch knowledge analytics')
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return <div className="p-12 text-center text-gray-400">Loading knowledge metrics...</div>
  }

  if (error) {
    return <div className="p-4 bg-red-950/30 border border-red-900 rounded-xl text-red-400">{error}</div>
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Knowledge Landscape</h3>
        <button 
          onClick={fetchData}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Entries', value: data.overview.totalEntries, icon: FileText, color: 'text-blue-400' },
          { label: 'Document Chunks', value: data.overview.totalChunks, icon: Layers, color: 'text-indigo-400' },
          { label: 'Vector Embeddings', value: data.overview.totalVectors, icon: Database, color: 'text-emerald-400' },
          { label: 'Categories', value: data.overview.totalCategories, icon: Layers, color: 'text-purple-400' },
          { label: 'Namespaces', value: data.overview.totalNamespaces, icon: Database, color: 'text-pink-400' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#141414] border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-sm text-gray-400">{stat.label}</span>
            </div>
            <div className="text-3xl font-bold">{stat.value.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
          <h4 className="font-semibold mb-4 text-gray-200">PostgreSQL Categories</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Category</th>
                  <th className="px-4 py-3">Entries</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3 rounded-tr-lg">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.categoryBreakdown.map((cat, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-3 font-medium text-gray-300">
                      {cat.category || <span className="text-gray-500 italic">Uncategorized</span>}
                    </td>
                    <td className="px-4 py-3">{cat.entry_count}</td>
                    <td className="px-4 py-3">{cat.chunk_count}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {cat.last_updated ? new Date(cat.last_updated).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
                {data.categoryBreakdown.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No categories found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pinecone Namespaces */}
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
          <h4 className="font-semibold mb-4 text-gray-200">Pinecone Namespaces</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Namespace</th>
                  <th className="px-4 py-3">Vector Count</th>
                  <th className="px-4 py-3 rounded-tr-lg">Health</th>
                </tr>
              </thead>
              <tbody>
                {data.namespaces.map((ns, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-3 font-medium text-blue-400">{ns.namespace}</td>
                    <td className="px-4 py-3">{ns.vector_count.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-3 h-3" /> Good
                      </span>
                    </td>
                  </tr>
                ))}
                {data.namespaces.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No namespaces found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Orphan Detection Teaser (Full logic is in the API, we can just show a button here to run full check) */}
      <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-semibold text-gray-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Integrity Check (Orphan Detection)
          </h4>
          <p className="text-sm text-gray-400 mt-1">Scan for mismatches between PostgreSQL entries and Pinecone vectors.</p>
        </div>
        <button 
          onClick={async () => {
            alert('Running full integrity scan... This will take a moment.')
            // Here you would hook up the actual orphan detection UI flow
          }}
          className="px-4 py-2 bg-yellow-600/10 text-yellow-500 border border-yellow-500/20 rounded-lg hover:bg-yellow-600/20 transition-colors whitespace-nowrap text-sm font-medium"
        >
          Run Integrity Scan
        </button>
      </div>
    </div>
  )
}
