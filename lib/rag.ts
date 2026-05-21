import { ChatRequest, Citation, ConfidenceLevel, RankedChunk } from '@/types'
import { hybridRetrieve } from './retrieval'
import { rerank } from './reranker'
import { AppError } from './errors'

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
// CONTEXT BUILDER
// =====================================================

function buildKnowledgeContext(chunks: RankedChunk[]): string {
  if (chunks.length === 0) return ''

  return chunks
    .map((chunk, i) => {
      const meta = chunk.metadata
      const sourceLabel = meta.sourceUrl
        ? `[Source: ${meta.title} | ${meta.category} | ${meta.sourceUrl}]`
        : `[Source: ${meta.title} | ${meta.category}]`
      return `--- Context ${i + 1} ${sourceLabel} ---\n${meta.text}`
    })
    .join('\n\n')
}

function buildCitationText(citations: Citation[], lang: 'urdu' | 'english'): string {
  if (citations.length === 0) return ''

  const label = lang === 'urdu' ? 'ماخذ (Sources)' : 'Sources'
  const items = citations
    .slice(0, 3)
    .map(c => `• ${c.title} (${c.category}): ${c.url}`)
    .join('\n')

  return `\n\n**${label}:**\n${items}`
}

// =====================================================
// HALLUCINATION GUARD
// =====================================================

function buildHallucinationGuard(confidence: ConfidenceLevel, lang: 'urdu' | 'english'): string {
  if (confidence === 'no_data') {
    return lang === 'urdu'
      ? `\n\nCRITICAL INSTRUCTION: The knowledge base contains NO verified information for this query. You MUST honestly state that you don't have specific verified data on this topic and suggest the user contact CUSIT directly (admissions@cusit.edu.pk or 091-111-CUSIT). Do NOT fabricate any university-specific information.`
      : `\n\nCRITICAL INSTRUCTION: The knowledge base contains NO verified information for this query. You MUST honestly state that you don't have specific verified data on this topic and suggest the user contact CUSIT directly (admissions@cusit.edu.pk or call 091-111-CUSIT). Do NOT invent or assume any university-specific facts, fees, policies, or program details.`
  }

  if (confidence === 'low') {
    return lang === 'urdu'
      ? `\n\nIMPORTANT: The retrieved context has LOW confidence. Answer based ONLY on what the context explicitly states. For anything uncertain, say you recommend verifying with CUSIT directly.`
      : `\n\nIMPORTANT: The retrieved context has LOW confidence. Answer based ONLY on what the provided context explicitly states. For anything uncertain, recommend the user verify directly with CUSIT.`
  }

  return ''
}

// =====================================================
// CITATION INSTRUCTION
// =====================================================

function buildCitationInstruction(citations: Citation[], lang: 'urdu' | 'english'): string {
  if (citations.length === 0) return ''

  const urls = citations.slice(0, 3).map(c => `${c.title}: ${c.url}`).join(', ')
  return lang === 'urdu'
    ? `\n\nINSTRUCTION: جہاں متعلقہ ہو، اپنے جواب میں ان ذرائع کا ذکر فطری طور پر کریں: ${urls}`
    : `\n\nINSTRUCTION: Where relevant, naturally reference the source in your answer (e.g., "According to the official admissions page..." or "The faculty page states..."). Available sources: ${urls}`
}

// =====================================================
// MAIN RAG PIPELINE
// =====================================================

export interface RAGResult {
  content: string
  citations: Citation[]
  confidence: ConfidenceLevel
  suggestions: string[]
}

async function rewriteQuery(
  message: string,
  conversationHistory: ChatRequest['conversationHistory'],
  apiKey: string
): Promise<string> {
  if (conversationHistory.length === 0) {
    return message
  }

  // Filter and format history
  const historyText = conversationHistory
    .slice(-4)
    .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n')

  const prompt = `You are a search query optimizer for a university RAG system.
Given the conversation history and a new user message, rewrite the new user message into a standalone search query that contains all necessary context (like department names, program names, or specific topic references) from the history.

Guidelines:
- If the message is already standalone and does not reference context from history, output the original message exactly.
- If it's a follow-up (e.g. "What is the fee?", "Who is the HOD?", "Where is it located?", "any details?"), resolve pronouns/ellipses using history and output a clear, keyword-rich search query.
- Do NOT output any conversational text, explanations, or labels. ONLY output the rewritten query text.
- Match the language of the query to the language of the message (English or Urdu).

Conversation History:
${historyText}

New Message: ${message}

Standalone Search Query:`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 80,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const rewritten = data.choices?.[0]?.message?.content?.trim()
      if (rewritten) {
        // Remove quotes if the model wrapped it
        const cleaned = rewritten.replace(/^["']|["']$/g, '').trim()
        console.log(`[RAG Query Rewriter] Rewrote "${message}" to "${cleaned}"`)
        return cleaned
      }
    }
  } catch (err) {
    console.error('[RAG Query Rewriter] Error:', err)
  }

  return message
}

