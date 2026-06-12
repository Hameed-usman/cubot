'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, AlertTriangle, Zap, Activity, BarChart3, PieChart,
  CheckCircle, XCircle, HelpCircle, ArrowRight, RefreshCw, Loader2,
  MessageSquare, Clock, Brain, Target
} from 'lucide-react'

interface AnalyticsData {
  volume: { date: string, count: number }[]
  confidenceDist: { confidence: string, count: number }[]
  topQueries: { query: string, count: number }[]
  stats: {
    avg_retrieval: number
    avg_total: number
    cache_hit_rate: number
  }
  noDataRate: { total: number, no_data_count: number }
}

function HealthBadge({ score }: { score: 'good' | 'warning' | 'critical' | 'empty' }) {
  const cfg = {
    good:     { label: 'Healthy',   bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  text: '#34d399', dot: 'bg-emerald-400' },
    warning:  { label: 'Needs Work',bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24', dot: 'bg-amber-400' },
    critical: { label: 'Critical',  bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#f87171', dot: 'bg-red-400' },
    empty:    { label: 'No Data',   bg: 'rgba(255,255,255,0.04)',border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.3)', dot: 'bg-white/20' },
  }[score]
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${score === 'good' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

function MetricCard({
  icon, title, value, subtitle, health, explanation, action
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  health: 'good' | 'warning' | 'critical' | 'empty'
  explanation: string
  action?: string
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            {icon}
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-white/40">{title}</span>
        </div>
        <HealthBadge score={health} />
      </div>
      <div>
        <div className="text-3xl font-bold text-white font-display">{value}</div>
        <div className="text-xs text-white/30 mt-0.5 font-sans">{subtitle}</div>
      </div>
      <p className="text-xs text-white/50 font-sans leading-relaxed">{explanation}</p>
      {action && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400/80 font-sans">
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          {action}
        </div>
      )}
    </div>
  )
}

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/analytics')
      if (res.ok) setData(await res.json())
    } catch { /* silent */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cu-gold" />
        <p className="text-white/30 text-sm font-sans">Loading intelligence data…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <XCircle className="w-10 h-10 text-red-400/50" />
        <p className="text-red-400 text-sm font-sans">Failed to load analytics. Check your database connection.</p>
      </div>
    )
  }

  // Safe extractions with defaults
  const volume = data.volume || []
  const confidenceDist = data.confidenceDist || []
  const topQueries = data.topQueries || []
  const totalQueries = Number(data.noDataRate?.total || 0)
  const noDataCount = Number(data.noDataRate?.no_data_count || 0)
  const cacheHitRaw = Number(data.stats?.cache_hit_rate || 0)
  const avgTotalMs = Math.round(Number(data.stats?.avg_total || 0))
  const avgRetrievalMs = Math.round(Number(data.stats?.avg_retrieval || 0))

  const noDataPercent = totalQueries > 0 ? Math.round((noDataCount / totalQueries) * 100) : 0
  const cachePercent = Math.round(cacheHitRaw * 100)

  // Compute high-confidence rate
  const highCount = Number(confidenceDist.find(d => d.confidence === 'high')?.count || 0)
  const medCount = Number(confidenceDist.find(d => d.confidence === 'medium')?.count || 0)
  const goodAnswerRate = totalQueries > 0 ? Math.round(((highCount + medCount) / totalQueries) * 100) : 0

  // Determine health scores
  const answerHealth: 'good' | 'warning' | 'critical' | 'empty' =
    totalQueries === 0 ? 'empty' : goodAnswerRate >= 75 ? 'good' : goodAnswerRate >= 50 ? 'warning' : 'critical'

  const noDataHealth: 'good' | 'warning' | 'critical' | 'empty' =
    totalQueries === 0 ? 'empty' : noDataPercent <= 10 ? 'good' : noDataPercent <= 30 ? 'warning' : 'critical'

  const speedHealth: 'good' | 'warning' | 'critical' | 'empty' =
    totalQueries === 0 ? 'empty' : avgTotalMs <= 5000 ? 'good' : avgTotalMs <= 10000 ? 'warning' : 'critical'

  const cacheHealth: 'good' | 'warning' | 'critical' | 'empty' =
    totalQueries === 0 ? 'empty' : cachePercent >= 30 ? 'good' : cachePercent >= 10 ? 'warning' : 'critical'

  // Overall system health score
  const healthScores = { good: 3, warning: 1, critical: 0, empty: 1 }
  const overallScore = [answerHealth, noDataHealth, speedHealth, cacheHealth]
    .reduce((sum, h) => sum + healthScores[h], 0)
  const overallHealth = overallScore >= 10 ? 'good' : overallScore >= 6 ? 'warning' : 'critical'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-lg">Bot Intelligence Dashboard</h2>
          <p className="text-xs text-white/30 font-sans mt-0.5">Real performance data — understand how well Cubot is serving your visitors</p>
        </div>
        <div className="flex items-center gap-3">
          <HealthBadge score={totalQueries === 0 ? 'empty' : overallHealth} />
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-sans text-white/50 hover:text-white/80 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {totalQueries === 0 ? (
        /* Empty state when no queries yet */
        <div className="rounded-2xl p-10 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Brain className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/50 font-sans text-sm font-semibold mb-1">No chat data yet</p>
          <p className="text-white/25 font-sans text-xs max-w-sm mx-auto">
            Once users start asking questions, you'll see real-time intelligence here — answer quality, speed, popular topics, and what the bot doesn't know.
          </p>
        </div>
      ) : (
        <>
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              icon={<Target className="w-4 h-4 text-emerald-400" />}
              title="Answer Quality"
              value={`${goodAnswerRate}%`}
              subtitle={`${highCount + medCount} of ${totalQueries} questions answered well`}
              health={answerHealth}
              explanation="How often the bot gives a confident, useful answer. High-quality answers have verified data from your knowledge base."
              action={answerHealth !== 'good' ? 'Go to Sync tab and index more website pages' : undefined}
            />
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
              title="Unanswered Rate"
              value={`${noDataPercent}%`}
              subtitle={`${noDataCount} questions had no good answer`}
              health={noDataHealth}
              explanation="% of questions where the bot had no verified data. High rate means your knowledge base has gaps — sync more pages."
              action={noDataHealth !== 'good' ? 'Check Top Questions below — those topics need syncing' : undefined}
            />
            <MetricCard
              icon={<Clock className="w-4 h-4 text-blue-400" />}
              title="Response Speed"
              value={`${(avgTotalMs / 1000).toFixed(1)}s`}
              subtitle={`Retrieval: ${avgRetrievalMs}ms | Total: ${avgTotalMs}ms`}
              health={speedHealth}
              explanation="How long it takes Cubot to answer. Under 5s is great. Slow responses happen when the knowledge base has poor matches."
              action={speedHealth !== 'good' ? 'Better indexed data = faster retrieval' : undefined}
            />
            <MetricCard
              icon={<Zap className="w-4 h-4 text-amber-400" />}
              title="Cache Efficiency"
              value={`${cachePercent}%`}
              subtitle={`${Math.round(totalQueries * cacheHitRaw)} instant replies served`}
              health={cacheHealth}
              explanation="Frequently asked questions are cached and answered instantly (no AI cost). Higher is better — means users ask similar questions."
            />
          </div>

          {/* Confidence breakdown + top queries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Confidence breakdown */}
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-1">
                <PieChart className="w-4 h-4 text-white/30" />
                <h3 className="text-sm font-semibold text-white font-display">Answer Confidence Breakdown</h3>
              </div>
              <p className="text-xs text-white/30 font-sans mb-5">
                Shows how confident the bot was across all {totalQueries} questions. Green = great data. Red = knowledge gap.
              </p>
              <div className="space-y-4">
                {[
                  { key: 'high',    label: 'High Confidence',   desc: 'Bot answered with verified data',              color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                  { key: 'medium',  label: 'Medium Confidence', desc: 'Partial data found, reasonable answer',        color: 'bg-blue-500',    textColor: 'text-blue-400' },
                  { key: 'low',     label: 'Low Confidence',    desc: 'Data exists but may be incomplete',           color: 'bg-amber-500',   textColor: 'text-amber-400' },
                  { key: 'no_data', label: 'No Data Found',     desc: '⚠ Bot had nothing — knowledge gap',          color: 'bg-red-500',     textColor: 'text-red-400' },
                ].map(({ key, label, desc, color, textColor }) => {
                  const count = Number(confidenceDist.find(d => d.confidence === key)?.count || 0)
                  const pct = Math.round((count / (totalQueries || 1)) * 100)
                  return (
                    <div key={key}>
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <p className={`text-xs font-semibold ${textColor} font-sans`}>{label}</p>
                          <p className="text-[10px] text-white/25 font-sans">{desc}</p>
                        </div>
                        <span className="text-xs font-mono text-white/60 mt-0.5 ml-4 flex-shrink-0">{pct}% · {count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Questions */}
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-white/30" />
                <h3 className="text-sm font-semibold text-white font-display">Most Asked Questions</h3>
              </div>
              <p className="text-xs text-white/30 font-sans mb-4">
                What your visitors actually want to know. Use this list to guide what to sync next.
              </p>
              {topQueries.length > 0 ? (
                <div className="space-y-1">
                  {topQueries.slice(0, 10).map((q, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 rounded-xl px-3 transition-colors hover:bg-white/[0.03]">
                      <span className="text-[10px] font-mono text-white/20 w-4 flex-shrink-0">{i + 1}</span>
                      <span className="text-xs font-sans text-white/65 flex-1 truncate">{q.query}</span>
                      <span className="text-[10px] font-mono text-white/25 bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">
                        ×{q.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <HelpCircle className="w-8 h-8 text-white/10 mb-2" />
                  <p className="text-white/25 text-xs font-sans">No question data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Query Volume Chart */}
          {volume.length > 0 && (
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-white/30" />
                <h3 className="text-sm font-semibold text-white font-display">Daily Question Volume</h3>
              </div>
              <p className="text-xs text-white/30 font-sans mb-5">
                How many students asked the bot each day. Spikes often happen during admission season.
              </p>
              <SimpleLineChart data={volume} />
            </div>
          )}

          {/* Action Panel */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(201,162,39,0.04)', border: '1px solid rgba(201,162,39,0.15)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-cu-gold/70" />
              <h3 className="text-sm font-semibold text-cu-gold font-display">What To Do Next</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  show: noDataPercent > 15,
                  icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
                  title: 'Close Knowledge Gaps',
                  desc: `${noDataPercent}% of questions had no answer. Go to Sync → paste the URLs of pages the bot didn't know about.`,
                  urgency: 'urgent'
                },
                {
                  show: topQueries.length > 0,
                  icon: <MessageSquare className="w-4 h-4 text-blue-400" />,
                  title: 'Train on Top Questions',
                  desc: `Your most asked question is "${topQueries[0]?.query?.slice(0, 40)}…". Make sure that topic is synced.`,
                  urgency: 'info'
                },
                {
                  show: avgTotalMs > 8000,
                  icon: <Clock className="w-4 h-4 text-amber-400" />,
                  title: 'Improve Response Speed',
                  desc: 'Responses are taking over 8s. Syncing more structured content will help the retrieval engine find answers faster.',
                  urgency: 'warning'
                },
                {
                  show: noDataPercent <= 10 && goodAnswerRate >= 75,
                  icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
                  title: 'Bot is Performing Well',
                  desc: `${goodAnswerRate}% good answer rate — excellent! Keep adding content regularly to maintain quality.`,
                  urgency: 'good'
                },
              ].filter(a => a.show).map((action, i) => (
                <div key={i} className="rounded-xl p-3.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    {action.icon}
                    <p className="text-xs font-bold text-white/80 font-display">{action.title}</p>
                  </div>
                  <p className="text-[11px] text-white/40 font-sans leading-relaxed">{action.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SimpleLineChart({ data }: { data: { date: string, count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const step = 100 / (data.length - 1 || 1)
  const points = data.map((d, i) => {
    const x = i * step
    const y = 100 - (d.count / max) * 80
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-32 overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a227" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        <line x1="0" y1="60" x2="100" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <path d={`M 0,100 L ${points} L 100,100 Z`} fill="url(#chartGradient)" />
        <polyline fill="none" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        {data.map((d, i) => (
          <circle key={i} cx={i * step} cy={100 - (d.count / max) * 80} r="1.5" fill="#c9a227" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 font-mono">
        {data.map((d, i) => (
          <span key={i}>{new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
        ))}
      </div>
    </div>
  )
}
