import { v4 as uuidv4 } from 'uuid'
import { ChatRequest, Citation, ConfidenceLevel, RankedChunk } from '@/types'
import { hybridRetrieve } from './retrieval'
import { rerank } from './reranker'
import { AppError } from './errors'
import { getCachedResult, setCachedResult, CachedRAGResult } from './query-cache'
import sql from './db'

// We use the standard ReadableStream and TransformStream which are global in Next.js/Node 18+

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

/**
 * Logs query analytics to the database.
 */
async function logQuery(params: {
  id: string
  query: string
  intent: string
  confidence: ConfidenceLevel
  responseLength: number
  retrievalMs: number
  totalMs: number
  cacheHit?: boolean
  chunks?: RankedChunk[]
}) {
  try {
    await sql`
      INSERT INTO query_logs (
        id, query, intent, confidence, response_length, 
        retrieval_ms, total_ms, cache_hit
      ) VALUES (
        ${params.id}, ${params.query}, ${params.intent}, ${params.confidence}, 
        ${params.responseLength}, ${params.retrievalMs}, ${params.totalMs}, 
        ${params.cacheHit || false}
      )
    `
    
    await sql`
      INSERT INTO retrieval_logs (
        id, query, intent, confidence, response_length, 
        retrieval_ms, total_ms, cache_hit
      ) VALUES (
        ${params.id}, ${params.query}, ${params.intent}, ${params.confidence}, 
        ${params.responseLength}, ${params.retrievalMs}, ${params.totalMs}, 
        ${params.cacheHit || false}
      )
    `

    if (params.chunks && params.chunks.length > 0) {
      for (const chunk of params.chunks) {
        await sql`
          INSERT INTO retrieved_chunks (
            retrieval_log_id, pinecone_id, similarity_score, source_url
          ) VALUES (
            ${params.id}, ${chunk.id}, ${chunk.score || 0}, ${chunk.metadata?.sourceUrl || ''}
          )
        `.catch(() => {})
      }
    }
  } catch (err) {
    console.warn('[logQuery] Failed to log query:', err)
  }
}

// =====================================================
// CONTEXT BUILDER — Token-Budgeted
// =====================================================

const MAX_CONTEXT_CHARS = 12000 // ~3000 tokens — safe context budget for LLM

/**
 * Builds the knowledge context string with a token budget.
 * Ensures we never overflow the LLM's context window.
 * Deduplicates chunks with >60% overlapping text before injecting.
 */
function buildKnowledgeContext(chunks: RankedChunk[]): string {
  if (chunks.length === 0) return ''

  const parts: string[] = []
  let totalChars = 0
  const seenMiniHashes = new Set<string>()

  for (let i = 0; i < chunks.length; i++) {
    const meta = chunks[i].metadata
    const text = meta.text || ''

    // Deduplication: skip chunks with very similar start (first 100 chars)
    const miniHash = text.slice(0, 100).toLowerCase().replace(/\s/g, '')
    if (seenMiniHashes.has(miniHash)) continue
    seenMiniHashes.add(miniHash)

    const sourceLabel = meta.sourceUrl
      ? `[Source: ${meta.title} | ${meta.category} | ${meta.sourceUrl}]`
      : `[Source: ${meta.title} | ${meta.category}]`

    const entry = `--- Context ${parts.length + 1} ${sourceLabel} ---\n${text}`

    // Enforce token budget
    if (totalChars + entry.length > MAX_CONTEXT_CHARS) {
      // Truncate the last entry if there's still some budget left
      const remaining = MAX_CONTEXT_CHARS - totalChars
      if (remaining > 200) {
        parts.push(entry.slice(0, remaining) + '\n[truncated for context budget]')
      }
      break
    }

    parts.push(entry)
    totalChars += entry.length
  }

  return parts.join('\n\n')
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
      : `\n\nIMPORTANT: Limited confidence context. Only state what the context explicitly confirms. For uncertain details, say you can't verify rather than guessing.`
  }

  return ''
}

// =====================================================
// QUERY REWRITING
// =====================================================

