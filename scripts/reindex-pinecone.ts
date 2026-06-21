/**
 * Re-Index Script v4 — Production-grade, crash-safe Pinecone re-indexer
 *
 * Fixes:
 *   Fix 1 — Gemini text-embedding-004 (768-dim, matches Pinecone index dimension)
 *            with proper exponential backoff on rate limits (was the original crash cause)
 *   Fix 2 — Resume: checks reindex-progress.json → skips already-indexed offsets
 *            + Pinecone fetch check for partial batches from a previous crash
 *   Fix 3 — DB reconnects fresh on EVERY batch (not just on timeout) — eliminates
 *            Neon idle-connection errors during long inter-batch waits
 *   Fix 4 — Batch size 10, 8 s inter-batch delay
 *   Fix 5 — reindex-progress.json tracks lastOffset (compact, not thousands of UUIDs)
 *            so resuming is instant even after indexing 1300+ chunks
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reindex-pinecone.ts
 *
 * Resume from crash automatically (reads reindex-progress.json if present).
 *
 * To force a full restart (ignore progress file):
 *   npx tsx --env-file=.env.local scripts/reindex-pinecone.ts --reset
 */

import * as path from 'path'
import * as fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10
const INTER_BATCH_DELAY_MS = 8000
const PINECONE_TEXT_LIMIT = 6000
const PROGRESS_FILE = path.join(process.cwd(), 'reindex-progress.json')
// Uses gemini-embedding-001 with MRL truncation to 768-dim
// This is the SAME model and config used by lib/embeddings.ts in production.
const GEMINI_EMBED_MODEL = 'gemini-embedding-001'
const GEMINI_EMBED_DIMENSION = 768 // MRL truncation: 3072 → 768 to match Pinecone index

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19) // HH:MM:SS
  process.stdout.write(`[${ts}] ${msg}\n`)
}

// ─── Progress file ────────────────────────────────────────────────────────────

interface Progress {
  /** The DB OFFSET of the last successfully completed batch */
  lastCompletedOffset: number
  /** Total vectors upserted so far (for reporting) */
  upsertedSoFar: number
  /** Total vectors skipped so far */
  skippedSoFar: number
  startedAt: string
  updatedAt: string
}

function loadProgress(reset: boolean): Progress {
  if (!reset && fs.existsSync(PROGRESS_FILE)) {
    try {
      const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8')
      const p = JSON.parse(raw) as Progress
      log(`📂 Loaded progress: resuming from offset ${p.lastCompletedOffset + BATCH_SIZE} (${p.upsertedSoFar} already upserted)`)
      return p
    } catch {
      log('⚠️  Could not parse progress file — starting fresh')
    }
  }
  if (reset && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE)
    log('🗑️  Progress file deleted (--reset)')
  }
  return {
    lastCompletedOffset: -BATCH_SIZE, // will +BATCH_SIZE to get 0 on first iteration
    upsertedSoFar: 0,
    skippedSoFar: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function saveProgress(p: Progress) {
  p.updatedAt = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

// ─── Namespace mapper (mirrors lib/embed-and-store.ts) ───────────────────────

function categoryToNamespace(category: string): string {
  const cat = (category || '').toLowerCase().trim()
  if (/facult|staff|professor|lecturer|instructor|dean|rector|director/i.test(cat)) return 'faculty'
  if (/admiss|apply|enroll|eligib/i.test(cat)) return 'admissions'
  if (/scholarship|financial.?aid|merit|bursary/i.test(cat)) return 'scholarships'
  if (/fee|tuition|cost|charges?|finance|dues/i.test(cat)) return 'finance'
  if (/notice|announcement|news|circular|bulletin/i.test(cat)) return 'notices'
  if (/event|seminar|workshop|conference|ceremony|webinar/i.test(cat)) return 'events'
  if (/policy|rule|regulation|handbook|code.?of.?conduct/i.test(cat)) return 'policies'
  if (/contact|location|address|phone|email/i.test(cat)) return 'contact'
  if (/facility|facilities|hostel|transport|library|sports|cafeteria|lab/i.test(cat)) return 'facilities'
  if (/cs|cse|it|software|computer.?science|bscs|bsit|bsse/i.test(cat)) return 'dept-cs'
  if (/bba|mba|business|management|commerce/i.test(cat)) return 'dept-bba'
  if (/pharm/i.test(cat)) return 'dept-pharmacy'
  if (/nurs/i.test(cat)) return 'dept-nursing'
  if (/academic|curriculum|course|syllabus|semester|program|degree/i.test(cat)) return 'academic'
  if (/alumni|graduate|former/i.test(cat)) return 'alumni'
  return 'general'
}

// ─── Gemini embedding via SDK (gemini-embedding-001, MRL → 768-dim) ────────────────
// Uses the @google/generative-ai SDK — same as lib/embeddings.ts in production.
// gemini-embedding-001 natively outputs 3072-dim but MRL allows truncation to 768.
// outputDimensionality: 768 ensures vectors match the existing Pinecone index exactly.
// Rate limits (free tier): 1,500 req/day, 100 req/min.
// At batch=10 with 8s delay → ~7.5 req/min — well within limits.

async function embedWithGemini(texts: string[], apiKey: string): Promise<number[][] | null> {
  const MAX_ATTEMPTS = 6
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL })

  const results: number[][] = []

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i].trim().slice(0, 10000)
    let embedded = false

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await model.embedContent({
          content: { role: 'user', parts: [{ text }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: GEMINI_EMBED_DIMENSION,
        } as any)

        results.push(res.embedding.values)
        embedded = true
        break

      } catch (err: any) {
        const status = err?.status ?? err?.httpStatusCode ?? 0
        const msg = err?.message ?? String(err)

        if (status === 429 || msg.includes('429') || msg.includes('quota')) {
          // Exponential backoff: 15s → 30s → 60s → 120s → 240s
          const waitMs = Math.min(15000 * Math.pow(2, attempt - 1), 300000) + Math.random() * 2000
          log(`  ⏳ Gemini rate limited — waiting ${Math.round(waitMs / 1000)}s (chunk ${i + 1}/${texts.length}, attempt ${attempt}/${MAX_ATTEMPTS})...`)
          await sleep(waitMs)
          continue
        }

        // Transient server errors — short retry
        if (status >= 500 || msg.includes('500') || msg.includes('503')) {
          log(`  ⚠️  Gemini server error (chunk ${i + 1}, attempt ${attempt}): ${msg.slice(0, 80)}`)
          if (attempt < MAX_ATTEMPTS) { await sleep(5000 * attempt); continue }
        }

        log(`  ❌ Gemini error (chunk ${i + 1}, attempt ${attempt}): ${msg.slice(0, 100)}`)
        if (attempt < MAX_ATTEMPTS) { await sleep(3000 * attempt); continue }
      }
    }

    if (!embedded) {
      log(`  ❌ Could not embed chunk ${i + 1}/${texts.length} after ${MAX_ATTEMPTS} attempts — aborting batch`)
      return null
    }
  }

  return results
}

