import sql from '../lib/db'

async function audit() {
  try {
    console.log('🔍 Starting Deep Database Audit...')

    // 1. Check for Dental/BDS content
    const dentalData = await sql`
      SELECT id, title, category, LEFT(text, 100) as snippet 
      FROM knowledge_entries 
      WHERE text ILIKE '%dental%' OR text ILIKE '%BDS%' OR text ILIKE '%dentistry%'
      LIMIT 10
    `
    console.log(`\n✅ Dental/BDS Chunks Found: ${dentalData.length}`)
    if (dentalData.length > 0) console.table(dentalData)

    // 2. Namespace distribution
    const namespaces = await sql`
      SELECT category, count(*) as count 
      FROM knowledge_entries 
      GROUP BY category 
      ORDER BY count DESC
    `
    console.log('\n📊 Namespace Distribution:')
    console.table(namespaces)

    // 3. Check for specific Dental URLs in crawl stats
    const dentalUrls = await sql`
      SELECT url, status, error_log 
      FROM crawl_stats 
      WHERE url ILIKE '%dental%' OR url ILIKE '%bds%'
      LIMIT 5
    `
    console.log(`\n🌐 Crawl Stats for Dental Pages: ${dentalUrls.length}`)
    if (dentalUrls.length > 0) console.table(dentalUrls)

    // 4. Log check
    const totalEntries = await sql`SELECT count(*) as count FROM knowledge_entries`
    console.log(`\n📚 Total Indexed Chunks: ${totalEntries[0].count}`)

  } catch (error) {
    console.error('❌ Audit Failed:', error)
  }
}

audit().then(() => process.exit(0))
