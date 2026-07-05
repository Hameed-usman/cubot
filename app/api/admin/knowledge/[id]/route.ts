import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { embedText } from '@/lib/embeddings'
import { pineconeIndex } from '@/lib/pinecone'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const id = params.id
    const { title, content, namespace, source_url, tags } = await req.json()

    if (!title || !content || !namespace) {
      return NextResponse.json({ error: 'Title, content, and namespace are required' }, { status: 400 })
    }

    // Fetch old entry to get source type and page type if missing
    const oldEntry = await sql`SELECT category, source_url, page_type, source_type FROM knowledge_entries WHERE id = ${id}`
    if (oldEntry.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const { upsertKnowledgeChunk } = await import('@/lib/embed-and-store')
    
    // Using upsertKnowledgeChunk with forceUpdate=true guarantees everything 
    // including pinecone vector id and sync timestamp are perfectly maintained.
    const result = await upsertKnowledgeChunk({
      id: id, // Pass existing ID to force update on the same record
      title,
      content,
      category: namespace,
      sourceUrl: source_url || oldEntry[0].source_url || '',
      sourceType: oldEntry[0].source_type || 'manual',
      pageType: tags || oldEntry[0].page_type || 'general',
      forceUpdate: true,
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Knowledge PUT error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const id = params.id

    // Fetch old entry to get namespace
    const oldEntry = await sql`SELECT category FROM knowledge_entries WHERE id = ${id}`
    
    if (oldEntry.length > 0) {
      const namespace = oldEntry[0].category || 'general'
      
      // Delete from Pinecone
      const index = pineconeIndex.get()
      if (index) {
        try {
          await index.namespace(namespace).deleteOne(id)
        } catch (e) {
          console.error('[Knowledge DELETE] Failed to delete from pinecone:', e)
        }
      }

      // Hard delete from PostgreSQL
      await sql`DELETE FROM knowledge_entries WHERE id = ${id}`
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Knowledge DELETE error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
