/**
 * Admissions namespace diagnostic
 * Checks why 0 vectors ended up in the Pinecone "admissions" namespace.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/diagnose-admissions.ts
 */

const { neon } = require('@neondatabase/serverless')

const connStr = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!connStr) { console.error('❌ No DB URL set'); process.exit(1) }

const sql = neon(connStr)

async function run() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Admissions Namespace Diagnostic')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ── 1. Check how many chunks are actually classified as Admissions in DB ───
  const [catCount] = await sql`
    SELECT COUNT(*) AS cnt
    FROM knowledge_entries
    WHERE LOWER(category) LIKE '%admiss%'
  `
  console.log(`1️⃣  Chunks with category containing "admiss": ${catCount.cnt}`)

  // ── 2. All distinct categories that map to "admissions" namespace ──────────
  const admissCategories = await sql`
    SELECT DISTINCT category, COUNT(*) as cnt
    FROM knowledge_entries
    WHERE LOWER(category) SIMILAR TO '%(admiss|apply|enroll|eligib)%'
    GROUP BY category
    ORDER BY cnt DESC
  `
  console.log('\n   Categories mapping to admissions namespace:')
  if (admissCategories.length === 0) {
    console.log('   ⚠️  NONE — no chunks classified as Admissions in the DB')
  } else {
    admissCategories.forEach((r: any) => console.log(`   • "${r.category}": ${r.cnt} chunks`))
  }

  // ── 3. Search chunk CONTENT for admission keywords (regardless of category) ─
  const contentMatches = await sql`
    SELECT COUNT(*) AS cnt
    FROM knowledge_entries
    WHERE content ILIKE '%admiss%'
       OR content ILIKE '%apply%'
       OR content ILIKE '%enroll%'
       OR content ILIKE '%eligib%'
       OR content ILIKE '%requirement%'
  `
  console.log(`\n2️⃣  Chunks whose CONTENT mentions admissions keywords: ${contentMatches[0].cnt}`)

  // ── 4. What categories do those content-matching chunks actually have? ──────
  const contentCats = await sql`
    SELECT category, COUNT(*) AS cnt
    FROM knowledge_entries
    WHERE content ILIKE '%admiss%'
       OR content ILIKE '%apply%'
       OR content ILIKE '%enroll%'
       OR content ILIKE '%eligib%'
    GROUP BY category
    ORDER BY cnt DESC
    LIMIT 15
  `
  console.log('\n   Their actual categories (= what namespace they landed in):')
  contentCats.forEach((r: any) => console.log(`   • "${r.category}": ${r.cnt} chunks`))

  // ── 5. Check source_urls for anything that looks like an admissions page ───
  const admissUrls = await sql`
    SELECT DISTINCT source_url, category, COUNT(*) AS chunks
    FROM knowledge_entries
    WHERE source_url ILIKE '%admiss%'
       OR source_url ILIKE '%apply%'
       OR source_url ILIKE '%enroll%'
    GROUP BY source_url, category
    ORDER BY chunks DESC
    LIMIT 10
  `
  console.log(`\n3️⃣  Chunks from URLs containing admissions keywords: ${admissUrls.length}`)
  if (admissUrls.length === 0) {
    console.log('   ⚠️  NONE — no admissions URLs were scraped at all')
  } else {
    admissUrls.forEach((r: any) => console.log(`   • [${r.category}] (${r.chunks} chunks) ${r.source_url}`))
  }

  // ── 6. Show 3 example chunks that mention admissions in content ─────────────
  const examples = await sql`
    SELECT id, title, category, source_url,
           LEFT(content, 300) AS preview
    FROM knowledge_entries
    WHERE content ILIKE '%admiss%'
       OR content ILIKE '%enroll%'
       OR content ILIKE '%eligib%'
    LIMIT 3
  `
  console.log(`\n4️⃣  3 example chunks with admissions content:`)
  if (examples.length === 0) {
    console.log('   ⚠️  No chunks found — admissions content may not have been scraped')
  } else {
    examples.forEach((r: any, i: number) => {
      console.log(`\n   ── Example ${i + 1} ──`)
      console.log(`   Title    : ${r.title}`)
      console.log(`   Category : ${r.category}`)
      console.log(`   URL      : ${r.source_url}`)
      console.log(`   Preview  : ${r.preview.replace(/\n/g, ' ').trim()}`)
    })
  }

  // ── 7. Overall namespace distribution in DB ──────────────────────────────────
  const allCats = await sql`
    SELECT category, COUNT(*) AS cnt
    FROM knowledge_entries
    GROUP BY category
    ORDER BY cnt DESC
  `
  console.log('\n5️⃣  Full category distribution in knowledge_entries:')
  allCats.forEach((r: any) => console.log(`   • "${r.category}": ${r.cnt} chunks`))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

run().catch(err => {
  console.error('💥', err.message)
  process.exit(1)
})
