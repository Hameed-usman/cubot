import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/duplicates
 * Detect duplicate URLs, chunks (by content hash), and knowledge entries.
 */
export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    // 1. Duplicate URLs (same source_url with multiple entries groups)
    const duplicateUrls = await sql`
      SELECT
        source_url,
        COUNT(*) as entry_count,
        COUNT(DISTINCT content_hash) as unique_hashes,
        array_agg(id::TEXT ORDER BY created_at ASC) as entry_ids,
        MIN(created_at) as first_seen,
        MAX(updated_at) as last_updated
      FROM knowledge_entries
      WHERE source_url IS NOT NULL AND source_url != ''
      GROUP BY source_url
      HAVING COUNT(*) > (SELECT COALESCE(MIN(total_chunks), 0) + 1 FROM knowledge_entries ke2 WHERE ke2.source_url = knowledge_entries.source_url LIMIT 1)
      ORDER BY entry_count DESC
      LIMIT 50
    `

    // 2. Duplicate content (same content_hash across DIFFERENT URLs)
    const duplicateContent = await sql`
      SELECT
        content_hash,
        COUNT(*) as occurrence_count,
        array_agg(id::TEXT ORDER BY created_at ASC) as entry_ids,
        array_agg(DISTINCT source_url) as source_urls,
        MIN(content) as content_preview,
        MIN(created_at) as first_seen
      FROM knowledge_entries
      WHERE content_hash IS NOT NULL
      GROUP BY content_hash
      HAVING COUNT(*) > 1
      ORDER BY occurrence_count DESC
      LIMIT 50
    `

    // 3. Duplicate scraped pages (same URL in scraped_pages multiple times — shouldn't happen due to UNIQUE constraint, but check)
    const duplicateScrapedPages = await sql`
      SELECT
        url,
        COUNT(*) as count,
        array_agg(id::TEXT) as page_ids
      FROM scraped_pages
      GROUP BY url
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `

    // 4. Entries with same title + category (potential logical duplicates)
    const similarEntries = await sql`
      SELECT
        title,
        category,
        COUNT(*) as count,
        array_agg(id::TEXT ORDER BY created_at ASC) as entry_ids,
        array_agg(DISTINCT source_url) as source_urls
      FROM knowledge_entries
      GROUP BY title, category
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 30
    `

    // Summary counts
    const summary = {
      duplicateUrlGroups: duplicateUrls.length,
      duplicateContentGroups: duplicateContent.length,
      duplicatePageGroups: duplicateScrapedPages.length,
      similarEntryGroups: similarEntries.length,
      totalDuplicateEntries: duplicateContent.reduce(
        (sum: number, row: any) => sum + parseInt(row.occurrence_count || '0', 10) - 1,
        0
      ),
    }

    return NextResponse.json({
      summary,
      duplicateUrls,
      duplicateContent,
      duplicateScrapedPages,
      similarEntries,
    })
  } catch (err: any) {
    console.error('[DuplicatesGET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/duplicates
 * Remove duplicate entries, keeping the oldest (original) record.
 * Body: { type: 'content' | 'entries', keepIds: string[], removeIds: string[] }
 */
export async function DELETE(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { removeIds, type } = await req.json()

    if (!Array.isArray(removeIds) || removeIds.length === 0) {
      return NextResponse.json({ error: 'removeIds array is required' }, { status: 400 })
    }

    // Fetch namespaces for Pinecone deletion
    const entries = await sql`
      SELECT id, pinecone_namespace, pinecone_vector_id, category
      FROM knowledge_entries
      WHERE id::TEXT = ANY(${removeIds})
    `

    // Delete from Pinecone by namespace
    const index = pineconeIndex.get()
    if (index) {
      // Group by namespace for efficient deletion
      const byNamespace = new Map<string, string[]>()
      for (const entry of entries) {
        const ns = entry.pinecone_namespace || entry.category || 'general'
        if (!byNamespace.has(ns)) byNamespace.set(ns, [])
        byNamespace.get(ns)!.push(entry.pinecone_vector_id || entry.id)
      }

      for (const [ns, ids] of byNamespace.entries()) {
        try {
          await index.namespace(ns).deleteMany(ids)
        } catch (e) {
          console.error(`[DuplicatesDELETE] Pinecone delete failed for ${ns}:`, e)
        }
      }
    }

    // Delete from Neon
    await sql`DELETE FROM knowledge_entries WHERE id::TEXT = ANY(${removeIds})`

    return NextResponse.json({
      success: true,
      removed: removeIds.length,
      message: `Removed ${removeIds.length} duplicate records from Neon and Pinecone`,
    })
  } catch (err: any) {
    console.error('[DuplicatesDELETE] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
