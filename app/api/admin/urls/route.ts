import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

const URL_QUERY_COLUMNS = `
  sp.id, sp.url, sp.title, sp.crawl_depth, sp.crawl_status,
  sp.pinecone_sync_status, sp.content_hash, sp.last_scraped_at, sp.created_at,
  COALESCE(ke_agg.total_chunks, sp.chunk_count, 0) as total_chunks,
  COALESCE(ke_agg.namespace, 'unknown') as namespace,
  COALESCE(ke_agg.category, 'unknown') as category,
  COALESCE(ke_agg.pinecone_vectors, 0) as pinecone_vectors,
  COALESCE(ROUND(ke_agg.avg_chunk_size), 0) as avg_chunk_size
`

/**
 * GET /api/admin/urls
 * Returns all scraped URLs with their chunk counts, status, and metadata.
 */
export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const search = url.searchParams.get('search') || ''
    const statusFilter = url.searchParams.get('status') || ''

    let pages: any[]
    let countResult: any[]
    const searchWild = `%${search}%`

    if (search && statusFilter) {
      pages = await sql`
        SELECT sp.id, sp.url, sp.title, sp.crawl_depth, sp.crawl_status,
          sp.pinecone_sync_status, sp.content_hash, sp.last_scraped_at, sp.created_at,
          COALESCE(ke_agg.total_chunks, sp.chunk_count, 0) as total_chunks,
          COALESCE(ke_agg.namespace, 'unknown') as namespace,
          COALESCE(ke_agg.category, 'unknown') as category,
          COALESCE(ke_agg.pinecone_vectors, 0) as pinecone_vectors,
          COALESCE(ROUND(ke_agg.avg_chunk_size), 0) as avg_chunk_size
        FROM scraped_pages sp
        LEFT JOIN (
          SELECT source_url, COUNT(*) as total_chunks, COUNT(pinecone_vector_id) as pinecone_vectors,
            MIN(pinecone_namespace) as namespace, MIN(category) as category, AVG(LENGTH(content)) as avg_chunk_size
          FROM knowledge_entries WHERE source_url IS NOT NULL AND source_url != '' GROUP BY source_url
        ) ke_agg ON sp.url = ke_agg.source_url
        WHERE sp.deleted_at IS NULL
          AND (sp.url ILIKE ${searchWild} OR sp.title ILIKE ${searchWild})
          AND sp.crawl_status = ${statusFilter}
        ORDER BY sp.last_scraped_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM scraped_pages sp
        WHERE sp.deleted_at IS NULL
          AND (sp.url ILIKE ${searchWild} OR sp.title ILIKE ${searchWild})
          AND sp.crawl_status = ${statusFilter}
      `
    } else if (search) {
      pages = await sql`
        SELECT sp.id, sp.url, sp.title, sp.crawl_depth, sp.crawl_status,
          sp.pinecone_sync_status, sp.content_hash, sp.last_scraped_at, sp.created_at,
          COALESCE(ke_agg.total_chunks, sp.chunk_count, 0) as total_chunks,
          COALESCE(ke_agg.namespace, 'unknown') as namespace,
          COALESCE(ke_agg.category, 'unknown') as category,
          COALESCE(ke_agg.pinecone_vectors, 0) as pinecone_vectors,
          COALESCE(ROUND(ke_agg.avg_chunk_size), 0) as avg_chunk_size
        FROM scraped_pages sp
        LEFT JOIN (
          SELECT source_url, COUNT(*) as total_chunks, COUNT(pinecone_vector_id) as pinecone_vectors,
            MIN(pinecone_namespace) as namespace, MIN(category) as category, AVG(LENGTH(content)) as avg_chunk_size
          FROM knowledge_entries WHERE source_url IS NOT NULL AND source_url != '' GROUP BY source_url
        ) ke_agg ON sp.url = ke_agg.source_url
        WHERE sp.deleted_at IS NULL
          AND (sp.url ILIKE ${searchWild} OR sp.title ILIKE ${searchWild})
        ORDER BY sp.last_scraped_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM scraped_pages sp
        WHERE sp.deleted_at IS NULL
          AND (sp.url ILIKE ${searchWild} OR sp.title ILIKE ${searchWild})
      `
    } else if (statusFilter) {
      pages = await sql`
        SELECT sp.id, sp.url, sp.title, sp.crawl_depth, sp.crawl_status,
          sp.pinecone_sync_status, sp.content_hash, sp.last_scraped_at, sp.created_at,
          COALESCE(ke_agg.total_chunks, sp.chunk_count, 0) as total_chunks,
          COALESCE(ke_agg.namespace, 'unknown') as namespace,
          COALESCE(ke_agg.category, 'unknown') as category,
          COALESCE(ke_agg.pinecone_vectors, 0) as pinecone_vectors,
          COALESCE(ROUND(ke_agg.avg_chunk_size), 0) as avg_chunk_size
        FROM scraped_pages sp
        LEFT JOIN (
          SELECT source_url, COUNT(*) as total_chunks, COUNT(pinecone_vector_id) as pinecone_vectors,
            MIN(pinecone_namespace) as namespace, MIN(category) as category, AVG(LENGTH(content)) as avg_chunk_size
          FROM knowledge_entries WHERE source_url IS NOT NULL AND source_url != '' GROUP BY source_url
        ) ke_agg ON sp.url = ke_agg.source_url
        WHERE sp.deleted_at IS NULL AND sp.crawl_status = ${statusFilter}
        ORDER BY sp.last_scraped_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`
        SELECT COUNT(*) as total FROM scraped_pages sp
        WHERE sp.deleted_at IS NULL AND sp.crawl_status = ${statusFilter}
      `
    } else {
      pages = await sql`
        SELECT sp.id, sp.url, sp.title, sp.crawl_depth, sp.crawl_status,
          sp.pinecone_sync_status, sp.content_hash, sp.last_scraped_at, sp.created_at,
          COALESCE(ke_agg.total_chunks, sp.chunk_count, 0) as total_chunks,
          COALESCE(ke_agg.namespace, 'unknown') as namespace,
          COALESCE(ke_agg.category, 'unknown') as category,
          COALESCE(ke_agg.pinecone_vectors, 0) as pinecone_vectors,
          COALESCE(ROUND(ke_agg.avg_chunk_size), 0) as avg_chunk_size
        FROM scraped_pages sp
        LEFT JOIN (
          SELECT source_url, COUNT(*) as total_chunks, COUNT(pinecone_vector_id) as pinecone_vectors,
            MIN(pinecone_namespace) as namespace, MIN(category) as category, AVG(LENGTH(content)) as avg_chunk_size
          FROM knowledge_entries WHERE source_url IS NOT NULL AND source_url != '' GROUP BY source_url
        ) ke_agg ON sp.url = ke_agg.source_url
        WHERE sp.deleted_at IS NULL
        ORDER BY sp.last_scraped_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `
      countResult = await sql`SELECT COUNT(*) as total FROM scraped_pages WHERE deleted_at IS NULL`
    }

    const total = parseInt(countResult[0]?.total || '0', 10)

    const statusBreakdown = await sql`
      SELECT crawl_status, COUNT(*) as count
      FROM scraped_pages
      WHERE deleted_at IS NULL
      GROUP BY crawl_status
      ORDER BY count DESC
    `

    return NextResponse.json({
      urls: pages,
      total,
      limit,
      offset,
      statusBreakdown,
    })
  } catch (err: any) {
    console.error('[UrlsGET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