async function rewriteQuery(
  message: string,
  conversationHistory: ChatRequest['conversationHistory'],
  apiKey: string
): Promise<string> {
  if (conversationHistory.length === 0) {
    return message
  }

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
      signal: AbortSignal.timeout(4000),
    })

    if (response.ok) {
      const data = await response.json()
      const rewritten = data.choices?.[0]?.message?.content?.trim()
      if (rewritten) {
        const cleaned = rewritten.replace(/^["']|["']$/g, '').trim()
        console.log(`[RAG] Query rewritten: "${message}" → "${cleaned}"`)
        return cleaned
      }
    }
  } catch (err) {
    console.error('[RAG] Query rewriter error:', err)
  }

  return message
}

// =====================================================
// FALLBACK RETRY PIPELINE
// =====================================================

interface RetrievalAttempt {
  chunks: RankedChunk[]
  citations: Citation[]
  confidence: ConfidenceLevel
}

/**
 * Enterprise Hybrid Retrieval Engine — v3
 * 
 * Strategy:
 * 1. Intent Analysis & Synonym Expansion (Dental -> BDS, etc.)
 * 2. Multi-Stage Retrieval Lifecycle:
 *    - STAGE 1: High-Precision (Specific Namespace + Top-K)
 *    - STAGE 2: Broad Fallback (Global Namespace + Synonym Expansion)
 *    - STAGE 3: Semantic Relaxation (Broad reranking of all candidates)
 */

const SYNONYMS: Record<string, string[]> = {
  'dental': ['bds', 'dentistry', 'dental surgery', 'dental science', 'oral medicine'],
  'bds': ['dental', 'dentistry', 'dental surgery', 'oral medicine'],
  'pharmacy': ['pharm-d', 'pharmacology', 'pharma'],
  'cs': ['computer science', 'it', 'information technology', 'software engineering'],
  'bba': ['business', 'management', 'mba', 'commerce'],
  'nursing': ['bsn', 'medical assistant'],
  'admission': ['apply', 'enroll', 'entry test', 'last date', 'eligibility'],
  'fee': ['charges', 'payment', 'tuition', 'scholarship']
}

function expandSynonyms(query: string): string {
  let expanded = query
  const lower = query.toLowerCase()
  for (const [key, alts] of Object.entries(SYNONYMS)) {
    if (lower.includes(key)) {
      expanded += ' ' + alts.join(' ')
    }
  }
  return expanded
}

async function retrieveWithFallback(
  query: string,
  intent: string
): Promise<RetrievalAttempt> {
  const apiKey = process.env.GROQ_API_KEY || ''
  
  // ATTEMPT 1: High-Precision Semantic Hybrid
  console.log(`[RAG] Attempt 1: High-Precision Hybrid for "${query}"`)
  const attempt1 = await hybridRetrieve(query, 6, { expandQueries: false })
  if (attempt1.confidence === 'high' || (attempt1.confidence === 'medium' && attempt1.chunks.length >= 3)) {
    return attempt1
  }

  // ATTEMPT 2: Synonym Expansion + Multi-Query variant
  console.log('[RAG] Attempt 1 low confidence. Attempting Stage 2: Synonym Expansion.')
  const expandedQuery = expandSynonyms(query)
  const attempt2 = await hybridRetrieve(expandedQuery, 10, { expandQueries: true })
  if (attempt2.confidence !== 'no_data' && attempt2.chunks.length > 0) {
    return attempt2
  }

  // ATTEMPT 3: Broad Semantic Relaxation (Search related namespaces)
  console.log('[RAG] Attempt 2 failed. Attempting Stage 3: Broad Namespace Search.')
  // We Broaden the search by using a generic 'academic' and 'admissions' combined query
  const broadQuery = `${query} admissions eligibility process requirements`
  const attempt3 = await hybridRetrieve(broadQuery, 15, { expandQueries: true })
  
  return attempt3
}

// =====================================================
// MAIN RAG PIPELINE
// =====================================================

export interface RAGResult {
  content: string
  citations: Citation[]
  confidence: ConfidenceLevel
  suggestions: string[]
  cached?: boolean
  retrievalMs?: number
}

