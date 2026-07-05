import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { embedQuery } from '@/lib/embeddings'
import { pineconeIndex } from '@/lib/pinecone'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/namespaces/test
 * Run a knowledge coverage test against a specific namespace.
 * Embeds the query, retrieves top chunks from Pinecone, then generates an answer.
 */
export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { namespace, question } = await req.json()
    if (!namespace || !question) {
      return NextResponse.json({ error: 'namespace and question are required' }, { status: 400 })
    }

    const startMs = Date.now()

    // 1. Embed the query
    let queryEmbedding: number[]
    try {
      queryEmbedding = await embedQuery(question)
    } catch (e: any) {
      return NextResponse.json({ error: 'Failed to embed query: ' + e.message }, { status: 500 })
    }

    // 2. Query Pinecone
    const index = pineconeIndex.get()
    if (!index) {
      return NextResponse.json({ error: 'Pinecone not configured' }, { status: 503 })
    }

    const retrievalStart = Date.now()
    const queryResponse = await index.namespace(namespace).query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    })
    const retrievalMs = Date.now() - retrievalStart

    const matches = queryResponse.matches || []
    const topChunks = matches.map((m: any) => ({
      id: m.id,
      score: m.score,
      text: (m.metadata?.text || '').slice(0, 500),
      sourceUrl: m.metadata?.sourceUrl || '',
      title: m.metadata?.title || '',
      category: m.metadata?.category || namespace,
    }))

    // 3. Calculate confidence
    const topScore = matches[0]?.score || 0
    const confidence = topScore >= 0.75 ? 'high' : topScore >= 0.55 ? 'medium' : topScore >= 0.35 ? 'low' : 'none'

    // 4. Generate answer using Groq (if available)
    let answer = ''
    const groqApiKey = process.env.GROQ_API_KEY
    if (groqApiKey && topChunks.length > 0) {
      try {
        const contextText = topChunks
          .map((c: any, i: number) => `[${i + 1}] ${c.text}`)
          .join('\n\n')

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'user',
                content: `Based on the following context from namespace "${namespace}", answer the question concisely.\n\nContext:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`,
              },
            ],
            temperature: 0.1,
            max_tokens: 300,
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (response.ok) {
          const data = await response.json()
          answer = data.choices?.[0]?.message?.content?.trim() || ''
        }
      } catch (e) {
        console.error('[NamespaceTest] Groq error:', e)
      }
    }

    const totalMs = Date.now() - startMs

    // 5. Pass/fail based on whether useful chunks were found
    const passed = topChunks.length > 0 && (confidence === 'high' || confidence === 'medium')

    return NextResponse.json({
      namespace,
      question,
      result: {
        passed,
        confidence,
        topScore: Math.round(topScore * 100) / 100,
        retrievedChunks: topChunks,
        answer,
        retrievalMs,
        totalMs,
        chunkCount: topChunks.length,
      },
    })
  } catch (err: any) {
    console.error('[NamespaceTest] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
