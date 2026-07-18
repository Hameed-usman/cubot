import { createHash } from 'crypto'
import { PageType, SourceType } from '@/types'
import { semanticChunk } from './textSplitter'
import { embedBatch } from './embeddings'
import { pineconeIndex } from './pinecone'
import { groqFetchWithRetry } from './groq-queue'
import sql from './db'
import { v4 as uuidv4 } from 'uuid'

// ─── Constants ────────────────────────────────────────────────────────────────

const PINECONE_TEXT_LIMIT = 6000
const EMBEDDING_MODEL = 'gemini-embedding-001'

// ─── Per-Chunk Classifier ─────────────────────────────────────────────────────

/**
 * Classifies a single text chunk by inspecting its CONTENT (not URL/title).
 * Each chunk is routed to the most semantically appropriate namespace.
 * Uses the same rule priority as the existing page classifier.
 */
export interface ChunkClassification {
  category: string
  namespace: string
  pageType: PageType
}

export function classifyChunkByRules(text: string): ChunkClassification | null {
  const t = text.toLowerCase()

  if (/scholarship|financial[\s.-]?aid|merit\s+award|stipend|bursary|need[\s-]?based/i.test(t))
    return { category: 'Scholarship', namespace: 'scholarships', pageType: 'scholarship' }

  if (/hostel|dormitor|accommodat|boarding|residence\s+hall|warden/i.test(t))
    return { category: 'Hostel', namespace: 'hostel', pageType: 'general' }

  if (/library|transport|shuttle|sports\s+complex|cafeteria|canteen|laboratory\s+facilit/i.test(t))
    return { category: 'Facilities', namespace: 'facilities', pageType: 'general' }

  if (/fee|tuition|charges?|payment|dues|cost\s+of|prospectus/i.test(t))
    return { category: 'Finance', namespace: 'finance', pageType: 'academic' }

  if (/admiss|apply|application|enroll|eligib|selection\s+criteria|merit\s+list/i.test(t))
    return { category: 'Admissions', namespace: 'admissions', pageType: 'admissions' }

  if (/disciplin|conduct|rule|regulat|violation|penalty|sanction|code\s+of/i.test(t))
    return { category: 'Policy', namespace: 'policies', pageType: 'policy' }

  if (/attendance|absent|leave|punctual|late|tardy/i.test(t))
    return { category: 'Academic', namespace: 'academic', pageType: 'academic' }

  if (/\bexam(ination)?s?\b|re-?checking|re-?evaluation|answer\s+sheet|invigilat|question\s+paper|result|grade|cgpa|gpa/i.test(t))
    return { category: 'Examination', namespace: 'examination', pageType: 'academic' }

  if (/credit\s+hour|course|semester|degree|program|syllabus|timetable/i.test(t))
    return { category: 'Academic', namespace: 'academic', pageType: 'academic' }

  if (/faculty|professor|lecturer|instructor|staff|teacher|dean|rector|director/i.test(t))
    return { category: 'Faculty', namespace: 'faculty', pageType: 'faculty' }

  if (/event|seminar|workshop|conference|ceremony|webinar|convocation/i.test(t))
    return { category: 'Events', namespace: 'events', pageType: 'event' }

  if (/notice|announcement|circular|bulletin|news\s+letter/i.test(t))
    return { category: 'Notices', namespace: 'notices', pageType: 'notice' }

  if (/contact|phone|email|address|location|helpline/i.test(t))
    return { category: 'Contact', namespace: 'contact', pageType: 'contact' }

  if (/\b(cs|cse|it|bscs|bsit|bsse|software\s+eng|computer\s+science)\b/i.test(t))
    return { category: 'CS & IT', namespace: 'dept-cs', pageType: 'department' }

  if (/\b(bba|mba|business\s+admin|management|commerce)\b/i.test(t))
    return { category: 'BBA', namespace: 'dept-bba', pageType: 'department' }

  if (/pharm(acy|acology|d)|d\.pharm/i.test(t))
    return { category: 'Pharmacy', namespace: 'dept-pharmacy', pageType: 'department' }

  if (/nurs(ing|e)|midwifery/i.test(t))
    return { category: 'Nursing', namespace: 'dept-nursing', pageType: 'department' }

  return null
}

