import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { runRAGPipeline } = await import('../lib/rag');
  const result = await runRAGPipeline({
    message: "can you tell me or explain me the whole fee structure even with the mentioned department",
    conversationHistory: [
      { role: 'user', content: 'can you share the fee structure for BS-CS fall 2025?' },
      { role: 'assistant', content: 'The fee structure for BS-CS Fall 2025 is 924,000...' }
    ]
  });
  console.log("\n--- RESULT ---");
  console.log("Confidence:", result.confidence);
  console.log("Citations:", result.citations.length);
  console.log(result.content);
}

main().catch(console.error);
