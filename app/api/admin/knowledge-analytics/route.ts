import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { requireAdminAuth } from '@/lib/adminAuth'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    // Overview Metrics
    const totalEntriesRes = await sql`SELECT COUNT(*) as count FROM knowledge_entries`
    const totalChunksRes = await sql`SELECT COUNT(*) as count FROM document_chunks`
    const totalCategoriesRes = await sql`SELECT COUNT(DISTINCT category) as count FROM knowledge_entries`
    
    // Pinecone stats
    let totalVectors = 0
    let pineconeNamespaces: Record<string, number> = {}
    
    try {
      const index = pineconeIndex.get()
      if (index) {
        const stats = await index.describeIndexStats()
        totalVectors = stats.totalRecordCount || 0
        if (stats.namespaces) {
          for (const [ns, data] of Object.entries(stats.namespaces)) {
            pineconeNamespaces[ns] = data.recordCount || 0
          }
        }
      }
    } catch (e) {
      console.error('[KnowledgeAnalytics] Pinecone error:', e)
    }

    // Category Breakdown
    const categoryBreakdown = await sql`
      SELECT category, COUNT(id) as entry_count, COALESCE(SUM(total_chunks), COUNT(id)) as chunk_count, MAX(updated_at) as last_updated
      FROM knowledge_entries
      GROUP BY category
      ORDER BY entry_count DESC
    `

    // Namespace breakdown based on Pinecone
    const namespaces = Object.entries(pineconeNamespaces).map(([ns, count]) => ({
      namespace: ns,
      vector_count: count,
      health: 'good' // health logic will be added via orphan detection later or can be simple here
    })).sort((a, b) => b.vector_count - a.vector_count)

    return NextResponse.json({
      overview: {
        totalEntries: Number(totalEntriesRes[0]?.count) || 0,
        totalChunks: Number(totalChunksRes[0]?.count) || 0,
        totalCategories: Number(totalCategoriesRes[0]?.count) || 0,
        totalNamespaces: namespaces.length,
        totalVectors
      },
      categoryBreakdown,
      namespaces
    })
  } catch (error: any) {
    console.error('[KnowledgeAnalytics] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge analytics' }, { status: 500 })
  }
}
