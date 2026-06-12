import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Production-grade embedding module using Google gemini-embedding-001.
 *
 * gemini-embedding-001 natively outputs 3072-dim vectors, but supports
 * Matryoshka Representation Learning (MRL) — allowing truncation to smaller
 * sizes (128, 768, 1536, 3072) without retraining.
 *
 * We request 768 dimensions via `outputDimensionality` so vectors match the
 * existing Pinecone index (768-dim) without requiring a rebuild.
 *
 * Falls back gracefully if GEMINI_API_KEY is not set (for local dev without keys).
 */

const EMBEDDING_MODEL = 'gemini-embedding-001'
const OUTPUT_DIMENSIONALITY = 768  // MRL truncation — matches Pinecone index dimension
const BATCH_SIZE = 100             // Gemini API batch limit
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

let embeddingClient: GoogleGenerativeAI | null = null

function getEmbeddingClient(): GoogleGenerativeAI | null {
  if (embeddingClient) return embeddingClient
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[Embeddings] GEMINI_API_KEY not set — real embeddings unavailable.')
    return null
  }
  embeddingClient = new GoogleGenerativeAI(apiKey)
  return embeddingClient
}

/**
 * Sleep utility for retry backoff.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Embed a single text string using gemini-embedding-001 with MRL truncation to 768-dim.
 * Returns a real 768-dimensional semantic vector compatible with the Pinecone index.
 * Retries up to 3 times on transient failures.
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getEmbeddingClient()

  if (!client) {
    // Graceful degradation: return zero vector (retrieval will still work, just poorly)
    console.warn('[Embeddings] Returning zero vector — configure GEMINI_API_KEY for real embeddings.')
    return new Array(OUTPUT_DIMENSIONALITY).fill(0)
  }

  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL })
  const cleanText = text.trim().slice(0, 10000) // Gemini token limit safety

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text: cleanText }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        // MRL: truncate from 3072 → 768 to match Pinecone index
        outputDimensionality: OUTPUT_DIMENSIONALITY,
      } as any)
      return result.embedding.values
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || error?.message?.includes('429')
      const isLastAttempt = attempt === RETRY_ATTEMPTS

      if (isLastAttempt) {
        console.error(`[Embeddings] Failed after ${RETRY_ATTEMPTS} attempts:`, error?.message)
        throw error
      }

      const delay = isRateLimit ? RETRY_DELAY_MS * attempt * 2 : RETRY_DELAY_MS * attempt
      console.warn(`[Embeddings] Attempt ${attempt} failed (${error?.message}). Retrying in ${delay}ms...`)
      await sleep(delay)
    }
  }

  return new Array(OUTPUT_DIMENSIONALITY).fill(0)
}

/**
 * Embed multiple texts in batches using gemini-embedding-001 with MRL truncation to 768-dim.
 * Respects Gemini's batch limits and includes rate-limit-safe delays between batches.
 *
 * @param texts - Array of strings to embed
 * @returns Array of 768-dimensional vectors, in the same order as input
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getEmbeddingClient()

  if (!client) {
    console.warn('[Embeddings] Returning zero vectors — configure GEMINI_API_KEY.')
    return texts.map(() => new Array(OUTPUT_DIMENSIONALITY).fill(0))
  }

  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL })
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const batchResults = await Promise.all(
          batch.map(async (text) => {
            const clean = text.trim().slice(0, 10000)
            const res = await model.embedContent({
              content: { role: 'user', parts: [{ text: clean }] },
              taskType: 'RETRIEVAL_DOCUMENT',
              // MRL: truncate from 3072 → 768 to match Pinecone index
              outputDimensionality: OUTPUT_DIMENSIONALITY,
            } as any)
            return res.embedding.values
          })
        )
        results.push(...batchResults)

        // Polite delay between batches to avoid rate limits
        if (i + BATCH_SIZE < texts.length) {
          await sleep(200)
        }
        break
      } catch (error: any) {
        if (attempt === RETRY_ATTEMPTS) {
          console.error(`[Embeddings] Batch ${i / BATCH_SIZE + 1} failed:`, error?.message)
          // Push zero vectors for failed batch so pipeline doesn't break
          results.push(...batch.map(() => new Array(OUTPUT_DIMENSIONALITY).fill(0)))
        } else {
          const delay = RETRY_DELAY_MS * attempt * 2
          console.warn(`[Embeddings] Batch attempt ${attempt} failed. Retrying in ${delay}ms...`)
          await sleep(delay)
        }
      }
    }
  }

  return results
}