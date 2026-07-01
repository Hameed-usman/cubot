import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    // 1. Get all IDs from PostgreSQL
    const dbEntries = await sql`SELECT id, category FROM knowledge_entries`
    const dbIds = new Set(dbEntries.map(e => e.id))
    const dbNamespaces = [...new Set(dbEntries.map(e => e.category || 'general'))]

    const orphansInDb: any[] = []
    const orphansInPinecone: string[] = []

    const index = pineconeIndex.get()
    if (!index) {
      return NextResponse.json({ error: 'Pinecone not initialized' }, { status: 500 })
    }

    const stats = await index.describeIndexStats()
    const namespaces = Object.keys(stats.namespaces || {})
    
    // Add any namespaces found in DB that aren't in Pinecone yet (to check if they should be)
    for (const ns of dbNamespaces) {
      if (!namespaces.includes(ns)) namespaces.push(ns)
    }

    // 2. Get all IDs from Pinecone across all namespaces
    const pineconeIds = new Set<string>()

    for (const ns of namespaces) {
      try {
        let paginationToken: string | undefined
        do {
          const results: any = await index.namespace(ns).listPaginated({ paginationToken })
          if (results.vectors) {
            for (const v of results.vectors) {
              pineconeIds.add(v.id)
            }
          }
          paginationToken = results.pagination?.next
        } while (paginationToken)
      } catch (e) {
        console.error(`[OrphanDetection] Error listing namespace ${ns}:`, e)
      }
    }

    // 3. Find Orphans in DB (has DB record, no Pinecone vector)
    for (const entry of dbEntries) {
      if (!pineconeIds.has(entry.id)) {
        orphansInDb.push(entry)
      }
    }

    // 4. Find Orphans in Pinecone (has Pinecone vector, no DB record)
    for (const pid of Array.from(pineconeIds)) {
      if (!dbIds.has(pid)) {
        orphansInPinecone.push(pid)
      }
    }

    return NextResponse.json({
      orphansInDb,
      orphansInPinecone,
      summary: {
        dbTotal: dbIds.size,
        pineconeTotal: pineconeIds.size,
        dbOrphansCount: orphansInDb.length,
        pineconeOrphansCount: orphansInPinecone.length
      }
    })
  } catch (err: any) {
    console.error('Orphan Detection error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { action, ids } = await req.json()
    // action: 'delete_from_db' | 'delete_from_pinecone'

    if (action === 'delete_from_db' && Array.isArray(ids) && ids.length > 0) {
      await sql`DELETE FROM knowledge_entries WHERE id = ANY(${ids})`
      return NextResponse.json({ success: true, message: `Deleted ${ids.length} records from DB` })
    }

    if (action === 'delete_from_pinecone' && Array.isArray(ids) && ids.length > 0) {
      const index = pineconeIndex.get()
      if (!index) return NextResponse.json({ error: 'Pinecone not initialized' }, { status: 500 })

      // We have to iterate namespaces to delete.
      const stats = await index.describeIndexStats()
      const namespaces = Object.keys(stats.namespaces || {})

      for (const ns of namespaces) {
        try {
          await index.namespace(ns).deleteMany(ids)
        } catch (e) {
          console.error(`[OrphanDetection] Error deleting from namespace ${ns}:`, e)
        }
      }
      return NextResponse.json({ success: true, message: `Attempted to delete ${ids.length} vectors from Pinecone` })
    }

    return NextResponse.json({ error: 'Invalid action or IDs' }, { status: 400 })
  } catch (err: any) {
    console.error('Orphan Detection POST error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
