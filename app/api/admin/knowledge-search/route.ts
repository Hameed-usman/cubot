import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import { hybridRetrieve, getTargetNamespaces, expandQuery } from '@/lib/retrieval'
import { rerank } from '@/lib/reranker'

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
    const apiKey = process.env.GROQ_API_KEY || ''
    
    // 1. Get query expansions
    const expandedQueries = await expandQuery(query, apiKey)
    
    // 2. Get target namespaces
    const namespaces = getTargetNamespaces(query)

    // 3. Run full retrieval
    const retrievedResult = await hybridRetrieve(query, 50, { expandQueries: true })

    const t1 = performance.now()

    // 4. Rerank top results
    const rerankedChunks = await rerank(query, retrievedResult.chunks)
    
    const t2 = performance.now()

    return NextResponse.json({
      success: true,
      originalQuery: query,
      rewrittenQueries: expandedQueries.filter(q => q !== query),
      namespaces,
      confidence: retrievedResult.confidence,
      pipeline: {
        retrieval_ms: Math.round(t1 - t0),
        rerank_ms: Math.round(t2 - t1),
        total_ms: Math.round(t2 - t0)
      },
      results: rerankedChunks.slice(0, 10).map(chunk => ({
        id: chunk.id,
        score: chunk.score,
        bm25Score: chunk.bm25Score || 0,
        rerankScore: chunk.rerankScore || chunk.score,
        metadata: chunk.metadata
      }))
    })
  } catch (err: any) {
    console.error('Knowledge Search error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
