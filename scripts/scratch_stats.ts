import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import sql from '../lib/db'

async function getFullStats() {
  try {
    console.log('=== TABLES IN DATABASE ===')
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `

    for (const t of tables) {
      try {
        const result = await sql.unsafe(`SELECT COUNT(*) as cnt FROM "${t.table_name}"`)
        console.log(`  ${t.table_name}: ${result[0].cnt} rows`)
      } catch {
        console.log(`  ${t.table_name}: (could not count)`)
      }
    }

    console.log('\n=== CRAWL QUEUE STATUS ===')
    const queue = await sql`SELECT status, COUNT(*) as count FROM crawl_queue GROUP BY status`
    if (queue.length === 0) console.log('  Queue is EMPTY')
    for (const row of queue) console.log(`  ${row.status}: ${row.count} URLs`)

    console.log('\n=== SCRAPED PAGES (PostgreSQL FTS) ===')
    const pages = await sql`SELECT COUNT(*) as cnt, COUNT(DISTINCT url) as urls FROM scraped_pages`
    console.log(`  Total rows: ${pages[0].cnt}`)
    console.log(`  Unique URLs: ${pages[0].urls}`)

    console.log('\n=== KNOWLEDGE ENTRIES (FTS chunks) ===')
    const ke = await sql`SELECT COUNT(*) as cnt FROM knowledge_entries`
    console.log(`  Total text chunks: ${ke[0].cnt}`)
    
    console.log('\n=== PINECONE (Vector Store) ===')
    console.log('  (Run scratch_namespaces.ts separately for Pinecone stats)')

  } catch (error: any) {
    console.error('Error:', error.message)
  } finally {
    process.exit(0)
  }
}

getFullStats()
