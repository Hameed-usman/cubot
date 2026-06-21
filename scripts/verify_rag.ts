import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const questions = [
  "Where is CUSIT located?",
  "How do I apply for admission?",
  "What programs does CUSIT offer?",
  "Tell me about the computer science department",
  "Mujhe admission ke baare mein batao"
]

async function verify() {
  const { runRAGPipeline } = await import('../lib/rag')
  console.log("=== FINAL VERIFICATION ===")
  for (const q of questions) {
    console.log(`\nQuestion: ${q}`)
    
    const startTime = Date.now()
    try {
      const randomSuffix = ` -- bypass cache ${Math.random()}`
      const result = await runRAGPipeline({
        message: q + randomSuffix,
        conversationHistory: []
      })
      const endTime = Date.now()
      
      console.log(`Response Time: ${endTime - startTime}ms`)
      console.log(`Confidence: ${result.confidence}`)
      console.log(`Bot Response: ${result.content}`)
    } catch (e: any) {
      console.error(`Error: ${e.message}`)
    }
  }
}

verify().catch(console.error)
