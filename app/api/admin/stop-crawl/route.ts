import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    // Set stop flag in admin_config
    await sql`
      INSERT INTO admin_config (key, value, updated_at)
      VALUES ('stop_crawl', 'true', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE 
      SET value = 'true', updated_at = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ success: true, message: 'Stop signal sent to crawler. It will safely abort its current batch.' })
  } catch (error: any) {
    console.error('[StopCrawl] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
