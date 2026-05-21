import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env FIRST
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { runRAGPipeline } from '@/lib/rag'

async function runTests() {
  console.log('🧪 Starting RAG Evaluation Tests...\n')

  const tests = [
    {
      name: 'Test 1: Standalone Query (English)',
      request: {
        message: 'Who is on the computer science faculty?',
        conversationHistory: []
      }
    },
    {
      name: 'Test 2: Factual Verification (CS Department Info)',
      request: {
        message: 'Where is CUSIT located and what is their email?',
        conversationHistory: []
      }
    },
    {
      name: 'Test 3: Conversational Memory & Query Rewriting (Admissions + Cost follow-up)',
      steps: [
        {
          message: 'I want to apply for the BS Computer Science program.',
          history: []
        },
        {
          message: 'How much does it cost?',
          history: [
            { role: 'user', content: 'I want to apply for the BS Computer Science program.' },
            { role: 'assistant', content: 'That is a fantastic choice! The BS Computer Science program at CUSIT is an excellent pathway. Admissions are open, and eligibility requires an intermediate (FSc/ICS) degree with at least 50% marks. Would you like me to share details on the application process?' }
          ]
        }
      ]
    },
    {
      name: 'Test 4: Persona Warmth & Empathy (Anxious Applicant)',
      request: {
        message: 'I am so stressed about whether I will get admission, the application is so confusing.',
        conversationHistory: []
      }
    },
    {
      name: 'Test 5: Hallucination Guard (Asking about a fake course)',
      request: {
        message: 'Tell me about the PhD program in Underwater Basket Weaving at CUSIT and its fee.',
        conversationHistory: []
      }
    }
  ]

  for (const t of tests) {
    console.log(`=========================================`)
    console.log(`▶️  ${t.name}`)
    console.log(`=========================================`)

    try {
      if ('steps' in t) {
        // Multi-step conversation memory test
        for (let i = 0; i < t.steps.length; i++) {
          const step = t.steps[i]
          console.log(`\n[Step ${i + 1}] User: "${step.message}"`)
          const res = await runRAGPipeline({
            message: step.message,
            conversationHistory: step.history as any
          })
          console.log(`Advisor: "${res.content}"`)
          console.log(`Confidence: ${res.confidence} | Citations: ${res.citations.length}`)
        }
      } else if ('request' in t) {
        console.log(`User: "${t.request.message}"`)
        const res = await runRAGPipeline(t.request as any)
        console.log(`Advisor: "${res.content}"`)
        console.log(`Confidence: ${res.confidence} | Citations: ${res.citations.length}`)
      }
    } catch (error: any) {
      console.error(`❌ Test failed with error:`, error)
    }
    console.log('\n')
  }

  console.log('✅ All evaluation tests completed.')
}

runTests().catch(err => {
  console.error('💥 Test script crashed:', err)
  process.exit(1)
})
