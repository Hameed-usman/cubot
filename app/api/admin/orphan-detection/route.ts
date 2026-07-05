import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/orphan-detection
 * Compares Neon knowledge_entries with Pinecone vectors to find:
 * 1. DB records that have no corresponding Pinecone vector
 * 2. Pinecone vectors that have no corresponding DB record
 */
export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const index = pineconeIndex.get()
    if (!index) {
      return NextResponse.json({ error: 'Pinecone not configured' }, { status: 503 })
    }

    // 1. Get all DB records with their vector IDs
    const dbEntries = await sql`
      SELECT id, pinecone_vector_id, pinecone_namespace, category
      FROM knowledge_entries
      WHERE pinecone_vector_id IS NOT NULL
    `

    const dbVectorIds = new Set<string>(dbEntries.map((e: any) => e.pinecone_vector_id || e.id))
    const dbIdSet = new Set<string>(dbEntries.map((e: any) => String(e.id)))

    // 2. Get Pinecone namespace stats
    const stats = await index.describeIndexStats()
    const namespaces = Object.entries(stats.namespaces || {})

    let pineconeTotal = 0
    const orphansInPinecone: string[] = []
    const orphansInDb: Array<{ id: string; category: string }> = []

    // 3. For each namespace, list vectors and cross-reference
    for (const [ns, nsData] of namespaces) {
      const nsCount = (nsData as any).recordCount || (nsData as any).vectorCount || 0
      pineconeTotal += nsCount

      try {
        const listResult = await index.namespace(ns).listPaginated({ limit: 100 })
        const vectorIds = (listResult.vectors || []).map((v: any) => v.id)

        for (const vid of vectorIds) {
          if (!dbVectorIds.has(vid) && !dbIdSet.has(vid)) {
            orphansInPinecone.push(vid)
          }
        }
      } catch (e) {
        console.error(`[OrphanDetection] Failed to list vectors in namespace "${ns}":`, e)
      }
    }

    // 4. DB records missing Pinecone sync
    const unsyncedEntries = await sql`
      SELECT id, category, pinecone_vector_id
      FROM knowledge_entries
      WHERE pinecone_synced_at IS NULL
        AND pinecone_vector_id IS NOT NULL
      LIMIT 100
    `

    for (const entry of unsyncedEntries) {
      orphansInDb.push({
        id: String(entry.id),
        category: entry.category || 'unknown',
      })
    }

    return NextResponse.json({
      summary: {
        dbTotal: dbEntries.length,
        pineconeTotal,
        dbOrphansCount: orphansInDb.length,
        pineconeOrphansCount: orphansInPinecone.length,
      },
      orphansInDb,
      orphansInPinecone,
    })
  } catch (err: any) {
    console.error('[OrphanDetection] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/orphan-detection
 * Take action on detected orphans.
 * Body: { action: 'delete_from_pinecone' | 'delete_from_db', ids: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { action, ids } = await req.json()

    if (!action || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'action and ids are required' }, { status: 400 })
    }

    const index = pineconeIndex.get()

    if (action === 'delete_from_pinecone' && index) {
      const stats = await index.describeIndexStats()
      const namespaceNames = Object.keys(stats.namespaces || {})

      for (const ns of namespaceNames) {
        try {
          await index.namespace(ns).deleteMany(ids)
        } catch (e) {
          // Ignore errors for namespaces that don't contain these IDs
        }
      }

      return NextResponse.json({
        success: true,
        message: `Attempted deletion of ${ids.length} orphan vectors across ${namespaceNames.length} namespaces`,
      })
    }

    if (action === 'delete_from_db') {
      if (ids.length > 0) {
        await sql`DELETE FROM knowledge_entries WHERE id::TEXT = ANY(${ids})`
      }
      return NextResponse.json({
        success: true,
        message: `Deleted ${ids.length} orphan records from Neon`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('[OrphanDetectionPOST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
