import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/namespaces
 * Returns all namespaces with aggregated stats from Neon + Pinecone.
 */
export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    // 1. Aggregate stats from Neon
    const neonStats = await sql`
      SELECT
        pinecone_namespace as namespace,
        COUNT(DISTINCT source_url) FILTER (WHERE source_url IS NOT NULL AND source_url != '') as total_urls,
        COUNT(*) as total_chunks,
        COUNT(DISTINCT id) as total_entries,
        AVG(LENGTH(content)) as avg_chunk_size,
        MAX(updated_at) as last_updated,
        MAX(last_scraped_at) as last_scraped,
        COUNT(*) FILTER (WHERE source_type = 'manual') as manual_count,
        COUNT(*) FILTER (WHERE source_type = 'scraper' OR source_type = 'web_scraper') as scraper_count,
        COUNT(pinecone_vector_id) as synced_vectors,
        COUNT(*) FILTER (WHERE pinecone_vector_id IS NULL) as unsynced_count
      FROM knowledge_entries
      WHERE pinecone_namespace IS NOT NULL
      GROUP BY pinecone_namespace
      ORDER BY total_chunks DESC
    `

    // 2. Get Pinecone namespace stats
    const index = pineconeIndex.get()
    let pineconeStats: Record<string, { vectorCount: number }> = {}

    if (index) {
      try {
        const stats = await index.describeIndexStats()
        pineconeStats = Object.fromEntries(
          Object.entries(stats.namespaces || {}).map(([ns, data]) => [
            ns,
            { vectorCount: (data as any).recordCount || (data as any).vectorCount || 0 },
          ])
        )
      } catch (e) {
        console.error('[NamespacesGET] Failed to fetch Pinecone stats:', e)
      }
    }

    // 3. Merge Neon and Pinecone data
    const namespaces = neonStats.map((row: any) => ({
      namespace: row.namespace,
      totalUrls: parseInt(row.total_urls || '0', 10),
      totalChunks: parseInt(row.total_chunks || '0', 10),
      totalEntries: parseInt(row.total_entries || '0', 10),
      avgChunkSize: Math.round(parseFloat(row.avg_chunk_size || '0')),
      lastUpdated: row.last_updated,
      lastScraped: row.last_scraped,
      manualCount: parseInt(row.manual_count || '0', 10),
      scraperCount: parseInt(row.scraper_count || '0', 10),
      syncedVectors: parseInt(row.synced_vectors || '0', 10),
      unsyncedCount: parseInt(row.unsynced_count || '0', 10),
      pineconeVectors: pineconeStats[row.namespace]?.vectorCount || 0,
      sourceTypes: [
        ...(parseInt(row.manual_count || '0', 10) > 0 ? ['manual'] : []),
        ...(parseInt(row.scraper_count || '0', 10) > 0 ? ['scraper'] : []),
      ],
      syncHealth: pineconeStats[row.namespace]
        ? Math.abs(
            (pineconeStats[row.namespace]?.vectorCount || 0) - parseInt(row.total_chunks || '0', 10)
          ) < 5
          ? 'healthy'
          : 'degraded'
        : 'unknown',
    }))

    // 4. Also include any Pinecone namespaces not in Neon
    const neonNamespaceNames = new Set(namespaces.map((n: any) => n.namespace))
    const pineconeOnlyNamespaces = Object.entries(pineconeStats)
      .filter(([ns]) => !neonNamespaceNames.has(ns))
      .map(([ns, data]) => ({
        namespace: ns,
        totalUrls: 0,
        totalChunks: 0,
        totalEntries: 0,
        avgChunkSize: 0,
        lastUpdated: null,
        lastScraped: null,
        manualCount: 0,
        scraperCount: 0,
        syncedVectors: 0,
        unsyncedCount: 0,
        pineconeVectors: data.vectorCount,
        sourceTypes: [],
        syncHealth: 'orphaned', // In Pinecone but not in Neon
      }))

    return NextResponse.json({
      namespaces: [...namespaces, ...pineconeOnlyNamespaces],
      totalNamespaces: namespaces.length + pineconeOnlyNamespaces.length,
      pineconeConfigured: !!index,
    })
  } catch (err: any) {
    console.error('[NamespacesGET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