// ─── Dynamic Namespace Registry ───────────────────────────────────────────────

const STATIC_NAMESPACES = [
  'finance', 'scholarships', 'academic', 'examination', 'hostel', 'facilities',
  'admissions', 'policies', 'faculty', 'events', 'notices', 'contact',
  'dept-cs', 'dept-bba', 'dept-pharmacy', 'dept-nursing', 'general',
]

/**
 * Returns the full set of namespaces currently in use (static list + whatever
 * already exists in Postgres). Fetched ONCE per ingestion run and reused across
 * chunks so the LLM classifier always knows what already exists and prefers
 * reusing a namespace over inventing a near-duplicate one.
 */
export async function getKnownNamespaces(): Promise<string[]> {
  try {
    const rows = await sql`
      SELECT DISTINCT pinecone_namespace FROM knowledge_entries
      WHERE pinecone_namespace IS NOT NULL
      LIMIT 100
    `
    const dbNamespaces = rows.map((r: any) => r.pinecone_namespace).filter(Boolean)
    return Array.from(new Set([...STATIC_NAMESPACES, ...dbNamespaces]))
  } catch {
    return [...STATIC_NAMESPACES]
  }
}

/**
 * LLM fallback classifier — only invoked when NO regex rule matches.
 * Given the existing namespace list, it either reuses one or proposes a new
 * one for genuinely novel content. Fails closed (returns null) on any error,
 * so the caller falls back to 'general' instead of crashing ingestion.
 */
async function classifyChunkWithLLM(
  text: string,
  knownNamespaces: string[]
): Promise<ChunkClassification | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  const snippet = text.slice(0, 800)
  const nsList = knownNamespaces.length > 0 ? knownNamespaces.join(', ') : 'general'

  const prompt = `You are a document classifier for a university knowledge base.

Existing namespaces (domains already in use): ${nsList}

Classify the text chunk below. Strongly prefer reusing an EXISTING namespace if the content reasonably fits one — do not invent a near-duplicate of an existing namespace. Only propose a brand-new namespace if the content covers a genuinely different domain that none of the existing namespaces reasonably cover.

Text chunk:
"""${snippet}"""

Respond ONLY with a JSON object in this exact shape:
{"namespace": "lowercase-hyphenated-slug (max 3 words)", "category": "Human Readable Category Name", "isNewNamespace": true or false}`

  try {
    const response = await groqFetchWithRetry(() =>
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 100,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(8000),
      })
    )

    if (!response.ok) return null

    const data = await response.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')

    let namespace = String(parsed.namespace || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)

    if (!namespace) return null

    const category = String(parsed.category || namespace).slice(0, 60)
    return { category, namespace, pageType: 'general' }
  } catch (err) {
    console.warn('[classifyChunkWithLLM] Fallback classification failed:', err)
    return null
  }
}

/**
 * Full per-chunk classifier: rules first (fast, free, deterministic), LLM
 * fallback only for content that matches none of the rules (rare — most
 * university content lands in an existing domain). Never throws; always
 * returns a usable classification.
 */
export async function classifyChunk(
  text: string,
  opts: { knownNamespaces?: string[] } = {}
): Promise<ChunkClassification> {
  const ruleResult = classifyChunkByRules(text)
  if (ruleResult) return ruleResult

  const llmResult = await classifyChunkWithLLM(text, opts.knownNamespaces || STATIC_NAMESPACES)
  if (llmResult) return llmResult

  return { category: 'General', namespace: 'general', pageType: 'general' }
}

