'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, MessageSquare, Clock, ShieldAlert, BarChart2, Globe } from 'lucide-react'

interface ConversationData {
  metrics: {
    today: number
    thisWeek: number
    thisMonth: number
    totalUsers: number
    totalMessages: number
  }
  topQueries: Array<{ query: string; count: number }>
  languages: Array<{ language: string; count: number }>
  intents: Array<{ intent: string; count: number }>
  volume: Array<{ date: string; count: number }>
  confidenceDist: Array<{ confidence: string; count: number }>
  stats: {
    avg_retrieval: number
    avg_total: number
    cache_hit_rate: number
  }
  noDataRate: {
    total: number
    no_data_count: number
  }
}

export default function ConversationAnalyticsTab() {
  const [data, setData] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/conversation-analytics')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        console.error(e)
        setLoading(false)
      })
  }, [])

  if (loading || !data) {
    return <div className="p-12 text-center text-gray-400">Loading conversation metrics...</div>
  }

  const hallucinationRate = data.noDataRate.total > 0 
    ? ((data.noDataRate.no_data_count / data.noDataRate.total) * 100).toFixed(1) 
    : '0.0'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Conversation Analytics</h3>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Messages Today', value: data.metrics.today, icon: MessageSquare, color: 'text-blue-400' },
          { label: 'Messages This Week', value: data.metrics.thisWeek, icon: BarChart2, color: 'text-indigo-400' },
          { label: 'Total Unique Users', value: data.metrics.totalUsers, icon: Users, color: 'text-emerald-400' },
          { label: 'Unanswered Rate', value: `${hallucinationRate}%`, icon: ShieldAlert, color: 'text-red-400' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#141414] border border-gray-800 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 bg-gray-900 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-400">{stat.label}</span>
            </div>
            <div className="text-3xl font-bold ml-11">{stat.value.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Queries Table */}
        <div className="lg:col-span-2 bg-[#141414] border border-gray-800 rounded-xl p-6">
          <h4 className="font-semibold mb-4 text-gray-200">Most Frequent Questions (Last 30 Days)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Query</th>
                  <th className="px-4 py-3 rounded-tr-lg w-24 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.topQueries.map((q, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-3 font-medium text-gray-300 truncate max-w-sm" title={q.query}>"{q.query}"</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-100 bg-blue-900/40 rounded-full">
                        {q.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown Panel */}
        <div className="space-y-6">
          {/* Performance */}
          <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
            <h4 className="font-semibold mb-4 text-gray-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" /> Pipeline Latency
            </h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Avg Retrieval Time</span>
                  <span className="font-medium">{Math.round(data.stats.avg_retrieval)}ms</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (data.stats.avg_retrieval / 500) * 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Avg Total Response</span>
                  <span className="font-medium">{Math.round(data.stats.avg_total)}ms</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (data.stats.avg_total / 2000) * 100)}%` }}></div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-800 flex justify-between items-center text-sm">
                <span className="text-gray-400">Cache Hit Rate</span>
                <span className="text-emerald-400 font-medium">{(data.stats.cache_hit_rate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
            <h4 className="font-semibold mb-4 text-gray-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Language Distribution
            </h4>
            <div className="space-y-3">
              {data.languages.map((l, i) => {
                const percentage = ((l.count / data.metrics.totalMessages) * 100).toFixed(1)
                return (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300 capitalize">{l.language}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{percentage}%</span>
                      <div className="w-16 bg-gray-800 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
