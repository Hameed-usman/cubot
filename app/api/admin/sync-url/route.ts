import { NextRequest, NextResponse } from 'next/server'
import { runCrawler } from '@/scripts/full-site-scraper'
import sql from '@/lib/db'
import { getServerSession } from 'next-auth'
import { requireAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sync-url
 * Instantly syncs a single URL to the knowledge base.
 */
export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    console.log(`[Sync] Manual sync requested for: ${url}`)
    
    // Execute crawler for single URL
    // We run it as high priority (single URL doesn't take long)
    await sql`INSERT INTO crawl_queue (url, depth, priority) VALUES (${url}, 0, 1) ON CONFLICT DO NOTHING`;
    await runCrawler()

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced: ${url}` 
    })
  } catch (error: any) {
    console.error('[Sync] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