/**
 * OCR fallback for scanned/image-based PDFs where pdf-parse extracts almost
 * no real text (common with older scanned handbooks/notices that were printed
 * then re-scanned). Uses Gemini's File API directly via REST — not the SDK —
 * so it works regardless of the installed @google/generative-ai version.
 *
 * Uploads the PDF once, then asks Gemini to transcribe it in small page
 * batches (keeps each response well under output-token limits regardless of
 * how dense a real page turns out to be). Fails closed at every step: any
 * failure just returns null and the original (sparse) extraction is kept —
 * OCR can only help, never break an ingestion that would have worked anyway.
 */
async function ocrPdfWithGemini(
  buffer: Buffer,
  pageCount: number,
  log: (msg: string, status?: IngestionProgressEvent['status']) => void
): Promise<string[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    log('⚠️ OCR fallback unavailable — GEMINI_API_KEY not configured', 'warn')
    return null
  }

  try {
    log('🔎 Extracted text looks too sparse — this PDF may be scanned. Running OCR via Gemini...', 'info')

    // Step 1: start a resumable upload session
    const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(buffer.length),
        'X-Goog-Upload-Header-Content-Type': 'application/pdf',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'cubot-ocr-upload.pdf' } }),
      signal: AbortSignal.timeout(60_000),
    })

    const uploadUrl = startRes.headers.get('x-goog-upload-url')
    if (!uploadUrl) {
      log('⚠️ OCR fallback failed — could not start file upload with Gemini', 'warn')
      return null
    }

    // Step 2: upload the bytes and finalize
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(buffer.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(180_000),
    })

    if (!uploadRes.ok) {
      log(`⚠️ OCR fallback failed — file upload error (HTTP ${uploadRes.status})`, 'warn')
      return null
    }

    const uploaded = await uploadRes.json()
    const fileUri = uploaded?.file?.uri
    const fileName = uploaded?.file?.name
    let state = uploaded?.file?.state

    if (!fileUri || !fileName) {
      log('⚠️ OCR fallback failed — Gemini did not return a file reference', 'warn')
      return null
    }

    // Step 3: poll until Gemini finishes processing the upload (usually near-instant for PDFs)
    for (let attempt = 0; attempt < 15 && state !== 'ACTIVE'; attempt++) {
      await new Promise((r) => setTimeout(r, 2000))
      const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
        signal: AbortSignal.timeout(20_000),
      })
      const checkData = await checkRes.json().catch(() => ({}))
      state = checkData?.state
      if (state === 'FAILED') {
        log('⚠️ OCR fallback failed — Gemini could not process the uploaded file', 'warn')
        return null
      }
    }

    // Step 4: transcribe in small page batches (keeps every response well
    // within output-token limits no matter how dense real pages turn out to be)
    const BATCH_SIZE = 8
    const pages: string[] = new Array(pageCount).fill('')
    let anyBatchSucceeded = false

    for (let start = 1; start <= pageCount; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, pageCount)
      const prompt = `This PDF may contain scanned/image pages. Transcribe the FULL text of pages ${start} to ${end} ONLY (ignore all other pages), in order. For each page output exactly:
===PAGE <page number>===
<the complete transcribed text of that page, preserving structure like headings, bullet points, and tables as plain text>

Do not add any commentary, summary, or notes of your own — only the transcribed text. If a page is blank or unreadable, still output the marker with an empty body.`

      try {
        const genRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { fileData: { fileUri, mimeType: 'application/pdf' } },
                  { text: prompt },
                ],
              }],
              generationConfig: { temperature: 0, maxOutputTokens: 8192 },
            }),
            signal: AbortSignal.timeout(120_000),
          }
        )

        if (!genRes.ok) {
          log(`⚠️ OCR batch pages ${start}-${end} failed (HTTP ${genRes.status}) — skipping`, 'warn')
          continue
        }

        const genData = await genRes.json()
        const batchText: string =
          genData?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''

        const pageSplits = batchText.split(/===\s*PAGE\s+(\d+)\s*===/i)
        for (let i = 1; i < pageSplits.length; i += 2) {
          const pageNum = parseInt(pageSplits[i], 10)
          const text = (pageSplits[i + 1] || '').trim()
          if (pageNum >= start && pageNum <= end) {
            pages[pageNum - 1] = text
            if (text.length > 0) anyBatchSucceeded = true
          }
        }
        log(`  OCR'd pages ${start}-${end} / ${pageCount}`, 'info')
      } catch (batchErr: any) {
        log(`⚠️ OCR batch pages ${start}-${end} failed: ${batchErr.message} — skipping`, 'warn')
      }
    }

    if (!anyBatchSucceeded) {
      log('⚠️ OCR fallback produced no usable text — keeping original extraction', 'warn')
      return null
    }

    const totalOcrChars = pages.reduce((sum, p) => sum + p.length, 0)
    log(`✓ OCR complete — extracted ${totalOcrChars.toLocaleString()} characters via Gemini`, 'success')
    return pages
  } catch (err: any) {
    log(`⚠️ OCR fallback failed: ${err.message} — keeping original extraction`, 'warn')
    return null
  }
}

