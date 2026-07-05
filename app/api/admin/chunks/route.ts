import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chunks?url=<url>
 * Returns all knowledge_entries (chunks) for a given source URL.
 * Also accepts scraped_page_id via document_chunks table.
 */
export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const searchUrl = new URL(req.url)
    const sourceUrl = searchUrl.searchParams.get('url') || ''
    const pageId = searchUrl.searchParams.get('page_id') || ''
    const limit = Math.min(parseInt(searchUrl.searchParams.get('limit') || '100', 10), 500)

    if (!sourceUrl && !pageId) {
      return NextResponse.json({ error: 'url or page_id parameter is required' }, { status: 400 })
    }

    let chunks
    if (sourceUrl) {
      chunks = await sql`
        SELECT
          id,
          title,
          content,
          category,
          source_url,
          source_type,
          chunk_index,
          total_chunks,
          content_hash,
          pinecone_vector_id,
          pinecone_namespace,
          embedding_model,
          pinecone_synced_at,
          created_at,
          updated_at,
          LENGTH(content) as char_count,
          ROUND(LENGTH(content)::numeric / 4) as approx_token_count
        FROM knowledge_entries
        WHERE source_url = ${sourceUrl}
        ORDER BY chunk_index ASC
        LIMIT ${limit}
      `
    } else {
      // Fetch via document_chunks → scraped_page_id
      chunks = await sql`
        SELECT
          ke.id,
          ke.title,
          ke.content,
          ke.category,
          ke.source_url,
          ke.source_type,
          ke.chunk_index,
          ke.total_chunks,
          ke.content_hash,
          ke.pinecone_vector_id,
          ke.pinecone_namespace,
          ke.embedding_model,
          ke.pinecone_synced_at,
          ke.created_at,
          ke.updated_at,
          LENGTH(ke.content) as char_count,
          ROUND(LENGTH(ke.content)::numeric / 4) as approx_token_count
        FROM knowledge_entries ke
        JOIN document_chunks dc ON dc.pinecone_id = ke.id::TEXT
        WHERE dc.scraped_page_id = ${pageId}::UUID
        ORDER BY ke.chunk_index ASC
        LIMIT ${limit}
      `
    }

    return NextResponse.json({
      chunks,
      total: chunks.length,
      sourceUrl: sourceUrl || null,
      pageId: pageId || null,
    })
  } catch (err: any) {
    console.error('[ChunksGET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
