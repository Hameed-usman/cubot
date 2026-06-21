/**
 * Retroactively reclassifies all existing chunks in the DB using the updated classifier.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reclassify-chunks.ts
 */

import { neon } from '@neondatabase/serverless'
import { classifyPage } from '../lib/classifier'

async function run() {
  const connStr = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!connStr) {
    console.error('❌ No DB URL set')
    process.exit(1)
  }

  const sql = neon(connStr)

  console.log('🔍 Fetching all chunks from the database...')
  const chunks = await sql`SELECT id, source_url, title, content, category FROM knowledge_entries`
  
  console.log(`📊 Found ${chunks.length} chunks. Reclassifying in batches...`)

  let changedCount = 0
  const categoryChanges: Record<string, number> = {}

  // Prepare updates
  const updates: Array<{ id: string, newCategory: string, pageType: string }> = []

  for (const chunk of chunks) {
    const { id, source_url, title, content, category: oldCategory } = chunk
    
    // Use the first 1000 chars of content to help the classifier
    const classification = classifyPage(source_url || '', title || '', (content || '').slice(0, 1000))
    const newCategory = classification.category

    if (newCategory !== oldCategory) {
      const key = `${oldCategory} -> ${newCategory}`
      categoryChanges[key] = (categoryChanges[key] || 0) + 1
      updates.push({ id, newCategory, pageType: classification.pageType })
    }
  }

  console.log(`⏳ Found ${updates.length} chunks that need updating...`)

  // Run in concurrent batches of 10
  const BATCH_SIZE = 10
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (update) => {
      let success = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const freshSql = neon(connStr)
          await freshSql`
            UPDATE knowledge_entries
            SET category = ${update.newCategory},
                page_type = ${update.pageType}
            WHERE id = ${update.id}
          `
          success = true
          break
        } catch (e) {
          if (attempt === 3) console.error(`Failed to update ${update.id}:`, e)
          await new Promise(r => setTimeout(r, 1000 * attempt))
        }
      }
    }))
    changedCount += batch.length
    console.log(`   Progress: ${changedCount} / ${updates.length}`)
  }

  console.log(`\n✅ Reclassification complete. ${changedCount} chunks updated.`)
  if (changedCount > 0) {
    console.log('\n🔄 Category Shifts:')
    for (const [shift, count] of Object.entries(categoryChanges)) {
      console.log(`   ${shift}: ${count} chunks`)
    }
    console.log('\n⚠️  IMPORTANT: You must run `npx tsx scripts/reindex-pinecone.ts` to sync these changes to Pinecone!')
  } else {
    console.log('\n👍 No changes needed. All chunks were already correctly classified.')
  }
}

run().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