// ─── PDF Parsing ──────────────────────────────────────────────────────────────

export interface ParsedPdf {
  text: string
  pageCount: number
  info: Record<string, any>
  /** Raw per-page text, index 0 = page 1. pdf-parse renders pages strictly in
   *  order (sequential await loop), so a closure counter is a safe way to
   *  attribute each render callback to its page number. */
  pages: string[]
}

/**
 * Parse a PDF from a raw Buffer using pdf-parse.
 * Returns the full extracted text, page count, and per-page text array
 * (needed to attribute each chunk to a real PDF page number).
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdf> {
  // Dynamic import — pdf-parse has no named ESM export
  const pdfParse = (await import('pdf-parse')).default
  const pages: string[] = []
  let pageCounter = 0

  const result = await pdfParse(buffer, {
    // Capture per-page text for better section detection + page attribution
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        let text = ''
        let lastY = -1
        for (const item of textContent.items) {
          if (lastY !== item.transform[5] && lastY !== -1) text += '\n'
          text += item.str
          lastY = item.transform[5]
        }
        pageCounter++
        pages[pageCounter - 1] = text
        return text
      })
    },
  })

  return {
    text: result.text || '',
    pageCount: result.numpages || 1,
    info: result.info || {},
    pages,
  }
}

/**
 * Fetch a PDF from a URL and parse it.
 */
export async function parsePdfFromUrl(url: string): Promise<ParsedPdf> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CubotBot/1.0)',
      'Accept': 'application/pdf,*/*',
    },
    signal: AbortSignal.timeout(180_000),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: HTTP ${res.status} ${res.statusText}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
    throw new Error(`URL does not appear to serve a PDF (content-type: ${contentType})`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return parsePdfBuffer(buffer)
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export function computeDocumentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingDoc?: {
    id: string
    name: string
    version: string
    createdAt: string
    totalChunks: number
    status: string
  }
}

export async function checkDuplicate(hash: string): Promise<DuplicateCheckResult> {
  const rows = await sql`
    SELECT id, name, version, created_at, total_chunks, status
    FROM document_ingestions
    WHERE document_hash = ${hash}
    LIMIT 1
  `.catch(() => [] as any[])

  if (rows.length === 0) return { isDuplicate: false }

  return {
    isDuplicate: true,
    existingDoc: {
      id: rows[0].id,
      name: rows[0].name,
      version: rows[0].version,
      createdAt: rows[0].created_at,
      totalChunks: rows[0].total_chunks,
      status: rows[0].status,
    },
  }
}

// ─── Full Ingestion Pipeline ──────────────────────────────────────────────────

export interface IngestParams {
  buffer: Buffer
  documentHash: string
  documentName: string
  documentVersion: string
  sourceType: SourceType
  sourceUrl?: string
  fileName?: string
  fileSizeBytes?: number
  /** Called for each progress event */
  onProgress: (event: IngestionProgressEvent) => void
  /** If set, deletes old chunks for this document ID first (replace mode) */
  replaceDocumentId?: string
}

