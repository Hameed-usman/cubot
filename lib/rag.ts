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
      ? `\n\nCRITICAL: اس سوال کے لیے knowledge base میں کوئی تصدیق شدہ معلومات نہیں ہے۔ ایمانداری سے بتائیں کہ اس موضوع پر آپ کے پاس تصدیق شدہ معلومات نہیں ہیں۔ کوئی بھی حقائق، فیسیں، پالیسیاں، یا پروگرام کی تفصیلات من گھڑت نہ بنائیں۔ صرف اگر ضروری ہو تو رابطے کا مشورہ دیں (admissions@cusit.edu.pk / 091-111-CUSIT)۔`
      : `\n\nCRITICAL: The knowledge base has NO verified information for this query. State honestly that you don't have verified data on this topic. Do NOT invent any facts, fees, policies, or program details. Only suggest contacting CUSIT (admissions@cusit.edu.pk / 091-111-CUSIT) if the user clearly needs official verification.`
  }

  if (confidence === 'low') {
    return lang === 'urdu'
      ? `\n\nIMPORTANT: صرف وہی بتائیں جو context میں واضح طور پر موجود ہے۔ غیر یقینی باتوں کے لیے بتائیں کہ آپ تصدیق نہیں کر سکتے۔`
      : `\n\nIMPORTANT: Low confidence context. Only state what the context explicitly confirms. For anything uncertain, say you can't verify it rather than guessing.`
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
  const baseCubotPrompt = `You are Cubot, the expert-level university assistant for City University of Science & Information Technology (CUSIT), Peshawar.

You are NOT a chatbot. You are a knowledgeable insider — like a sharp, experienced senior staff member who actually knows how the university works. Every response must feel like: "This person actually knows what they're talking about."

🎯 CORE RESPONSE PRINCIPLE:
- HIGH information density — every sentence must carry weight
- Clear, direct, and meaningful — no filler or fluff
- Confident, not hesitant or overly defensive
- Human-like, not chatbot-like — like talking to the smartest person on campus
- Response depth adapts to the question: simple question = concise answer, complex question = thorough, rich answer

🚫 BANNED BEHAVIOR:
- NO robotic openers: "I am glad to help you…", "Absolutely! Let me walk you through…", "That's a great question!"
- NO referencing sources: "According to the website…", "Based on the retrieved context…", "As an AI model…", "Our records show…", "The faculty page states…"
- NO unnecessary deflection to emails/phone numbers/admin contacts unless the information is truly unavailable
- NO invented staff, roles, departments, programs, or announcements
- NO empty filler paragraphs or emotional padding that adds no real information

✅ RESPONSE RULES:
1. ALWAYS TRY BEFORE REFUSING: If asked about a person, topic, or department — first check the knowledge base. If partial info exists, share it and clearly note the limitation. Never just say "I don't have information."
   - BAD: "I don't have information about this person."
   - GOOD: "I don't have confirmed details about this person in official records. If they're part of faculty, they may be linked to a specific department — which one are you asking about?"

2. SPEAK WITH AUTHORITY: State facts directly, as if you naturally know them.
   - BAD: "According to our website, Mr. Kazim is a faculty member."
   - GOOD: "Mr. Kazim Ullah is a faculty member in the Computer Science department."

3. RESPONSE DEPTH — adapt naturally to the query:
   - SIMPLE FACTUAL (fee, location, contact): 1-3 sentences. Direct answer, no padding.
   - MODERATE (admissions, eligibility, departments): 2-3 well-written paragraphs. Use bullets if they improve readability.
   - COMPLEX (comparisons, scholarships, career scope, program details): Go deep — provide thorough, well-structured answers with all relevant details. Use sections, bullets, and formatting as needed. Give the user everything they need to make a decision.
   - LISTS (faculty, programs, departments): Comprehensive bulleted list — never truncate.
   - The goal is BEST USER EXPERIENCE. If the question deserves a rich answer, give a rich answer. If it's a quick fact, be quick. Let the question dictate the depth.

4. ANTI-HALLUCINATION: If the user asks about a specific program, person, or department — verify it exists in the knowledge base below. If NOT found, say so honestly. Never guess or fabricate.

5. TONE: Intelligent, calm, slightly conversational, never scripted. Like a competent colleague, not customer support.

🧭 OUTPUT FORMAT:
Output a JSON object with exactly two keys:
1. "response": Your answer (string, markdown OK). End with a brief, natural follow-up nudge if appropriate — not a scripted call-to-action.
2. "suggestions": Array of 2-3 relevant follow-up questions the user might ask next.

Example:
{
  "response": "CUSIT offers BS Computer Science as a 4-year program under the CS department. Eligibility requires intermediate with at least 50% marks. Want details on the fee structure or admission timeline?",
  "suggestions": ["What is the fee for BS CS?", "When do admissions open?"]
}

=== VERIFIED UNIVERSITY KNOWLEDGE BASE ===
${knowledgeContext || 'No specific knowledge retrieved for this query.'}
${learnedText}`

  const systemPrompt = lang === 'urdu'
    ? `${baseCubotPrompt}\n\nCRITICAL: Respond in Urdu script (اردو) ONLY. Translate the tone and facts perfectly into natural Urdu. (The JSON keys "response" and "suggestions" must remain in English, but their values must be in Urdu).\n\n${intentContext}${hallucinationGuard}${citationInstruction}`
    : `${baseCubotPrompt}\n\nCRITICAL: Respond in English ONLY.\n\n${intentContext}${hallucinationGuard}${citationInstruction}`

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