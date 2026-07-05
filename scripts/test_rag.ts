import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { runRAGPipeline } from '../lib/rag';

async function main() {
  console.log("Testing RAG for CDC...");
  const result = await runRAGPipeline({
    message: "Hey can you tell me about cdc of cusit"
  });

  console.log("Confidence:", result.confidence);
  console.log("Citations:", result.citations.length);
  if (result.citations.length > 0) {
    console.log("Top Citation Category:", result.citations[0].category);
  }
}

main().catch(console.error);
