import sql from '../lib/db'

async function check() {
  try {
    console.log('--- Checking Knowledge Entries (Successful) ---')
    const successful = await sql`
      SELECT id, title, category, source_url
      FROM knowledge_entries 
      WHERE content ILIKE '%dental%' OR content ILIKE '%bds%' OR content ILIKE '%dentistry%'
         OR title ILIKE '%dental%' OR title ILIKE '%bds%' OR title ILIKE '%dentistry%'
      LIMIT 10
    `
    console.table(successful)

    console.log('\n--- Checking Failed Pages (Crawl Errors) ---')
    const failed = await sql`
      SELECT id, url, error
      FROM crawl_failed_pages 
      WHERE url ILIKE '%dental%' OR url ILIKE '%bds%' OR url ILIKE '%dentistry%'
      LIMIT 10
    `
    console.table(failed)

    if (successful.length === 0 && failed.length === 0) {
      console.log('\n⚠️ NO DENTAL DATA FOUND IN DATABASE (Success or Failure).')
      console.log('This likely means the scraper never even saw these links.')
    } else {
      console.log(`\n✅ Results: ${successful.length} success, ${failed.length} failed.`)
    }

  } catch (err) {
    console.error('Check failed:', err)
  }
  process.exit(0)
}

check()
