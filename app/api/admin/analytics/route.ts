import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getServerSession } from 'next-auth'
import { requireAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes


    // 1. Get volume over last 7 days
    const volume = await sql`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as count
      FROM query_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `

    // 2. Confidence distribution
    const confidenceDist = await sql`
      SELECT confidence, COUNT(*) as count
      FROM query_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1
    `

    // 3. Top queries
    const topQueries = await sql`
      SELECT query, COUNT(*) as count
      FROM query_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `

    // 4. Latency metrics
    const stats = await sql`
      SELECT 
        COALESCE(AVG(retrieval_ms), 0) as avg_retrieval,
        COALESCE(AVG(total_ms), 0) as avg_total,
        COALESCE(AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END), 0) as cache_hit_rate
      FROM query_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
    `

    // 5. Hallucination/No Data rate
    const noDataRate = await sql`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN confidence = 'no_data' THEN 1 ELSE 0 END), 0) as no_data_count
      FROM query_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
    `

    return NextResponse.json({
      volume,
      confidenceDist,
      topQueries,
      stats: stats[0] || {},
      noDataRate: noDataRate[0] || { total: 0, no_data_count: 0 }
    })
  } catch (error) {
    console.error('[Analytics] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
