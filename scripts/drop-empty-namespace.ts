/**
 * Drop the orphaned "" (empty-string) namespace from the cubot-cu Pinecone index.
 * Run once, then delete this file.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/drop-empty-namespace.ts
 */

import { Pinecone } from '@pinecone-database/pinecone'

async function run() {
  const apiKey = process.env.PINECONE_API_KEY
  const indexName = process.env.PINECONE_INDEX_NAME

  if (!apiKey || !indexName) {
    console.error('❌ PINECONE_API_KEY or PINECONE_INDEX_NAME not set in .env.local')
    process.exit(1)
  }

  const pc = new Pinecone({ apiKey })
  const index = pc.Index(indexName)

  // Check stats before deletion
  console.log(`\n🔍 Checking index "${indexName}" before deletion...`)
  const before = await index.describeIndexStats()
  const ns = before.namespaces || {}
  const orphaned = (ns[''] as any)?.recordCount ?? 0
  console.log(`   ⚠️  "" namespace: ${orphaned} vectors (will be deleted)`)
  console.log(`   Total vectors across all namespaces: ${Object.values(ns).reduce((s, v) => s + (v as any).recordCount, 0)}`)

  if (orphaned === 0) {
    console.log('\n✅ "" namespace is already empty — nothing to do.')
    process.exit(0)
  }

  // Delete ALL vectors in the "" namespace
  console.log(`\n🗑️  Deleting all ${orphaned} vectors in the "" namespace...`)
  await index.namespace('').deleteAll()
  console.log('   Done.')

  // Confirm after deletion
  console.log('\n📊 Verifying — index stats after deletion:')
  // Brief pause so Pinecone has time to reflect the deletion
  await new Promise(r => setTimeout(r, 3000))
  const after = await index.describeIndexStats()
  const nsAfter = after.namespaces || {}
  const remaining = (nsAfter[''] as any)?.recordCount ?? 0
  if (remaining === 0) {
    console.log('   ✅ "" namespace is gone.')
  } else {
    console.log(`   ⚠️  "" namespace still shows ${remaining} vectors — may need a moment to propagate.`)
  }

  const entries = Object.entries(nsAfter).sort(([a], [b]) => a.localeCompare(b))
  for (const [name, data] of entries) {
    const label = name === '' ? '⚠️  "" (orphaned)' : `✅ "${name}"`
    console.log(`   ${label}: ${(data as any).recordCount} vectors`)
  }
  console.log(`   Total: ${Object.values(nsAfter).reduce((s, v) => s + (v as any).recordCount, 0)} vectors`)
  console.log()
}

run().catch(err => {
  console.error('💥 Fatal:', err.message)
  process.exit(1)
})
