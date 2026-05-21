import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { v4 as uuidv4 } from 'uuid'
import { classifyPage, buildBreadcrumb } from '@/lib/classifier'
import { semanticChunk } from '@/lib/textSplitter'
import { upsertPageChunks } from '@/lib/embed-and-store'

export interface DocumentResult {
  success: boolean
  chunksCreated: number
  error?: string
}

// ─── Extractors ────────────────────────────────────────────────────────────────

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text
  } catch (error: any) {
    throw new Error(`PDF extraction failed: ${error.message}`)
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error: any) {
    throw new Error(`DOCX extraction failed: ${error.message}`)
  }
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const lines: string[] = []

    for (const sheetName of workbook.SheetNames) {
      lines.push(`\n## Sheet: ${sheetName}\n`)
      const sheet = workbook.Sheets[sheetName]
      const csvData = XLSX.utils.sheet_to_csv(sheet)

      // Convert CSV rows to readable text
      const rows = csvData.split('\n').filter(row => row.replace(/,/g, '').trim().length > 0)
      for (const row of rows) {
        const cells = row.split(',').map(c => c.trim()).filter(Boolean)
        if (cells.length > 0) {
          lines.push(cells.join(' | '))
        }
      }
    }

    return lines.join('\n')
  } catch (error: any) {
    throw new Error(`XLSX extraction failed: ${error.message}`)
  }
}

// ─── Main Document Processor ───────────────────────────────────────────────────

/**
 * Downloads and processes a document (PDF/DOCX/XLSX) into knowledge chunks.
 * Extracts text, classifies the document, chunks semantically, and upserts to Pinecone + DB.
 */
export async function processDocument(url: string): Promise<DocumentResult> {
  try {
    // Download document binary
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CubotCrawler/1.0)',
      },
      signal: AbortSignal.timeout(30000), // 30s for documents
    })

    if (!response.ok) {
      return { success: false, chunksCreated: 0, error: `HTTP ${response.status}` }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const urlLower = url.toLowerCase()

    // ── Extract text based on file type ──────────────────────────────────────
    let text = ''
    let sourceType: 'pdf' | 'docx' | 'xlsx' = 'pdf'

    if (urlLower.includes('.pdf')) {
      text = await extractPdf(buffer)
      sourceType = 'pdf'
    } else if (urlLower.includes('.docx') || urlLower.includes('.doc')) {
      text = await extractDocx(buffer)
      sourceType = 'docx'
    } else if (urlLower.includes('.xlsx') || urlLower.includes('.xls')) {
      text = await extractXlsx(buffer)
      sourceType = 'xlsx'
    } else {
      return { success: false, chunksCreated: 0, error: 'Unsupported document type' }
    }

    if (!text || text.trim().length < 50) {
      return { success: false, chunksCreated: 0, error: 'No readable text extracted' }
    }

    // ── Derive title from URL filename ────────────────────────────────────────
    const fileName = decodeURIComponent(url.split('/').pop() || 'Document')
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())

    const classification = classifyPage(url, fileName)
    const breadcrumb = buildBreadcrumb(url)
    const parentPageId = uuidv4()

    // ── Semantic chunking ─────────────────────────────────────────────────────
    const chunks = semanticChunk(text, {
      title: fileName,
      sourceUrl: url,
      department: classification.department,
      category: classification.category,
      pageType: classification.pageType,
      breadcrumb,
      sourceType,
      contentHash: '',
      crawledAt: new Date().toISOString(),
    })

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'No chunks generated from document' }
    }

    // ── Upsert to DB + Pinecone ────────────────────────────────────────────────
    const result = await upsertPageChunks({
      chunks: chunks.map(c => ({ text: c.text, chunkIndex: c.metadata.chunkIndex })),
      title: fileName,
      category: classification.category,
      sourceUrl: url,
      sourceType,
      pageType: classification.pageType,
      breadcrumb,
      parentPageId,
    })

    console.log(`    ✅ Document: "${fileName}" → ${result.upserted} chunks (${sourceType.toUpperCase()})`)

    return { success: true, chunksCreated: result.upserted }

  } catch (error: any) {
    return { success: false, chunksCreated: 0, error: error.message }
  }
}
