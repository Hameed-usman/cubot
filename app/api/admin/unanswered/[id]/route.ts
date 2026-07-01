import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const id = params.id
    const { resolved, resolved_entry_id } = await req.json()

    await sql`
      UPDATE unanswered_questions
      SET resolved = ${resolved},
          resolved_entry_id = ${resolved_entry_id || null},
          resolved_at = CASE WHEN ${resolved}::boolean THEN NOW() ELSE NULL END
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Unanswered PUT error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const id = params.id

    await sql`DELETE FROM unanswered_questions WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Unanswered DELETE error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