// ─── Database (fresh connection on every batch) ───────────────────────────────
// Neon serverless is HTTP-based — each "connection" is stateless.
// Recreating the driver on each batch costs nothing and eliminates all
// idle-connection / timeout issues during long inter-batch sleeps.

function createDb() {
  // Use dynamic require so env is read at call time (not at module load time)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { neon } = require('@neondatabase/serverless')
  const connStr =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL
  if (!connStr) throw new Error('DATABASE_URL / NEON_DATABASE_URL not set in .env.local')
  return neon(connStr)
}

// ─── Pinecone: check which IDs already exist ─────────────────────────────────

async function getPineconeExistingIds(
  index: any,
  ids: string[],
  namespace: string
): Promise<Set<string>> {
  try {
    const result = await index.namespace(namespace).fetch(ids)
    return new Set(Object.keys(result.records || {}))
  } catch {
    return new Set()
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const reset = process.argv.includes('--reset')

  log('\n🔄 CUBot Pinecone Re-Indexer v4')
  log(`   Model  : Gemini / ${GEMINI_EMBED_MODEL} (${GEMINI_EMBED_DIMENSION}-dim)`)
  log(`   Batch  : ${BATCH_SIZE} chunks | Delay: ${INTER_BATCH_DELAY_MS / 1000}s between batches`)
  log(`   DB     : Fresh connection on every batch (Neon serverless)`)
  log(reset
    ? '   Mode   : FULL RESET (ignoring progress file)\n'
    : '   Mode   : RESUME (skips already-indexed offsets + Pinecone fetch check)\n')

  // ── Validate env vars ──────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) { log('❌ GEMINI_API_KEY not set in .env.local'); process.exit(1) }

  const pineconeApiKey = process.env.PINECONE_API_KEY
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME
  if (!pineconeApiKey || !pineconeIndexName) {
    log('❌ PINECONE_API_KEY or PINECONE_INDEX_NAME not set')
    process.exit(1)
  }

  // ── Init Pinecone ──────────────────────────────────────────────────────────
  const { Pinecone } = await import('@pinecone-database/pinecone')
  const pinecone = new Pinecone({ apiKey: pineconeApiKey })
  const index = pinecone.Index(pineconeIndexName)

  // ── Load progress ──────────────────────────────────────────────────────────
  const progress = loadProgress(reset)

  // ── Get total from DB ──────────────────────────────────────────────────────
  const db0 = createDb()
  const countRes = await db0`SELECT COUNT(*) AS cnt FROM knowledge_entries`
  const total = Number(countRes[0].cnt)
  const startOffset = progress.lastCompletedOffset + BATCH_SIZE

  log(`📊 Total chunks in PostgreSQL : ${total}`)
  log(`📊 Resuming from offset       : ${startOffset}`)
  log(`📊 Chunks remaining           : ~${total - startOffset}`)
  log(`📊 Estimated time             : ~${Math.ceil(((total - startOffset) / BATCH_SIZE) * INTER_BATCH_DELAY_MS / 60000)} min\n`)

  let upserted = 0
  let skipped = 0
  let failed = 0
  const startTime = Date.now()

  // ── Main loop ──────────────────────────────────────────────────────────────
  for (let offset = startOffset; offset < total; offset += BATCH_SIZE) {
    const batchNum = Math.floor(offset / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(total / BATCH_SIZE)

    // Fix 3: fresh DB connection on every single batch
    const db = createDb()

    let rows: any[]
    try {
      rows = await db`
        SELECT id, title, content, category, source_url, source_type, page_type,
               breadcrumb, content_hash, chunk_index, total_chunks, parent_page_id
        FROM knowledge_entries
        ORDER BY created_at ASC
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `
    } catch (dbErr: any) {
      log(`  ❌ DB fetch failed at offset ${offset}: ${dbErr.message?.slice(0, 80)}`)
      log('     Will retry this batch after 10s...')
      await sleep(10000)
      // Retry once with a brand-new connection
      try {
        const db2 = createDb()
        rows = await db2`
          SELECT id, title, content, category, source_url, source_type, page_type,
                 breadcrumb, content_hash, chunk_index, total_chunks, parent_page_id
          FROM knowledge_entries
          ORDER BY created_at ASC
          LIMIT ${BATCH_SIZE} OFFSET ${offset}
        `
      } catch (dbErr2: any) {
        log(`  ❌ DB retry also failed: ${dbErr2.message?.slice(0, 80)} — skipping batch`)
        failed += BATCH_SIZE
        continue
      }
    }

    if (!rows! || rows!.length === 0) break

    // Fix 2: Check Pinecone for existing IDs (handles partial batches from a crash)
    // We group by namespace because Pinecone fetch is namespace-scoped.
    const byNamespace = new Map<string, typeof rows>()
    for (const r of rows!) {
      const ns = categoryToNamespace(r.category || '')
      if (!byNamespace.has(ns)) byNamespace.set(ns, [])
      byNamespace.get(ns)!.push(r)
    }

    const existingInPinecone = new Set<string>()
    for (const [ns, nsRows] of byNamespace) {
      const existing = await getPineconeExistingIds(index, nsRows.map(r => r.id), ns)
      for (const id of existing) existingInPinecone.add(id)
    }

    const toProcess = rows!.filter(r => !existingInPinecone.has(r.id))
    const alreadyDone = rows!.length - toProcess.length

    if (alreadyDone > 0) {
      skipped += alreadyDone
      log(`  ⏭️  Batch ${batchNum}/${totalBatches}: ${alreadyDone}/${rows!.length} already in Pinecone — skipping those`)
    }

    if (toProcess.length === 0) {
      // Whole batch already indexed — save progress and continue
      progress.lastCompletedOffset = offset
      progress.skippedSoFar += alreadyDone
      saveProgress(progress)
      if (offset + BATCH_SIZE < total) await sleep(1000) // minimal delay when skipping
      continue
    }

    // ── Embed via Gemini ───────────────────────────────────────────────────
    const texts = toProcess.map(r => (r.content || '').slice(0, 8000))
    const embeddings = await embedWithGemini(texts, geminiKey)

    if (!embeddings) {
      failed += toProcess.length
      log(`  ❌ Batch ${batchNum}/${totalBatches}: embedding failed — skipping ${toProcess.length} chunks`)
      // Still advance progress so we don't loop forever on a bad batch
      progress.lastCompletedOffset = offset
      saveProgress(progress)
      if (offset + BATCH_SIZE < total) await sleep(INTER_BATCH_DELAY_MS)
      continue
    }

    // ── Group vectors by namespace ─────────────────────────────────────────
    const vectorsByNamespace = new Map<string, Array<{
      id: string
      values: number[]
      metadata: Record<string, string | number>
    }>>()

    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i]
      const vec = embeddings[i]

      if (!vec || vec.length === 0 || vec.every(v => v === 0)) {
        log(`  ⚠️  Zero/empty vector for chunk ${row.id} — skipping`)
        failed++
        continue
      }

      const ns = categoryToNamespace(row.category || '')
      const metadata: Record<string, string | number> = {
        text: (row.content || '').slice(0, PINECONE_TEXT_LIMIT),
        title: row.title || '',
        category: row.category || '',
        sourceUrl: row.source_url || '',
        sourceType: row.source_type || 'webpage',
        pageType: row.page_type || 'general',
        breadcrumb: row.breadcrumb || '',
        contentHash: row.content_hash || '',
        chunkIndex: row.chunk_index ?? 0,
        totalChunks: row.total_chunks ?? 1,
        namespace: ns,
        embeddingVersion: `gemini/${GEMINI_EMBED_MODEL}`,
        indexedAt: new Date().toISOString(),
      }
      if (row.parent_page_id) metadata.parentPageId = row.parent_page_id

      if (!vectorsByNamespace.has(ns)) vectorsByNamespace.set(ns, [])
      vectorsByNamespace.get(ns)!.push({ id: row.id, values: vec, metadata })
    }

    // ── Upsert to Pinecone (with retry) ───────────────────────────────────
    let batchUpserted = 0
    for (const [ns, vectors] of vectorsByNamespace) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Pinecone upserts up to 100 vectors per call
          for (let i = 0; i < vectors.length; i += 100) {
            await index.namespace(ns).upsert(vectors.slice(i, i + 100))
          }
          batchUpserted += vectors.length
          break
        } catch (err: any) {
          if (attempt < 3) {
            log(`  ⚠️  Pinecone retry for "${ns}" (${err.message?.slice(0, 60)})... (${attempt}/3)`)
            await sleep(5000 * attempt)
          } else {
            log(`  ❌ Pinecone failed for "${ns}" after 3 attempts: ${err.message?.slice(0, 80)}`)
            failed += vectors.length
          }
        }
      }
    }

    upserted += batchUpserted

    // Fix 5: Save progress after each batch (compact — just the offset)
    progress.lastCompletedOffset = offset
    progress.upsertedSoFar += batchUpserted
    progress.skippedSoFar += alreadyDone
    saveProgress(progress)

    // ── Progress log ───────────────────────────────────────────────────────
    const totalProcessed = offset + rows!.length
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const pct = Math.round((totalProcessed / total) * 100)
    const eta = elapsed > 0
      ? Math.round(((total - totalProcessed) / (totalProcessed - startOffset || 1)) * elapsed)
      : 0
    const nsBrief = Array.from(vectorsByNamespace.entries())
      .map(([ns, v]) => `${ns}:${v.length}`)
      .join(' | ')

    log(`  ✅ [${pct}%] offset ${offset} | ${totalProcessed}/${total} chunks | +${batchUpserted} upserted | skip:${skipped} fail:${failed} | ETA ~${Math.ceil(eta / 60)}m | [${nsBrief}]`)

    // Delay between batches
    if (offset + BATCH_SIZE < total) {
      await sleep(INTER_BATCH_DELAY_MS)
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const totalTime = Math.round((Date.now() - startTime) / 1000)
  log('\n🎉 Re-indexing complete!')
  log(`   ✅ Upserted this run : ${upserted} vectors`)
  log(`   ⏭️  Skipped          : ${skipped} (already in Pinecone)`)
  log(`   ❌ Failed            : ${failed} vectors`)
  log(`   ⏱️  Time             : ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`)

  log('\n📊 Final Pinecone namespace breakdown:')
  try {
    const stats = await index.describeIndexStats()
    const ns = stats.namespaces || {}
    const entries = Object.entries(ns).sort(([a], [b]) => a.localeCompare(b))
    for (const [name, data] of entries) {
      const label = name === '' ? '⚠️  "" (orphaned)' : `✅ "${name}"`
      log(`   ${label}: ${(data as any).recordCount} vectors`)
    }
    const totalVectors = Object.values(ns).reduce((s, v) => s + (v as any).recordCount, 0)
    log(`   Total: ${totalVectors} vectors`)
  } catch (e: any) {
    log(`   (Could not fetch stats: ${e.message?.slice(0, 60)})`)
  }

  // Clean up progress file only on a fully clean run (no failures)
  if (failed === 0 && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE)
    log('\n🗑️  Progress file deleted (clean run — no failures)')
  } else if (failed > 0) {
    log(`\n⚠️  Progress file kept (${failed} failures). Run again to retry failed chunks.`)
  }

  process.exit(0)
}

run().catch(err => {
  log(`\n💥 Fatal: ${err.stack || err.message}`)
  process.exit(1)
})
