import { RankedChunk, PageType } from '@/types'
import { withGroqQueue } from './groq-queue'

/**
 * Enterprise Reranker v2 — Heuristic Pre-filter + LLM Cross-encoder
 *
 * Pipeline (two-stage):
 * Stage 1: Fast heuristic reranker (< 2ms, no API cost)
 *   - TF-IDF term overlap
 *   - Exact phrase match bonus
 *   - Title match bonus
 *   - Page type relevance boost
 *   - Recency boost
 *   - Keyword metadata match boost (NEW — uses keywords extracted during chunking)
 *   → Reduces N candidates to top 10
 *
 * Stage 2: LLM cross-encoder (optional, ~300ms, low cost)
 *   - All 10 candidates sent to Groq in ONE batch call
 *   - LLM scores each chunk 0-10 for query relevance
 *   - Final top 5 selected by LLM score
 *   - Falls back to stage 1 results if LLM fails
 */

// ─── Page type relevance boosts ───────────────────────────────────────────────

const PAGE_TYPE_BOOSTS: Array<{ patterns: RegExp[]; boost: PageType[]; weight: number }> = [
  {
    patterns: [/notice|announce|circular|latest|new|update|today|recent/i],
    boost: ['notice', 'event'],
    weight: 0.25,
  },
  {
    patterns: [/admiss|apply|enroll|join|eligib|require|how to apply|entry test/i],
    boost: ['admissions'],
    weight: 0.25,
  },
  {
    patterns: [/alumni|graduate|former|success|career after/i],
    boost: ['alumni'],
    weight: 0.2,
  },
  {
    patterns: [/scholarship|financial.?aid|merit|bursary|waiver/i],
    boost: ['scholarship'],
    weight: 0.25,
  },
  {
    patterns: [/faculty|professor|staff|teacher|lecturer|dr\.|prof\.|hod|head of department/i],
    boost: ['faculty'],
    weight: 0.25,
  },
  {
    patterns: [/policy|rule|regulation|handbook|code/i],
    boost: ['policy'],
    weight: 0.2,
  },
  {
    patterns: [/fee|tuition|cost|charges?|dues|payment|installment/i],
    boost: ['academic'],
    weight: 0.25,
  },
  {
    patterns: [/contact|phone|email|location|address|office|reach/i],
    boost: ['contact'],
    weight: 0.2,
  },
]

// ─── Utilities ─────────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}

function termOverlapScore(queryTokens: Set<string>, targetText: string): number {
  const targetTokens = tokenize(targetText)
  let matches = 0
  for (const token of queryTokens) {
    if (targetTokens.has(token)) matches++
  }
  return queryTokens.size > 0 ? matches / queryTokens.size : 0
}

function exactPhraseBonus(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  // Reward both exact phrase and word boundary match
  if (text.toLowerCase().includes(q)) return 0.35
  // Partial phrase match (first 3 words of query)
  const partial = q.split(' ').slice(0, 3).join(' ')
  if (partial.length > 6 && text.toLowerCase().includes(partial)) return 0.15
  return 0
}

function titleMatchScore(queryTokens: Set<string>, title: string): number {
  return termOverlapScore(queryTokens, title) * 1.8 // Title is 1.8× more important
}

function pageTypeBoost(query: string, pageType: PageType): number {
  for (const rule of PAGE_TYPE_BOOSTS) {
    if (rule.patterns.some(p => p.test(query))) {
      if (rule.boost.includes(pageType)) {
        return rule.weight
      }
    }
  }
  return 0
}

function recencyBoost(query: string, crawledAt: string): number {
  const isTimeQuery = /latest|recent|today|new|current|this week|this month|2024|2025|2026/i.test(query)
  if (!isTimeQuery || !crawledAt) return 0

  try {
    const ageMs = Date.now() - new Date(crawledAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays <= 1) return 0.30
    if (ageDays <= 7) return 0.20
    if (ageDays <= 30) return 0.10
  } catch {
    // ignore
  }
  return 0
}

/**
 * NEW: Keyword metadata boost.
 * Chunks now store extracted keywords in metadata.
 * If query terms appear in the chunk's keyword list, it's a strong relevance signal.
 */
function keywordMetadataBoost(queryTokens: Set<string>, keywordsStr: string): number {
  if (!keywordsStr) return 0
  const chunkKeywords = new Set(keywordsStr.toLowerCase().split(',').map(k => k.trim()))
  let matches = 0
  for (const token of queryTokens) {
    if (token.length > 3 && chunkKeywords.has(token)) matches++
  }
  return queryTokens.size > 0 ? (matches / queryTokens.size) * 0.3 : 0
}

// ─── Stage 1: Fast Heuristic Reranker ─────────────────────────────────────────

