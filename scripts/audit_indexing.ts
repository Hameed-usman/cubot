import sql from '../lib/db'

async function check() {
  console.log('--- Checking Knowledge ---')
  const k = await sql`SELECT count(*) FROM knowledge_entries WHERE content ILIKE '%dental%'`
  console.log('KNOWLEDGE_COUNT:' + k[0].count)

  console.log('--- Checking Failed Pages ---')
  const f = await sql`SELECT url, error FROM crawl_failed_pages WHERE url ILIKE '%dental%'`
  f.forEach(p => console.log(`FAILED: ${p.url} -> ${p.error}`))
}
check().catch(console.error)
