import sql from './db'
import { embedText, embedBatch } from './embeddings'
import { pineconeIndex } from './pinecone'
import { categoryToNamespace } from './embed-and-store'
import { RankedChunk, ChunkMetadata, Citation, ConfidenceLevel } from '@/types'

/**
 * Enterprise Hybrid Retrieval Engine — v2
 *
 * Pipeline:
 * 1. Query expansion → 3 query variants (original + 2 paraphrases)
 * 2. Multi-namespace vector search (intent-targeted namespace + global fallback)
 * 3. PostgreSQL FTS with websearch_to_tsquery (supports phrase matching)
 * 4. Reciprocal Rank Fusion — merges all result sets
 * 5. Similarity threshold filtering (removes noise)
 * 6. Returns unified ranked list
 */

const TOP_K_VECTOR = 30    // Per query variant (3 variants × 30 = up to 90 candidates before dedup)
const TOP_K_KEYWORD = 40
const RRF_K = 60           // RRF constant
const MIN_VECTOR_SCORE = 0.45 // Filter out low-confidence vectors

// ─── University Synonyms ───────────────────────────────────────────────────────

const SYNONYMS: Record<string, string[]> = {
  'dental': ['bds', 'dentistry', 'dental surgery', 'dental science', 'oral medicine'],
  'bds': ['dental', 'dentistry', 'dental surgery', 'oral medicine'],
  'pharmacy': ['pharm-d', 'pharmacology', 'pharma', 'd-pharm'],
  'cs': ['computer science', 'it', 'information technology', 'software engineering', 'bscs', 'mscs'],
  'it': ['information technology', 'computer science', 'cs', 'bsit'],
  'bba': ['business', 'management', 'mba', 'commerce', 'finance'],
  'nursing': ['bsn', 'medical assistant', 'nurse'],
  'admission': ['apply', 'enroll', 'entry test', 'last date', 'eligibility', 'form', 'intake'],
  'fee': ['charges', 'payment', 'tuition', 'cost', 'dues', 'scholarship']
}

/**
 * Expands a query with synonyms to improve recall.
 */
function expandSynonyms(query: string): string {
  let expanded = query
  const lower = query.toLowerCase()
  for (const [key, alts] of Object.entries(SYNONYMS)) {
    if (lower.includes(key)) {
      // Add unique alts that aren't already in the query
      alts.forEach(alt => {
        if (!lower.includes(alt)) expanded += ' ' + alt
      })
    }
  }
  return expanded
}

// ─── Namespace Routing ─────────────────────────────────────────────────────────

/**
 * Maps a classified intent/query to the most relevant namespaces to search.
 * Primary namespace searched first (higher weight), then global fallback.
 */
function getTargetNamespaces(query: string): string[] {
  const q = query.toLowerCase()

  // Build ordered list — most specific namespace first
  const namespaces: string[] = []

  if (/facult|staff|professor|lecturer|instructor|teacher|bio|cv|dr\.|prof\.|hod|dean|who is|tell me about|profile|details of/i.test(q))
    namespaces.push('faculty')
  if (/admiss|apply|enroll|eligib|entry test|last date|intake|form/i.test(q))
    namespaces.push('admissions')
  if (/scholarship|financial.?aid|merit|bursary|stipend|waiver/i.test(q))
    namespaces.push('scholarships')
  if (/fee|tuition|cost|charges?|payment|installment|dues|how much/i.test(q))
    namespaces.push('finance')
  if (/notice|announcement|news|circular|latest|recent|update/i.test(q))
    namespaces.push('notices')
  if (/event|seminar|workshop|conference|ceremony|convocation/i.test(q))
    namespaces.push('events')
  if (/policy|rule|regulation|handbook|code.?of.?conduct/i.test(q))
    namespaces.push('policies')
  if (/contact|phone|email|address|location|reach|visit|map|directions/i.test(q))
    namespaces.push('contact')
  if (/\b(cs|bscs|mscs|software|computer.?science|it|bsit)\b/i.test(q))
    namespaces.push('dept-cs')
  if (/\b(bba|mba|business|management|commerce)\b/i.test(q))
    namespaces.push('dept-bba')
  if (/pharm/i.test(q)) namespaces.push('dept-pharmacy')
  if (/nurs/i.test(q)) namespaces.push('dept-nursing')
  if (/program|degree|course|curriculum|syllabus|semester|credit/i.test(q))
    namespaces.push('academic')
  if (/alumni|graduate|former student/i.test(q))
    namespaces.push('alumni')
  if (/\b(dental|bds|dentistry|oral)\b/i.test(q))
    namespaces.push('admissions', 'academic')

  // Always include general as fallback
  if (!namespaces.includes('general')) namespaces.push('general')

  return namespaces
}

