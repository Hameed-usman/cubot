import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/vectors
 * Fetch all knowledge entries with full vector metadata for the Vector Explorer.
 */
export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const search = url.searchParams.get('search') || ''
    const namespace = url.searchParams.get('namespace') || ''

    // Neon's tagged template literal doesn't support nested sql fragments,
    // so we use separate query branches.
    let entries: any[]
    let countResult: any[]

    if (search && namespace) {
      const searchWild = `%${search}%`
      entries = await sql`
        SELECT id, title, content, category, source_url, source_type, page_type,
          chunk_index, total_chunks, content_hash,
          pinecone_vector_id, pinecone_namespace, embedding_model, pinecone_synced_at,
          created_at, updated_at, last_scraped_at,
          LENGTH(content) as char_count,
          ROUND(LENGTH(content)::numeric / 4) as approx_token_count
        FROM knowledge_entries
        WHERE pinecone_namespace = ${namespace}
          AND (title ILIKE ${searchWild} OR content ILIKE ${searchWild} OR source_url ILIKE ${searchWild})
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM knowledge_entries
        WHERE pinecone_namespace = ${namespace}
          AND (title ILIKE ${searchWild} OR content ILIKE ${searchWild} OR source_url ILIKE ${searchWild})
      `
    } else if (search) {
      const searchWild = `%${search}%`
      entries = await sql`
        SELECT id, title, content, category, source_url, source_type, page_type,
          chunk_index, total_chunks, content_hash,
          pinecone_vector_id, pinecone_namespace, embedding_model, pinecone_synced_at,
          created_at, updated_at, last_scraped_at,
          LENGTH(content) as char_count,
          ROUND(LENGTH(content)::numeric / 4) as approx_token_count
        FROM knowledge_entries
        WHERE (title ILIKE ${searchWild} OR content ILIKE ${searchWild} OR source_url ILIKE ${searchWild})
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM knowledge_entries
        WHERE (title ILIKE ${searchWild} OR content ILIKE ${searchWild} OR source_url ILIKE ${searchWild})
      `
    } else if (namespace) {
      entries = await sql`
        SELECT id, title, content, category, source_url, source_type, page_type,
          chunk_index, total_chunks, content_hash,
          pinecone_vector_id, pinecone_namespace, embedding_model, pinecone_synced_at,
          created_at, updated_at, last_scraped_at,
          LENGTH(content) as char_count,
          ROUND(LENGTH(content)::numeric / 4) as approx_token_count
        FROM knowledge_entries
        WHERE pinecone_namespace = ${namespace}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM knowledge_entries
        WHERE pinecone_namespace = ${namespace}
      `
    } else {
      entries = await sql`
        SELECT id, title, content, category, source_url, source_type, page_type,
          chunk_index, total_chunks, content_hash,
          pinecone_vector_id, pinecone_namespace, embedding_model, pinecone_synced_at,
          created_at, updated_at, last_scraped_at,
          LENGTH(content) as char_count,
          ROUND(LENGTH(content)::numeric / 4) as approx_token_count
        FROM knowledge_entries
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM knowledge_entries`
    }

    const total = parseInt(countResult[0]?.total || '0', 10)

    // Get namespace list for filter dropdowns
    const namespaceList = await sql`
      SELECT DISTINCT pinecone_namespace as namespace, COUNT(*) as count
      FROM knowledge_entries
      WHERE pinecone_namespace IS NOT NULL
      GROUP BY pinecone_namespace
      ORDER BY count DESC
    `

    return NextResponse.json({
      entries,
      total,
      limit,
      offset,
      namespaces: namespaceList,
    })
  } catch (err: any) {
    console.error('[VectorsGET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/vectors
 * Create a new knowledge entry with full Pinecone synchronization.
 */
export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const body = await req.json()
    const { title, content, category, source_url, source_type = 'manual' } = body

    if (!title || !content || !category) {
      return NextResponse.json({ error: 'title, content, and category are required' }, { status: 400 })
    }

    const { upsertKnowledgeChunk } = await import('@/lib/embed-and-store')
    const result = await upsertKnowledgeChunk({
      title,
      content,
      category,
      sourceUrl: source_url || '',
      sourceType: source_type,
      forceUpdate: true,
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    const entry = await sql`SELECT * FROM knowledge_entries WHERE id = ${result.id}`

    return NextResponse.json({ success: true, entry: entry[0] })
  } catch (err: any) {
    console.error('[VectorsPOST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
