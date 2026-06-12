import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { conversation_id, session_id, feedback } = await req.json()

    if (!session_id || !feedback || !['thumbs_up', 'thumbs_down'].includes(feedback)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Insert into feedback_logs
    if (conversation_id) {
      await sql`
        INSERT INTO feedback_logs (conversation_id, session_id, feedback)
        VALUES (${conversation_id}, ${session_id}, ${feedback})
      `
      
      // Update conversations table
      await sql`
        UPDATE conversations 
        SET feedback = ${feedback} 
        WHERE id = ${conversation_id} AND session_id = ${session_id}
      `
    } else {
      // General feedback without conversation ID
      await sql`
        INSERT INTO feedback_logs (session_id, feedback)
        VALUES (${session_id}, ${feedback})
      `
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Feedback API error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
