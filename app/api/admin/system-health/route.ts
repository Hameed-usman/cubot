import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import sql from '@/lib/db'
import { pineconeIndex } from '@/lib/pinecone'
import { embedText } from '@/lib/embeddings'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const health = {
      database: { status: 'checking', details: '' },
      redis: { status: 'checking', details: '' },
      pinecone: { status: 'checking', details: '' },
      embedding: { status: 'checking', details: '' },
      crawlers: { status: 'idle', details: '' }
    }

    // 1. Database
    try {
      const dbRes = await sql`SELECT 1 as ok`
      if (dbRes.length > 0) {
        health.database.status = 'operational'
        health.database.details = 'Connected to Neon PostgreSQL'
      } else {
        health.database.status = 'degraded'
      }
    } catch (e: any) {
      health.database.status = 'down'
      health.database.details = e.message
    }

    // 2. Redis
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
      if (redisUrl && redisToken) {
        const res = await fetch(`${redisUrl}/ping`, {
          headers: { Authorization: `Bearer ${redisToken}` }
        })
        if (res.ok) {
          health.redis.status = 'operational'
          health.redis.details = 'Connected to Upstash Redis'
        } else {
          health.redis.status = 'down'
          health.redis.details = `Status: ${res.status}`
        }
      } else {
        health.redis.status = 'down'
        health.redis.details = 'Missing Upstash credentials'
      }
    } catch (e: any) {
      health.redis.status = 'down'
      health.redis.details = e.message
    }

    // 3. Pinecone
    try {
      const index = pineconeIndex.get()
      if (index) {
        const stats = await index.describeIndexStats()
        health.pinecone.status = 'operational'
        health.pinecone.details = `Index ready. ${stats.totalRecordCount} vectors.`
      } else {
        health.pinecone.status = 'down'
        health.pinecone.details = 'Pinecone client not initialized'
      }
    } catch (e: any) {
      health.pinecone.status = 'down'
      health.pinecone.details = e.message
    }

    // 4. Embedding Provider (Gemini)
    try {
      // Just test a quick embedding to ensure connectivity and valid API key
      const testEmbed = await embedText("test")
      if (testEmbed && testEmbed.length > 0) {
        health.embedding.status = 'operational'
        health.embedding.details = 'Gemini API responding'
      } else {
        health.embedding.status = 'degraded'
        health.embedding.details = 'Failed to generate embedding'
      }
    } catch (e: any) {
      health.embedding.status = 'down'
      health.embedding.details = e.message
    }

    // 5. Crawlers
    try {
      const runRes = await sql`SELECT status, updated_at FROM crawl_runs ORDER BY updated_at DESC LIMIT 1`
      if (runRes.length > 0) {
        health.crawlers.status = runRes[0].status
        health.crawlers.details = `Last update: ${new Date(runRes[0].updated_at).toLocaleString()}`
      }
    } catch (e: any) {
      health.crawlers.status = 'unknown'
      health.crawlers.details = e.message
    }

    return NextResponse.json(health)
  } catch (err: any) {
    console.error('System Health GET error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
