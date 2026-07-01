import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import { hybridRetrieve } from '@/lib/retrieval'
import { rerank } from '@/lib/reranker'
import { embedQuery } from '@/lib/embeddings'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { query } = await req.json()
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const t0 = performance.now()

    // We can simulate what hybridRetrieve does internally or just call it.
    // hybridRetrieve already handles intent routing, expanding, and retrieving.
    const retrievedResult = await hybridRetrieve(query)

    const t1 = performance.now()

    const rerankedChunks = await rerank(query, retrievedResult.chunks)
    
    const t2 = performance.now()

    return NextResponse.json({
      success: true,
      query,
      pipeline: {
        retrieval_ms: Math.round(t1 - t0),
        rerank_ms: Math.round(t2 - t1),
        total_ms: Math.round(t2 - t0)
      },
      results: rerankedChunks.slice(0, 10).map(chunk => ({
        id: chunk.id,
        score: chunk.score,
        rerankScore: chunk.rerankScore || chunk.score,
        metadata: chunk.metadata
      }))
    })
  } catch (err: any) {
    console.error('Knowledge Search error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
