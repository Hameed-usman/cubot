import { ChunkMetadata, TextChunk } from '@/types'

/**
 * Split text into chunks of approximately 500 tokens with 50 token overlap.
 * Uses word count as a proxy for tokens (word count × 1.3 ≈ token count).
 * This is a pure TypeScript implementation with no external dependencies.
 *
 * @param text - The text to split into chunks
 * @param metadata - Metadata to attach to each chunk (excluding text and chunkIndex)
 * @returns TextChunk[] - Array of text chunks with metadata
 */
export function splitIntoChunks(
  text: string,
  metadata: Omit<ChunkMetadata, 'text' | 'chunkIndex'>
): TextChunk[] {
  const chunks: TextChunk[] = []

  // Configuration
  const targetChunkSize = 500 // tokens
  const overlapSize = 50 // tokens

  // Convert to approximate token count (word count × 1.3)
  const words = text.split(/\s+/)
  const totalTokens = Math.floor(words.length * 1.3)

  if (totalTokens <= targetChunkSize) {
    // If text is smaller than chunk size, return as single chunk
    chunks.push({
      text: text.trim(),
      metadata: {
        ...metadata,
        text: text.trim(),
        chunkIndex: 0,
      },
    })
    return chunks
  }

  // Calculate chunk boundaries
  const tokensPerWord = 1.3
  const wordsPerChunk = Math.floor(targetChunkSize / tokensPerWord)
  const wordsPerOverlap = Math.floor(overlapSize / tokensPerWord)

  let startIndex = 0
  let chunkIndex = 0

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + wordsPerChunk, words.length)
    const chunkText = words.slice(startIndex, endIndex).join(' ').trim()

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        metadata: {
          ...metadata,
          text: chunkText,
          chunkIndex,
        },
      })
    }

    // Move start index forward, accounting for overlap
    startIndex = endIndex - wordsPerOverlap
    chunkIndex++

    // Prevent infinite loop if overlap is too large
    if (startIndex <= 0 || startIndex >= words.length) {
      break
    }
  }

  return chunks
}