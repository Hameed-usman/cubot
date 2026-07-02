'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, MessageSquare, Clock, ShieldAlert, BarChart2, Globe, RefreshCw } from 'lucide-react'

interface ConversationData {
  metrics: {
    today: number
    thisWeek: number
    thisMonth: number
    totalUsers: number
    totalMessages: number
  }
  topQueries: Array<{ query: string; count: number }>
  liveFeed: Array<{
    id: string;
    session_id: string;
    user_message: string;
    bot_response: string;
    language: string;
    created_at: string;
  }>
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
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/conversation-analytics')
      if (res.ok) {
        const d = await res.json()
        setData(d)
        setLastUpdated(new Date())
      }
    } catch (e) {
      console.error('Failed to fetch conversation metrics:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load and polling
  useEffect(() => {
    fetchData()
    // Poll every 15 seconds for real-time updates
    const interval = setInterval(() => fetchData(false), 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <p>Loading real-time analytics...</p>
      </div>
    )
  }

  if (!data) return <div className="text-red-400 p-8">Failed to load analytics data.</div>

  const hallucinationRate = data.noDataRate.total > 0 
    ? ((data.noDataRate.no_data_count / data.noDataRate.total) * 100).toFixed(1) 
    : '0.0'

  const maxQueryCount = Math.max(...(data.topQueries.map(q => Number(q.count)) || [1]))

  return (
    <div className="space-y-8 pb-8">
      {/* Header section with live refresh status */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Live Analytics
          </h3>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Real-time tracking active
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500 font-mono">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : 'text-gray-400'}`} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Primary Metrics - Glassmorphism style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Chats', value: data.metrics.totalMessages, icon: MessageSquare, gradient: 'from-blue-500/20 to-cyan-500/5', color: 'text-cyan-400', border: 'border-cyan-500/20' },
          { label: 'Chats Today', value: data.metrics.today, icon: BarChart2, gradient: 'from-indigo-500/20 to-purple-500/5', color: 'text-indigo-400', border: 'border-indigo-500/20' },
          { label: 'Unique Students', value: data.metrics.totalUsers, icon: Users, gradient: 'from-emerald-500/20 to-teal-500/5', color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'Unanswered %', value: `${hallucinationRate}%`, icon: ShieldAlert, gradient: 'from-rose-500/20 to-red-500/5', color: 'text-rose-400', border: 'border-rose-500/20' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient} bg-[#0A0A0A] border ${stat.border} rounded-2xl p-6 backdrop-blur-xl shadow-lg`}
          >
            {/* Subtle glow effect behind icon */}
            <div className={`absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br ${stat.gradient} blur-2xl rounded-full opacity-40 pointer-events-none`}></div>
            
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 bg-black/40 border border-white/5 rounded-xl ${stat.color} shadow-inner`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-400 tracking-wide">{stat.label}</span>
            </div>
            <div className="text-4xl font-bold ml-1 tracking-tight text-white">{stat.value.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Most Asked Questions */}
        <div className="xl:col-span-2 bg-[#0F0F13] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-100">Most Asked Questions</h4>
              <p className="text-sm text-gray-500 mt-1">What students are searching for (Last 30 Days)</p>
            </div>
            <div className="text-xs font-medium px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
              Top {Math.min(10, data.topQueries.length)} Trends
            </div>
          </div>

          <div className="space-y-4">
            {data.topQueries.length === 0 ? (
              <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                No questions recorded yet. Start chatting with Cubot!
              </div>
            ) : (
              data.topQueries.map((q, i) => {
                const percentage = Math.max(2, (Number(q.count) / maxQueryCount) * 100);
                return (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative group"
                  >
                    {/* Visual Bar Background */}
                    <div className="absolute inset-0 bg-white/5 rounded-lg overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-colors"
                      />
                    </div>

                    {/* Content */}
                    <div className="relative flex justify-between items-center px-4 py-3 border border-white/5 rounded-lg group-hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-4 truncate mr-4">
                        <span className="text-xs font-bold text-gray-500 w-4">{i + 1}</span>
                        <span className="font-medium text-gray-200 truncate" title={q.query}>
                          "{q.query}"
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white bg-black/40 px-3 py-1 rounded-full border border-white/5 shadow-inner">
                          {q.count}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side Widgets */}
        <div className="space-y-6">
          {/* Performance Status */}
          <div className="bg-[#0F0F13] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h4 className="font-semibold mb-6 text-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" /> Pipeline Speed
            </h4>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Search Engine Latency</span>
                  <span className="font-mono text-purple-400">{Math.round(data.stats.avg_retrieval)}ms</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (data.stats.avg_retrieval / 500) * 100)}%` }}
                    className="bg-gradient-to-r from-purple-600 to-fuchsia-500 h-2 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.4)]" 
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Total Response Time</span>
                  <span className="font-mono text-indigo-400">{Math.round(data.stats.avg_total)}ms</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (data.stats.avg_total / 2000) * 100)}%` }}
                    className="bg-gradient-to-r from-indigo-600 to-blue-500 h-2 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)]" 
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-center text-sm">
                <span className="text-gray-400">Knowledge Cache Hit Rate</span>
                <span className="text-emerald-400 font-mono text-lg tracking-tight">{(data.stats.cache_hit_rate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="bg-[#0F0F13] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h4 className="font-semibold mb-6 text-gray-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Top Languages Used
            </h4>
            <div className="space-y-4">
              {data.languages.map((l, i) => {
                const percentage = ((l.count / data.metrics.totalMessages) * 100).toFixed(1)
                return (
                  <div key={i} className="group">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-gray-300 capitalize font-medium">{l.language}</span>
                      <span className="text-emerald-400 font-mono">{percentage}%</span>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-1.5 border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className="bg-gradient-to-r from-emerald-600 to-teal-500 h-1.5 rounded-full" 
                      />
                    </div>
                  </div>
                )
              })}
              {data.languages.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">No language data available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Conversation Feed */}
      <div className="bg-[#0F0F13] border border-white/5 rounded-2xl p-6 shadow-xl overflow-hidden mt-6">
        <h4 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" /> Live Conversation Feed
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-black/40 border-b border-white/10">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3 min-w-[200px]">Student Question</th>
                <th className="px-4 py-3 min-w-[200px]">Cubot Response</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Lang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.liveFeed?.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No conversations yet.</td></tr>
              ) : (
                data.liveFeed?.map((chat) => (
                  <tr key={chat.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-gray-200 font-medium">
                      <div className="line-clamp-2" title={chat.user_message}>{chat.user_message}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      <div className="line-clamp-2" title={chat.bot_response}>{chat.bot_response}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-black/40 px-2 py-1 rounded text-gray-500 border border-white/5" title={chat.session_id}>
                        {chat.session_id.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {chat.language || 'en'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
