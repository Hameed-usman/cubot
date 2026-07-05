'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe, Database, Hash, AlertTriangle, CheckCircle, RefreshCw,
  ChevronRight, ChevronDown, Search, Zap, Play, AlertCircle,
  X, BarChart2, Clock, TrendingUp, Box
} from 'lucide-react'

interface NamespaceData {
  namespace: string
  totalUrls: number
  totalChunks: number
  totalEntries: number
  avgChunkSize: number
  lastUpdated: string | null
  lastScraped: string | null
  manualCount: number
  scraperCount: number
  syncedVectors: number
  unsyncedCount: number
  pineconeVectors: number
  sourceTypes: string[]
  syncHealth: 'healthy' | 'degraded' | 'unknown' | 'orphaned'
}

interface TestResult {
  passed: boolean
  confidence: string
  topScore: number
  retrievedChunks: Array<{ id: string; score: number; text: string; sourceUrl: string; title: string }>
  answer: string
  retrievalMs: number
  totalMs: number
  chunkCount: number
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    healthy: { cls: 'bg-green-500/15 text-green-300 border-green-500/30', label: '● Healthy' },
    degraded: { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', label: '◐ Degraded' },
    unknown: { cls: 'bg-gray-500/15 text-gray-300 border-gray-500/30', label: '○ Unknown' },
    orphaned: { cls: 'bg-red-500/15 text-red-300 border-red-500/30', label: '✕ Orphaned' },
  }
  const { cls, label } = map[health] || map.unknown
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>{label}</span>
}

