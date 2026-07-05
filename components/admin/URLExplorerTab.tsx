'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe, Database, ChevronDown, ChevronUp, Search, RefreshCw,
  CheckCircle, AlertCircle, X, FileText, Hash, Clock, Eye, Filter,
  Box, ExternalLink
} from 'lucide-react'

interface UrlData {
  id: string
  url: string
  title: string | null
  crawl_depth: number
  crawl_status: string
  pinecone_sync_status: string
  content_hash: string | null
  last_scraped_at: string | null
  created_at: string
  total_chunks: number
  namespace: string
  category: string
  pinecone_vectors: number
  avg_chunk_size: number
}

interface ChunkData {
  id: string
  title: string
  content: string
  category: string
  source_url: string
  source_type: string
  chunk_index: number
  total_chunks: number
  content_hash: string
  pinecone_vector_id: string | null
  pinecone_namespace: string | null
  embedding_model: string | null
  created_at: string
  char_count: number
  approx_token_count: number
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'bg-green-500/15 text-green-300 border-green-500/30',
    synced: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    failed: 'bg-red-500/15 text-red-300 border-red-500/30',
    pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    archived: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] || map.pending}`}>
      {status}
    </span>
  )
}

function ChunkRow({ chunk }: { chunk: ChunkData }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-gray-800/60 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-blue-400">{chunk.chunk_index + 1}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white truncate font-medium">{chunk.title}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{chunk.content.slice(0, 80)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-3 flex-shrink-0 text-xs text-gray-500">
          <span>~{chunk.approx_token_count} tk</span>
          <span>{chunk.char_count} ch</span>
          <div className={`w-1.5 h-1.5 rounded-full ${chunk.pinecone_vector_id ? 'bg-green-400' : 'bg-yellow-400'}`} />
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800/60 bg-black/20">
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Vector ID</p>
                <code className="text-xs text-blue-300 font-mono break-all">{chunk.pinecone_vector_id || '—'}</code>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Namespace</p>
                <code className="text-xs text-purple-300 font-mono">{chunk.pinecone_namespace || '—'}</code>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Content Hash</p>
                <code className="text-xs text-gray-400 font-mono">{chunk.content_hash?.slice(0, 24)}...</code>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Chunk Content</p>
              <div className="bg-black/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{chunk.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UrlRow({ url }: { url: UrlData }) {
  const [expanded, setExpanded] = useState(false)
  const [chunks, setChunks] = useState<ChunkData[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)

  const loadChunks = async () => {
    if (chunks.length > 0 || loadingChunks) return
    setLoadingChunks(true)
    try {
      const res = await fetch(`/api/admin/chunks?url=${encodeURIComponent(url.url)}`)
      const data = await res.json()
      if (res.ok) setChunks(data.chunks || [])
    } finally {
      setLoadingChunks(false)
    }
  }

  const handleExpand = () => {
    if (!expanded) loadChunks()
    setExpanded(!expanded)
  }

  const syncDiff = Math.abs(url.total_chunks - url.pinecone_vectors)
  const syncOk = syncDiff <= 1

  return (
    <div className="bg-[#0d1526] border border-gray-800/60 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 hover:bg-blue-500/5 transition-colors text-left"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            url.crawl_status === 'success' ? 'bg-green-400' : 'bg-red-400'
          }`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-white truncate max-w-xs">{url.title || url.url}</p>
              <StatusBadge status={url.pinecone_sync_status || 'pending'} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="truncate max-w-xs text-blue-400/70">{url.url}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 ml-4 flex-shrink-0 text-xs">
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Chunks</span>
              <span className="text-white font-semibold">{url.total_chunks}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Vectors</span>
              <span className={`font-semibold ${syncOk ? 'text-green-400' : 'text-yellow-400'}`}>
                {url.pinecone_vectors}
              </span>
            </div>
          </div>
          <div className="hidden md:block text-gray-500">
            {url.namespace && (
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                {url.namespace}
              </span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800/60">
          {/* URL metadata */}
          <div className="px-5 py-4 bg-black/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-gray-500">Category</p>
              <p className="text-white mt-0.5 font-mono">{url.category}</p>
            </div>
            <div>
              <p className="text-gray-500">Crawl Depth</p>
              <p className="text-white mt-0.5">{url.crawl_depth}</p>
            </div>
            <div>
              <p className="text-gray-500">Last Scraped</p>
              <p className="text-white mt-0.5">{url.last_scraped_at ? new Date(url.last_scraped_at).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Avg Chunk Size</p>
              <p className="text-white mt-0.5">{url.avg_chunk_size > 0 ? `${Math.round(url.avg_chunk_size)} ch` : '—'}</p>
            </div>
          </div>

          {/* Chunks */}
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between mb-3 mt-2">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Generated Chunks ({url.total_chunks})
              </h4>
              <a
                href={url.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open URL
              </a>
            </div>

            {loadingChunks ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-gray-600 animate-spin" />
              </div>
            ) : chunks.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No chunks found for this URL
              </div>
            ) : (
              <div className="space-y-2">
                {chunks.map((chunk) => <ChunkRow key={chunk.id} chunk={chunk} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function URLExplorerTab() {
  const [urls, setUrls] = useState<UrlData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [namespace, setNamespace] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [statusBreakdown, setStatusBreakdown] = useState<Array<{ crawl_status: string; count: string }>>([])
  const limit = 25

  const fetchUrls = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      })
      if (search) params.set('search', search)
      if (namespace) params.set('namespace', namespace)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/urls?${params}`)
      const data = await res.json()
      if (res.ok) {
        setUrls(data.urls || [])
        setTotal(data.total || 0)
        setStatusBreakdown(data.statusBreakdown || [])
      }
    } finally {
      setLoading(false)
    }
  }, [search, namespace, statusFilter, page])

  useEffect(() => { fetchUrls() }, [fetchUrls])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">URL & Chunk Explorer</h2>
          <p className="text-sm text-gray-400 mt-1">
            {total.toLocaleString()} scraped URLs — expand any to view generated chunks
          </p>
        </div>
        <button
          onClick={fetchUrls}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm border border-gray-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap gap-2">
        {statusBreakdown.map((s) => (
          <button
            key={s.crawl_status}
            onClick={() => { setStatusFilter(statusFilter === s.crawl_status ? '' : s.crawl_status); setPage(0) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === s.crawl_status
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                : 'bg-gray-800/60 text-gray-400 hover:text-white border-gray-700/60'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${
              s.crawl_status === 'success' ? 'bg-green-400' :
              s.crawl_status === 'failed' ? 'bg-red-400' : 'bg-gray-400'
            }`} />
            {s.crawl_status} ({s.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); setSearch(searchDraft); setPage(0) }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search by URL or title..."
            className="w-full bg-[#0d1526] border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
          />
        </div>
        <button type="submit"
          className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-medium transition-colors">
          Search
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setSearchDraft(''); setPage(0) }}
            className="px-3 py-2.5 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* URL list */}
      {loading && urls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mb-3" />
          <p className="text-gray-500">Loading URLs...</p>
        </div>
      ) : urls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Globe className="w-8 h-8 text-gray-700 mb-3" />
          <p className="text-gray-500">No URLs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {urls.map((url) => <UrlRow key={url.id} url={url} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {Math.min(page * limit + 1, total)}–{Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs disabled:opacity-40 transition-colors">
              ← Prev
            </button>
            <span className="text-xs text-gray-500">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs disabled:opacity-40 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
