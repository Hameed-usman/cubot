'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Database, Clock, ChevronDown, ChevronRight, LayoutList, Target, Zap, Info } from 'lucide-react'

export default function RAGDebuggerTab() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setResults(null)
    try {
      const res = await fetch('/api/admin/knowledge-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      const data = await res.json()
      setResults(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-semibold">RAG Debugger</h3>
          <p className="text-sm text-gray-400 mt-1">Test the retrieval pipeline and inspect chunk scores.</p>
        </div>
      </div>

      {/* Real-Life Use Case Guide */}
      <div className="bg-[#141414] border border-blue-900/50 rounded-xl p-5 shadow-lg">
        <h4 className="text-blue-400 font-semibold flex items-center gap-2 mb-3">
          <Info className="w-5 h-5" /> How to use the Debugger (Real-Life Scenario)
        </h4>
        <p className="text-sm text-gray-300 mb-4 leading-relaxed">
          If a student says Cubot gave a wrong or hallucinated answer, paste their exact question here. This tool shows you exactly what paragraphs Cubot grabbed from your database before generating an answer.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
            <span className="text-emerald-400 font-medium text-sm flex items-center gap-1 mb-1">✅ Good Signs (Accurate Answer)</span>
            <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
              <li><strong>Confidence</strong> is <span className="text-emerald-400">High</span></li>
              <li><strong>Namespaces</strong> perfectly match the department (e.g. <code>admissions</code>)</li>
              <li><strong>BM25 Score</strong> is &gt; 0 (exact keywords matched)</li>
            </ul>
          </div>
          <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-lg">
            <span className="text-rose-400 font-medium text-sm flex items-center gap-1 mb-1">❌ Poor Signs (Hallucination Risk)</span>
            <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
              <li><strong>Confidence</strong> is <span className="text-rose-400">Low</span> or <span className="text-rose-400">No Data</span></li>
              <li><strong>BM25 Score</strong> is 0 for all top chunks (no keywords found)</li>
              <li>Namespaces default to <code>general</code> for specific queries</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative max-w-3xl">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a user question to simulate retrieval..."
          className="w-full pl-11 pr-24 py-4 bg-[#141414] border border-gray-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute inset-y-2 right-2 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Searching...' : 'Test'}
        </button>
      </form>

      {/* Results Panel */}
      {results && results.success && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          {/* Debug Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Query Analysis</h4>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-400 block mb-1">Original Query</span>
                  <span className="text-sm font-medium text-gray-200">"{results.originalQuery}"</span>
                </div>
                {results.rewrittenQueries && results.rewrittenQueries.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">AI Rewritten Queries (Expanded)</span>
                    <ul className="text-sm text-indigo-300 list-disc list-inside">
                      {results.rewrittenQueries.map((q: string, i: number) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#141414] border border-gray-800 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Retrieval Strategy</h4>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-400 block mb-1">Final Confidence Score</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase
                    ${results.confidence === 'high' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' : 
                      results.confidence === 'medium' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' : 
                      'bg-rose-900/50 text-rose-400 border border-rose-800'}`}>
                    {results.confidence}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-1">Target Namespaces</span>
                  <div className="flex flex-wrap gap-1.5">
                    {results.namespaces?.map((ns: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-800 text-xs rounded border border-gray-700 text-gray-300">
                        {ns}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Stats */}
          <div className="flex flex-wrap gap-4 p-4 bg-[#141414] border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-gray-400">Total Latency:</span>
              <span className="font-semibold">{results.pipeline.total_ms}ms</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-gray-400">Retrieval:</span>
              <span className="font-semibold">{results.pipeline.retrieval_ms}ms</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <LayoutList className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">Rerank:</span>
              <span className="font-semibold">{results.pipeline.rerank_ms}ms</span>
            </div>
          </div>

          {/* Retrieved Chunks */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              Top Retrieved Context
              <span className="px-2 py-0.5 bg-gray-800 text-xs rounded-full text-gray-400">{results.results.length} chunks</span>
            </h4>
            
            {results.results.map((chunk: any, i: number) => (
              <div key={i} className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden transition-all">
                <div 
                  onClick={() => setExpandedId(expandedId === chunk.id ? null : chunk.id)}
                  className="p-4 cursor-pointer hover:bg-gray-800/30 flex items-start gap-4"
                >
                  <div className="flex-none pt-1">
                    {expandedId === chunk.id ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h5 className="font-medium text-gray-200 truncate pr-4">{chunk.metadata.title || 'Untitled Document'}</h5>
                      <div className="flex flex-wrap items-center justify-end gap-2 flex-none">
                        <span className="text-xs px-2 py-1 bg-gray-800 rounded-md text-gray-400 font-mono border border-gray-700">
                          Pinecone/RRF: {chunk.score.toFixed(4)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-md font-mono border ${chunk.bm25Score > 0 ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                          BM25 (Keyword): {chunk.bm25Score?.toFixed(4) || '0.0000'}
                        </span>
                        {chunk.rerankScore !== chunk.score && (
                          <span className="text-xs px-2 py-1 bg-blue-900/40 text-blue-400 rounded-md font-mono border border-blue-800">
                            Reranked: {chunk.rerankScore.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500 mb-2">
                      <span className="px-2 py-0.5 border border-gray-800 rounded-full bg-black/50">{chunk.metadata.namespace || chunk.metadata.category}</span>
                      <span className="px-2 py-0.5 border border-gray-800 rounded-full bg-black/50">{chunk.metadata.sourceType}</span>
                    </div>
                    {expandedId !== chunk.id && (
                      <p className="text-sm text-gray-400 line-clamp-2">{chunk.metadata.text || chunk.metadata.content}</p>
                    )}
                  </div>
                </div>

                {expandedId === chunk.id && (
                  <div className="p-4 bg-[#0a0a0a] border-t border-gray-800">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {chunk.metadata.text || chunk.metadata.content}
                    </p>
                    {chunk.metadata.sourceUrl && (
                      <div className="mt-4 pt-4 border-t border-gray-800 text-xs">
                        <a href={chunk.metadata.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {chunk.metadata.sourceUrl}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {results.results.length === 0 && (
              <div className="p-8 text-center bg-[#141414] border border-gray-800 rounded-xl text-gray-400">
                No context retrieved for this query.
              </div>
            )}
          </div>

        </motion.div>
      )}
    </div>
  )
}
