import { TextChunk, ChunkMetadata, PageType, SourceType } from '@/types'

/**
 * Enterprise Semantic Text Splitter — v2
 *
 * Strategy (ordered by preference):
 * 1. Split on heading boundaries (##/### — preserves section context)
 * 2. For oversized sections: split on paragraph boundaries (\n\n)
 * 3. For oversized paragraphs: split on sentence boundaries
 * 4. Prepend section heading to every chunk (critical for retrieval quality)
 * 5. Overlapping context window between chunks (no lost context at boundaries)
 * 6. Extract top keywords per chunk (stored in metadata for reranker)
 * 7. Track section name per chunk (enables section-targeted retrieval)
 *
 * FIXES vs v1:
 * - TARGET_CHARS: 3200 → 2000 (~512 tokens — optimal embedding quality)
 * - OVERLAP_CHARS: 400 → 600 (25-30% overlap prevents context loss)
 * - Added keyword extraction per chunk
 * - Added section name tracking in metadata
 * - Added min content quality gate (rejects nav/footer boilerplate)
 */

const TARGET_CHARS = 2000  // ~500 tokens × 4 chars/token — optimal for text-embedding-004
const OVERLAP_CHARS = 600  // ~150 tokens of overlap — prevents boundary context loss
const MIN_CHUNK_CHARS = 80 // Discard trivially short chunks (navigation remnants)

// Words to ignore when extracting keywords (stop words)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'this', 'that', 'these', 'those',
  'it', 'its', 'they', 'their', 'we', 'our', 'you', 'your', 'he', 'she',
  'his', 'her', 'all', 'any', 'each', 'both', 'more', 'most', 'other',
  'some', 'such', 'into', 'about', 'up', 'out', 'as', 'if', 'then',
  'than', 'so', 'no', 'not', 'also', 'which', 'who', 'what', 'how',
  'when', 'where', 'why', 'can', 'page', 'click', 'here', 'read', 'view',
])

// Patterns that indicate boilerplate/navigation content — skipped during chunking
const BOILERPLATE_PATTERNS = [
  /^(home|back|next|previous|menu|navigation|click here|read more|learn more|see all)$/i,
  /^(copyright|all rights reserved|terms|privacy|cookie)/i,
  /^\s*\|\s*$/, // Pure separator lines
]

type SharedMeta = Omit<ChunkMetadata, 'text' | 'chunkIndex' | 'totalChunks'>

// ─── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Splits text into semantically coherent chunks with rich metadata.
 */
export function semanticChunk(text: string, meta: SharedMeta): TextChunk[] {
  const cleaned = cleanText(text)
  if (cleaned.length < MIN_CHUNK_CHARS) return []

  // 1. Split by sections (heading-aware)
  const sections = splitBySections(cleaned)
  const rawChunks: Array<{ text: string; sectionName: string }> = []

  for (const section of sections) {
    const prefix = section.heading ? `${section.heading}\n\n` : ''
    const body = section.content.trim()
    const combined = (prefix + body).trim()

    // Skip boilerplate sections
    if (isBoilerplate(body)) continue

    if (combined.length <= TARGET_CHARS) {
      rawChunks.push({ text: combined, sectionName: section.heading })
    } else {
      // 2. Oversized → split by paragraphs
      const paragraphChunks = splitByParagraphs(body, prefix)
      for (const pc of paragraphChunks) {
        rawChunks.push({ text: pc, sectionName: section.heading })
      }
    }
  }

  // 3. Add overlapping context window
  const overlapped = addOverlap(rawChunks)

  // 4. Filter noise and build TextChunk[]
  const totalChunks = overlapped.length

  return overlapped
    .filter(chunk => chunk.text.trim().length >= MIN_CHUNK_CHARS)
    .map((chunk, index): TextChunk => {
      const keywords = extractKeywords(chunk.text, 8)
      return {
        text: chunk.text.trim(),
        metadata: {
          ...meta,
          chunkIndex: index,
          totalChunks,
          keywords,
          sectionName: chunk.sectionName,
        } as ChunkMetadata & { keywords: string[]; sectionName: string },
      }
    })
}

// ─── Section Splitter ──────────────────────────────────────────────────────────

interface Section {
  heading: string
  content: string
}

/**
 * Splits text into sections by H1/H2/H3 headings.
 * Handles markdown (## Heading) and all-caps headers (ADMISSION REQUIREMENTS).
 */