function NamespaceCoverageTest({ namespace }: { namespace: string }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState('')

  const presetQuestions: Record<string, string[]> = {
    finance: ['What are the BSCS fee charges?', 'Are there any installment payment options?'],
    admissions: ['What are the admission requirements?', 'When is the last date to apply?'],
    scholarships: ['What scholarships are available for students?', 'How to apply for merit scholarship?'],
    faculty: ['Who are the faculty members in the CS department?', 'Who is the HOD of Computer Science?'],
    general: ['What programs does CUSIT offer?', 'Where is CUSIT located?'],
  }

  const presets = presetQuestions[namespace] || presetQuestions.general

  const runTest = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/namespaces/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace, question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed')
      setResult(data.result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 border-t border-gray-800/60 pt-4 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h4 className="text-sm font-semibold text-white">Knowledge Coverage Test</h4>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runTest()}
            placeholder={`Ask something about ${namespace}...`}
            className="w-full bg-[#0a1120] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500/60"
          />
        </div>
        <button
          onClick={runTest}
          disabled={loading || !question.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Test
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((q) => (
          <button
            key={q}
            onClick={() => setQuestion(q)}
            className="text-xs px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-700/60"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {result && (
        <div className="bg-[#0a1120] rounded-xl p-4 space-y-4 border border-gray-800/60">
          {/* Test verdict */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {result.passed ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">PASS</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">FAIL</span>
                </div>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                result.confidence === 'high' ? 'bg-green-500/15 text-green-300 border-green-500/30' :
                result.confidence === 'medium' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' :
                'bg-red-500/15 text-red-400 border-red-500/30'
              }`}>
                {result.confidence} confidence
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Top score: <span className="text-white font-mono">{(result.topScore * 100).toFixed(1)}%</span>
              {' '}· {result.retrievalMs}ms
            </div>
          </div>

          {/* Retrieved chunks */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Retrieved Chunks ({result.chunkCount})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {result.retrievedChunks.map((chunk, i) => (
                <div key={chunk.id} className="bg-black/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400">#{i + 1} {chunk.title}</span>
                    <span className="text-xs font-mono text-blue-400">{(chunk.score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{chunk.text}</p>
                  {chunk.sourceUrl && (
                    <p className="text-xs text-gray-600 mt-1 truncate">{chunk.sourceUrl}</p>
                  )}
                </div>
              ))}
              {result.chunkCount === 0 && (
                <p className="text-xs text-red-400">No chunks retrieved from this namespace for this question.</p>
              )}
            </div>
          </div>

          {/* Generated Answer */}
          {result.answer && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Generated Answer</p>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-sm text-gray-200 leading-relaxed">{result.answer}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function NamespaceExplorerTab() {
  const [namespaces, setNamespaces] = useState<NamespaceData[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pineconeConfigured, setPineconeConfigured] = useState(true)

  const fetchNamespaces = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/namespaces')
      const data = await res.json()
      if (res.ok) {
        setNamespaces(data.namespaces || [])
        setPineconeConfigured(data.pineconeConfigured)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNamespaces() }, [fetchNamespaces])

  const totalChunks = namespaces.reduce((s, n) => s + n.totalChunks, 0)
  const totalVectors = namespaces.reduce((s, n) => s + n.pineconeVectors, 0)
  const healthyCount = namespaces.filter(n => n.syncHealth === 'healthy').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Namespace Explorer</h2>
          <p className="text-sm text-gray-400 mt-1">
            {namespaces.length} namespaces · {totalChunks.toLocaleString()} chunks · {totalVectors.toLocaleString()} Pinecone vectors
          </p>
        </div>
        <button
          onClick={fetchNamespaces}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm border border-gray-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!pineconeConfigured && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-200">
            Pinecone is not configured. Vector counts will show 0. Neon data is still accurate.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Namespaces', value: namespaces.length, icon: Box, color: 'text-blue-400' },
          { label: 'Total Chunks', value: totalChunks.toLocaleString(), icon: Database, color: 'text-purple-400' },
          { label: 'Pinecone Vectors', value: totalVectors.toLocaleString(), icon: Hash, color: 'text-emerald-400' },
          { label: 'Healthy', value: `${healthyCount}/${namespaces.length}`, icon: CheckCircle, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0d1526] border border-gray-800/60 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-800/80 rounded-lg flex items-center justify-center">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Namespace List */}
      {loading && namespaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mb-3" />
          <p className="text-gray-500">Loading namespaces...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {namespaces.map((ns) => (
            <div key={ns.namespace} className="bg-[#0d1526] border border-gray-800/60 rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-5 hover:bg-blue-500/5 transition-colors text-left"
                onClick={() => setExpanded(expanded === ns.namespace ? null : ns.namespace)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Box className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-semibold text-white">{ns.namespace}</h3>
                      <HealthBadge health={ns.syncHealth} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{ns.totalUrls} URLs</span>
                      <span>{ns.totalChunks} chunks</span>
                      <span>{ns.pineconeVectors} vectors</span>
                      {ns.avgChunkSize > 0 && <span>~{ns.avgChunkSize} avg chars</span>}
                      {ns.sourceTypes.length > 0 && (
                        <span className="flex items-center gap-1">
                          {ns.sourceTypes.map(t => (
                            <span key={t} className={`px-1.5 py-0.5 rounded text-xs ${
                              t === 'manual' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                            }`}>{t}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 ml-4 flex-shrink-0">
                  {/* Mini bar chart: Neon vs Pinecone */}
                  <div className="hidden sm:flex flex-col items-end gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Neon</span>
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(80, ns.totalChunks / 10)}px` }} />
                      <span className="text-gray-300 font-mono w-8 text-right">{ns.totalChunks}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Pine</span>
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(80, ns.pineconeVectors / 10)}px` }} />
                      <span className="text-gray-300 font-mono w-8 text-right">{ns.pineconeVectors}</span>
                    </div>
                  </div>
                  {expanded === ns.namespace
                    ? <ChevronDown className="w-4 h-4 text-gray-500" />
                    : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </div>
              </button>

              {expanded === ns.namespace && (
                <div className="border-t border-gray-800/60 px-5 pb-5">
                  {/* Detailed Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-2">
                    {[
                      { label: 'Neon Entries', value: ns.totalEntries, color: 'text-blue-400' },
                      { label: 'Pinecone Vectors', value: ns.pineconeVectors, color: 'text-emerald-400' },
                      { label: 'Sync Gap', value: Math.abs(ns.totalChunks - ns.pineconeVectors), color: ns.syncHealth === 'healthy' ? 'text-green-400' : 'text-yellow-400' },
                      { label: 'Avg Chunk Size', value: `${ns.avgChunkSize} ch`, color: 'text-purple-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-black/30 rounded-xl p-3 text-center">
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 my-3">
                    <span>Last scraped: {ns.lastScraped ? new Date(ns.lastScraped).toLocaleString() : '—'}</span>
                    <span>Last updated: {ns.lastUpdated ? new Date(ns.lastUpdated).toLocaleString() : '—'}</span>
                  </div>

                  {/* Knowledge Coverage Test inline */}
                  <NamespaceCoverageTest namespace={ns.namespace} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
