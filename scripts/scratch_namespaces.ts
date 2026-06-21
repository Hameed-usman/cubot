import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { pineconeIndex } from '../lib/pinecone'

async function run() {
  const index = pineconeIndex.get()
  if (!index) {
    console.log("Pinecone index not initialized.")
    return
  }

  try {
    const stats = await index.describeIndexStats()
    console.log("Pinecone Namespace Stats:")
    console.log(JSON.stringify(stats.namespaces, null, 2))
  } catch (error) {
    console.error("Error fetching stats:", error)
  }
}

run()