export async function runRAGPipeline(
  request: ChatRequest,
  intentContext: string = '',
  intent: string = 'general_question'
): Promise<RAGResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new AppError('GROQ_API_KEY not configured', 500, 'CONFIG_ERROR')
  }

  const { message, conversationHistory } = request
  const lang = detectLanguage(message)
  const startMs = Date.now()

  // ── Cache check ─────────────────────────────────────────────────────────────
  const cached = await getCachedResult(message, intent)
  if (cached) {
    console.log(`[RAG] Cache hit for query: "${message.slice(0, 40)}"`)
    return {
      content: cached.content,
      citations: cached.citations as Citation[],
      confidence: cached.confidence as ConfidenceLevel,
      suggestions: cached.suggestions,
      cached: true,
      retrievalMs: 0,
    }
  }

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
  const searchQuery = await rewriteQuery(message, conversationHistory, apiKey)

  // ── Dynamic retrieval limit for list/aggregation queries ────────────────────
  const isListQuery = /all|list|multiple|who are|teachers|faculty|professors|staff|courses|programs/i.test(message)
  const topNChunks = isListQuery ? 12 : 5

  // ── Retrieval with 3-attempt fallback ────────────────────────────────────────
  const retrievalStart = Date.now()
  const { chunks: rawChunks, citations, confidence } = await retrieveWithFallback(searchQuery, intent)
  const retrievalMs = Date.now() - retrievalStart

  console.log(`[RAG] Retrieved ${rawChunks.length} candidates in ${retrievalMs}ms (confidence: ${confidence})`)

  // ── LLM-assisted reranking ──────────────────────────────────────────────────
  const useLLMRerank = confidence !== 'no_data' && rawChunks.length > topNChunks
  const rerankedChunks = await rerank(searchQuery, rawChunks, topNChunks, useLLMRerank)

  // ── Build context (token-budgeted + deduplicated) ───────────────────────────
  const knowledgeContext = buildKnowledgeContext(rerankedChunks)
  const hallucinationGuard = buildHallucinationGuard(confidence, lang)
  const conversationHistory3 = conversationHistory
    .slice(-3)
    .map(h => `${h.role}: ${h.content}`)
    .join('\n')

  // ── System prompt ───────────────────────────────────────────────────────────
  const baseCubotPrompt = `You are the Senior University Admission Advisor for City University of Science & Information Technology (CUSIT), Peshawar. 

Your goal is to provide such complete and impressive information that prospective students and parents feel fully equipped to apply without needing to visit the campus or call support.

🎯 CORE RESPONSE PRINCIPLE:
- INSTITUTION-AWARE: You know every department, every fee detail, and every deadline.
- WELCOMING & TRUSTWORTHY: You are the face of the university's digital excellence.
- CONTEXT-RICH: Don't just give a fact; explain the process and the benefits.
- PROFESSIONAL CONFIDENCE: Answer directly and thoroughly.
- HIGH information density — every sentence must carry weight
- Clear, direct, and meaningful — no filler or fluff
- Confident, not hesitant or overly defensive
- Human-like, not chatbot-like — like talking to the smartest person on campus
- Response depth adapts to the question: simple question = concise answer, complex question = thorough, rich answer

🚫 BANNED BEHAVIOR:
- NO robotic openers: "I am glad to help you…", "Absolutely! Let me walk you through…", "That's a great question!"
- NO referencing sources: "According to the website…", "Based on the retrieved context…", "As an AI model…", "Our records show…"
- NO unnecessary deflection to emails/phone numbers/admin contacts unless the information is truly unavailable
- NO invented staff, roles, departments, programs, or announcements
- NO empty filler paragraphs or emotional padding that adds no real information
- NO saying "I don't know" without first attempting to provide partial information

✅ RESPONSE RULES:
1. ALWAYS TRY BEFORE REFUSING: If asked about a person, topic, or department — check the knowledge base first. If partial info exists, share it and clearly note the limitation.
   - BAD: "I don't have information about this person."
   - GOOD: "I don't have confirmed details about this person in official records. If they're part of faculty, they may be linked to a specific department — which one are you asking about?"

2. SPEAK WITH AUTHORITY: State facts directly.
   - BAD: "According to our website, Mr. Kazim is a faculty member."
   - GOOD: "Mr. Kazim Ullah is a faculty member in the Computer Science department."

3. RESPONSE DEPTH — adapt naturally to the query:
   - SIMPLE FACTUAL (fee, location, contact): 1-3 sentences. Direct answer, no padding.
   - MODERATE (admissions, eligibility, departments): 2-3 well-written paragraphs. Use bullets if they improve readability.
3. COMPLEX (comparisons, scholarships, career scope, program details): Go deep — well-structured with sections, bullets, formatting. Give the user everything they need.
   - LISTS (faculty, programs, departments): Comprehensive bulleted list — never truncate.

4. ANTI-HALLUCINATION (STRICT SCOPE GUARD): You MUST ONLY answer using the provided context below. You are FORBIDDEN from using your general LLM knowledge to answer questions about the university, its programs, fees, or faculty. If a specific program, person, or department is NOT explicitly found in the verified knowledge base below, you MUST state honestly that you don't have the information. Never guess, fabricate, or improvise.

5. TONE: Welcoming, authoritative, supportive, and highly informative. Like a senior admission consultant who wants the student to succeed.

6. CITATION: Always prioritize specific program names and department details.

🧭 OUTPUT FORMAT:
Output a JSON object with exactly two keys:
1. "response": Your answer (string, markdown OK). End with a brief, natural follow-up nudge if appropriate.
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
    ? `${baseCubotPrompt}\n\nCRITICAL: Respond in Urdu script (اردو) ONLY. (JSON keys remain English).\n\n${intentContext}${hallucinationGuard}`
    : `${baseCubotPrompt}\n\nCRITICAL: Respond in English ONLY.\n\n${intentContext}${hallucinationGuard}\n\nADVISOR GUIDANCE: If confirmed data is scarce, share related admission resources, eligibility patterns, or contact channels professionally. NEVER simply say 'I don't know' if any related university context exist.`

  const prompt = `${systemPrompt}
${conversationHistory3 ? `\nConversation context:\n${conversationHistory3}\n` : ''}
User question: ${message}
Answer (${lang === 'urdu' ? 'URDU ONLY' : 'ENGLISH ONLY'}, MUST BE VALID JSON):`

  // ── STRICT SCOPE GUARD (Tier-3 Degradation) ─────────────────────────────────
  if (confidence === 'no_data') {
    const fallbackMessage = lang === 'urdu'
      ? "اس وقت میرے پاس اس بارے میں مخصوص معلومات نہیں ہیں۔ براہ کرم داخلہ آفس سے info@cusit.edu.pk یا +92-91-111-111-287 پر براہ راست رابطہ کریں۔"
      : "I don't have specific information about that right now. Please contact the admissions office directly at info@cusit.edu.pk or call +92-91-111-111-287.";
    
    // Log unanswered query
    sql`
      INSERT INTO unanswered_questions (question_text, language, persona, tier_reached)
      VALUES (${message}, ${lang}, ${intent}, 'tier3')
    `.catch(() => {});

    return {
      content: fallbackMessage,
      citations: [],
      confidence: 'no_data',
      suggestions: ["How to apply?", "What are the contact details?"],
      cached: false,
      retrievalMs
    }
  }

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
          temperature: 0.15,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          stream: false, // Explicitly false for the sync version
        }),
        signal: AbortSignal.timeout(30000),
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
        console.error('[Groq] JSON Parse Error:', parseErr)
        parsedContent = contentStr
      }

      const result: RAGResult = {
        content: parsedContent || (lang === 'urdu'
          ? 'معذرت، ابھی جواب دینے میں دشواری ہو رہی ہے۔ دوبارہ کوشش کریں۔'
          : 'I\'m having trouble responding right now. Please try again.'),
        citations,
        confidence,
        suggestions: parsedSuggestions,
        cached: false,
        retrievalMs,
      }

      // ── Log analytics ────────────────────────────────────────────────────────
      const totalMs = Date.now() - startMs
      logQuery({
        id: uuidv4(),
        query: message,
        intent,
        confidence,
        responseLength: result.content.length,
        retrievalMs,
        totalMs,
        cacheHit: false,
        chunks: rerankedChunks,
      }).catch(() => {})

      // Cache successful high/medium confidence results
      const isNegativeResponse = /don't have info|don't know|not found|معذرت|پاس معلومات نہیں|تصدیق شدہ معلومات نہیں/i.test(parsedContent)
      if (confidence !== 'no_data' && parsedContent && !isNegativeResponse) {
        const cachePayload: CachedRAGResult = {
          content: result.content,
          citations: result.citations,
          confidence: result.confidence,
          suggestions: result.suggestions,
          cachedAt: Date.now(),
        }
        setCachedResult(message, cachePayload, intent).catch(() => {})
      }

      return result
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

