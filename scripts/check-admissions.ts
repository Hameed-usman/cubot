import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import sql from '../lib/db'

async function main() {
  const rows = await sql`
    SELECT title, source_url, chunk_index, LEFT(content, 200) as preview
    FROM knowledge_entries
    WHERE category ILIKE '%admiss%'
       OR source_url ILIKE '%admiss%'
       OR content ILIKE '%admission%'
    ORDER BY last_scraped_at DESC
    LIMIT 10
  `
  console.table(rows)
  process.exit(0)
}

main().catch(console.error)
