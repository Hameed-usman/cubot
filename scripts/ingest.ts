import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables BEFORE importing other modules
const envPath = path.join(process.cwd(), '.env.local')
const result = dotenv.config({ path: envPath })
if (result.error) {
  console.error('Failed to load .env.local:', result.error)
}

// Now import after env is loaded
import { pineconeIndex, isPineconeConfigured } from '@/lib/pinecone'
import { embedBatch } from '@/lib/embeddings'
import { splitIntoChunks } from '@/lib/textSplitter'
import { DEPARTMENTS, Department } from '@/types'

/**
 * Ingestion script - run locally via: npm run ingest
 * This script reads all data files, chunks them, embeds them, and upserts to Pinecone.
 * It is idempotent - running twice produces the same result.
 */

const DATA_DIR = path.join(process.cwd(), 'data')

async function ingestDepartment(department: Department): Promise<number> {
  console.log(`\n📚 Processing ${department}...`)

  const deptDir = path.join(DATA_DIR, department)

  if (!fs.existsSync(deptDir)) {
    console.warn(`  ⚠️  Directory not found: ${deptDir}`)
    return 0
  }

  const files = fs.readdirSync(deptDir).filter((f) => f.endsWith('.txt'))
  let totalChunks = 0

  for (const fileName of files) {
    const filePath = path.join(deptDir, fileName)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Split into chunks
    const chunks = splitIntoChunks(content, {
      department,
      fileName,
    } as any)

    console.log(`  📄 ${fileName}: ${chunks.length} chunks`)

    // Embed chunks in batches
    const batchSize = 100
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const texts = batch.map((c) => c.text)
      const embeddings = await embedBatch(texts)

      // Prepare vectors for Pinecone
      const vectors = batch.map((chunk, idx) => ({
        id: `${department}_${fileName}_chunk_${chunk.metadata.chunkIndex}`,
        values: embeddings[idx],
        metadata: {
          text: chunk.text,
          department,
          fileName,
          chunkIndex: chunk.metadata.chunkIndex,
        },
      }))

      // Upsert to Pinecone
      const index = pineconeIndex.get()
      if (index) {
        await index.upsert(vectors)
      }
      totalChunks += batch.length
    }
  }

  return totalChunks
}

async function main() {
  console.log('🚀 Starting ingestion...\n')

  // Check configuration
  console.log('Config check:')
  console.log('  Pinecone configured:', isPineconeConfigured())

  const startTime = Date.now()
  let totalChunks = 0
  let totalVectors = 0

  for (const dept of DEPARTMENTS) {
    const chunks = await ingestDepartment(dept)
    totalChunks += chunks
    totalVectors += chunks
    console.log(`  ✅ ${dept}: ${chunks} chunks ingested`)
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\n✅ Ingestion complete:`)
  console.log(`   Total chunks: ${totalChunks}`)
  console.log(`   Total vectors: ${totalVectors}`)
  console.log(`   Duration: ${duration}s`)
}

main().catch(console.error)