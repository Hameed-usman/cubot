/**
 * Migration: Add persistent Pinecone mapping columns to knowledge_entries.
 * Run: npx tsx scripts/migrate-pinecone-mapping.ts
 */
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const sql = neon(process.env.NEON_DATABASE_URL!)

async function migrate() {
  console.log('🚀 Running Pinecone mapping migration...')

  // Add columns if not exist
  await sql`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS pinecone_vector_id TEXT`
  console.log('✅ pinecone_vector_id column ensured')

  await sql`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS pinecone_namespace TEXT`
  console.log('✅ pinecone_namespace column ensured')

  await sql`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'gemini-embedding-001'`
  console.log('✅ embedding_model column ensured')

  await sql`ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS pinecone_synced_at TIMESTAMP WITH TIME ZONE`
  console.log('✅ pinecone_synced_at column ensured')

  // Backfill: in this system the knowledge_entry id IS used as the Pinecone vector id
  // So we can safely backfill pinecone_vector_id = id for all existing records.
  const result = await sql`
    UPDATE knowledge_entries
    SET pinecone_vector_id = id::TEXT
    WHERE pinecone_vector_id IS NULL
  `
  console.log(`✅ Backfilled pinecone_vector_id for existing records`)

  // Backfill namespace from category using the same mapping logic
  await sql`
    UPDATE knowledge_entries
    SET pinecone_namespace = CASE
      WHEN category ~* 'facult|staff|professor|lecturer|instructor|dean|rector|director' THEN 'faculty'
      WHEN category ~* 'admiss|apply|enroll|eligib' THEN 'admissions'
      WHEN category ~* 'scholarship|financial.?aid|merit|bursary' THEN 'scholarships'
      WHEN category ~* 'fee|tuition|cost|charges?|finance|dues' THEN 'finance'
      WHEN category ~* 'notice|announcement|news|circular|bulletin' THEN 'notices'
      WHEN category ~* 'event|seminar|workshop|conference|ceremony|webinar' THEN 'events'
      WHEN category ~* 'policy|rule|regulation|handbook|code.?of.?conduct' THEN 'policies'
      WHEN category ~* 'contact|location|address|phone|email' THEN 'contact'
      WHEN category ~* 'facility|facilities|hostel|transport|library|sports|cafeteria|lab' THEN 'facilities'
      WHEN category ~* 'cs|cse|it|software|computer.?science|bscs|bsit|bsse' THEN 'dept-cs'
      WHEN category ~* 'bba|mba|business|management|commerce' THEN 'dept-bba'
      WHEN category ~* 'pharm' THEN 'dept-pharmacy'
      WHEN category ~* 'nurs' THEN 'dept-nursing'
      WHEN category ~* 'academic|curriculum|course|syllabus|semester|program|degree' THEN 'academic'
      WHEN category ~* 'alumni|graduate|former' THEN 'alumni'
      ELSE 'general'
    END
    WHERE pinecone_namespace IS NULL
  `
  console.log('✅ Backfilled pinecone_namespace from category')

  // Verify
  const counts = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(pinecone_vector_id) as with_vector_id,
      COUNT(pinecone_namespace) as with_namespace
    FROM knowledge_entries
  `
  console.log('\n📊 Verification:')
  console.log(`   Total entries:    ${counts[0].total}`)
  console.log(`   With vector_id:   ${counts[0].with_vector_id}`)
  console.log(`   With namespace:   ${counts[0].with_namespace}`)
  console.log('\n✨ Migration complete!')
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
