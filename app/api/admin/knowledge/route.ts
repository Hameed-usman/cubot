import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import { embedText } from '@/lib/embeddings'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const search = url.searchParams.get('search') || ''
    const sourceType = url.searchParams.get('source_type') || ''
    const category = url.searchParams.get('category') || ''

    // Dynamic query building
    let query = sql`SELECT id, title, content, category, source_type, source_url, created_at, updated_at FROM knowledge_entries WHERE 1=1`
    
    if (search) {
      query = sql`${query} AND (title ILIKE ${'%' + search + '%'} OR content ILIKE ${'%' + search + '%'})`
    }
    if (sourceType) {
      query = sql`${query} AND source_type = ${sourceType}`
    }
    if (category) {
      query = sql`${query} AND category = ${category}`
    }

    query = sql`${query} ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`

    const entries = await query

    return NextResponse.json({ entries })
  } catch (err: any) {
    console.error('Knowledge GET error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const body = await req.json()
    const { title, content, namespace, source_url, tags } = body

    if (!title || !content || !namespace) {
      return NextResponse.json({ error: 'Title, content, and namespace are required' }, { status: 400 })
    }

    const id = uuidv4()
    const contentHash = createHash('sha256').update(content).digest('hex')
    const stype = 'manual'
    const pageType = tags || 'general'

    // 1. Generate embedding
    let embedding: number[]
    try {
      embedding = await embedText(content)
    } catch (err: any) {
      console.error('[Knowledge POST] Embed error:', err)
      return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 })
    }

    // 2. Insert into PostgreSQL
    const entries = await sql`
      INSERT INTO knowledge_entries (id, title, content, category, source_url, source_type, page_type, content_hash, search_vector)
      VALUES (
        ${id}, ${title}, ${content}, ${namespace}, ${source_url || null}, ${stype}, ${pageType}, ${contentHash},
        setweight(to_tsvector('english', COALESCE(${title}, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(${namespace}, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(${content}, '')), 'C')
      )
      RETURNING id, title, content, category, source_type, created_at
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
          sourceUrl: source_url || 'manual_entry',
          namespace,
          sourceType: stype,
          pageType: pageType,
          created_by: 'admin',
          created_at: new Date().toISOString()
        }
      }])
    } else {
      console.warn('[Knowledge POST] Pinecone index not available.')
    }

    return NextResponse.json({ success: true, entry: entries[0] })
  } catch (err: any) {
    console.error('Knowledge POST error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
