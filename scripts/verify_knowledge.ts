/**
 * CUBOT — Knowledge Base Verification Script
 * Run: npx tsx scripts/verify_knowledge.ts
 *
 * Checks:
 *  1. Neon (PostgreSQL) — counts rows, shows latest entries
 *  2. Pinecone          — confirms vectors exist per namespace
 *  3. Cross-check       — finds DB entries with no Pinecone sync
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import sql from '../lib/db'
import { pineconeIndex } from '../lib/pinecone'

const BOLD  = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED   = '\x1b[31m'
const CYAN  = '\x1b[36m'
const RESET = '\x1b[0m'

function box(title: string) {
  console.log(`\n${BOLD}${CYAN}${'─'.repeat(60)}${RESET}`)
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`)
  console.log(`${BOLD}${CYAN}${'─'.repeat(60)}${RESET}`)
}

async function main() {
  console.log(`\n${BOLD}🔍 CUBOT Knowledge Base Verification${RESET}`)
  console.log(`   ${new Date().toLocaleString()}\n`)

  // ── 1. NEON (PostgreSQL) STATS ────────────────────────────────────────────
  box('1. NEON (PostgreSQL) Database')

  const [totalRow] = await sql`SELECT COUNT(*) as count FROM knowledge_entries`
  const totalEntries = parseInt(totalRow.count)
  console.log(`\n   Total entries:  ${GREEN}${BOLD}${totalEntries}${RESET}`)

  const [syncedRow] = await sql`
    SELECT COUNT(*) as count FROM knowledge_entries
    WHERE pinecone_synced_at IS NOT NULL
  `
  const synced = parseInt(syncedRow.count)
  const unsynced = totalEntries - synced
  console.log(`   Pinecone synced: ${GREEN}${synced}${RESET}`)
  console.log(`   Not synced yet:  ${unsynced > 0 ? RED : GREEN}${unsynced}${RESET}`)

  // Breakdown by source type
  const byType = await sql`
    SELECT source_type, COUNT(*) as count
    FROM knowledge_entries
    GROUP BY source_type
    ORDER BY count DESC
  `
  console.log(`\n   ${BOLD}By Source Type:${RESET}`)
  byType.forEach((r: any) => {
    console.log(`     ${r.source_type?.padEnd(12)} → ${CYAN}${r.count}${RESET} entries`)
  })

  // Breakdown by namespace
  const byNs = await sql`
    SELECT pinecone_namespace, COUNT(*) as count
    FROM knowledge_entries
    WHERE pinecone_namespace IS NOT NULL
    GROUP BY pinecone_namespace
    ORDER BY count DESC
    LIMIT 15
  `
  console.log(`\n   ${BOLD}By Namespace (top 15):${RESET}`)
  byNs.forEach((r: any) => {
    console.log(`     ${r.pinecone_namespace?.padEnd(18)} → ${CYAN}${r.count}${RESET} chunks`)
  })

  // Latest 5 entries added
  const latest = await sql`
    SELECT title, source_type, category, pinecone_namespace, created_at
    FROM knowledge_entries
    ORDER BY created_at DESC
    LIMIT 5
  `
  console.log(`\n   ${BOLD}Latest 5 Entries Added:${RESET}`)
  latest.forEach((r: any) => {
    const ts = r.created_at ? new Date(r.created_at).toLocaleString() : 'unknown'
    const title = (r.title || '').slice(0, 45).padEnd(45)
    console.log(`     ${GREEN}✓${RESET} ${title}  [${r.pinecone_namespace}]  ${YELLOW}${ts}${RESET}`)
  })

  // ── 2. PINECONE STATS ─────────────────────────────────────────────────────
  box('2. Pinecone Vector Store')

  const index = pineconeIndex.get()
  if (!index) {
    console.log(`   ${RED}✗ Pinecone index not available (check PINECONE_API_KEY)${RESET}`)
  } else {
    try {
      const stats = await index.describeIndexStats()
      const totalVectors = stats.totalRecordCount ?? 0
      console.log(`\n   Total vectors:   ${GREEN}${BOLD}${totalVectors}${RESET}`)

      const namespaceMap = stats.namespaces ?? {}
      const nsKeys = Object.keys(namespaceMap)
      console.log(`   Namespaces used: ${GREEN}${nsKeys.length}${RESET}`)
      
      if (nsKeys.length > 0) {
        console.log(`\n   ${BOLD}Vector Count by Namespace:${RESET}`)
        nsKeys
          .sort((a, b) => (namespaceMap[b]?.recordCount ?? 0) - (namespaceMap[a]?.recordCount ?? 0))
          .forEach(ns => {
            const count = namespaceMap[ns]?.recordCount ?? 0
            const bar = '█'.repeat(Math.min(Math.ceil(count / 5), 30))
            console.log(`     ${ns.padEnd(20)} ${CYAN}${bar}${RESET} ${count}`)
          })
      }

      // Cross-check: DB count vs Pinecone count
      box('3. Cross-Check: Neon ↔ Pinecone')
      const gap = totalEntries - totalVectors
      if (Math.abs(gap) <= 5) {
        console.log(`\n   ${GREEN}${BOLD}✅ In sync!${RESET}  Neon: ${totalEntries} entries | Pinecone: ${totalVectors} vectors (gap: ${gap})`)
      } else {
        console.log(`\n   ${YELLOW}⚠️  Gap detected!${RESET}  Neon: ${totalEntries} | Pinecone: ${totalVectors} | Difference: ${gap}`)
        console.log(`      This is normal if a crawl is still in progress.`)
      }

    } catch (err: any) {
      console.log(`   ${RED}✗ Could not fetch Pinecone stats: ${err.message}${RESET}`)
    }
  }

  // ── 3. UNSYNCED ENTRIES ───────────────────────────────────────────────────
  box('4. Entries NOT Synced to Pinecone')

  const unsynced_entries = await sql`
    SELECT title, source_url, created_at
    FROM knowledge_entries
    WHERE pinecone_synced_at IS NULL
    ORDER BY created_at DESC
    LIMIT 10
  `
  if (unsynced_entries.length === 0) {
    console.log(`\n   ${GREEN}✅ All entries are synced to Pinecone!${RESET}`)
  } else {
    console.log(`\n   ${YELLOW}⚠️  ${unsynced_entries.length} entries not yet in Pinecone:${RESET}`)
    unsynced_entries.forEach((r: any) => {
      console.log(`     ${RED}✗${RESET} ${(r.title || '').slice(0, 55)}`)
    })
  }

  console.log(`\n${BOLD}${'─'.repeat(60)}${RESET}`)
  console.log(`${GREEN}${BOLD}Verification complete.${RESET}\n`)
}

main().catch(e => {
  console.error(`${RED}Fatal error:${RESET}`, e.message)
  process.exit(1)
})
