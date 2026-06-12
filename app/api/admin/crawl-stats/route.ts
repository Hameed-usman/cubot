import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { CrawlDashboardData } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/crawl-stats
 * Returns comprehensive crawl observability data for the admin dashboard.
 * Protected — requires valid NextAuth session.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const authRes = await requireAdminAuth(request)
    if (authRes) return authRes


    // Run all queries in parallel for speed
    const [
      lastRunRows,
      totalEntriesRows,
      byCategoryRows,
      bySourceTypeRows,
      byPageTypeRows,
      recentUpdatesRows,
      recentFailuresRows,
    ] = await Promise.all([
      // Last completed crawl run
      sql`
        SELECT
          run_id        AS "runId",
          pages_crawled AS "pagesCrawled",
          pages_failed  AS "pagesFailed",
          pages_updated AS "pagesUpdated",
          pages_skipped AS "pagesSkipped",
          documents_processed AS "documentsProcessed",
          chunks_created      AS "chunksCreated",
          embeddings_created  AS "embeddingsCreated",
          duration_seconds    AS "durationSeconds",
          status,
          started_at   AS "startedAt",
          completed_at AS "completedAt"
        FROM crawl_stats
        ORDER BY started_at DESC
        LIMIT 1
      `,

      // Total knowledge entries
      sql`SELECT COUNT(*) AS count FROM knowledge_entries`,

      // Breakdown by category
      sql`
        SELECT category, COUNT(*) AS count
        FROM knowledge_entries
        GROUP BY category
        ORDER BY count DESC
      `,

      // Breakdown by source type
      sql`
        SELECT source_type AS "sourceType", COUNT(*) AS count
        FROM knowledge_entries
        GROUP BY source_type
        ORDER BY count DESC
      `,

      // Breakdown by page type
      sql`
        SELECT page_type AS "pageType", COUNT(*) AS count
        FROM knowledge_entries
        WHERE page_type IS NOT NULL
        GROUP BY page_type
        ORDER BY count DESC
      `,

      // Recent updates (last 10)
      sql`
        SELECT DISTINCT ON (source_url)
          title,
          source_url   AS "sourceUrl",
          updated_at   AS "updatedAt",
          page_type    AS "pageType"
        FROM knowledge_entries
        WHERE source_url IS NOT NULL AND source_url != ''
        ORDER BY source_url, updated_at DESC
        LIMIT 10
      `,

      // Recent failures from last run
      sql`
        SELECT
          f.url,
          f.error,
          f.attempted_at AS "attemptedAt"
        FROM crawl_failed_pages f
        INNER JOIN (
          SELECT run_id FROM crawl_stats ORDER BY started_at DESC LIMIT 1
        ) latest ON f.run_id = latest.run_id
        ORDER BY f.attempted_at DESC
        LIMIT 20
      `.catch(() => []), // Non-fatal if table is empty
    ])

    const dashboard: CrawlDashboardData = {
      lastRun: lastRunRows.length > 0 ? {
        runId: lastRunRows[0].runId,
        pagesCrawled: parseInt(lastRunRows[0].pagesCrawled) || 0,
        pagesFailed: parseInt(lastRunRows[0].pagesFailed) || 0,
        pagesUpdated: parseInt(lastRunRows[0].pagesUpdated) || 0,
        pagesSkipped: parseInt(lastRunRows[0].pagesSkipped) || 0,
        documentsProcessed: parseInt(lastRunRows[0].documentsProcessed) || 0,
        chunksCreated: parseInt(lastRunRows[0].chunksCreated) || 0,
        embeddingsCreated: parseInt(lastRunRows[0].embeddingsCreated) || 0,
        durationSeconds: parseInt(lastRunRows[0].durationSeconds) || 0,
        status: lastRunRows[0].status as any,
        startedAt: lastRunRows[0].startedAt?.toISOString?.() || '',
        completedAt: lastRunRows[0].completedAt?.toISOString?.() || undefined,
      } : null,

      totalEntries: parseInt(totalEntriesRows[0]?.count) || 0,

      byCategory: Object.fromEntries(
        byCategoryRows.map(r => [r.category, parseInt(r.count)])
      ),

      bySourceType: Object.fromEntries(
        bySourceTypeRows.map(r => [r.sourceType || 'unknown', parseInt(r.count)])
      ),

      byPageType: Object.fromEntries(
        byPageTypeRows.map(r => [r.pageType || 'general', parseInt(r.count)])
      ),

      recentUpdates: recentUpdatesRows.map(r => ({
        title: r.title,
        sourceUrl: r.sourceUrl,
        updatedAt: r.updatedAt?.toISOString?.() || '',
        pageType: r.pageType || 'general',
      })),

      recentFailures: (recentFailuresRows as any[]).map(r => ({
        url: r.url,
        error: r.error || 'Unknown error',
        attemptedAt: r.attemptedAt?.toISOString?.() || '',
      })),
    }

    return NextResponse.json(dashboard)
  } catch (error: any) {
    console.error('[CrawlStats API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load crawl statistics' },
      { status: 500 }
    )
  }
}
