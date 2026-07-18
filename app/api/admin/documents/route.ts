import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/documents
 * Returns all document ingestion records ordered by most recent first.
 * Real data only — directly from document_ingestions table.
 */
export async function GET(req: NextRequest) {
  const authRes = await requireAdminAuth(req)
  if (authRes) return authRes

  try {
    const url = new URL(req.url)
    const search = url.searchParams.get('search') || ''
    const statusFilter = url.searchParams.get('status') || ''

    let rows: any[]

    if (search && statusFilter) {
      rows = await sql`
        SELECT
          id, name, version, source_type, source_url, file_name,
          file_size_bytes, status, is_active,
          total_pages, total_chunks, total_tokens,
          embedding_time_ms, namespace_distribution,
          duplicate_chunks_removed, error_message,
          uploaded_by, created_at, updated_at
        FROM document_ingestions
        WHERE (LOWER(name) LIKE ${'%' + search.toLowerCase() + '%'} OR LOWER(file_name) LIKE ${'%' + search.toLowerCase() + '%'})
          AND status = ${statusFilter}
        ORDER BY created_at DESC
        LIMIT 100
      `
    } else if (search) {
      rows = await sql`
        SELECT
          id, name, version, source_type, source_url, file_name,
          file_size_bytes, status, is_active,
          total_pages, total_chunks, total_tokens,
          embedding_time_ms, namespace_distribution,
          duplicate_chunks_removed, error_message,
          uploaded_by, created_at, updated_at
        FROM document_ingestions
        WHERE LOWER(name) LIKE ${'%' + search.toLowerCase() + '%'} OR LOWER(file_name) LIKE ${'%' + search.toLowerCase() + '%'}
        ORDER BY created_at DESC
        LIMIT 100
      `
    } else if (statusFilter) {
      rows = await sql`
        SELECT
          id, name, version, source_type, source_url, file_name,
          file_size_bytes, status, is_active,
          total_pages, total_chunks, total_tokens,
          embedding_time_ms, namespace_distribution,
          duplicate_chunks_removed, error_message,
          uploaded_by, created_at, updated_at
        FROM document_ingestions
        WHERE status = ${statusFilter}
        ORDER BY created_at DESC
        LIMIT 100
      `
    } else {
      rows = await sql`
        SELECT
          id, name, version, source_type, source_url, file_name,
          file_size_bytes, status, is_active,
          total_pages, total_chunks, total_tokens,
          embedding_time_ms, namespace_distribution,
          duplicate_chunks_removed, error_message,
          uploaded_by, created_at, updated_at
        FROM document_ingestions
        ORDER BY created_at DESC
        LIMIT 100
      `
    }

    // Summary stats
    const stats = await sql`
      SELECT
        COUNT(*)                                      AS total,
        COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
        COUNT(*) FILTER (WHERE status = 'processing') AS processing,
        COALESCE(SUM(total_chunks), 0)                AS total_chunks,
        COALESCE(SUM(total_pages), 0)                 AS total_pages
      FROM document_ingestions
    `

    return NextResponse.json({
      documents: rows,
      stats: stats[0] || {},
    })
  } catch (err: any) {
    console.error('[Documents API] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