function splitBySections(text: string): Section[] {
  // Markdown headings (##, ###)
  if (/^#{1,3} .+/m.test(text)) {
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

  // ALL-CAPS headings (common in scraped university pages)
  if (/^[A-Z][A-Z\s]{5,50}$/m.test(text)) {
    const parts = text.split(/(?=^[A-Z][A-Z\s]{5,50}$)/m)
    return parts
      .filter(p => p.trim())
      .map(part => {
        const lines = part.split('\n')
        const heading = lines[0].trim()
        const content = lines.slice(1).join('\n').trim()
        return { heading, content: content || heading }
      })
  }

  // No headings found → single section
  return [{ heading: '', content: text }]
}

// ─── Paragraph Splitter ────────────────────────────────────────────────────────

function splitByParagraphs(text: string, headingPrefix: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0)
  const chunks: string[] = []
  let current = headingPrefix

  for (const para of paragraphs) {
    if (isBoilerplate(para)) continue

    if ((current + para).length <= TARGET_CHARS) {
      current += (current.length > headingPrefix.length ? '\n\n' : '') + para
    } else {
      if (current.trim().length >= MIN_CHUNK_CHARS) {
        chunks.push(current.trim())
      }

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

// ─── Sentence Splitter ─────────────────────────────────────────────────────────

function splitBySentences(text: string, headingPrefix: string): string[] {
  // Improved sentence regex: handles abbreviations like Dr., Mr., B.Sc. etc.
  const sentences = text.match(/[^.!?]+(?:[.!?](?!\s+[a-z])[^.!?]*)*[.!?]*/g) || [text]
  const chunks: string[] = []
  let current = headingPrefix

  for (const sentence of sentences) {
    const s = sentence.trim()
    if (!s) continue

    if ((current + s).length <= TARGET_CHARS) {
      current += (current !== headingPrefix ? ' ' : '') + s
    } else {
      if (current.trim().length >= MIN_CHUNK_CHARS) {
        chunks.push(current.trim())
      }
      current = headingPrefix + s
    }
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(current.trim())
  }

  return chunks
}

// ─── Overlap Injection ─────────────────────────────────────────────────────────

/**
 * Adds overlapping context between consecutive chunks.
 * Each chunk (except first) gets the last OVERLAP_CHARS of the previous chunk prepended.
 * This ensures no critical context is lost at chunk boundaries.
 */
function addOverlap(
  chunks: Array<{ text: string; sectionName: string }>
): Array<{ text: string; sectionName: string }> {
  if (chunks.length <= 1) return chunks

  return chunks.map((chunk, i) => {
    if (i === 0) return chunk
    const prevChunk = chunks[i - 1]
    const overlap = prevChunk.text.slice(-OVERLAP_CHARS)

    // Don't duplicate if chunk already starts with similar content
    if (chunk.text.startsWith(overlap.slice(0, 40))) return chunk

    return {
      text: `[...continued]\n${overlap}\n\n${chunk.text}`,
      sectionName: chunk.sectionName,
    }
  })
}

// ─── Keyword Extraction ────────────────────────────────────────────────────────

/**
 * Extracts top-N keywords from a text chunk.
 * Uses TF scoring (term frequency in chunk) to surface the most important terms.
 * Filters stop words, short words, and numeric-only tokens.
 *
 * Stored in chunk metadata — used by reranker for exact term match scoring.
 */
export function extractKeywords(text: string, topN = 8): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))

  // Count term frequency
  const freq = new Map<string, number>()
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1)
  }

  // Boost multi-word candidates (bigrams that appear together)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`
    if (bigram.length > 8 && bigram.length < 40) {
      freq.set(bigram, (freq.get(bigram) || 0) + 1.5) // Bigrams weighted higher
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word)
}

// ─── Text Cleaner ─────────────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')        // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')          // Tabs → spaces
    .replace(/[ \t]+$/gm, '')      // Trailing whitespace per line
    .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
    .replace(/[^\S\n]{3,}/g, ' ') // Multiple spaces → single space
    // Remove repeated lines (common in poorly-scraped pages)
    .split('\n')
    .filter((line, idx, arr) => idx === 0 || line.trim() !== arr[idx - 1].trim())
    .join('\n')
    .trim()
}

// ─── Boilerplate Detection ─────────────────────────────────────────────────────

function isBoilerplate(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 5) return true
  return BOILERPLATE_PATTERNS.some(p => p.test(trimmed))
}

// ─── Legacy Compatibility Shim ────────────────────────────────────────────────

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