import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import { scrapeUrlOnce } from '@/scripts/full-site-scraper'
import sql from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const USER_AGENT = 'Mozilla/5.0 (compatible; CubotCrawler/1.0; +https://cusit.edu.pk/cubot)'

/**
 * POST /api/admin/keyword-scrape
 *
 * Two modes:
 *
 * 1. SEED MODE — fetches a seed URL (static HTML pages), discovers matching links, scrapes them.
 * 2. DB MODE   — searches the already-crawled knowledge_entries table in Neon for source_urls
 *               matching the keyword. Re-scrapes them to pick up any changes.
 *               Good for "resync all fee pages" type of use case.
 * 3. PATTERN MODE — admin supplies an explicit list of URLs (or URL patterns) to scrape directly.
 *
 * All modes stream SSE progress.
 */
export async function POST(req: NextRequest) {
  const authRes = await requireAdminAuth(req)
  if (authRes) return authRes

  const body = await req.json()
  const { keyword, seedUrl, urls: explicitUrls } = body

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
    return NextResponse.json({ error: 'A keyword of at least 2 characters is required.' }, { status: 400 })
  }

  const kw = keyword.trim().toLowerCase()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`))
        } catch { /* client disconnected */ }
      }

      try {
        let urlsToScrape: string[] = []

        // ── Mode 3: Explicit URL list ──────────────────────────────────────────
        if (Array.isArray(explicitUrls) && explicitUrls.length > 0) {
          urlsToScrape = explicitUrls.filter((u: any) => typeof u === 'string' && u.startsWith('http'))
          send('log', { message: `📋 Using ${urlsToScrape.length} explicitly provided URLs.`, status: 'info' })
        }

        // ── Mode 1: Seed URL link discovery (static HTML only) ─────────────────
        else if (seedUrl) {
          send('log', { message: `🔍 Fetching seed page: ${seedUrl}`, status: 'info' })
          try {
            new URL(seedUrl)
          } catch {
            send('log', { message: '❌ Invalid seed URL format.', status: 'error' })
            send('done', { total: 0, success: 0, failed: 0, skipped: 0, chunks: 0 })
            controller.close()
            return
          }

          const seedRes = await fetch(seedUrl, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
            signal: AbortSignal.timeout(20000),
          }).catch(() => null)

          if (!seedRes || !seedRes.ok) {
            send('log', { message: `❌ Could not fetch seed page (HTTP ${seedRes?.status ?? 'error'}).`, status: 'error' })
            send('done', { total: 0, success: 0, failed: 0, skipped: 0, chunks: 0 })
            controller.close()
            return
          }

          const html = await seedRes.text()
          const cheerio = await import('cheerio')
          const $ = cheerio.load(html)
          const discovered = new Set<string>()

          $('a[href]').each((_, el) => {
            const href = $(el).attr('href')?.trim()
            const text = $(el).text().trim()
            if (!href) return
            let resolved: string
            try { resolved = new URL(href, seedUrl).href } catch { return }
            resolved = resolved.split('#')[0]
            const matchTarget = `${resolved.toLowerCase()} ${text.toLowerCase()}`
            if (matchTarget.includes(kw)) {
              if (/\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|ttf|eot|mp4|avi|zip|rar)(\?.*)?$/i.test(resolved)) return
              discovered.add(resolved)
            }
          })

          urlsToScrape = Array.from(discovered)
          send('log', { message: `📄 Discovered ${urlsToScrape.length} matching link(s) from seed page.`, status: urlsToScrape.length > 0 ? 'success' : 'warn' })
        }

        // ── Mode 2: DB keyword search (always run as fallback / addition) ──────
        {
          send('log', { message: `🗄️  Searching knowledge base for existing "${keyword}" pages to refresh...`, status: 'info' })
          
          const dbRows = await sql`
            SELECT DISTINCT source_url
            FROM knowledge_entries
            WHERE source_type IN ('webpage', 'document')
              AND source_url IS NOT NULL
              AND (
                LOWER(source_url) LIKE ${'%' + kw + '%'}
                OR LOWER(title) LIKE ${'%' + kw + '%'}
                OR LOWER(category) LIKE ${'%' + kw + '%'}
              )
            LIMIT 100
          `

          const dbUrls = dbRows
            .map((r: any) => r.source_url as string)
            .filter((u: string) => u && u.startsWith('http'))

          const before = urlsToScrape.length
          const combined = new Set([...urlsToScrape, ...dbUrls])
          urlsToScrape = Array.from(combined)
          
          if (dbUrls.length > 0) {
            send('log', {
              message: `🗄️  Found ${dbUrls.length} existing DB entries matching "${keyword}" (${urlsToScrape.length - before} new additions).`,
              status: 'info',
            })
          }
        }

        if (urlsToScrape.length === 0) {
          send('log', {
            message: `⚠️  No pages found matching "${keyword}". Try a different keyword, seed URL, or add pages manually first.`,
            status: 'warn',
          })
          send('done', { total: 0, success: 0, failed: 0, skipped: 0, chunks: 0 })
          controller.close()
          return
        }

        send('discovered', { count: urlsToScrape.length, keyword })
        send('log', { message: `🚀 Starting scrape of ${urlsToScrape.length} URL(s)...`, status: 'info' })

        // ── Scrape each URL ────────────────────────────────────────────────────
        let successCount = 0, failedCount = 0, skippedCount = 0, totalChunks = 0

        for (let i = 0; i < urlsToScrape.length; i++) {
          if (req.signal.aborted) {
            send('log', { message: '🛑 Scraping stopped by admin.', status: 'warn' })
            break
          }

          const url = urlsToScrape[i]
          const label = url.split('/').pop()?.replace(/%20/g, ' ') || url
          send('scraping', { url, index: i + 1, total: urlsToScrape.length, label })

          try {
            const result = await scrapeUrlOnce(url)
            if (result.success) {
              if ((result.chunksCreated ?? 0) === 0) {
                skippedCount++
                send('log', { message: `⏭ No changes: ${label}`, status: 'skip', url })
              } else {
                successCount++
                totalChunks += result.chunksCreated ?? 0
                send('log', { message: `✓ Scraped: ${label} — ${result.chunksCreated} chunks`, status: 'success', url, chunks: result.chunksCreated })
              }
            } else {
              failedCount++
              send('log', { message: `✗ Failed: ${label} — ${result.error || 'Unknown error'}`, status: 'error', url })
            }
          } catch (err: any) {
            failedCount++
            send('log', { message: `✗ Error: ${label} — ${err.message}`, status: 'error', url })
          }
        }

        send('log', {
          message: `🎉 Done! ${successCount} scraped, ${skippedCount} unchanged, ${failedCount} failed. ${totalChunks} total chunks saved to DB & Pinecone.`,
          status: successCount > 0 ? 'success' : 'warn',
        })
        send('done', { total: urlsToScrape.length, success: successCount, failed: failedCount, skipped: skippedCount, chunks: totalChunks })

      } catch (err: any) {
        send('log', { message: `❌ Fatal error: ${err.message}`, status: 'error' })
        send('done', { total: 0, success: 0, failed: 0, skipped: 0, chunks: 0 })
      }

      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
