import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const id = params.id
    const { title, content, department, language } = await req.json()

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const cat = department || 'general'

    await sql`
      UPDATE knowledge_entries
      SET title = ${title},
          content = ${content},
          category = ${cat},
          department = ${department || null},
          language = ${language || 'en'},
          updated_at = NOW()
      WHERE id = ${id}
    `

    // Reset embedding status to 'pending'
    try {
      await sql`UPDATE knowledge_entries SET embedding_status = 'pending' WHERE id = ${id}`
    } catch(e) {}

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

    // Soft delete by setting status to archived. 
    // Schema doesn't have status on knowledge_entries natively, adding it dynamically or using source_type
    try {
      await sql`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`
      await sql`UPDATE knowledge_entries SET status = 'archived' WHERE id = ${id}`
    } catch(e) {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Knowledge DELETE error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
