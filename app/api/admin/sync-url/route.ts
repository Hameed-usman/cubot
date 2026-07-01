import { NextRequest, NextResponse } from 'next/server'
import { scrapeUrlOnce } from '@/scripts/full-site-scraper'
import { requireAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
// Increase timeout: scraping + embedding one page can take ~30-60 seconds
export const maxDuration = 120

/**
 * POST /api/admin/sync-url
 * Scrapes and embeds a single URL into the knowledge base, then returns.
 * Uses scrapeUrlOnce() instead of runCrawler() to avoid an infinite polling loop.
 */
export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    // Validate URL format
    try { new URL(url) } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    console.log(`[Sync] Manual sync requested for: ${url}`)

    const result = await scrapeUrlOnce(url)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to scrape page' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced: ${url}`,
      chunksCreated: result.chunksCreated,
    })
  } catch (error: any) {
    console.error('[Sync] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
