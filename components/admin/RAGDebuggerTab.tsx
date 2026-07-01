'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Database, Clock, ChevronDown, ChevronRight, LayoutList } from 'lucide-react'

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
          className="w-full pl-11 pr-24 py-4 bg-[#141414] border border-gray-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
          
          {/* Pipeline Stats */}
          <div className="flex gap-4 p-4 bg-[#141414] border border-gray-800 rounded-xl">
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
                      <div className="flex items-center gap-2 flex-none">
                        <span className="text-xs px-2 py-1 bg-gray-800 rounded-md text-gray-400 font-mono">
                          Score: {chunk.score.toFixed(4)}
                        </span>
                        {chunk.rerankScore !== chunk.score && (
                          <span className="text-xs px-2 py-1 bg-blue-900/40 text-blue-400 rounded-md font-mono">
                            Reranked: {chunk.rerankScore.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500 mb-2">
                      <span className="px-2 py-0.5 border border-gray-800 rounded-full">{chunk.metadata.namespace || chunk.metadata.category}</span>
                      <span className="px-2 py-0.5 border border-gray-800 rounded-full">{chunk.metadata.sourceType}</span>
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
