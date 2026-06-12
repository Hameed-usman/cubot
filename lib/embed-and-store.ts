import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import sql from './db'
import { embedText, embedBatch } from './embeddings'
import { pineconeIndex } from './pinecone'
import { ChunkMetadata } from '@/types'

/**
 * Maps a category/pageType string to a stable Pinecone namespace.
 * Namespaces isolate vectors by domain, dramatically improving cosine similarity
 * recall at scale (300+ pages) by reducing the search pool to relevant vectors only.
 */
export function categoryToNamespace(category: string): string {
  const cat = (category || '').toLowerCase().trim()
  if (/facult|staff|professor|lecturer|instructor|dean|rector|director/i.test(cat)) return 'faculty'
  if (/admiss|apply|enroll|eligib/i.test(cat)) return 'admissions'
  if (/scholarship|financial.?aid|merit|bursary/i.test(cat)) return 'scholarships'
  if (/fee|tuition|cost|charges?|finance|dues/i.test(cat)) return 'finance'
  if (/notice|announcement|news|circular|bulletin/i.test(cat)) return 'notices'
  if (/event|seminar|workshop|conference|ceremony|webinar/i.test(cat)) return 'events'
  if (/policy|rule|regulation|handbook|code.?of.?conduct/i.test(cat)) return 'policies'
  if (/contact|location|address|phone|email/i.test(cat)) return 'contact'
  if (/cs|cse|it|software|computer.?science|bscs|bsit|bsse/i.test(cat)) return 'dept-cs'
  if (/bba|mba|business|management|commerce/i.test(cat)) return 'dept-bba'
  if (/pharm/i.test(cat)) return 'dept-pharmacy'
  if (/nurs/i.test(cat)) return 'dept-nursing'
  if (/academic|curriculum|course|syllabus|semester|program|degree/i.test(cat)) return 'academic'
  if (/alumni|graduate|former/i.test(cat)) return 'alumni'
  return 'general'
}

/**
 * Pinecone metadata has an 8KB total limit per vector.
 * We store trimmed text to stay well within limits while preserving reranker quality.
 */
const PINECONE_TEXT_LIMIT = 6000 // chars — gives reranker full working context

// ─── Single Chunk Upsert ───────────────────────────────────────────────────────

/**
 * Production-grade upsert for a single knowledge chunk.
 * - Computes content hash for change detection
 * - Stores full rich metadata in both Neon and Pinecone
 * - Skips re-embedding if content hash is unchanged
 * - Routes to correct Pinecone namespace based on category
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
  keywords?: string[]
  sectionName?: string
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
    keywords = [],
    sectionName = '',
  } = params

  const contentHash = createHash('md5').update(content).digest('hex')
  const now = new Date().toISOString()
  const namespace = categoryToNamespace(category)

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
          // FIX: was 1000 chars — reranker had NO useful context. Now 6000 chars.
          text: content.slice(0, PINECONE_TEXT_LIMIT),
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
          namespace,
          embeddingVersion: 'gemini-embedding-001',
        }
        if (parentPageId) metadata.parentPageId = parentPageId
        if (sectionName) metadata.sectionName = sectionName
        if (keywords.length > 0) metadata.keywords = keywords.join(',')

        // Upsert into the correct namespace for better recall at scale
        await index.namespace(namespace).upsert([{ id, values: embedding, metadata }])
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

// ─── Batch Page Upsert (Parallel) ─────────────────────────────────────────────

/**
 * Upsert multiple chunks from the same page — with PARALLEL batch embedding.
 *
 * FIX: Old code embedded chunks one-by-one in a sequential for-loop.
 * With 300+ pages × 5 chunks avg = 1500+ sequential Gemini API calls.
 * This caused ingestion to take 45+ minutes and often timeout mid-crawl,
 * leaving the Pinecone index partially populated.
 *
 * New approach:
 * - Check which chunks actually need re-embedding (hash comparison)
 * - Batch-embed all new/changed chunks in one call to embedBatch()
 * - Upsert all vectors to Pinecone in one batch call
 * - DB writes remain sequential (to avoid transaction conflicts)
 */