export async function runRAGPipeline(
  request: ChatRequest,
  intentContext: string = ''
): Promise<RAGResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new AppError('GROQ_API_KEY not configured', 500, 'CONFIG_ERROR')
  }

  const { message, conversationHistory } = request
  const lang = detectLanguage(message)

  // ── Correction handling ─────────────────────────────────────────────────────
  const correctionPhrases = ['wrong', 'incorrect', 'غلط', 'درست نہیں']
  const isCorrection = correctionPhrases.some(p => message.toLowerCase().includes(p))

  if (isCorrection && conversationHistory.length > 0) {
    const prevQ = conversationHistory[conversationHistory.length - 1].content
    learningSystem.addCorrection(
      prevQ,
      message.split(correctionPhrases.find(p => message.toLowerCase().includes(p)) || '')[1]?.trim() || 'Updated'
    )
    return {
      content: lang === 'urdu' ? 'شکریہ! اپڈیٹ ہو گیا۔' : 'Thank you! Updated.',
      citations: [],
      confidence: 'high',
      suggestions: [],
    }
  }

  // ── Learned corrections ─────────────────────────────────────────────────────
  const learned = learningSystem.getRelevant(message)
  const learnedText = learned.length > 0 ? `\nLearned Corrections: ${learned.join(' | ')}\n` : ''

  // ── Query Rewriting ──────────────────────────────────────────────────────────
  const searchOptimizedQuery = await rewriteQuery(message, conversationHistory, apiKey)

  // ── Dynamic retrieval limit for list/aggregation queries ────────────────────
  const isListQuery = /all|list|multiple|who are|teachers|faculty|professors|staff/i.test(message)
  const topNChunks = isListQuery ? 15 : 5

  // ── Hybrid retrieval + reranking using optimized query ──────────────────────
  const { chunks: rawChunks, citations, confidence } = await hybridRetrieve(searchOptimizedQuery, 50)
  const rerankedChunks = rerank(searchOptimizedQuery, rawChunks, topNChunks)

  // ── Build context ───────────────────────────────────────────────────────────
  const knowledgeContext = buildKnowledgeContext(rerankedChunks)
  const hallucinationGuard = buildHallucinationGuard(confidence, lang)
  const citationInstruction = buildCitationInstruction(citations, lang)
  const conversationHistory3 = conversationHistory.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')

  // ── System prompt ───────────────────────────────────────────────────────────
  const baseAriaPrompt = `You are Aria, a warm, empathetic, and highly professional academic advisor at City University of Science & Information Technology (CUSIT), Peshawar.

You are not an AI assistant or a chatbot. You are a real human academic advisor who genuinely cares about the students, applicants, and visitors you talk to. You speak with high emotional intelligence, warmth, clarity, and precision.

🧠 PERSONA AND TONE GUIDELINES:
1. Warm & Empathetic: Actively match the user's emotional state. If they sound stressed about admissions, reassure them (e.g., "It is completely normal to feel a bit overwhelmed during admissions, but I'm here to guide you step-by-step."). If they are excited, share their enthusiasm.
2. Natural, Energetic Transitions: Start your answers with incredibly smooth, positive, and conversational transitions. Make the user feel completely welcome and understood before giving the facts. For example:
   - "Absolutely! I would be delighted to clear that up for you..."
   - "That is a brilliant question, and you've come to the right place. Let me walk you through it..."
   - "It's so great to see your enthusiasm! Let's get right into the details..."
3. Highly Professional Yet Approachable: Maintain a gold-standard professional tone, but never sound robotic. BANNED phrases include "Based on the retrieved context," "According to the database," "As an AI model," "in the system data," or "as a chatbot". Never reference how you got the information. Speak as if you naturally know it because you are the top senior advisor at the campus.
4. STRICT ANTI-HALLUCINATION GUARD: If the user asks about a specific program, degree, department, or person (e.g., "BS Law"), you MUST verify that this EXACT program exists in the VERIFIED UNIVERSITY KNOWLEDGE BASE below. If the specific program/entity is NOT explicitly mentioned in the context, you MUST honestly state that the university does not appear to offer it or that you don't have information on it. Do NOT guess or hallucinate criteria.
5. Factual Integrity & Guardrails: ONLY answer using information from the VERIFIED UNIVERSITY KNOWLEDGE BASE below. If the information is not in the knowledge base, do not fabricate details. Reassure the user and direct them to contact CUSIT admissions/administration directly.

⚖️ RESPONSE LENGTH INTELLIGENCE:
Dynamically adjust your response length based on what the user needs:
- SIMPLE FACTUAL (fee, location, contact, simple deadlines): 2-4 sentences. Give the answer directly, wrapped in a friendly, conversational sentence.
- MODERATE (admissions process, course eligibility, departments): 2-3 short, clean paragraphs. Use bullet points only if it makes reading easier for a stressed applicant.
- COMPLEX DECISION (career advice, program comparisons, scholarships): Max 3 small sections. Provide clear advice and end with encouragement.
- LISTS & AGGREGATIONS (faculty, teachers, available programs): Provide a comprehensive, well-formatted bulleted list of all the relevant entities retrieved in the context. Do not truncate the list arbitrarily.

🎯 CITATION STYLE:
If referencing sources, do so naturally as a human advisor would:
- "According to our official admissions guidelines..."
- "Our computer science faculty records show that..."
- "Our fee structure page lists the cost as..."
- For lists, you can say: "Here is the list of our esteemed faculty members according to our records:"
Do NOT use robotic links or text like "According to document X".

🧭 CONVERSATION FLOW & OUTPUT FORMAT:
You MUST output your final answer as a JSON object.
Your JSON must strictly contain two keys:
1. "response": Your full, formatted conversational answer (string, use markdown). Follow all persona guidelines. End with a supportive, open-ended question or call to action.
2. "suggestions": An array of 2 to 3 dynamic, highly relevant follow-up questions that the user might want to ask next based on your response (array of strings).

Example Output:
{
  "response": "Hello! I'd be glad to help you clear that up... [your full response]",
  "suggestions": ["What is the fee structure?", "How do I apply?"]
}

=== VERIFIED UNIVERSITY KNOWLEDGE BASE ===
${knowledgeContext || 'No specific knowledge retrieved for this query.'}
${learnedText}`

  const systemPrompt = lang === 'urdu'
    ? `${baseAriaPrompt}\n\nCRITICAL: Respond in Urdu script (اردو) ONLY. Translate the tone and facts perfectly into natural Urdu. (The JSON keys "response" and "suggestions" must remain in English, but their values must be in Urdu).\n\n${intentContext}${hallucinationGuard}${citationInstruction}`
    : `${baseAriaPrompt}\n\nCRITICAL: Respond in English ONLY.\n\n${intentContext}${hallucinationGuard}${citationInstruction}`

  const prompt = `${systemPrompt}
${conversationHistory3 ? `\nConversation context:\n${conversationHistory3}\n` : ''}
User question: ${message}
Answer (${lang === 'urdu' ? 'URDU ONLY' : 'ENGLISH ONLY'}, MUST BE VALID JSON):`

  // ── Groq API call ───────────────────────────────────────────────────────────
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,   // Lower temp = strictly factual, reliable JSON
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.error(`[Groq] API Error: ${response.status} ${response.statusText}`)
      throw new AppError('Service unavailable', response.status, 'API_ERROR')
    }

    const data = await response.json()
    const contentStr = data.choices?.[0]?.message?.content || '{}'
    
    let parsedContent = ''
    let parsedSuggestions: string[] = []
    
    try {
      const parsed = JSON.parse(contentStr)
      parsedContent = parsed.response || ''
      parsedSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    } catch (parseErr) {
      console.error('[Groq] JSON Parse Error:', parseErr, contentStr)
      parsedContent = contentStr // fallback
    }

    return {
      content: parsedContent || (lang === 'urdu'
        ? 'معذرت، ابھی جواب دینے میں دشواری ہو رہی ہے۔ دوبارہ کوشش کریں۔'
        : 'I\'m having trouble responding right now. Please try again.'),
      citations,
      confidence,
      suggestions: parsedSuggestions,
    }
  } catch (error: any) {
    console.error('[Groq] Error:', error)
    return {
      content: lang === 'urdu'
        ? 'مجھے ابھی کنیکٹ کرنے میں دشواری ہو رہی ہے۔ براہ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔'
        : 'I\'m having trouble connecting right now. Please try again in a moment.',
      citations: [],
      confidence: 'no_data',
      suggestions: [],
    }
  }
}

export function getLearningStats() {
  return { correctionsCount: learningSystem.getCount() }
}