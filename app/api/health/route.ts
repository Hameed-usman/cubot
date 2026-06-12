import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  let dbOk = false
  let redisOk = false
  let pineconeOk = false

  // 1. Check DB
  try {
    const res = await sql`SELECT 1 as ok`
    if (res && res.length > 0 && res[0].ok === 1) dbOk = true
  } catch (e) {
    console.error('DB Health Check Failed:', e)
  }

  // 2. Check Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (redisUrl && redisToken) {
    try {
      const res = await fetch(`${redisUrl}/ping`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      })
      if (res.ok) redisOk = true
    } catch (e) {
      console.error('Redis Health Check Failed:', e)
    }
  }

  // 3. Check Pinecone
  const pineconeKey = process.env.PINECONE_API_KEY
  if (pineconeKey) {
    try {
      const res = await fetch('https://api.pinecone.io/indexes', {
        headers: { 'Api-Key': pineconeKey }
      })
      if (res.ok) pineconeOk = true
    } catch (e) {
      console.error('Pinecone Health Check Failed:', e)
    }
  }

  return NextResponse.json({
    status: 'ok',
    database: dbOk,
    redis: redisOk,
    pinecone: pineconeOk,
    timestamp: new Date().toISOString()
  })
}
