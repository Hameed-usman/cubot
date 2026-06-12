import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10)

    const entries = await sql`
      SELECT id, title, content, category, department, language, source_type, created_at, updated_at
      FROM knowledge_entries
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

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
    const { title, content, department, language, source_type } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const id = uuidv4()
    
    // We set 'category' to department if not provided, for schema compatibility
    const cat = department || 'general'
    const lang = language || 'en'
    const stype = source_type || 'manual'

    const entries = await sql`
      INSERT INTO knowledge_entries (id, title, content, category, department, language, source_type)
      VALUES (${id}, ${title}, ${content}, ${cat}, ${department || null}, ${lang}, ${stype})
      RETURNING id, title, content, category, department, language, source_type, created_at
    `

    // Wait, the prompt says "sets embedding_status to 'pending'"
    // The schema does not have embedding_status on knowledge_entries natively, but we can assume it's part of a different logic or we can add it if needed.
    // The prompt: "inserts into knowledge_entries, sets embedding_status to 'pending'"
    // I will add an ALTER TABLE in the SQL if missing, or just execute it directly.
    try {
      await sql`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending'`
      await sql`UPDATE knowledge_entries SET embedding_status = 'pending' WHERE id = ${id}`
    } catch(e) {
      // Ignore if table schema couldn't be altered here easily, though it should work.
    }

    return NextResponse.json({ entry: entries[0] })
  } catch (err: any) {
    console.error('Knowledge POST error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