// ─── Query Expansion ────────────────────────────────────────────────────────────

/**
 * Generates alternative phrasings of a query using Groq for multi-query retrieval.
 * Returns original + up to 2 expansions.
 * On error, gracefully returns just the original query.
 */
async function expandQuery(query: string, apiKey: string): Promise<string[]> {
  if (!apiKey || query.length < 8) return [query]

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Generate exactly 2 alternative phrasings of this university search query. Output ONLY the 2 alternatives on separate lines, no numbering, no explanation.

Original: ${query}

Alternatives:`,
        }],
        temperature: 0.4,
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(4000),
    })

    if (resp.ok) {
      const data = await resp.json()
      const raw = data.choices?.[0]?.message?.content?.trim() || ''
      const alts = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 4)
      return [query, ...alts.slice(0, 2)]
    }
  } catch {
    // Non-fatal — fall through to single query
  }

  return [query]
}

// ─── Vector Search (Multi-query + Multi-namespace) ─────────────────────────────

async function vectorSearch(queries: string[], topK: number = TOP_K_VECTOR): Promise<RankedChunk[]> {
  const index = pineconeIndex.get()
  if (!index) return []

  const allResults: RankedChunk[] = []
  const seen = new Set<string>()

  try {
    // Embed all query variants in one batch call
    const embeddings = await embedBatch(queries)

    for (let qi = 0; qi < queries.length; qi++) {
      const embedding = embeddings[qi]
      const targetNamespaces = getTargetNamespaces(queries[qi])

      // Search primary namespaces, then fall back to global (no namespace filter)
      for (const ns of targetNamespaces) {
        console.log(`[Retrieval Debug] Sending query to namespace ${ns} with vector length ${embedding.length}`)
        const response = await index.namespace(ns).query({
          vector: embedding,
          topK: Math.ceil(topK / Math.max(targetNamespaces.length, 1)),
          includeMetadata: true,
        })

        for (const match of response.matches || []) {
          // Apply minimum score threshold to filter noise
          if ((match.score || 0) < MIN_VECTOR_SCORE) continue
          if (seen.has(match.id)) continue
          seen.add(match.id)

          allResults.push({
            id: match.id,
            score: match.score || 0,
            metadata: (match.metadata || {}) as unknown as ChunkMetadata,
          })
        }
      }

      // Also search global index for comprehensive coverage
      const globalResp = await index.query({
        vector: embedding,
        topK: Math.ceil(topK / 2),
        includeMetadata: true,
      })

      for (const match of globalResp.matches || []) {
        if ((match.score || 0) < MIN_VECTOR_SCORE) continue
        if (seen.has(match.id)) continue
        seen.add(match.id)

        allResults.push({
          id: match.id,
          score: match.score || 0,
          metadata: (match.metadata || {}) as unknown as ChunkMetadata,
        })
      }
    }
  } catch (error) {
    console.error('[Retrieval] Vector search error:', error)
  }

  return allResults
}

// ─── BM25 Keyword Search (PostgreSQL FTS) ─────────────────────────────────────

async function keywordSearch(query: string, topK: number = TOP_K_KEYWORD): Promise<RankedChunk[]> {
  try {
    // Sanitize: remove SQL-dangerous chars
    const sanitized = query.replace(/['\"\\;:]/g, ' ').trim()
    if (!sanitized) return []

    // Use websearch_to_tsquery for phrase matching (e.g. "BSCS 401", "BS Computer Science")
    // Falls back to plainto_tsquery on parse failure
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
      FROM knowledge_entries,
           websearch_to_tsquery('english', ${sanitized}) AS query
      WHERE search_vector @@ query
        AND content_hash IS NOT NULL
      ORDER BY bm25_score DESC
      LIMIT ${topK}
    `.catch(async () => {
      // Fallback: plainto_tsquery for simpler queries that fail websearch parsing
      return sql`
        SELECT
          id, title, content,
          source_url AS "sourceUrl", source_type AS "sourceType",
          page_type AS "pageType", category, breadcrumb,
          content_hash AS "contentHash", chunk_index AS "chunkIndex",
          total_chunks AS "totalChunks", last_scraped_at,
          ts_rank_cd(search_vector, query, 32) AS bm25_score
        FROM knowledge_entries,
             plainto_tsquery('english', ${sanitized}) AS query
        WHERE search_vector @@ query
          AND content_hash IS NOT NULL
        ORDER BY bm25_score DESC
        LIMIT ${topK}
      `
    })

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

function reciprocalRankFusion(
  vectorResults: RankedChunk[],
  keywordResults: RankedChunk[],
  k: number = RRF_K
): RankedChunk[] {
  const scores = new Map<string, { chunk: RankedChunk; rrfScore: number }>()

  // Score from vector ranking (sorted by score desc)
  const sortedVector = [...vectorResults].sort((a, b) => b.score - a.score)
  sortedVector.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + rank + 1)
    scores.set(chunk.id, { chunk, rrfScore })
  })

  // Score from keyword ranking — add to existing or create
  keywordResults.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + rank + 1)
    const existing = scores.get(chunk.id)

    if (existing) {
      // Appears in both lists — significant boost
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

// ─── Fallback DB Scan ─────────────────────────────────────────────────────────

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

export async function hybridRetrieve(
  query: string,
  topK: number = 50,
  options: { expandQueries?: boolean } = { expandQueries: true }
): Promise<RetrievalResult> {
  const pineconeAvailable = !!pineconeIndex.get()
  const apiKey = process.env.GROQ_API_KEY || ''

  let merged: RankedChunk[] = []

  // Ensure query is cleaned
  const cleanQuery = query.trim()
  if (!cleanQuery) return { chunks: [], citations: [], confidence: 'no_data' }

  // ── Run query expansion + search in parallel ──────────────────────────────
  // Use synonyms if options allow or if query is short
  const searchQueries = options.expandQueries
    ? await expandQuery(cleanQuery, apiKey)
    : [cleanQuery]
    
  // If no expansion but synonym expansion is needed for specific terms
  if (/\b(dental|bds|pharmacy|nursing|cs|bba)\b/i.test(cleanQuery.toLowerCase())) {
    const withSynonyms = expandSynonyms(cleanQuery)
    if (withSynonyms !== cleanQuery && !searchQueries.includes(withSynonyms)) {
      searchQueries.push(withSynonyms)
    }
  }

  if (pineconeAvailable) {
    const [vectorResults, keywordResults] = await Promise.all([
      vectorSearch(searchQueries, TOP_K_VECTOR),
      keywordSearch(cleanQuery, TOP_K_KEYWORD),   // FTS always uses original query
    ])

    merged = reciprocalRankFusion(vectorResults, keywordResults)
  } else {
    // Pinecone not available — keyword search only
    const keywordResults = await keywordSearch(query, topK)
    if (keywordResults.length > 0) {
      merged = keywordResults
    } else {
      merged = await fallbackDbSearch(5)
    }
  }

  // ── Deduplicate by content similarity ────────────────────────────────────
  merged = deduplicateByContent(merged)

  // ── Build citations ───────────────────────────────────────────────────────
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

  // ── Confidence scoring ────────────────────────────────────────────────────
  let confidence: ConfidenceLevel = 'no_data'
  const topScore = merged[0]?.rrfScore || merged[0]?.score || 0
  if (merged.length === 0) {
    confidence = 'no_data'
  } else if (merged.length >= 5 && topScore > 0.55) {
    confidence = 'high'
  } else if (merged.length >= 2 && topScore > 0.35) {
    confidence = 'medium'
  } else if (merged.length >= 1) {
    confidence = 'low'
  }

  return { chunks: merged, citations, confidence }
}

// ─── Content Deduplication ────────────────────────────────────────────────────

/**
 * Removes chunks with >70% text overlap to avoid injecting redundant context.
 * Uses a fast character-shingle comparison instead of expensive cosine similarity.
 */
function deduplicateByContent(chunks: RankedChunk[], threshold = 0.70): RankedChunk[] {
  const kept: RankedChunk[] = []
  const keptShingles: Set<string>[] = []

  for (const chunk of chunks) {
    const text = (chunk.metadata.text || '').slice(0, 500).toLowerCase()
    const shingles = buildShingles(text, 5)

    let isDuplicate = false
    for (const existing of keptShingles) {
      const similarity = jaccardSimilarity(shingles, existing)
      if (similarity > threshold) {
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      kept.push(chunk)
      keptShingles.push(shingles)
    }
  }

  return kept
}

function buildShingles(text: string, k: number): Set<string> {
  const shingles = new Set<string>()
  for (let i = 0; i <= text.length - k; i++) {
    shingles.add(text.slice(i, i + k))
  }
  return shingles
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const s of a) {
    if (b.has(s)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}
