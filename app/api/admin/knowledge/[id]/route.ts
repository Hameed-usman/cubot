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

    // 1. Fetch old entry to get the old namespace
    const oldEntry = await sql`SELECT category, source_url, page_type FROM knowledge_entries WHERE id = ${id}`
    if (oldEntry.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }
    const oldNamespace = oldEntry[0].category || 'general'

    const contentHash = createHash('sha256').update(content).digest('hex')
    const pageType = tags || oldEntry[0].page_type

    // 2. Generate new embedding
    let embedding: number[]
    try {
      embedding = await embedText(content)
    } catch (err: any) {
      console.error('[Knowledge PUT] Embed error:', err)
      return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 })
    }

    // 3. Update PostgreSQL
    await sql`
      UPDATE knowledge_entries
      SET title = ${title},
          content = ${content},
          category = ${namespace},
          source_url = ${source_url || oldEntry[0].source_url},
          page_type = ${pageType},
          content_hash = ${contentHash},
          search_vector = setweight(to_tsvector('english', COALESCE(${title}, '')), 'A') ||
                          setweight(to_tsvector('english', COALESCE(${namespace}, '')), 'B') ||
                          setweight(to_tsvector('english', COALESCE(${content}, '')), 'C'),
          updated_at = NOW()
      WHERE id = ${id}
    `

    // 4. Update Pinecone
    const index = pineconeIndex.get()
    if (index) {
      // If namespace changed, delete old vector first
      if (oldNamespace !== namespace) {
        try {
          await index.namespace(oldNamespace).deleteOne(id)
        } catch (e) {
          console.error('[Knowledge PUT] Failed to delete old vector from pinecone:', e)
        }
      }

      await index.namespace(namespace).upsert([{
        id,
        values: embedding,
        metadata: {
          title,
          category: namespace,
          text: content,
          content,
          sourceUrl: source_url || oldEntry[0].source_url || 'manual_entry',
          namespace,
          sourceType: 'manual',
          pageType: pageType,
          updated_at: new Date().toISOString()
        }
      }])
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