export async function upsertPageChunks(params: {
  chunks: Array<{ text: string; chunkIndex: number; keywords?: string[]; sectionName?: string }>
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
  const namespace = categoryToNamespace(shared.category)
  const now = new Date().toISOString()
  
  // Upsert scraped_page
  const contentHash = chunks.length > 0 ? createHash('md5').update(chunks.map(c => c.text).join('')).digest('hex') : ''
  let scrapedPageId = uuidv4()
  try {
    const pageRes = await sql`
      INSERT INTO scraped_pages (id, url, title, content_hash, chunk_count, pinecone_sync_status, crawl_status, last_scraped_at)
      VALUES (${scrapedPageId}, ${shared.sourceUrl}, ${shared.title}, ${contentHash}, ${totalChunks}, 'pending', 'success', ${now})
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        content_hash = EXCLUDED.content_hash,
        chunk_count = EXCLUDED.chunk_count,
        pinecone_sync_status = 'pending',
        crawl_status = 'success',
        last_scraped_at = EXCLUDED.last_scraped_at,
        deleted_at = NULL
      RETURNING id
    `
    if (pageRes.length > 0) scrapedPageId = pageRes[0].id
  } catch (e) {
    console.warn('scraped_pages insert failed:', e)
  }

  let upserted = 0
  let skipped = 0
  let failed = 0

  // ── Step 1: Check existing hashes in DB (batch query) ─────────────────────
  const existingRows = await sql`
    SELECT id, chunk_index, content_hash
    FROM knowledge_entries
    WHERE source_url = ${shared.sourceUrl}
      AND source_type = ${shared.sourceType}
  `.catch(() => [] as Array<{ id: string; chunk_index: number; content_hash: string }>)

  const existingMap = new Map(existingRows.map(r => [r.chunk_index, r]))

  // ── Step 2: Compute hashes and find which chunks need update ───────────────
  const toEmbed: Array<{
    idx: number
    text: string
    id: string
    isNew: boolean
    keywords: string[]
    sectionName: string
  }> = []

  for (const chunk of chunks) {
    const hash = createHash('md5').update(chunk.text).digest('hex')
    const existing = existingMap.get(chunk.chunkIndex)

    if (existing && existing.content_hash === hash && !forceUpdate) {
      // Touch timestamp only
      await sql`
        UPDATE knowledge_entries SET last_scraped_at = ${now} WHERE id = ${existing.id}
      `.catch(() => {})
      skipped++
      continue
    }

    const id = existing ? existing.id : uuidv4()
    toEmbed.push({
      idx: chunk.chunkIndex,
      text: chunk.text,
      id,
      isNew: !existing,
      keywords: chunk.keywords || [],
      sectionName: chunk.sectionName || '',
    })
  }

  if (toEmbed.length === 0) return { upserted: 0, skipped, failed }

  // ── Step 3: Batch-embed all changed chunks in one API call ─────────────────
  let embeddings: number[][] = []
  try {
    embeddings = await embedBatch(toEmbed.map(c => c.text))
  } catch (err) {
    console.error('[upsertPageChunks] Batch embedding failed:', err)
    return { upserted, skipped, failed: toEmbed.length }
  }

  // ── Step 4: DB upserts + Pinecone batch upsert ─────────────────────────────
  const pineconeVectors: Array<{ id: string; values: number[]; metadata: Record<string, string | number> }> = []

  for (let i = 0; i < toEmbed.length; i++) {
    const chunk = toEmbed[i]
    const embedding = embeddings[i]
    const hash = createHash('md5').update(chunk.text).digest('hex')
    const titleWithIndex = `${shared.title} [${chunk.idx + 1}/${totalChunks}]`

    try {
      if (chunk.isNew) {
        await sql`
          INSERT INTO knowledge_entries (
            id, title, content, category,
            source_url, source_type, page_type, breadcrumb,
            content_hash, chunk_index, total_chunks, parent_page_id,
            last_scraped_at
          ) VALUES (
            ${chunk.id}, ${titleWithIndex}, ${chunk.text}, ${shared.category},
            ${shared.sourceUrl}, ${shared.sourceType}, ${shared.pageType}, ${shared.breadcrumb},
            ${hash}, ${chunk.idx}, ${totalChunks}, ${parentPageId},
            ${now}
          )
        `
        
        await sql`
          INSERT INTO document_chunks (scraped_page_id, chunk_index, text_content, embedding_version, pinecone_id)
          VALUES (${scrapedPageId}, ${chunk.idx}, ${chunk.text}, 'gemini-embedding-001', ${chunk.id})
        `.catch(() => {})
      } else {
        await sql`
          UPDATE knowledge_entries
          SET title           = ${titleWithIndex},
              content         = ${chunk.text},
              category        = ${shared.category},
              source_url      = ${shared.sourceUrl},
              source_type     = ${shared.sourceType},
              page_type       = ${shared.pageType},
              breadcrumb      = ${shared.breadcrumb},
              content_hash    = ${hash},
              chunk_index     = ${chunk.idx},
              total_chunks    = ${totalChunks},
              parent_page_id  = ${parentPageId},
              last_scraped_at = ${now},
              updated_at      = CURRENT_TIMESTAMP
          WHERE id = ${chunk.id}
        `
      }

      // Build Pinecone vector
      const metadata: Record<string, string | number> = {
        text: chunk.text.slice(0, PINECONE_TEXT_LIMIT), // FIX: was 1000
        title: titleWithIndex,
        category: shared.category,
        sourceUrl: shared.sourceUrl,
        sourceType: shared.sourceType,
        pageType: shared.pageType,
        breadcrumb: shared.breadcrumb,
        contentHash: hash,
        chunkIndex: chunk.idx,
        totalChunks,
        crawledAt: now,
        namespace,
        embeddingVersion: 'gemini-embedding-001',
      }
      if (parentPageId) metadata.parentPageId = parentPageId
      if (chunk.sectionName) metadata.sectionName = chunk.sectionName
      if (chunk.keywords.length > 0) metadata.keywords = chunk.keywords.join(',')

      pineconeVectors.push({ id: chunk.id, values: embedding, metadata })
      upserted++
    } catch (err) {
      console.error(`[upsertPageChunks] DB error for chunk ${chunk.idx}:`, err)
      failed++
    }
  }

  // ── Step 5: Batch upsert all new/changed vectors to Pinecone ──────────────
  if (pineconeVectors.length > 0) {
    const index = pineconeIndex.get()
    if (index) {
      try {
        // Pinecone supports batch upserts of up to 100 vectors
        const PINECONE_BATCH = 100
        for (let i = 0; i < pineconeVectors.length; i += PINECONE_BATCH) {
          const batch = pineconeVectors.slice(i, i + PINECONE_BATCH)
          await index.namespace(namespace).upsert(batch)
        }
        await sql`UPDATE scraped_pages SET pinecone_sync_status = 'synced' WHERE id = ${scrapedPageId}`.catch(() => {})
      } catch (err) {
        console.error('[upsertPageChunks] Pinecone batch upsert error:', err)
        await sql`UPDATE scraped_pages SET pinecone_sync_status = 'failed' WHERE id = ${scrapedPageId}`.catch(() => {})
      }
    }
  }

  return { upserted, skipped, failed }
}

// ── Legacy compatibility shim ────────────────────────────────────────────────
// Keeps the old admin.ts / manual entry flow working unchanged.

export async function upsertKnowledgeEntry(title: string, category: string, content: string) {
  return upsertKnowledgeChunk({ title, content, category, sourceType: 'manual' })
}