/**
 * Streaming version of the RAG pipeline.
 * Returns a ReadableStream that emits:
 * 1. Chunks of the "response" text directly.
 * 2. A final JSON-encoded block with "metadata" (suggestions, citations, confidence).
 */
export async function runStreamingRAGPipeline(
  request: ChatRequest,
  intentContext: string = '',
  intent: string = 'general_question'
): Promise<ReadableStream> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const { message, conversationHistory } = request
  const lang = detectLanguage(message)

  // ── 1. Setup Retrieval & Reranking ──────────────────────────────────────────
  const searchQuery = await rewriteQuery(message, conversationHistory, apiKey)
  const isListQuery = /all|list|multiple|who are|teachers|faculty|professors|staff|courses|programs/i.test(message)
  const topNChunks = isListQuery ? 12 : 5

  const { chunks: rawChunks, citations, confidence } = await retrieveWithFallback(searchQuery, intent)
  const rerankedChunks = await rerank(searchQuery, rawChunks, topNChunks, true)

  const knowledgeContext = buildKnowledgeContext(rerankedChunks)
  const hallucinationGuard = buildHallucinationGuard(confidence, lang)
  const conversationHistory3 = conversationHistory.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')

  // ── STRICT SCOPE GUARD (Tier-3 Degradation) ─────────────────────────────────
  if (confidence === 'no_data') {
    const fallbackMessage = lang === 'urdu'
      ? "اس وقت میرے پاس اس بارے میں مخصوص معلومات نہیں ہیں۔ براہ کرم داخلہ آفس سے info@cusit.edu.pk یا +92-91-111-111-287 پر براہ راست رابطہ کریں۔"
      : "I don't have specific information about that right now. Please contact the admissions office directly at info@cusit.edu.pk or call +92-91-111-111-287.";
    
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(fallbackMessage));
        controller.enqueue(new TextEncoder().encode('\n\n[METADATA]\n{"suggestions": ["How to apply?", "What are the contact details?"]}'));
        
        // Log unanswered query
        if (request.sessionId) {
          sql`
            INSERT INTO conversations (session_id, user_message, bot_response, persona, language, response_source, is_unanswered)
            VALUES (${request.sessionId}, ${message}, ${fallbackMessage}, ${intent}, ${lang}, 'fallback', true)
            RETURNING id
          `.then(async (res) => {
            if (res.length > 0) {
              await sql`
                INSERT INTO unanswered_questions (conversation_id, question_text, language, persona, tier_reached)
                VALUES (${res[0].id}, ${message}, ${lang}, ${intent}, 'tier3')
              `
            }
          }).catch(err => console.error('[RAG] Fallback log error:', err))
        }
        controller.close();
      }
    });
  }

  // ── 2. Create Prompt ────────────────────────────────────────────────────────
  // We use a slightly different prompt for streaming to make the text flow better
  const baseCubotPrompt = `You are Cubot, the expert-level university assistant for City University of Science & Information Technology (CUSIT), Peshawar.
  
  🎯 CORE RESPONSE PRINCIPLE:
  - HIGH information density.
  - No robotic openers.
  - Speak with authority.
  - Human-like, not chatbot-like.
  
  🧭 STREAMING FORMAT:
  1. First, provide the answer text directly.
  2. At the very end of your response, after a double newline, output exactly this delimiter: [METADATA]
  3. Immediately following the delimiter, output a JSON object with: "suggestions" (2-3 follow-up questions).
  
  Example ending:
  ...This is the end of my answer.
  
  [METADATA]
  {"suggestions": ["Question 1?", "Question 2?"]}
  
  === VERIFIED UNIVERSITY KNOWLEDGE BASE ===
  ${knowledgeContext || 'No specific knowledge retrieved for this query.'}`

  const systemPrompt = lang === 'urdu'
    ? `${baseCubotPrompt}\n\nCRITICAL: Respond in Urdu script (اردو) ONLY. (JSON keys remain English).\n\n${intentContext}${hallucinationGuard}`
    : `${baseCubotPrompt}\n\nCRITICAL: Respond in English ONLY.\n\n${intentContext}${hallucinationGuard}\n\nADVISOR GUIDANCE: Be thorough. If asked about a program, explain the admissions path. Always behave like a senior advisor.`

  const prompt = `${systemPrompt}
${conversationHistory3 ? `\nConversation context:\n${conversationHistory3}\n` : ''}
User question: ${message}
Answer (${lang === 'urdu' ? 'URDU ONLY' : 'ENGLISH ONLY'}):`

  // ── 3. Start Groq Stream ────────────────────────────────────────────────────
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Reduced temperature for stricter answers
      max_tokens: 1200,
      stream: true,
    }),
  })

  if (!response.ok) throw new Error(`Groq API Error: ${response.status}`)

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  // Use a TransformStream to process Groq chunks and emit them
  return new ReadableStream({
    async start(controller) {
      if (!response.body) {
        controller.close()
        return
      }

      const reader = response.body.getReader()
      let fullResponseText = ''

      try {
        const queryId = uuidv4()
        const startMs = Date.now()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                const text = parsed.choices?.[0]?.delta?.content || ''
                if (text) {
                  fullResponseText += text
                  controller.enqueue(encoder.encode(text))
                }
              } catch {
                // ignore invalid JSON chunks
              }
            }
          }
        }

        // ── End of stream processing ──────────────────────────────────────────
        const totalMs = Date.now() - startMs
        
        // Extract suggestions and content for logging
        const parts = fullResponseText.split('[METADATA]')
        const content = parts[0].trim()
        let suggestions: string[] = []
        if (parts.length > 1) {
          try {
            suggestions = JSON.parse(parts[1].trim()).suggestions || []
          } catch {}
        }

        logQuery({
          id: queryId,
          query: message,
          intent,
          confidence,
          responseLength: content.length,
          retrievalMs: 0, // In streaming, retrieval happened before
          totalMs,
          cacheHit: false,
          chunks: rerankedChunks
        }).catch(() => {})

        // Cache the result ONLY if it's high quality and actually contains info
        const isNegativeResponse = /don't have info|don't know|not found|معذرت|پاس معلومات نہیں|تصدیق شدہ معلومات نہیں/i.test(content)
        
        if (confidence !== 'no_data' && content && !isNegativeResponse) {
          setCachedResult(message, {
            content,
            citations: citations as Citation[],
            confidence,
            suggestions,
            cachedAt: Date.now()
          }, intent).catch(() => {})
        }

        // --- PHASE 5: Conversation Logging ---
        if (request.sessionId) {
          sql`
            INSERT INTO conversations (session_id, user_message, bot_response, persona, language, response_source, is_unanswered)
            VALUES (${request.sessionId}, ${message}, ${content}, ${intent}, ${lang}, 'ai_fresh', ${confidence === 'no_data'})
            RETURNING id
          `.then(async (res) => {
            // Log unanswered questions
            if (confidence === 'no_data' && res.length > 0) {
              await sql`
                INSERT INTO unanswered_questions (conversation_id, question_text, language, persona, tier_reached)
                VALUES (${res[0].id}, ${message}, ${lang}, ${intent}, 'tier3')
              `
            }
          }).catch(err => console.error('[RAG] Conversation log error:', err))
        }
      } catch (err) {
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })
}

export function getLearningStats() {
  return { correctionsCount: learningSystem.getCount() }
}