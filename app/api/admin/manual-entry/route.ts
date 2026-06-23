import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { embedText } from '@/lib/embeddings'
import { pineconeIndex } from '@/lib/pinecone'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { namespace, content } = await req.json()

    if (!namespace || !content) {
      return NextResponse.json({ success: false, error: 'Namespace and content are required.' }, { status: 400 })
    }

    const id = uuidv4()
    const contentHash = createHash('sha256').update(content).digest('hex')
    const title = `Manual Entry: ${namespace}`

    // 1. Embed content via Gemini
    let embedding: number[]
    try {
      embedding = await embedText(content)
    } catch (err: any) {
      console.error('[ManualEntry] Embed error:', err)
      return NextResponse.json({ success: false, error: 'Failed to generate embedding from Gemini API.' }, { status: 500 })
    }

    // 2. Insert into PostgreSQL
    await sql`
      INSERT INTO knowledge_entries (id, title, content, category, content_hash, search_vector, source_type)
      VALUES (
        ${id}, ${title}, ${content}, ${namespace}, ${contentHash},
        setweight(to_tsvector('english', COALESCE(${title}, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(${namespace}, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(${content}, '')), 'C'),
        'manual'
      )
    `

    // 3. Upsert into Pinecone
    const index = pineconeIndex.get()
    if (index) {
      await index.namespace(namespace).upsert([{
        id,
        values: embedding,
        metadata: {
          title,
          category: namespace,
          text: content,
          content,
          sourceUrl: 'manual_entry',
          namespace,
          sourceType: 'manual',
          pageType: 'general',
          created_by: 'admin',
          created_at: new Date().toISOString()
        }
      }])
    } else {
      console.warn('[ManualEntry] Pinecone index not available, saved to DB only.')
    }

    return NextResponse.json({ success: true, id })

  } catch (error: any) {
    console.error('[ManualEntry] Error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Internal server error.' }, { status: 500 })
  }
}
