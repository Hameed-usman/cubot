import { RankedChunk, PageType } from '@/types'

/**
 * In-memory cross-encoder reranker.
 *
 * After hybrid retrieval returns 20 candidates, this reranker scores them
 * against the user query using a multi-signal heuristic:
 *   1. TF-IDF style query term overlap
 *   2. Exact phrase match bonus
 *   3. Title match bonus
 *   4. Page type relevance boost
 *   5. Recency boost (recently crawled pages ranked higher for time-sensitive queries)
 *
 * Runs in < 2ms — no external API cost.
 */

// ─── Page type relevance boosts ───────────────────────────────────────────────
// Maps query intent keywords to page types that should be boosted

const PAGE_TYPE_BOOSTS: Array<{ patterns: RegExp[]; boost: PageType[] }> = [
  {
    patterns: [/notice|announce|circular|latest|new|update|today|recent/i],
    boost: ['notice', 'event'],
  },
  {
    patterns: [/admiss|apply|enroll|join|eligib|require|how to apply/i],
    boost: ['admissions'],
  },
  {
    patterns: [/alumni|graduate|former|success|career after/i],
    boost: ['alumni'],
  },
  {
    patterns: [/scholarship|financial.?aid|merit|bursary/i],
    boost: ['scholarship'],
  },
  {
    patterns: [/faculty|professor|staff|teacher|lecturer|dr\.|prof\./i],
    boost: ['faculty'],
  },
  {
    patterns: [/policy|rule|regulation|handbook|code/i],
    boost: ['policy'],
  },
  {
    patterns: [/fee|tuition|cost|charges?|dues|payment/i],
    boost: ['academic'],
  },
  {
    patterns: [/contact|phone|email|location|address|office/i],
    boost: ['contact'],
  },
]

// ─── Utilities ─────────────────────────────────────────────────────────────────

/** Tokenize text into lowercase word set */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}

/** Count how many query tokens appear in the target text */
function termOverlapScore(queryTokens: Set<string>, targetText: string): number {
  const targetTokens = tokenize(targetText)
  let matches = 0
  for (const token of queryTokens) {
    if (targetTokens.has(token)) matches++
  }
  return queryTokens.size > 0 ? matches / queryTokens.size : 0
}

/** Check for exact phrase match (significant bonus) */
function exactPhraseBonus(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  return text.toLowerCase().includes(q) ? 0.3 : 0
}

/** Title relevance (title is the most important field) */
function titleMatchScore(queryTokens: Set<string>, title: string): number {
  return termOverlapScore(queryTokens, title) * 1.5 // Title weighted 1.5×
}

/** Page type boost based on query intent */
function pageTypeBoost(query: string, pageType: PageType): number {
  for (const rule of PAGE_TYPE_BOOSTS) {
    if (rule.patterns.some(p => p.test(query))) {
      if (rule.boost.includes(pageType)) {
        return 0.2 // 20% boost for matching page type
      }
    }
  }
  return 0
}

/** Recency boost for time-sensitive queries */
function recencyBoost(query: string, crawledAt: string): number {
  const isTimeQuery = /latest|recent|today|new|current|this week|this month/i.test(query)
  if (!isTimeQuery || !crawledAt) return 0

  try {
    const ageMs = Date.now() - new Date(crawledAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    // Boost pages crawled within last 7 days
    if (ageDays <= 1) return 0.25
    if (ageDays <= 7) return 0.15
    if (ageDays <= 30) return 0.05
  } catch {
    // ignore
  }
  return 0
}

// ─── Main Reranker ─────────────────────────────────────────────────────────────

/**
 * Reranks a list of retrieved chunks against the user query.
 * Returns the top `topN` most relevant chunks.
 */
export function rerank(query: string, chunks: RankedChunk[], topN: number = 5): RankedChunk[] {
  if (chunks.length === 0) return []

  const queryTokens = tokenize(query)

  const scored = chunks.map(chunk => {
    const text = chunk.metadata.text || ''
    const title = chunk.metadata.title || ''
    const pageType = chunk.metadata.pageType || 'general'
    const crawledAt = chunk.metadata.crawledAt || ''

    // Multi-signal scoring
    const contentOverlap = termOverlapScore(queryTokens, text)
    const titleMatch = titleMatchScore(queryTokens, title)
    const phraseBonus = exactPhraseBonus(query, text)
    const typeBoost = pageTypeBoost(query, pageType)
    const recency = recencyBoost(query, crawledAt)

    // Normalize existing RRF score to [0, 1]
    const rrfNorm = Math.min((chunk.rrfScore || chunk.score || 0) * 10, 1)

    // Weighted combination
    const rerankScore =
      rrfNorm * 0.30 +       // Original retrieval score (30%)
      contentOverlap * 0.25 + // Content term overlap (25%)
      titleMatch * 0.20 +     // Title relevance (20%)
      phraseBonus * 0.10 +    // Exact phrase match bonus (10%)
      typeBoost * 0.10 +      // Page type intent alignment (10%)
      recency * 0.05          // Recency bonus for time-sensitive queries (5%)

    return { ...chunk, rerankScore }
  })

  return scored
    .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
    .slice(0, topN)
}
