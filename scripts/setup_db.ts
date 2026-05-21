import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env FIRST — before any other imports
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import sql from '@/lib/db'

/**
 * Database migration script.
 * Usage: npm run setup-db
 */

const QUERIES = [
  // 1. Create base table
  `CREATE TABLE IF NOT EXISTS knowledge_entries (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general'
  )`,

  // 2. Add columns individually
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS source_url TEXT`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS page_type TEXT NOT NULL DEFAULT 'general'`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS breadcrumb TEXT`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS content_hash TEXT`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS chunk_index INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS total_chunks INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS parent_page_id UUID`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS search_vector tsvector`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,

  // 3. Create indexes
  `CREATE INDEX IF NOT EXISTS idx_knowledge_fts ON knowledge_entries USING gin(search_vector)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_page_type ON knowledge_entries(page_type)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_source_url ON knowledge_entries(source_url)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash ON knowledge_entries(content_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_parent_page_id ON knowledge_entries(parent_page_id)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_entries(source_type)`,

  // 4. Create trigger functions
  `CREATE OR REPLACE FUNCTION update_knowledge_search_vector() RETURNS TRIGGER AS $$
   BEGIN
       NEW.search_vector :=
           setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
           setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
           setweight(to_tsvector('english', COALESCE(NEW.page_type, '')), 'B') ||
           setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS trg_knowledge_search_vector ON knowledge_entries`,
  `CREATE TRIGGER trg_knowledge_search_vector
   BEFORE INSERT OR UPDATE ON knowledge_entries
   FOR EACH ROW EXECUTE FUNCTION update_knowledge_search_vector()`,

  `CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
   $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS trg_knowledge_updated_at ON knowledge_entries`,
  `CREATE TRIGGER trg_knowledge_updated_at
   BEFORE UPDATE ON knowledge_entries
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

  // 5. Create Crawl Stats tables
  `CREATE TABLE IF NOT EXISTS crawl_stats (
      id SERIAL PRIMARY KEY,
      run_id UUID NOT NULL,
      pages_crawled INTEGER NOT NULL DEFAULT 0,
      pages_failed INTEGER NOT NULL DEFAULT 0,
      pages_updated INTEGER NOT NULL DEFAULT 0,
      pages_skipped INTEGER NOT NULL DEFAULT 0,
      documents_processed INTEGER NOT NULL DEFAULT 0,
      chunks_created INTEGER NOT NULL DEFAULT 0,
      embeddings_created INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      error_log TEXT,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_crawl_stats_run_id ON crawl_stats(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_crawl_stats_started_at ON crawl_stats(started_at DESC)`,

  `CREATE TABLE IF NOT EXISTS crawl_failed_pages (
      id SERIAL PRIMARY KEY,
      run_id UUID NOT NULL,
      url TEXT NOT NULL,
      error TEXT,
      status_code INTEGER,
      attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_failed_pages_run_id ON crawl_failed_pages(run_id)`,

  // 6. Fix existing data search vectors
  `UPDATE knowledge_entries SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'C')
   WHERE search_vector IS NULL`
]

async function runMigration() {
  console.log('🗄️  Running database migration...\n')

  try {
    let successCount = 0
    for (const query of QUERIES) {
      try {
        await sql.query(query)
        successCount++
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
          console.warn(`  ⚠️  Warning on query: ${query.slice(0, 50)}... -> ${err.message}`)
        }
      }
    }

    console.log('✅ Migration complete')
    console.log(`   Statements executed: ${successCount}`)

    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `
    console.log(`\n📋 Tables in database:`)
    tables.forEach(t => console.log(`   ✓ ${t.table_name}`))

    const cols = await sql`
      SELECT COUNT(*) as count FROM information_schema.columns
      WHERE table_name = 'knowledge_entries'
    `
    console.log(`\n📊 knowledge_entries columns: ${cols[0].count}`)

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration()
