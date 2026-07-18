import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/adminAuth'
import {
  parsePdfBuffer,
  computeDocumentHash,
  checkDuplicate,
  ingestDocument,
  IngestionProgressEvent,
} from '@/lib/pdf-processor'
import sql from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — handles large 40+ page PDFs

/**
 * POST /api/admin/ingest-pdf
 *
 * Accepts two modes:
 *   1. File upload: multipart/form-data with `file`, `name`, `version`, `conflictResolution`
 *   2. URL import:  application/json with `url`, `name`, `version`, `conflictResolution`
 *
 * Streams SSE progress events back to the client.
 * conflictResolution: 'skip' | 'replace' | 'reindex'
 */
export async function POST(req: NextRequest) {
  const authRes = await requireAdminAuth(req)
  if (authRes) return authRes

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: IngestionProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch { /* client disconnected */ }
      }

      const sendLog = (message: string, status: IngestionProgressEvent['status'] = 'info') =>
        send({ type: 'log', message, status })

      try {
        const contentType = req.headers.get('content-type') || ''
        let buffer: Buffer
        let documentName = 'Unnamed Document'
        let documentVersion = '1.0'
        let sourceUrl: string | undefined
        let fileName: string | undefined
        let fileSizeBytes = 0
        let conflictResolution: string = 'ask' // 'ask'|'skip'|'replace'|'reindex'

        // ── Parse request ──────────────────────────────────────────────────
        if (contentType.includes('multipart/form-data')) {
          // File upload mode
          const formData = await req.formData()
          const file = formData.get('file') as File | null
          if (!file) {
            sendLog('❌ No file provided in form data', 'error')
            send({ type: 'done', result: undefined })
            controller.close()
            return
          }

          documentName = (formData.get('name') as string) || file.name.replace(/\.[^.]+$/, '')
          documentVersion = (formData.get('version') as string) || '1.0'
          conflictResolution = (formData.get('conflictResolution') as string) || 'ask'
          fileName = file.name
          fileSizeBytes = file.size

          const arrayBuffer = await file.arrayBuffer()
          buffer = Buffer.from(arrayBuffer)
          sendLog(`📂 Received file: ${file.name} (${(fileSizeBytes / 1024).toFixed(1)} KB)`, 'info')
        } else {
          // URL import mode
          const body = await req.json()
          const { url, name, version, conflictResolution: cr } = body

          if (!url) {
            sendLog('❌ No URL provided', 'error')
            send({ type: 'done', result: undefined })
            controller.close()
            return
          }

          try { new URL(url) } catch {
            sendLog('❌ Invalid URL format', 'error')
            send({ type: 'done', result: undefined })
            controller.close()
            return
          }

          documentName = name || url.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Document'
          documentVersion = version || '1.0'
          sourceUrl = url
          conflictResolution = cr || 'ask'

          sendLog(`🌐 Fetching PDF from URL: ${url}`, 'info')
          try {
            const res = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CubotBot/1.0)',
                Accept: 'application/pdf,*/*',
              },
              // 10 min hard ceiling — just a safety net against a truly hung connection.
              // The real protection against slow servers is the inactivity check below,
              // which only gives up if bytes actually STOP arriving, not just because
              // the transfer is slow overall.
              signal: AbortSignal.timeout(600_000),
            })

            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
            if (!res.body) throw new Error('Server returned no response body')

            const contentLengthHeader = res.headers.get('content-length')
            const expectedBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0
            if (expectedBytes) {
              sendLog(`⬇️ Downloading ${(expectedBytes / (1024 * 1024)).toFixed(1)} MB...`, 'info')
            } else {
              sendLog(`⬇️ Downloading (size unknown)...`, 'info')
            }

            // Stream the download so we can (a) show live progress and (b) tell the
            // difference between "slow but still sending bytes" and "actually stalled" —
            // a flat overall timeout can't distinguish those two cases.
            const reader = res.body.getReader()
            const receivedChunks: Uint8Array[] = []
            let receivedBytes = 0
            let lastLoggedMB = 0
            const INACTIVITY_LIMIT_MS = 45_000 // give up only if truly silent for 45s

            const readWithInactivityTimeout = (): Promise<ReadableStreamReadResult<Uint8Array>> =>
              new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('STALLED')), INACTIVITY_LIMIT_MS)
                reader.read().then(
                  (result) => { clearTimeout(timer); resolve(result) },
                  (err) => { clearTimeout(timer); reject(err) }
                )
              })

            while (true) {
              const { done, value } = await readWithInactivityTimeout()
              if (done) break
              if (value) {
                receivedChunks.push(value)
                receivedBytes += value.length
                const mb = receivedBytes / (1024 * 1024)
                if (mb - lastLoggedMB >= 1) {
                  lastLoggedMB = mb
                  const pct = expectedBytes ? ` (${Math.round((receivedBytes / expectedBytes) * 100)}%)` : ''
                  sendLog(`⬇️ ${mb.toFixed(1)} MB downloaded${pct}...`, 'info')
                }
              }
            }

            buffer = Buffer.concat(receivedChunks.map((c) => Buffer.from(c)))
            fileSizeBytes = buffer.length
            fileName = url.split('/').pop() || 'document.pdf'
            sendLog(`✓ Downloaded ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`, 'success')
          } catch (fetchErr: any) {
            const isStalled = fetchErr.message === 'STALLED'
            const isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError' || /abort|timeout/i.test(fetchErr.message || '')
            const msg = isStalled
              ? `The download stalled — no data received for 45 seconds. The source server dropped the connection. Try again, or download the file manually and use "Upload File" instead.`
              : isTimeout
              ? `Timed out after 10 minutes downloading the PDF. The source server is extremely slow — try downloading it manually and using "Upload File" instead.`
              : fetchErr.message
            sendLog(`❌ Failed to fetch PDF: ${msg}`, 'error')
            send({ type: 'done', result: undefined })
            controller.close()
            return
          }
        }

        // Validate it's a PDF
        if (buffer.slice(0, 4).toString('ascii') !== '%PDF') {
          sendLog('❌ File does not appear to be a valid PDF (missing %PDF header)', 'error')
          send({ type: 'done', result: undefined })
          controller.close()
          return
        }

        // ── Duplicate detection ────────────────────────────────────────────
        const documentHash = computeDocumentHash(buffer)
        sendLog(`🔍 Checking for duplicate document (hash: ${documentHash.slice(0, 12)}...)`, 'info')

        const dupCheck = await checkDuplicate(documentHash)

        if (dupCheck.isDuplicate && conflictResolution === 'ask') {
          send({
            type: 'conflict',
            message: `Document already exists: "${dupCheck.existingDoc?.name}" v${dupCheck.existingDoc?.version} (${dupCheck.existingDoc?.totalChunks} chunks, ingested ${new Date(dupCheck.existingDoc?.createdAt || '').toLocaleDateString()})`,
          } as any)
          controller.close()
          return
        }

        if (dupCheck.isDuplicate && conflictResolution === 'skip') {
          sendLog(`⏭ Skipped — document already ingested as "${dupCheck.existingDoc?.name}"`, 'warn')
          send({ type: 'done', result: undefined })
          controller.close()
          return
        }

        const replaceId = (dupCheck.isDuplicate && conflictResolution === 'replace')
          ? dupCheck.existingDoc?.id
          : undefined

        // ── Run ingestion pipeline ─────────────────────────────────────────
        sendLog(`🚀 Starting ingestion: "${documentName}" v${documentVersion}`, 'info')

        await ingestDocument({
          buffer,
          documentHash,
          documentName,
          documentVersion,
          sourceType: 'pdf',
          sourceUrl,
          fileName,
          fileSizeBytes,
          replaceDocumentId: replaceId,
          onProgress: (event) => send(event),
        })

      } catch (err: any) {
        sendLog(`❌ Fatal error: ${err.message}`, 'error')
        send({ type: 'done', result: undefined })
      }

      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
