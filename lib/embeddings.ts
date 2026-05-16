import { isGeminiConfigured } from './gemini'

/**
 * Embed text using a simple hash-based approach as a workaround.
 * For production, you would use a proper embedding service.
 *
 * This creates a deterministic 768-dimensional vector from text hash.
 */

function simpleHashEmbedding(text: string): number[] {
  // Create a simple 768-dim embedding from text hash
  const embedding: number[] = []
  for (let i = 0; i < 768; i++) {
    let hash = 0
    for (let j = 0; j < text.length; j++) {
      hash = ((hash << 5) - hash + text.charCodeAt(j) + i) | 0
    }
    embedding.push((Math.sin(hash) + 1) / 2) // Normalize to 0-1
  }
  return embedding
}

/**
 * Embed a single text.
 * @param text - The text to embed
 * @returns Promise<number[]> - 768-dimensional embedding vector
 */
export async function embedText(text: string): Promise<number[]> {
  // For now, use simple hash-based embedding
  // In production, replace with a proper embedding API
  return simpleHashEmbedding(text)
}

/**
 * Embed multiple texts in batch.
 * @param texts - Array of texts to embed
 * @returns Promise<number[][]> - Array of 768-dimensional vectors
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  return texts.map(text => simpleHashEmbedding(text))
}