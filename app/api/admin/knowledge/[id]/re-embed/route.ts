import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { embedText } from '@/lib/embeddings'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const id = params.id

    const entries = await sql`SELECT title, content, category, source_url, page_type, source_type FROM knowledge_entries WHERE id = ${id}`
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const entry = entries[0]
    const namespace = entry.category || 'general'

    // 1. Generate new embedding
    let embedding: number[]
    try {
      embedding = await embedText(entry.content)
    } catch (err: any) {
      console.error('[Knowledge Re-embed] Embed error:', err)
      return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 })
    }

    // 2. Update Pinecone
    const index = pineconeIndex.get()
    if (index) {
      await index.namespace(namespace).upsert([{
        id,
        values: embedding,
        metadata: {
          title: entry.title,
          category: namespace,
          text: entry.content,
          content: entry.content,
          sourceUrl: entry.source_url || (entry.source_type === 'manual' ? 'manual_entry' : ''),
          namespace,
          sourceType: entry.source_type,
          pageType: entry.page_type || 'general',
          updated_at: new Date().toISOString()
        }
      }])
    } else {
      return NextResponse.json({ error: 'Pinecone not configured' }, { status: 500 })
    }

    // 3. Touch updated_at in PostgreSQL
    await sql`UPDATE knowledge_entries SET updated_at = NOW() WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Knowledge Re-embed error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