function heuristicRerank(query: string, chunks: RankedChunk[], topN: number): RankedChunk[] {
  if (chunks.length === 0) return []

  const queryTokens = tokenize(query)

  const scored = chunks.map(chunk => {
    const text = chunk.metadata.text || ''
    const title = chunk.metadata.title || ''
    const pageType = chunk.metadata.pageType || 'general'
    const crawledAt = chunk.metadata.crawledAt || ''
    const keywords = (chunk.metadata as any).keywords || ''

    const contentOverlap = termOverlapScore(queryTokens, text)
    const titleMatch = titleMatchScore(queryTokens, title)
    const phraseBonus = exactPhraseBonus(query, text)
    const typeBoost = pageTypeBoost(query, pageType)
    const recency = recencyBoost(query, crawledAt)
    const keywordBoost = keywordMetadataBoost(queryTokens, keywords)

    // Normalize existing RRF/vector score to [0, 1]
    const retrievalScore = Math.min((chunk.rrfScore || chunk.score || 0) * 10, 1)

    const rerankScore =
      retrievalScore  * 0.25 +  // Retrieval score (25%)
      contentOverlap  * 0.20 +  // Content term overlap (20%)
      titleMatch      * 0.20 +  // Title relevance (20%)
      phraseBonus     * 0.15 +  // Exact phrase match (15%)
      keywordBoost    * 0.10 +  // Keyword metadata match (10%)
      typeBoost       * 0.07 +  // Page type alignment (7%)
      recency         * 0.03    // Recency (3%)

    return { ...chunk, rerankScore }
  })

  return scored
    .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
    .slice(0, topN)
}

// ─── Stage 2: LLM Cross-Encoder ───────────────────────────────────────────────

/**
 * Sends top-10 candidates to Groq in ONE batch call for semantic relevance scoring.
 * Returns chunks re-ordered by LLM relevance score (0-10).
 *
 * Uses structured output to get reliable scores.
 * Total cost: ~500 input tokens + ~50 output tokens = negligible.
 * Latency: ~300-500ms (acceptable for university chatbot use case).
 */
async function llmRerank(
  query: string,
  candidates: RankedChunk[],
  apiKey: string,
  topN: number
): Promise<RankedChunk[]> {
  if (!apiKey || candidates.length === 0) return candidates.slice(0, topN)

  // Build a compact representation of all candidates for the LLM prompt
  const candidateTexts = candidates
    .slice(0, 10)
    .map((c, i) => {
      const preview = (c.metadata.text || '').slice(0, 400).replace(/\n/g, ' ')
      return `[${i}] Title: ${c.metadata.title || 'N/A'} | Content: ${preview}`
    })
    .join('\n\n')

  const prompt = `You are a university chatbot relevance judge. Score each knowledge chunk for how useful it is for answering the user's query. Return ONLY a JSON object with a "scores" array containing objects with {"index": number, "score": number} where score is 0-10 (10 = perfectly relevant, 0 = irrelevant).

User Query: "${query}"

Knowledge Chunks:
${candidateTexts}

Scoring criteria:
- Does the chunk directly answer the query?
- Does it mention specific facts (names, dates, fees, program details) relevant to the query?
- Is it from an authoritative page type for this query?

Return JSON object only:`

  try {
    const response = await withGroqQueue(() =>
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(5000),
      })
    )

    if (!response.ok) throw new Error(`Groq ${response.status}`)

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)

    // Handle both {scores: [...]} and [...] formats
    const scoresArr: Array<{ index: number; score: number }> =
      Array.isArray(parsed) ? parsed : (parsed.scores || parsed.rankings || [])

    if (!Array.isArray(scoresArr) || scoresArr.length === 0) {
      throw new Error('Invalid scores format')
    }

    // Map LLM scores back to chunks
    const scoreMap = new Map(scoresArr.map(s => [s.index, s.score || 0]))

    const reranked = candidates
      .slice(0, 10)
      .map((chunk, i) => ({
        ...chunk,
        rerankScore: (scoreMap.get(i) || 0) / 10, // normalize to [0,1]
      }))
      .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))

    console.log(`[Reranker] LLM reranked ${reranked.length} → top ${topN}`)
    return reranked.slice(0, topN)
  } catch (err) {
    console.warn('[Reranker] LLM reranking failed, using heuristic results:', err)
    return candidates.slice(0, topN)
  }
}

// ─── Main Reranker (Public API) ────────────────────────────────────────────────

/**
 * Two-stage reranker.
 * @param query - User query
 * @param chunks - All retrieved candidates (up to 50)
 * @param topN - Final number of chunks to return
 * @param useLLM - Enable LLM cross-encoder stage (default: true for top queries)
 */
export async function rerank(
  query: string,
  chunks: RankedChunk[],
  topN: number = 5,
  useLLM: boolean = true
): Promise<RankedChunk[]> {
  if (chunks.length === 0) return []

  // Stage 1: Fast heuristic pre-filter N → top 10
  const preFiltered = heuristicRerank(query, chunks, Math.min(10, Math.max(topN * 2, 8)))

  // Stage 2: LLM cross-encoder top 10 → top N (only if LLM enabled and > topN results)
  if (useLLM && preFiltered.length > topN) {
    const apiKey = process.env.GROQ_API_KEY || ''
    if (apiKey) {
      return await llmRerank(query, preFiltered, apiKey, topN)
    }
  }

  return preFiltered.slice(0, topN)
}

/**
 * Synchronous heuristic-only rerank (for contexts where async is not possible).
 * @deprecated Use async rerank() instead for better quality.
 */
export function rerankSync(query: string, chunks: RankedChunk[], topN: number = 5): RankedChunk[] {
  return heuristicRerank(query, chunks, topN)
}
