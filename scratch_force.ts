import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import sql from '@/lib/db'

async function run() {
  const columns = [
    `source_url TEXT`,
    `source_type TEXT NOT NULL DEFAULT 'manual'`,
    `page_type TEXT NOT NULL DEFAULT 'general'`,
    `breadcrumb TEXT`,
    `content_hash TEXT`,
    `chunk_index INTEGER NOT NULL DEFAULT 0`,
    `total_chunks INTEGER NOT NULL DEFAULT 1`,
    `parent_page_id UUID`,
    `search_vector tsvector`,
    `last_scraped_at TIMESTAMP WITH TIME ZONE`,
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
  ]

  for (const col of columns) {
    try {
      await sql.unsafe(`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS ${col}`)
      console.log(`Added: ${col}`)
    } catch (e: any) {
      console.error(`Failed: ${col} -> ${e.message}`)
    }
  }
}
run()
