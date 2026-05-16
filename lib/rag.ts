import { ChatRequest } from '@/types'

// =====================================================
// LANGUAGE DETECTION
// =====================================================

function detectLanguage(text: string): 'urdu' | 'english' {
  const urduRegex = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g
  const urduMatches = text.match(urduRegex)
  const urduCharCount = urduMatches ? urduMatches.length : 0
  return urduCharCount / text.length > 0.12 ? 'urdu' : 'english'
}

// =====================================================
// LEARNING SYSTEM
// =====================================================

interface Correction { question: string; answer: string; timestamp: number }

class LearningSystem {
  private corrections: Correction[] = []
  addCorrection(q: string, a: string) {
    this.corrections.unshift({ question: q, answer: a, timestamp: Date.now() })
    if (this.corrections.length > 100) this.corrections.pop()
  }
  getRelevant(q: string): string[] {
    const key = q.toLowerCase().slice(0, 25)
    return this.corrections.filter(c => c.question.toLowerCase().includes(key)).map(c => c.answer)
  }
  getCount(): number { return this.corrections.length }
}
const learningSystem = new LearningSystem()

// =====================================================
// KNOWLEDGE BASE (SHORT)
// =====================================================

const KNOWLEDGE = {
  urdu: `City University Peshawar - فیس: CS/IT=95000, BBA=80000, Pharmacy=108000, Nursing=82000 روپے/سیمیسٹر | داخلہ: 45% نمبرز | فون: +92-91-1234567 | پروگرام: CS, IT, BBA, Pharmacy, Nursing`,
  english: `City University Peshawar - Fee: CS/IT=95000, BBA=80000, Pharmacy=108000, Nursing=82000 Rs/semester | Admission: 45% marks | Phone: +92-91-1234567 | Programs: CS, IT, BBA, Pharmacy, Nursing`
}

// =====================================================
// MAIN FUNCTION
// =====================================================

export async function runRAGPipeline(request: ChatRequest): Promise<ReadableStream<string>> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const { message, conversationHistory } = request
  const lang = detectLanguage(message)

  // Check for correction
  const correctionPhrases = ['wrong', 'incorrect', 'غلط', 'درست نہیں']
  const isCorrection = correctionPhrases.some(p => message.toLowerCase().includes(p))

  if (isCorrection && conversationHistory.length > 0) {
    const prevQ = conversationHistory[conversationHistory.length - 1].content
    learningSystem.addCorrection(prevQ, message.split(correctionPhrases.find(p => message.toLowerCase().includes(p)) || '')[1]?.trim() || 'Updated')
    return new ReadableStream({
      start(c) { c.enqueue(lang === 'urdu' ? 'شکریہ! اپڈیٹ ہو گیا۔' : 'Thank you! Updated.'); c.close() }
    })
  }

  // Get learned
  const learned = learningSystem.getRelevant(message)
  const learnedText = learned.length > 0 ? `\nLearned: ${learned.join(' | ')}` : ''

  // Get conversation context
  const history = conversationHistory.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')

  // Build prompt - FORCE LANGUAGE
  const systemPrompt = lang === 'urdu'
    ? `You are an AI assistant. Your ONLY response must be in Urdu script (اردو). Never respond in English. Use only Urdu characters. ${KNOWLEDGE.urdu}${learnedText}`
    : `You are an AI assistant. Your ONLY response must be in English. Never respond in Urdu. ${KNOWLEDGE.english}${learnedText}`

  const prompt = `${systemPrompt}
${history ? `Context: ${history}\n` : ''}
Question: ${message}
Answer (${lang === 'urdu' ? 'URDU SCRIPT ONLY - اردو میں' : 'ENGLISH ONLY'}):`

  // API call
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 512
    })
  })

  if (!response.ok) throw new Error('Service unavailable')

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || 'No response'

  return new ReadableStream({
    start(controller) { controller.enqueue(content); controller.close() }
  })
}

export function getLearningStats() {
  return { correctionsCount: learningSystem.getCount() }
}