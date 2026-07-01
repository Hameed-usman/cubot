import { hybridRetrieve } from '../lib/retrieval'
import { rerank } from '../lib/reranker'

async function testQuery(query: string) {
  console.log(`\n=================================================`)
  console.log(`QUERY: "${query}"`)
  console.log(`=================================================`)
  
  const t0 = performance.now()
  const retrievedResult = await hybridRetrieve(query)
  const t1 = performance.now()
  const rerankedChunks = await rerank(query, retrievedResult.chunks)
  const t2 = performance.now()
  
  console.log(`Retrieval: ${Math.round(t1 - t0)}ms | Rerank: ${Math.round(t2 - t1)}ms | Total: ${Math.round(t2 - t0)}ms`)
  console.log(`Total Chunks Retrieved: ${rerankedChunks.length}\n`)
  
  if (rerankedChunks.length === 0) {
    console.log(`❌ No chunks retrieved.`)
    return
  }
  
  // Show top 3 chunks
  for (let i = 0; i < Math.min(3, rerankedChunks.length); i++) {
    const chunk = rerankedChunks[i]
    console.log(`[Rank ${i + 1}] Score: ${chunk.score.toFixed(4)} | Reranked: ${chunk.rerankScore?.toFixed(4)}`)
    console.log(`Namespace: ${chunk.metadata.namespace || chunk.metadata.category} | Source: ${chunk.metadata.sourceType}`)
    console.log(`Title: ${chunk.metadata.title}`)
    console.log(`Content Preview: ${chunk.metadata.text.substring(0, 150).replace(/\n/g, ' ')}...`)
    console.log(`-------------------------------------------------`)
  }
}

async function main() {
  const queries = [
    "What is the fee for BSCS?",
    "How do I apply for admission?",
    "Who is the dean of computer science?",
    "Are there any scholarships available?"
  ]
  
  for (const q of queries) {
    await testQuery(q)
  }
  
  console.log("\n✅ RAG Verification Complete.")
  process.exit(0)
}

main()
