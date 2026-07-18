import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import { pineconeIndex } from '@/lib/pinecone'
import sql from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/admin/documents/[id]
 * Returns full document detail including per-chunk breakdown from knowledge_entries.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authRes = await requireAdminAuth(req)
  if (authRes) return authRes

  try {
    const { id } = params

    const docs = await sql`
      SELECT * FROM document_ingestions WHERE id = ${id} LIMIT 1
    `
    if (docs.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Fetch all chunks for this document
    const chunks = await sql`
      SELECT
        id, title, content, category, page_type,
        chunk_index, total_chunks, pinecone_namespace,
        pinecone_vector_id, content_hash, last_scraped_at,
        section_heading, page_number,
        created_at
      FROM knowledge_entries
      WHERE source_url = ${'doc:' + id}
      ORDER BY chunk_index ASC
      LIMIT 500
    `

    return NextResponse.json({
      document: docs[0],
      chunks,
      chunkCount: chunks.length,
    })
  } catch (err: any) {
    console.error('[Documents API] GET [id] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/documents/[id]
 * Removes the document record, all its knowledge_entries, and all Pinecone vectors.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authRes = await requireAdminAuth(req)
  if (authRes) return authRes

  try {
    const { id } = params

    // Get all chunk IDs before deletion for Pinecone cleanup
    const chunks = await sql`
      SELECT id, pinecone_namespace, pinecone_vector_id
      FROM knowledge_entries
      WHERE source_url = ${'doc:' + id}
    `.catch(() => [] as any[])

    // Group by namespace for efficient Pinecone deletes
    const byNamespace: Record<string, string[]> = {}
    for (const c of chunks) {
      const ns = c.pinecone_namespace || 'general'
      if (!byNamespace[ns]) byNamespace[ns] = []
      byNamespace[ns].push(c.id)
    }

    // Delete from Pinecone
    const index = pineconeIndex.get()
    if (index) {
      for (const [ns, ids] of Object.entries(byNamespace)) {
        try {
          // Pinecone delete accepts up to 1000 IDs at once
          for (let i = 0; i < ids.length; i += 1000) {
            await index.namespace(ns).deleteMany(ids.slice(i, i + 1000))
          }
        } catch (e) {
          console.warn(`[Documents API] Pinecone delete failed for ns ${ns}:`, e)
        }
      }
    }

    // Delete knowledge_entries
    await sql`DELETE FROM knowledge_entries WHERE source_url = ${'doc:' + id}`

    // Delete document record
    await sql`DELETE FROM document_ingestions WHERE id = ${id}`

    return NextResponse.json({
      success: true,
      message: `Document deleted. Removed ${chunks.length} chunks from ${Object.keys(byNamespace).length} namespace(s).`,
    })
  } catch (err: any) {
    console.error('[Documents API] DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/documents/[id]
 * Update document metadata: is_active (version management), name, version.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authRes = await requireAdminAuth(req)
  if (authRes) return authRes

  try {
    const { id } = params
    const body = await req.json()
    const { is_active, name, version } = body

    if (is_active !== undefined) {
      await sql`
        UPDATE document_ingestions
        SET is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${id}
      `
    }

    if (name !== undefined || version !== undefined) {
      await sql`
        UPDATE document_ingestions
        SET
          name      = COALESCE(${name ?? null}, name),
          version   = COALESCE(${version ?? null}, version),
          updated_at = NOW()
        WHERE id = ${id}
      `
    }

    const updated = await sql`SELECT * FROM document_ingestions WHERE id = ${id} LIMIT 1`
    return NextResponse.json({ success: true, document: updated[0] })
  } catch (err: any) {
    console.error('[Documents API] PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
