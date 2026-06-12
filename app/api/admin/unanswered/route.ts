import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const resolvedParam = req.nextUrl.searchParams.get('resolved')
    const isResolved = resolvedParam === 'true'

    const unanswered = await sql`
      SELECT id, conversation_id, question_text, language, persona, tier_reached, resolved, resolved_entry_id, resolved_at, created_at
      FROM unanswered_questions
      WHERE resolved = ${isResolved}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ unanswered })
  } catch (err: any) {
    console.error('Unanswered GET error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
