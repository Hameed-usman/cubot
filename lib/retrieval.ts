import sql from './db'
import { embedText } from './embeddings'
import { pineconeIndex } from './pinecone'
import { RankedChunk, ChunkMetadata, Citation, ConfidenceLevel } from '@/types'

/**
 * Production-grade hybrid retrieval engine.
 *
 * Pipeline:
 * 1. Vector search (Pinecone) — semantic similarity
 * 2. BM25 keyword search (PostgreSQL full-text) — exact term matching
 * 3. Reciprocal Rank Fusion — merges both result sets
 * 4. Returns unified ranked list
 */

const TOP_K_VECTOR = 20    // Retrieve more candidates before reranking
const TOP_K_KEYWORD = 20
const RRF_K = 60           // RRF constant (higher = less aggressive ranking)

// ─── Vector Search ─────────────────────────────────────────────────────────────

async function vectorSearch(query: string, topK: number = TOP_K_VECTOR): Promise<RankedChunk[]> {
  const index = pineconeIndex.get()
  if (!index) return []

  try {
    const embedding = await embedText(query)
    const response = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    })

    return (response.matches || []).map((match): RankedChunk => ({
      id: match.id,
      score: match.score || 0,
      metadata: (match.metadata || {}) as unknown as ChunkMetadata,
    }))
  } catch (error) {
    console.error('[Retrieval] Vector search error:', error)
    return []
  }
}

// ─── BM25 Keyword Search (PostgreSQL FTS) ─────────────────────────────────────

async function keywordSearch(query: string, topK: number = TOP_K_KEYWORD): Promise<RankedChunk[]> {
  try {
    // Sanitize query for PostgreSQL FTS — remove special chars
    const sanitized = query.replace(/['"\\;:]/g, ' ').trim()
    if (!sanitized) return []

    const results = await sql`
      SELECT
        id,
        title,
        content,
        source_url     AS "sourceUrl",
        source_type    AS "sourceType",
        page_type      AS "pageType",
        category,
        breadcrumb,
        content_hash   AS "contentHash",
        chunk_index    AS "chunkIndex",
        total_chunks   AS "totalChunks",
        last_scraped_at,
        ts_rank_cd(search_vector, query, 32) AS bm25_score
      FROM knowledge_entries, plainto_tsquery('english', ${sanitized}) query
      WHERE search_vector @@ query
        AND content_hash IS NOT NULL
      ORDER BY bm25_score DESC
      LIMIT ${topK}
    `

    return results.map((row): RankedChunk => ({
      id: row.id,
      score: 0,
      bm25Score: parseFloat(row.bm25_score) || 0,
      metadata: {
        text: row.content,
        title: row.title,
        sourceUrl: row.sourceUrl || '',
        sourceType: row.sourceType || 'manual',
        pageType: row.pageType || 'general',
        category: row.category || 'general',
        breadcrumb: row.breadcrumb || '',
        contentHash: row.contentHash || '',
        chunkIndex: row.chunkIndex || 0,
        totalChunks: row.totalChunks || 1,
        department: row.category || 'general',
        crawledAt: row.last_scraped_at?.toISOString() || '',
      },
    }))
  } catch (error) {
    console.error('[Retrieval] Keyword search error:', error)
    return []
  }
}

// ─── Reciprocal Rank Fusion ────────────────────────────────────────────────────

/**
 * Merges vector and keyword results using Reciprocal Rank Fusion.
 * RRF score = sum(1 / (k + rank)) across all lists.
 * Documents appearing in both lists receive significantly higher scores.
 */
function reciprocalRankFusion(
  vectorResults: RankedChunk[],
  keywordResults: RankedChunk[],
  k: number = RRF_K
): RankedChunk[] {
  const scores = new Map<string, { chunk: RankedChunk; rrfScore: number }>()

  // Score from vector ranking
  vectorResults.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + rank + 1)
    scores.set(chunk.id, {
      chunk,
      rrfScore,
    })
  })

  // Score from keyword ranking — add to existing or create new
  keywordResults.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + rank + 1)
    const existing = scores.get(chunk.id)

    if (existing) {
      // Found in both lists — boost significantly
      existing.rrfScore += rrfScore
      existing.chunk.bm25Score = chunk.bm25Score
    } else {
      scores.set(chunk.id, { chunk, rrfScore })
    }
  })

  return Array.from(scores.values())
    .map(({ chunk, rrfScore }) => ({ ...chunk, rrfScore }))
    .sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0))
}

// ─── Fallback: DB scan for manual entries ──────────────────────────────────────

async function fallbackDbSearch(topK: number = 5): Promise<RankedChunk[]> {
  try {
    const results = await sql`
      SELECT id, title, content, source_url AS "sourceUrl", source_type AS "sourceType",
             page_type AS "pageType", category, breadcrumb, chunk_index AS "chunkIndex",
             total_chunks AS "totalChunks", content_hash AS "contentHash"
      FROM knowledge_entries
      ORDER BY updated_at DESC
      LIMIT ${topK}
    `
    return results.map((row): RankedChunk => ({
      id: row.id,
      score: 0.5,
      metadata: {
        text: row.content,
        title: row.title,
        sourceUrl: row.sourceUrl || '',
        sourceType: row.sourceType || 'manual',
        pageType: row.pageType || 'general',
        category: row.category || 'general',
        breadcrumb: row.breadcrumb || '',
        contentHash: row.contentHash || '',
        chunkIndex: row.chunkIndex || 0,
        totalChunks: row.totalChunks || 1,
        department: row.category || 'general',
        crawledAt: '',
      },
    }))
  } catch {
    return []
  }
}

// ─── Main Hybrid Retrieval ─────────────────────────────────────────────────────

export interface RetrievalResult {
  chunks: RankedChunk[]
  citations: Citation[]
  confidence: ConfidenceLevel
}

export async function hybridRetrieve(query: string, topK: number = 20): Promise<RetrievalResult> {
  const pineconeAvailable = !!pineconeIndex.get()

  let merged: RankedChunk[] = []

  if (pineconeAvailable) {
    // Run both searches in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      vectorSearch(query, topK),
      keywordSearch(query, topK),
    ])

    merged = reciprocalRankFusion(vectorResults, keywordResults)
  } else {
    // Pinecone not available — use keyword search only + fallback
    const keywordResults = await keywordSearch(query, topK)
    if (keywordResults.length > 0) {
      merged = keywordResults
    } else {
      merged = await fallbackDbSearch(5)
    }
  }

  // ── Build citations from unique source URLs ──────────────────────────────
  const seenUrls = new Set<string>()
  const citations: Citation[] = []

  for (const chunk of merged.slice(0, 10)) {
    const url = chunk.metadata.sourceUrl
    if (url && url.startsWith('http') && !seenUrls.has(url)) {
      seenUrls.add(url)
      citations.push({
        title: chunk.metadata.title,
        url,
        pageType: chunk.metadata.pageType,
        category: chunk.metadata.category,
      })
    }
  }

  // ── Confidence scoring ──────────────────────────────────────────────────
  let confidence: ConfidenceLevel = 'no_data'
  if (merged.length === 0) {
    confidence = 'no_data'
  } else if (merged.length >= 5 && (merged[0].rrfScore || merged[0].score) > 0.6) {
    confidence = 'high'
  } else if (merged.length >= 2) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  return { chunks: merged, citations, confidence }
}
