import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max (Vercel Pro)

/**
 * GET /api/admin/trigger-crawl
 * Webhook endpoint to trigger a crawl run.
 * Secured with CRON_SECRET bearer token.
 *
 * Called by:
 * - GitHub Actions cron job
 * - Admin dashboard "Sync Now" button (via server action)
 * - External schedulers (cron-job.org etc.)
 *
 * NOTE: This endpoint does NOT run the full crawler inline (would timeout on Vercel).
 * Instead it triggers the crawl as a background process via GitHub Actions webhook
 * or returns instructions for manual execution.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const authRes = await requireAdminAuth(request)
  if (authRes) return authRes

  const mode = request.nextUrl.searchParams.get('mode') || 'webhook'

  // ── Option A: Trigger GitHub Actions workflow dispatch ──────────────────────
  if (mode === 'github' && process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
    try {
      const [owner, repo] = process.env.GITHUB_REPO.split('/')
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/crawl.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      )

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: 'GitHub Actions crawl workflow triggered successfully.',
          triggeredAt: new Date().toISOString(),
          mode: 'github_actions',
        })
      } else {
        const err = await response.text()
        return NextResponse.json({
          success: false,
          error: `GitHub API error: ${response.status} — ${err}`,
        }, { status: 500 })
      }
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: `Failed to trigger GitHub Actions: ${error.message}`,
      }, { status: 500 })
    }
  }

  // ── Option B: Return webhook acknowledgement ────────────────────────────────
  // For external schedulers (cron-job.org) calling this endpoint
  return NextResponse.json({
    success: true,
    message: 'Crawl trigger acknowledged. Run "npm run crawl" on your server/locally to execute.',
    triggeredAt: new Date().toISOString(),
    mode: 'manual',
    hint: 'Set GITHUB_TOKEN and GITHUB_REPO env vars to enable automatic GitHub Actions dispatch.',
  })
}

/**
 * POST /api/admin/trigger-crawl
 * Called by the admin dashboard "Sync Now" button.
 * Requires NextAuth session.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authRes = await requireAdminAuth(request)
  if (authRes) return authRes

  // Option A: Trigger GitHub Actions if configured (for production)
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
    try {
      const [owner, repo] = process.env.GITHUB_REPO.split('/')
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/crawl.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      )

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: '✓ Sync job dispatched! Your knowledge base will update in 10–15 minutes via GitHub Actions.',
          mode: 'github_actions',
        })
      }
    } catch {
      // Fall through to inline crawl
    }
  }

  // Option B: Run inline crawler (works in local dev and self-hosted)
  try {
    const { runCrawler } = await import('@/scripts/full-site-scraper')
    // Run without awaiting fully — return immediately and let it run async
    // We kick it off but return a "started" response
    runCrawler().catch((err: Error) => console.error('[Sync] Background crawl error:', err))

    return NextResponse.json({
      success: true,
      message: '✓ Full knowledge sync started! This may take 3–8 minutes. The bot will answer better after it completes.',
      mode: 'inline',
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: `⚠ Could not start sync: ${err.message}. Try using the Quick Sync for a specific URL instead.`,
      mode: 'error',
    }, { status: 500 })
  }
}
