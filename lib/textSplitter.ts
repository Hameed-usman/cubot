import { TextChunk, ChunkMetadata, PageType, SourceType } from '@/types'

/**
 * Production-grade semantic text splitter.
 *
 * Strategy (in order of preference):
 * 1. Split on heading boundaries (## / ### — preserves section context)
 * 2. For oversized sections: split on paragraph boundaries (\n\n)
 * 3. For oversized paragraphs: split on sentence boundaries
 * 4. Always prepend section heading to each chunk (improves retrieval)
 * 5. Applies overlapping context window between chunks
 *
 * Target: ~800 tokens per chunk, ~100 token overlap
 */

const TARGET_CHARS = 3200  // ~800 tokens × 4 chars/token
const OVERLAP_CHARS = 400  // ~100 tokens of overlap
const MIN_CHUNK_CHARS = 80 // Discard trivially short chunks

type SharedMeta = Omit<ChunkMetadata, 'text' | 'chunkIndex' | 'totalChunks'>

/**
 * Main entry point. Splits text into semantically coherent chunks.
 */
export function semanticChunk(text: string, meta: SharedMeta): TextChunk[] {
  const cleaned = cleanText(text)
  if (cleaned.length < MIN_CHUNK_CHARS) return []

  // 1. Try to split by headings first
  const sections = splitBySections(cleaned)
  const rawChunks: string[] = []

  for (const section of sections) {
    const prefix = section.heading ? `${section.heading}\n\n` : ''
    const body = section.content.trim()

    if ((prefix + body).length <= TARGET_CHARS) {
      rawChunks.push((prefix + body).trim())
    } else {
      // 2. Oversized → split by paragraphs
      const paragraphChunks = splitByParagraphs(body, prefix)
      rawChunks.push(...paragraphChunks)
    }
  }

  // 3. Add overlapping context window
  const overlapped = addOverlap(rawChunks)

  // 4. Filter noise and build TextChunk[]
  const totalChunks = overlapped.length
  return overlapped
    .filter(chunk => chunk.trim().length >= MIN_CHUNK_CHARS)
    .map((chunk, index): TextChunk => ({
      text: chunk.trim(),
      metadata: {
        ...meta,
        chunkIndex: index,
        totalChunks,
      },
    }))
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

interface Section {
  heading: string
  content: string
}

/**
 * Splits text into sections by H1/H2/H3 headings.
 * Handles both markdown (## Heading) and plain ALL-CAPS headings.
 */
function splitBySections(text: string): Section[] {
  // Markdown headings
  const mdHeadingRegex = /^(#{1,3} .+)$/m

  if (mdHeadingRegex.test(text)) {
    const parts = text.split(/(?=^#{1,3} )/m)
    return parts
      .filter(p => p.trim())
      .map(part => {
        const lines = part.split('\n')
        const heading = lines[0].replace(/^#+\s*/, '').trim()
        const content = lines.slice(1).join('\n').trim()
        return { heading, content: content || heading }
      })
  }

  // No headings found → treat as single section
  return [{ heading: '', content: text }]
}

/**
 * Splits a text block by paragraph boundaries (\n\n).
 * Prepends heading to each chunk for context preservation.
 * Falls back to sentence splitting if paragraphs are still too large.
 */
function splitByParagraphs(text: string, headingPrefix: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0)
  const chunks: string[] = []
  let current = headingPrefix

  for (const para of paragraphs) {
    if ((current + para).length <= TARGET_CHARS) {
      current += (current.length > headingPrefix.length ? '\n\n' : '') + para
    } else {
      if (current.trim().length >= MIN_CHUNK_CHARS) {
        chunks.push(current.trim())
      }

      // Paragraph itself too large → split by sentences
      if (para.length > TARGET_CHARS) {
        const sentences = splitBySentences(para, headingPrefix)
        chunks.push(...sentences)
        current = headingPrefix
      } else {
        current = headingPrefix + para
      }
    }
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(current.trim())
  }

  return chunks
}

/**
 * Last resort: splits by sentence boundaries.
 */
function splitBySentences(text: string, headingPrefix: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: string[] = []
  let current = headingPrefix

  for (const sentence of sentences) {
    if ((current + sentence).length <= TARGET_CHARS) {
      current += sentence
    } else {
      if (current.trim().length >= MIN_CHUNK_CHARS) {
        chunks.push(current.trim())
      }
      current = headingPrefix + sentence
    }
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(current.trim())
  }

  return chunks
}

/**
 * Adds overlapping context between consecutive chunks.
 * Each chunk (except first) gets the last OVERLAP_CHARS of the previous chunk prepended.
 * This ensures no context is lost at chunk boundaries.
 */
function addOverlap(chunks: string[]): string[] {
  if (chunks.length <= 1) return chunks

  return chunks.map((chunk, i) => {
    if (i === 0) return chunk
    const prevChunk = chunks[i - 1]
    const overlap = prevChunk.slice(-OVERLAP_CHARS)
    // Only prepend overlap if it doesn't duplicate the chunk's start
    if (!chunk.startsWith(overlap.slice(0, 50))) {
      return `[...continued]\n${overlap}\n\n${chunk}`
    }
    return chunk
  })
}

/**
 * Cleans raw extracted text for consistent chunking.
 * Removes excessive whitespace, normalizes line breaks.
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')         // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')           // Tabs → spaces
    .replace(/[ \t]+$/gm, '')       // Trailing whitespace per line
    .replace(/\n{4,}/g, '\n\n\n')   // Max 3 consecutive newlines
    .replace(/[^\S\n]{3,}/g, ' ')   // Multiple spaces → single space
    .trim()
}

// ─── Legacy compatibility ──────────────────────────────────────────────────────

/**
 * Legacy shim — keeps existing ingest.ts working without changes.
 */
export function splitIntoChunks(
  text: string,
  meta: { department: string; fileName: string }
): Array<{ text: string; metadata: { text: string; chunkIndex: number } }> {
  const chunks = semanticChunk(text, {
    title: meta.fileName,
    sourceUrl: '',
    department: meta.department,
    category: meta.department,
    pageType: 'general' as PageType,
    breadcrumb: '',
    sourceType: 'manual' as SourceType,
    contentHash: '',
    crawledAt: new Date().toISOString(),
  })

  return chunks.map(c => ({
    text: c.text,
    metadata: {
      text: c.text,
      chunkIndex: c.metadata.chunkIndex,
      department: meta.department,
      fileName: meta.fileName,
    },
  }))
}