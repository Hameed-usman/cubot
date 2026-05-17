import { ChatRequest } from '@/types'
import * as fs from 'fs'
import * as path from 'path'

import sql from './db'
import { embedText } from './embeddings'
import { pineconeIndex } from './pinecone'
import { AppError } from './errors'

// =====================================================
// FILE SYSTEM KNOWLEDGE BASE (DYNAMIC)
// =====================================================

async function getRelevantKnowledge(query: string): Promise<string> {
  try {
    const embedding = await embedText(query);
    const index = pineconeIndex.get();
    
    if (!index) {
      console.warn('Pinecone not configured, falling back to full DB scan (not recommended for large DBs)');
      // Degraded response: return top 5 recent entries from Neon DB instead of vector search
      const entries = await sql`SELECT content FROM knowledge_entries ORDER BY updated_at DESC LIMIT 5`;
      return entries.map(e => e.content).join('\n\n');
    }

    const searchResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true
    });

    if (searchResponse.matches && searchResponse.matches.length > 0) {
      return searchResponse.matches
        .map(match => match.metadata?.content as string || '')
        .filter(content => content.trim() !== '')
        .join('\n\n');
    }
    return '';
  } catch (error) {
    console.error('[Pinecone Error]:', error);
    // Graceful degraded response: return empty knowledge context
    return '';
  }
}

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
// MAIN FUNCTION
// =====================================================

export async function runRAGPipeline(request: ChatRequest, intentContext: string = ''): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new AppError('GROQ_API_KEY not configured', 500, 'CONFIG_ERROR');
  }

  const { message, conversationHistory } = request
  const lang = detectLanguage(message)

  // Check for correction
  const correctionPhrases = ['wrong', 'incorrect', 'غلط', 'درست نہیں']
  const isCorrection = correctionPhrases.some(p => message.toLowerCase().includes(p))

  if (isCorrection && conversationHistory.length > 0) {
    const prevQ = conversationHistory[conversationHistory.length - 1].content
    learningSystem.addCorrection(prevQ, message.split(correctionPhrases.find(p => message.toLowerCase().includes(p)) || '')[1]?.trim() || 'Updated')
    return lang === 'urdu' ? 'شکریہ! اپڈیٹ ہو گیا۔' : 'Thank you! Updated.'
  }

  // Get learned
  const learned = learningSystem.getRelevant(message)
  const learnedText = learned.length > 0 ? `\nLearned Corrections: ${learned.join(' | ')}\n` : ''

  // Get conversation context
  const history = conversationHistory.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')

  // Get Dynamic Knowledge from Vector Search
  const dynamicKnowledge = await getRelevantKnowledge(message)

  // Build prompt
  const baseAriaPrompt = `You are ARIA — the official intelligent university advisor for City University of Science & Information Technology (CUSIT).

You are not a chatbot. You are not an FAQ system.
You are a real academic advisor who speaks with intelligence, emotional awareness, and precise communication control.

🧠 CORE PURPOSE
Your job is NOT to answer questions. Your job is to:
- Understand intent behind every question
- Control depth of explanation intelligently
- Deliver the right amount of information (not too little, not too much)
- Guide the user naturally toward the next step
- Create a premium human-like advisory experience

⚖️ RESPONSE LENGTH INTELLIGENCE SYSTEM
You MUST dynamically decide response length based on intent:

1. SIMPLE FACTUAL QUESTIONS (e.g., location, fee, duration, contact)
→ Keep response SHORT (2–5 sentences max)
→ Give direct answer first
→ Add 1 helpful extra insight
→ End with a soft question

2. MODERATE QUESTIONS (e.g., admissions, programs, eligibility)
→ Medium length (2–4 short paragraphs)
→ Explain clearly but not excessively
→ Add context or benefit insight
→ End with guidance question

3. COMPLEX DECISION QUESTIONS (e.g., career, comparison, faculty, scholarships)
→ Structured explanation allowed
→ BUT max 3 small sections only
→ Focus on clarity, not volume
→ Always include recommendation or guidance

🚫 NEVER:
- Write long brochure-style paragraphs
- Dump full lists unless explicitly asked
- Repeat the same idea in multiple sentences
- Over-explain simple questions

🎯 INTENT-BASED RESPONSE RULE
Before answering, classify user intent:
- Seeking quick info → be concise
- Exploring options → be explanatory
- Making decision → be advisory + guiding
- Confused user → be reassuring + structured
- Professional inquiry → be precise + formal tone

💬 HUMAN ADVISOR STYLE RULE
You must sound like a real university advisor: natural flow, warm but professional, confident and grounded.
NEVER say "According to system data", "Here is the information", "The following details are as follows", "As per records".

🧠 INFORMATION DENSITY CONTROL
Every sentence must pass this filter: Does this help the user move forward? Or is it just filler? If filler → REMOVE IT.

🔥 THE "PLUS ONE INSIGHT" RULE
After answering ANY question, add ONLY ONE of the following:
- A useful hidden insight
- A practical next step
- A common student concern
- A suggestion for better decision-making
But NEVER overload.

🧭 CONVERSATION FLOW RULE
Every response must:
1. Answer the question clearly
2. Stay appropriately sized (based on intent)
3. Add one meaningful extra insight
4. End with natural continuation (question or next step)

Here is the official university knowledge database:
${dynamicKnowledge}
${learnedText}`

  const systemPrompt = lang === 'urdu'
    ? `${baseAriaPrompt}\n\nCRITICAL INSTRUCTION: Your ONLY response must be in Urdu script (اردو). Translate the tone, warmth, and exact facts perfectly into natural Urdu.\n\n${intentContext}`
    : `${baseAriaPrompt}\n\nCRITICAL INSTRUCTION: Your ONLY response must be in English. Never respond in Urdu.\n\n${intentContext}`;

  const prompt = `${systemPrompt}
${history ? `Context: ${history}\n` : ''}
Question: ${message}
Answer (${lang === 'urdu' ? 'URDU SCRIPT ONLY - اردو میں' : 'ENGLISH ONLY'}):`

  try {
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

    if (!response.ok) {
       console.error(`Groq API Error: ${response.status} ${response.statusText}`);
       throw new AppError('Service unavailable', response.status, 'API_ERROR');
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || 'No response'

    return content;
  } catch (error) {
    console.error('[Groq Error]:', error);
    // Graceful fallback response
    return lang === 'urdu' 
            ? 'مجھے ابھی کنیکٹ کرنے میں دشواری ہو رہی ہے۔ براہ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔' 
            : 'I\'m having trouble connecting right now. Please try again in a moment.';
  }
}

export function getLearningStats() {
  return { correctionsCount: learningSystem.getCount() }
}