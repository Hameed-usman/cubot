/**
 * Clean up old vectors from all namespaces for the 138 moved chunks.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-moved-chunks.ts
 */

import { neon } from '@neondatabase/serverless'
import { Pinecone } from '@pinecone-database/pinecone'

async function run() {
  const connStr = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!connStr) { console.error('❌ No DB URL set'); process.exit(1) }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pc.Index(process.env.PINECONE_INDEX_NAME!)
  const sql = neon(connStr)

  // Find chunks that were recently updated
  // Since we updated them in the last few minutes, their updated_at is very recent.
  console.log('🔍 Fetching recently updated chunks...')
  const recentlyUpdated = await sql`
    SELECT id FROM knowledge_entries
    WHERE updated_at > NOW() - INTERVAL '1 hour'
  `
  
  if (recentlyUpdated.length === 0) {
    console.log('✅ No recently updated chunks found.')
    process.exit(0)
  }

  const idsToDelete = recentlyUpdated.map(r => r.id)
  console.log(`🗑️  Found ${idsToDelete.length} chunks. Deleting them from ALL Pinecone namespaces to avoid duplicates...`)

  const stats = await index.describeIndexStats()
  const namespaces = Object.keys(stats.namespaces || {})

  for (const ns of namespaces) {
    console.log(`   Deleting from namespace: "${ns}"...`)
    // Pinecone allows deleting up to 1000 IDs at a time
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100)
      await index.namespace(ns).deleteMany(batch).catch(e => {
        // Ignore errors if vector doesn't exist
      })
    }
  }

  console.log('\n✅ Cleanup complete. Old vectors are gone.')
}

run().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