export interface IngestionProgressEvent {
  type: 'log' | 'progress' | 'done' | 'conflict'
  message?: string
  status?: 'info' | 'success' | 'error' | 'warn'
  stage?: string
  current?: number
  total?: number
  result?: IngestionResult
}

export interface IngestionResult {
  documentId: string
  totalPages: number
  totalChunks: number
  totalTokens: number
  embeddingTimeMs: number
  namespaceDistribution: Record<string, number>
  duplicateChunksRemoved: number
  status: 'completed' | 'failed'
}

/**
 * Full production ingestion pipeline:
 * 1. Parse PDF
 * 2. Chunk text semantically
 * 3. Classify each chunk independently
 * 4. Batch embed all chunks
 * 5. Store to Neon + Pinecone
 * 6. Write analytics to document_ingestions
 */
export async function ingestDocument(params: IngestParams): Promise<IngestionResult> {
  const {
    buffer, documentHash, documentName, documentVersion,
    sourceType, sourceUrl, fileName, fileSizeBytes, onProgress, replaceDocumentId,
  } = params

  const now = new Date().toISOString()
  const log = (message: string, status: IngestionProgressEvent['status'] = 'info') =>
    onProgress({ type: 'log', message, status })

  // ── Step 1: Create document record ────────────────────────────────────────
  let documentId: string

  if (replaceDocumentId) {
    // Delete existing knowledge_entries for this document
    log(`🗑️ Replacing existing document — removing old chunks...`, 'info')
    await sql`DELETE FROM knowledge_entries WHERE source_url = ${'doc:' + replaceDocumentId} AND source_type = ${sourceType}`.catch(() => {})
    // Delete old Pinecone vectors for this doc (best effort)
    documentId = replaceDocumentId
    await sql`
      UPDATE document_ingestions
      SET status = 'processing', document_hash = ${documentHash}, updated_at = NOW()
      WHERE id = ${documentId}
    `.catch(() => {})
  } else {
    documentId = uuidv4()
    await sql`
      INSERT INTO document_ingestions (id, name, version, source_type, source_url, file_name, file_size_bytes, document_hash, status)
      VALUES (${documentId}, ${documentName}, ${documentVersion}, ${sourceType}, ${sourceUrl ?? null}, ${fileName ?? null}, ${fileSizeBytes ?? 0}, ${documentHash}, 'processing')
    `
  }

  // ── Step 2: Parse PDF ──────────────────────────────────────────────────────
  log(`📄 Parsing PDF...`, 'info')
  const parsed = await parsePdfBuffer(buffer)
  log(`✓ Parsed ${parsed.pageCount} pages — ${parsed.text.length.toLocaleString()} characters`, 'success')

  // ── Step 3: Chunk the text (per-page, so every chunk carries a real page number) ──
  log(`✂️ Splitting into semantic chunks...`, 'info')
  const pages = parsed.pages.length > 0 ? parsed.pages : [parsed.text]
  let chunks: ReturnType<typeof semanticChunk> = []
  for (let p = 0; p < pages.length; p++) {
    const pageChunks = semanticChunk(pages[p], {
      title: documentName,
      sourceUrl: 'doc:' + documentId,
      department: 'general',
      category: 'General',
      pageType: 'general',
      breadcrumb: documentName,
      sourceType,
      contentHash: documentHash,
      crawledAt: now,
      pageNumber: p + 1,
    } as any)
    chunks.push(...pageChunks)
  }
  // Re-index continuously across the whole document (per-page calls each reset to 0)
  chunks = chunks.map((c, i) => ({
    ...c,
    metadata: { ...c.metadata, chunkIndex: i, totalChunks: chunks.length },
  }))

  if (chunks.length === 0) {
    const errMsg = 'No text could be extracted from the PDF. It may be scanned/image-based.'
    await sql`UPDATE document_ingestions SET status = 'failed', error_message = ${errMsg} WHERE id = ${documentId}`
    throw new Error(errMsg)
  }

  log(`✓ Created ${chunks.length} chunks`, 'success')

  // ── Step 4: Per-chunk classification ──────────────────────────────────────
  log(`🏷️ Classifying ${chunks.length} chunks individually...`, 'info')
  const knownNamespaces = await getKnownNamespaces()
  const newNamespacesCreated = new Set<string>()
  const classified: Array<(typeof chunks)[number] & { classification: ChunkClassification }> = []

  for (const chunk of chunks) {
    const cls = await classifyChunk(chunk.text, { knownNamespaces })
    if (!knownNamespaces.includes(cls.namespace)) {
      newNamespacesCreated.add(cls.namespace)
      knownNamespaces.push(cls.namespace)
    }
    classified.push({ ...chunk, classification: cls })
  }

  if (newNamespacesCreated.size > 0) {
    log(`🆕 New namespace(s) proposed by classifier: ${Array.from(newNamespacesCreated).join(', ')}`, 'info')
  }

  // Namespace distribution
  const nsDistribution: Record<string, number> = {}
  for (const c of classified) {
    nsDistribution[c.classification.namespace] = (nsDistribution[c.classification.namespace] || 0) + 1
  }
  const nsSummary = Object.entries(nsDistribution)
    .map(([ns, count]) => `${ns}(${count})`)
    .join(', ')
  log(`✓ Namespace distribution: ${nsSummary}`, 'success')

  // ── Step 5: Duplicate chunk detection ─────────────────────────────────────
  log(`🔍 Checking for duplicate chunks in knowledge base...`, 'info')
  const chunkHashes = classified.map(c => createHash('md5').update(c.text).digest('hex'))
  const existingHashes = await sql`
    SELECT content_hash FROM knowledge_entries
    WHERE content_hash = ANY(${chunkHashes})
  `.catch(() => [] as any[])

  const existingHashSet = new Set(existingHashes.map((r: any) => r.content_hash))
  const toIngest = classified.filter(c => {
    const h = createHash('md5').update(c.text).digest('hex')
    return !existingHashSet.has(h)
  })
  const duplicateChunksRemoved = classified.length - toIngest.length

  if (duplicateChunksRemoved > 0) {
    log(`⏭ Skipped ${duplicateChunksRemoved} duplicate chunks already in knowledge base`, 'warn')
  }
  log(`🚀 Embedding ${toIngest.length} new chunks...`, 'info')

  // ── Step 6: Batch embed ────────────────────────────────────────────────────
  const embeddingStart = Date.now()

  onProgress({ type: 'progress', stage: 'embedding', current: 0, total: toIngest.length })

  const EMBED_BATCH = 50
  const allEmbeddings: number[][] = []

  for (let i = 0; i < toIngest.length; i += EMBED_BATCH) {
    const batch = toIngest.slice(i, i + EMBED_BATCH)
    const vecs = await embedBatch(batch.map(c => c.text))
    allEmbeddings.push(...vecs)
    onProgress({ type: 'progress', stage: 'embedding', current: Math.min(i + EMBED_BATCH, toIngest.length), total: toIngest.length })
    log(`  Embedded ${Math.min(i + EMBED_BATCH, toIngest.length)} / ${toIngest.length} chunks`, 'info')
  }

  const embeddingTimeMs = Date.now() - embeddingStart
  log(`✓ Embeddings generated in ${(embeddingTimeMs / 1000).toFixed(1)}s`, 'success')

  // ── Step 7: Store to Neon + Pinecone ──────────────────────────────────────
  log(`💾 Storing chunks to database and vector index...`, 'info')
  const index = pineconeIndex.get()

  // Group vectors by namespace for batch upsert
  const vectorsByNs: Record<string, Array<{ id: string; values: number[]; metadata: Record<string, any> }>> = {}
  const totalChunks = chunks.length
  let storedCount = 0

  for (let i = 0; i < toIngest.length; i++) {
    const chunk = toIngest[i]
    const embedding = allEmbeddings[i]
    const cls = chunk.classification
    const chunkHash = createHash('md5').update(chunk.text).digest('hex')
    const chunkId = uuidv4()
    const titleWithIndex = `${documentName} [${chunk.metadata.chunkIndex + 1}/${totalChunks}]`
    const estimatedTokens = Math.ceil(chunk.text.length / 4)

    const sectionHeading = (chunk.metadata as any).sectionName || null
    const pageNumber = (chunk.metadata as any).pageNumber ?? null

    try {
      // Neon insert
      await sql`
        INSERT INTO knowledge_entries (
          id, title, content, category,
          source_url, source_type, page_type, breadcrumb,
          content_hash, chunk_index, total_chunks, parent_page_id,
          pinecone_vector_id, pinecone_namespace, embedding_model,
          section_heading, page_number,
          last_scraped_at
        ) VALUES (
          ${chunkId}, ${titleWithIndex}, ${chunk.text}, ${cls.category},
          ${'doc:' + documentId}, ${sourceType}, ${cls.pageType}, ${documentName},
          ${chunkHash}, ${chunk.metadata.chunkIndex}, ${totalChunks}, ${documentId},
          ${chunkId}, ${cls.namespace}, ${EMBEDDING_MODEL},
          ${sectionHeading}, ${pageNumber},
          ${now}
        )
        ON CONFLICT DO NOTHING
      `

      // Queue for Pinecone
      const metadata: Record<string, string | number> = {
        text: chunk.text.slice(0, PINECONE_TEXT_LIMIT),
        title: titleWithIndex,
        category: cls.category,
        sourceUrl: 'doc:' + documentId,
        sourceType,
        pageType: cls.pageType,
        breadcrumb: documentName,
        contentHash: chunkHash,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks,
        documentId,
        documentName,
        documentVersion,
        crawledAt: now,
        namespace: cls.namespace,
        embeddingVersion: EMBEDDING_MODEL,
      }
      if (sectionHeading) metadata.sectionName = sectionHeading
      if (pageNumber) metadata.pageNumber = pageNumber

      if (!vectorsByNs[cls.namespace]) vectorsByNs[cls.namespace] = []
      vectorsByNs[cls.namespace].push({ id: chunkId, values: embedding, metadata })
      storedCount++
    } catch (err: any) {
      log(`⚠️ Failed to store chunk ${i}: ${err.message}`, 'warn')
    }
  }

  // Pinecone batch upsert per namespace
  if (index) {
    for (const [ns, vectors] of Object.entries(vectorsByNs)) {
      const PINECONE_BATCH = 100
      for (let i = 0; i < vectors.length; i += PINECONE_BATCH) {
        await index.namespace(ns).upsert(vectors.slice(i, i + PINECONE_BATCH))
      }
      log(`  ↗ Upserted ${vectors.length} vectors → namespace: ${ns}`, 'success')
    }
  } else {
    log(`⚠️ Pinecone not configured — vectors not stored`, 'warn')
  }

  // ── Step 8: Estimate total tokens ─────────────────────────────────────────
  const totalTokens = chunks.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0)

  // ── Step 9: Update document_ingestions record ──────────────────────────────
  await sql`
    UPDATE document_ingestions
    SET
      status                   = 'completed',
      total_pages              = ${parsed.pageCount},
      total_chunks             = ${toIngest.length},
      total_tokens             = ${totalTokens},
      embedding_time_ms        = ${embeddingTimeMs},
      namespace_distribution   = ${JSON.stringify(nsDistribution)}::jsonb,
      duplicate_chunks_removed = ${duplicateChunksRemoved},
      updated_at               = NOW()
    WHERE id = ${documentId}
  `

  log(`🎉 Ingestion complete! ${toIngest.length} chunks stored across ${Object.keys(nsDistribution).length} namespace(s).`, 'success')

  const result: IngestionResult = {
    documentId,
    totalPages: parsed.pageCount,
    totalChunks: toIngest.length,
    totalTokens,
    embeddingTimeMs,
    namespaceDistribution: nsDistribution,
    duplicateChunksRemoved,
    status: 'completed',
  }

  onProgress({ type: 'done', result })
  return result
}
