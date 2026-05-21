import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import sql from './db'
import { embedText } from './embeddings'
import { pineconeIndex } from './pinecone'
import { ChunkMetadata } from '@/types'

/**
 * Production-grade upsert for a single knowledge chunk.
 * - Computes content hash for change detection
 * - Stores full rich metadata in both Neon and Pinecone
 * - Skips re-embedding if content hash is unchanged
 */
export async function upsertKnowledgeChunk(params: {
  title: string
  content: string
  category: string
  sourceUrl?: string
  sourceType?: ChunkMetadata['sourceType']
  pageType?: ChunkMetadata['pageType']
  breadcrumb?: string
  chunkIndex?: number
  totalChunks?: number
  parentPageId?: string
  forceUpdate?: boolean
}): Promise<{ success: boolean; id: string; skipped?: boolean; error?: unknown }> {
  const {
    title,
    content,
    category,
    sourceUrl = '',
    sourceType = 'manual',
    pageType = 'general',
    breadcrumb = '',
    chunkIndex = 0,
    totalChunks = 1,
    parentPageId,
    forceUpdate = false,
  } = params

  const contentHash = createHash('md5').update(content).digest('hex')
  const now = new Date().toISOString()

  try {
    // ── Check if this exact chunk already exists (same URL + chunk index) ──────
    const existing = await sql`
      SELECT id, content_hash FROM knowledge_entries
      WHERE source_url = ${sourceUrl}
        AND chunk_index = ${chunkIndex}
        AND source_type = ${sourceType}
      LIMIT 1
    `

    let id: string
    let shouldEmbed = true

    if (existing.length > 0) {
      id = existing[0].id

      // If content hash matches → nothing changed → skip expensive embedding
      if (existing[0].content_hash === contentHash && !forceUpdate) {
        // Still update last_scraped_at so we know we saw this page
        await sql`
          UPDATE knowledge_entries
          SET last_scraped_at = ${now}
          WHERE id = ${id}
        `
        return { success: true, id, skipped: true }
      }

      // Content changed → update record
      await sql`
        UPDATE knowledge_entries
        SET title           = ${title},
            content         = ${content},
            category        = ${category},
            source_url      = ${sourceUrl},
            source_type     = ${sourceType},
            page_type       = ${pageType},
            breadcrumb      = ${breadcrumb},
            content_hash    = ${contentHash},
            chunk_index     = ${chunkIndex},
            total_chunks    = ${totalChunks},
            parent_page_id  = ${parentPageId ?? null},
            last_scraped_at = ${now},
            updated_at      = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `
      shouldEmbed = true
    } else {
      // New entry
      id = uuidv4()
      await sql`
        INSERT INTO knowledge_entries (
          id, title, content, category,
          source_url, source_type, page_type, breadcrumb,
          content_hash, chunk_index, total_chunks, parent_page_id,
          last_scraped_at
        ) VALUES (
          ${id}, ${title}, ${content}, ${category},
          ${sourceUrl}, ${sourceType}, ${pageType}, ${breadcrumb},
          ${contentHash}, ${chunkIndex}, ${totalChunks}, ${parentPageId ?? null},
          ${now}
        )
      `
      shouldEmbed = true
    }

    // ── Embed and upsert to Pinecone ──────────────────────────────────────────
    if (shouldEmbed) {
      const embedding = await embedText(content)
      const index = pineconeIndex.get()

      if (index) {
        const metadata: Record<string, string | number> = {
          text: content.slice(0, 1000), // Pinecone metadata value limit
          title,
          category,
          sourceUrl,
          sourceType,
          pageType,
          breadcrumb,
          contentHash,
          chunkIndex,
          totalChunks,
          crawledAt: now,
        }
        if (parentPageId) metadata.parentPageId = parentPageId

        await index.upsert([{ id, values: embedding, metadata }])
      } else {
        console.warn('[upsertKnowledgeChunk] Pinecone not available — vector not stored.')
      }
    }

    return { success: true, id }
  } catch (error) {
    console.error('[upsertKnowledgeChunk] Error:', error)
    return { success: false, id: '', error }
  }
}

/**
 * Upsert multiple chunks from the same page in batch.
 * All chunks share the same parentPageId for grouping.
 */
export async function upsertPageChunks(params: {
  chunks: Array<{ text: string; chunkIndex: number }>
  title: string
  category: string
  sourceUrl: string
  sourceType: ChunkMetadata['sourceType']
  pageType: ChunkMetadata['pageType']
  breadcrumb: string
  parentPageId: string
  forceUpdate?: boolean
}): Promise<{ upserted: number; skipped: number; failed: number }> {
  const { chunks, parentPageId, forceUpdate, ...shared } = params
  const totalChunks = chunks.length
  let upserted = 0
  let skipped = 0
  let failed = 0

  for (const chunk of chunks) {
    const result = await upsertKnowledgeChunk({
      title: `${shared.title} [${chunk.chunkIndex + 1}/${totalChunks}]`,
      content: chunk.text,
      category: shared.category,
      sourceUrl: shared.sourceUrl,
      sourceType: shared.sourceType,
      pageType: shared.pageType,
      breadcrumb: shared.breadcrumb,
      chunkIndex: chunk.chunkIndex,
      totalChunks,
      parentPageId,
      forceUpdate,
    })

    if (result.success && result.skipped) skipped++
    else if (result.success) upserted++
    else failed++
  }

  return { upserted, skipped, failed }
}

// ── Legacy compatibility shim ────────────────────────────────────────────────
// Keeps the old admin.ts / manual entry flow working unchanged.

export async function upsertKnowledgeEntry(title: string, category: string, content: string) {
  return upsertKnowledgeChunk({ title, content, category, sourceType: 'manual' })
}
