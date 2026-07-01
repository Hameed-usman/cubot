import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { requireAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    // Metrics
    const today = await sql`SELECT COUNT(*) as count FROM conversations WHERE created_at >= NOW() - INTERVAL '1 day'`
    const thisWeek = await sql`SELECT COUNT(*) as count FROM conversations WHERE created_at >= NOW() - INTERVAL '7 days'`
    const thisMonth = await sql`SELECT COUNT(*) as count FROM conversations WHERE created_at >= NOW() - INTERVAL '30 days'`
    const totalUsers = await sql`SELECT COUNT(DISTINCT session_id) as count FROM conversations`
    const totalMessages = await sql`SELECT COUNT(*) as count FROM conversations`

    // Most Asked
    const mostAsked = await sql`
      SELECT query, COUNT(*) as count
      FROM retrieval_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY query
      ORDER BY count DESC
      LIMIT 10
    `

    // Language Distribution
    const languages = await sql`
      SELECT COALESCE(language, 'unknown') as language, COUNT(*) as count
      FROM conversations
      GROUP BY COALESCE(language, 'unknown')
      ORDER BY count DESC
    `

    // Intent Distribution
    const intents = await sql`
      SELECT COALESCE(intent, 'unknown') as intent, COUNT(*) as count
      FROM retrieval_logs
      GROUP BY COALESCE(intent, 'unknown')
      ORDER BY count DESC
    `

    // Daily Volume (for chart)
    const volume = await sql`
      SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as count
      FROM conversations
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `

    // Confidence
    const confidenceDist = await sql`
      SELECT confidence, COUNT(*) as count
      FROM retrieval_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
    `

    // Latency
    const stats = await sql`
      SELECT 
        COALESCE(AVG(retrieval_ms), 0) as avg_retrieval,
        COALESCE(AVG(total_ms), 0) as avg_total,
        COALESCE(AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END), 0) as cache_hit_rate
      FROM retrieval_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
    `

    const noDataRate = await sql`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN confidence = 'no_data' THEN 1 ELSE 0 END), 0) as no_data_count
      FROM retrieval_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
    `

    return NextResponse.json({
      metrics: {
        today: Number(today[0]?.count) || 0,
        thisWeek: Number(thisWeek[0]?.count) || 0,
        thisMonth: Number(thisMonth[0]?.count) || 0,
        totalUsers: Number(totalUsers[0]?.count) || 0,
        totalMessages: Number(totalMessages[0]?.count) || 0,
      },
      topQueries: mostAsked,
      languages,
      intents,
      volume,
      confidenceDist,
      stats: stats[0] || {},
      noDataRate: noDataRate[0] || { total: 0, no_data_count: 0 }
    })
  } catch (error: any) {
    console.error('[ConversationAnalytics] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch conversation analytics' }, { status: 500 })
  }
}
