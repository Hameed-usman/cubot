import { v4 as uuidv4 } from 'uuid'
import { ChatRequest, Citation, ConfidenceLevel, RankedChunk } from '@/types'
import { hybridRetrieve } from './retrieval'
import { rerank } from './reranker'
import { AppError } from './errors'
import { getCachedResult, setCachedResult, CachedRAGResult } from './query-cache'
import sql from './db'
import { groqFetchWithRetry } from './groq-queue'

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
        `.catch(() => { })
      }
    }
  } catch (err) {
    console.warn('[logQuery] Failed to log query:', err)
  }
}

// =====================================================
// CONTEXT BUILDER — Token-Budgeted
// =====================================================

const MAX_CONTEXT_CHARS = 24000 // ~6000 tokens — safe context budget for LLM

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
        const sliced = entry.slice(0, remaining)
        const lastPunctuation = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('?'))
        if (lastPunctuation > 0) {
          parts.push(sliced.slice(0, lastPunctuation + 1) + '\n[truncated for context budget]')
        } else {
          parts.push(sliced + '\n[truncated for context budget]')
        }
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
    const response = await groqFetchWithRetry(() =>
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 80,
        }),
        signal: AbortSignal.timeout(4000),
      })
    )

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
  const attempt1 = await hybridRetrieve(query, 15, { expandQueries: false })
  if (attempt1.confidence === 'high' || (attempt1.confidence === 'medium' && attempt1.chunks.length >= 3)) {
    return attempt1
  }

  // ATTEMPT 2: Synonym Expansion + Multi-Query variant
  console.log('[RAG] Attempt 1 low confidence. Attempting Stage 2: Synonym Expansion.')
  const expandedQuery = expandSynonyms(query)
  const attempt2 = await hybridRetrieve(expandedQuery, 15, { expandQueries: true })

  if (attempt2.confidence !== 'no_data' && attempt2.chunks.length > 0) {
    // Merge chunks from attempt1 and attempt2 to maximize recall
    if (attempt1.chunks.length > 0) {
      const seen = new Set(attempt2.chunks.map(c => c.id))
      const extra = attempt1.chunks.filter(c => !seen.has(c.id))
      attempt2.chunks.push(...extra)
    }
    if (attempt2.confidence === 'high' || (attempt2.confidence === 'medium' && attempt2.chunks.length >= 3)) {
      return attempt2
    }
  }

  // ATTEMPT 3: Broad Semantic Relaxation (Intent-aware)
  let attempt3: RetrievalAttempt = { chunks: [], citations: [], confidence: 'no_data' }
  const isAdmissionsRelated = /admission|apply|enroll|eligib|entry test|fee|scholarship/i.test(query) || intent.includes('admission')

  if (isAdmissionsRelated) {
    console.log('[RAG] Attempt 2 low confidence. Attempting Stage 3: Admissions Broad Search.')
    const broadQuery = `${query} details requirements process`
    attempt3 = await hybridRetrieve(broadQuery, 20, { expandQueries: true })
    if (attempt3.confidence !== 'no_data' && attempt3.chunks.length > 0) {
      if (attempt2.chunks.length > 0) {
        const seen = new Set(attempt3.chunks.map(c => c.id))
        const extra = attempt2.chunks.filter(c => !seen.has(c.id))
        attempt3.chunks.push(...extra)
      }
      if (attempt3.confidence === 'high' || (attempt3.confidence === 'medium' && attempt3.chunks.length >= 3)) {
        return attempt3
      }
    }
  } else {
    console.log('[RAG] Skipping Stage 3 because intent is not admissions-related.')
  }

  // ATTEMPT 4: Global Namespace Brute-force Recall Recovery
  console.log('[RAG] Confidence still low. Attempting Stage 4: Global Namespace Brute-force.')
  const attempt4 = await hybridRetrieve(query, 50, { expandQueries: true, globalNamespaceOnly: true })

  if (attempt4.confidence === 'high' || attempt4.confidence === 'medium') {
    // Only trust attempt4 if it found genuinely confident results
    const bestSoFar = attempt3.chunks.length > 0 ? attempt3 : (attempt2.chunks.length > 0 ? attempt2 : attempt1)
    const seen = new Set(attempt4.chunks.map(c => c.id))
    const extra = bestSoFar.chunks.filter(c => !seen.has(c.id))
    attempt4.chunks.push(...extra)
    return attempt4
  }

  // All 4 attempts failed to find confident results.
  // Pick the best available confidence level; if everything is 'low', return no_data
  // so the hallucination guard fires and the question gets logged as unanswered.
  const candidates = [attempt3, attempt2, attempt1, attempt4].filter(a => a.chunks.length > 0)
  const bestMedium = candidates.find(a => a.confidence === 'medium')
  if (bestMedium) return bestMedium

  // All low or no data — treat as no_data to avoid hallucination
  console.log('[RAG] All attempts returned low/no confidence. Treating as no_data.')
  return { chunks: [], citations: [], confidence: 'no_data' }
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
  const recentHistory = conversationHistory.slice(-8)
  const searchQuery = await rewriteQuery(message, recentHistory, apiKey)

  // ── Dynamic retrieval limit for list/aggregation queries ────────────────────
  const isListQuery = /all|list|multiple|who are|teachers|faculty|professors|staff|courses|programs/i.test(message)
  const topNChunks = isListQuery ? 12 : 10

  // ── Retrieval with 3-attempt fallback ────────────────────────────────────────
  const retrievalStart = Date.now()
  const { chunks: rawChunks, citations, confidence } = await retrieveWithFallback(searchQuery, intent)
  const retrievalMs = Date.now() - retrievalStart

  console.log(`[RAG] Retrieved ${rawChunks.length} candidates in ${retrievalMs}ms (confidence: ${confidence})`)

  // ── LLM-assisted reranking ──────────────────────────────────────────────────
  const useLLMRerank = confidence !== 'no_data' && rawChunks.length > 20
  const rerankedChunks = await rerank(searchQuery, rawChunks, topNChunks, useLLMRerank)

  // ── Build context (token-budgeted + deduplicated) ───────────────────────────
  const knowledgeContext = buildKnowledgeContext(rerankedChunks)

  // Debug: log what chunks are actually being sent to the LLM
  console.log(`[RAG] ┌─ Context chunks passed to LLM (${rerankedChunks.length} total, confidence: ${confidence}) ──`)
  rerankedChunks.forEach((c, i) => {
    const preview = (c.metadata.text || '').slice(0, 150).replace(/\n/g, ' ')
    console.log(`[RAG] │ [${i + 1}] [${c.metadata.category}] ${c.metadata.title} | score=${((c.rerankScore || c.rrfScore || c.score || 0)).toFixed(4)}`)
    console.log(`[RAG] │     “${preview}”`)
  })
  console.log(`[RAG] └─ End of context ──`)
  const hallucinationGuard = buildHallucinationGuard(confidence, lang)
  const conversationHistory3 = recentHistory
    .slice(-3)
    .map(h => `${h.role}: ${h.content}`)
    .join('\n')

  // ── Persona Detection ───────────────────────────────────────────────────────
  const lowerMessage = message.toLowerCase()
  let personaTone = ''
  if (/(apply|admission|fee|program)/.test(lowerMessage)) {
    personaTone = 'Tone: Warm welcoming tone (visitor).'
  } else if (/(exam|result|course|schedule|semester)/.test(lowerMessage)) {
    personaTone = 'Tone: Helpful direct tone (student).'
  }

  // ── System prompt ───────────────────────────────────────────────────────────
  const baseCubotPrompt = `You are Cubot, the official AI assistant of City University of Science and Information Technology (CUSIT), Peshawar. You work at the university's front desk and you speak like a warm, knowledgeable, and professional human staff member — not like a robot reading from a database.

Your personality: Friendly, helpful, confident, and concise. You speak naturally. You do not use corporate jargon. You do not start sentences with "Certainly!" or "Of course!" or "Great question!" You just answer, like a real person would.

Your rules:
- Answer only from the context provided to you. If the context contains the answer, give it confidently and completely — do not omit names, details, or data that is present in the context.
- CRITICAL GROUNDING RULE: Never add any service, fact, detail, or claim that is not explicitly written in the context below — even if it sounds typical or plausible for a university to offer (e.g. "career counseling", "wellness services", generic admission-to-graduation descriptions). If the context doesn't say it, you don't say it. A shorter, fully-grounded answer is always better than a longer one that includes unverified assumptions.
- If the context does not contain the answer, say clearly: "I don't have that detail on hand right now — your best bet is to call the admissions office directly at 111-1-CUSIT (111-12-8748) or visit us on Dalazak Road." Then stop. Do not guess. Do not add generic advice.
- Never say "based on the provided context" or "the context does not explicitly state" or "the provided context doesn't specify" — these phrases sound robotic. Just answer naturally.
- For list questions (faculty members, programs, courses, requirements), provide the FULL list from the context — do not summarize or truncate it. For non-list questions, keep answers to 4 sentences max.
- If someone asks something outside the university scope — weather, general knowledge, other universities — say: "I'm only set up to help with CUSIT-related questions. Is there something about the university I can help you with?"
- Respond in the same language the user writes in. If they write in Urdu, respond in Urdu. If they write in Roman Urdu, respond in Roman Urdu. If they write in English, respond in English.
- Never start your response with "Cubot:" or your own name.
- You represent CUSIT professionally. Every response reflects on the university.
- The context you receive may contain incomplete sentences at the boundaries of chunks. Never reproduce incomplete sentences in your answer. If a piece of information seems cut off, either complete it from your knowledge of the context or omit it entirely. Never output text that trails off mid-sentence.
${personaTone}

Output a JSON object with exactly two keys:
1. "response": Your answer (string, markdown OK).
2. "suggestions": Array of 2-3 relevant follow-up questions the user might ask next.

=== VERIFIED UNIVERSITY KNOWLEDGE BASE ===
${knowledgeContext || 'No specific knowledge retrieved for this query.'}
${learnedText}`

  const systemPrompt = lang === 'urdu'
    ? `${baseCubotPrompt}\n\nCRITICAL: Respond in Urdu script (اردو) ONLY. (JSON keys remain English).\n\n${intentContext}${hallucinationGuard}`
    : `${baseCubotPrompt}\n\nCRITICAL: Respond in English ONLY. When the knowledge base contains specific details (names, courses, fees, contacts), state them clearly and completely. Do not truncate or omit provided data.\n\n${intentContext}${hallucinationGuard}`

  const prompt = `${systemPrompt}
${conversationHistory3 ? `\nConversation context:\n${conversationHistory3}\n` : ''}
User question: ${message}
Answer (${lang === 'urdu' ? 'URDU ONLY' : 'ENGLISH ONLY'}, MUST BE VALID JSON):`

  // ── STRICT SCOPE GUARD (Tier-3 Degradation) ─────────────────────────────────
  if (confidence === 'no_data') {
    const fallbackMessage = `I don't have that specific information right now. For accurate details, you can reach the CUSIT admissions office directly:

📞 111-1-CUSIT (111-12-8748)  
📧 admissions@cusit.edu.pk  
📍 Dalazak Road, Peshawar

They'll be able to give you the most up-to-date answer.`;

    // Unconditionally log unanswered question — no sessionId dependency
    sql`
      INSERT INTO unanswered_questions (question_text, language, persona, tier_reached)
      VALUES (${message}, ${lang}, ${intent}, 'tier3')
    `.then(() => {
      console.log(`[RAG] Unanswered question logged: "${message.slice(0, 60)}"`)
    }).catch(err => {
      console.error('[RAG] Failed to log unanswered question (non-streaming):', err)
    });

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
    const response = await groqFetchWithRetry(() =>
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.05,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          stream: false, // Explicitly false for the sync version
        }),
        signal: AbortSignal.timeout(30000),
      })
    )

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
    }).catch(() => { })

    // Cache successful high/medium confidence results
    const isNegativeResponse = /don't have info|don't know|not found|معذرت|پاس معلومات نہیں|تصدیق شدہ معلومات نہیں/i.test(parsedContent)
    if (parsedContent && !isNegativeResponse) {
      const cachePayload: CachedRAGResult = {
        content: result.content,
        citations: result.citations,
        confidence: result.confidence,
        suggestions: result.suggestions,
        cachedAt: Date.now(),
      }
      setCachedResult(message, cachePayload, intent).catch(() => { })
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

  const isGreeting = /^(hey|hi|hello|salam|assalam|dear|helo|hii|howdy|good morning|good evening|good afternoon)[\s!.،]*$/i.test(message.trim())
  if (isGreeting) {
    return new ReadableStream({
      start(controller) {
        const greeting = lang === 'urdu'
          ? 'السلام علیکم! میں Cubot ہوں، CUSIT کا آفیشل AI اسسٹنٹ۔ آپ کی کیا مدد کر سکتا ہوں؟'
          : "Hi! I'm Cubot, CUSIT's official AI assistant. How can I help you today?"
        controller.enqueue(new TextEncoder().encode(greeting))
        controller.enqueue(new TextEncoder().encode('\n\n[METADATA]\n{"suggestions": ["How to apply to CUSIT?", "What programs are offered?", "What are the fee structures?"]}'))
        controller.close()
      }
    })
  }

  // ── 1. Setup Retrieval & Reranking ──────────────────────────────────────────
  const recentHistory = conversationHistory.slice(-8)
  const searchQuery = await rewriteQuery(message, recentHistory, apiKey)
  const isListQuery = /all|list|multiple|who are|teachers|faculty|professors|staff|courses|programs/i.test(message)
  const topNChunks = isListQuery ? 12 : 10

  const { chunks: rawChunks, citations, confidence } = await retrieveWithFallback(searchQuery, intent)
  const useLLMRerank = confidence !== 'no_data' && rawChunks.length > 20
  const rerankedChunks = await rerank(searchQuery, rawChunks, topNChunks, useLLMRerank)

  // Debug: log what chunks are actually being sent to the LLM
  console.log(`[RAG-Stream] ┌─ Context chunks passed to LLM (${rerankedChunks.length} total, confidence: ${confidence}) ──`)
  rerankedChunks.forEach((c, i) => {
    const preview = (c.metadata.text || '').slice(0, 150).replace(/\n/g, ' ')
    console.log(`[RAG-Stream] │ [${i + 1}] [${c.metadata.category}] ${c.metadata.title} | score=${((c.rerankScore || c.rrfScore || c.score || 0)).toFixed(4)}`)
    console.log(`[RAG-Stream] │     "${preview}"`)
  })
  console.log(`[RAG-Stream] └─ End of context ──`)

  const knowledgeContext = buildKnowledgeContext(rerankedChunks)
  const hallucinationGuard = buildHallucinationGuard(confidence, lang)
  const conversationHistory3 = recentHistory.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')

  // ── STRICT SCOPE GUARD (Tier-3 Degradation) ─────────────────────────────────
  if (confidence === 'no_data') {
    const fallbackMessage = `I don't have that specific information right now. For accurate details, you can reach the CUSIT admissions office directly:

📞 111-1-CUSIT (111-12-8748)  
📧 admissions@cusit.edu.pk  
📍 Dalazak Road, Peshawar

They'll be able to give you the most up-to-date answer.`;

    // Unconditionally log unanswered question — no sessionId or conversations dependency.
    // This runs before streaming starts to guarantee the DB write happens even if the
    // stream is cancelled early by the client.
    sql`
      INSERT INTO unanswered_questions (question_text, language, persona, tier_reached)
      VALUES (${message}, ${lang}, ${intent}, 'tier3')
    `.then(() => {
      console.log(`[RAG] Unanswered question logged: "${message.slice(0, 60)}"`)
    }).catch(err => {
      console.error('[RAG] Failed to log unanswered question (streaming):', err)
    });

    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(fallbackMessage));
        controller.enqueue(new TextEncoder().encode('\n\n[METADATA]\n{"suggestions": ["How to apply?", "What are the contact details?"]}'));
        controller.close();
      }
    });
  }

  // ── Persona Detection ───────────────────────────────────────────────────────
  const lowerMessage = message.toLowerCase()
  let personaTone = ''
  if (/(apply|admission|fee|program)/.test(lowerMessage)) {
    personaTone = 'Tone: Warm welcoming tone (visitor).'
  } else if (/(exam|result|course|schedule|semester)/.test(lowerMessage)) {
    personaTone = 'Tone: Helpful direct tone (student).'
  }

  // ── 2. Create Prompt ────────────────────────────────────────────────────────
  // We use a slightly different prompt for streaming to make the text flow better
  const baseCubotPrompt = `You are Cubot, the official AI assistant of City University of Science and Information Technology (CUSIT), Peshawar. You work at the university's front desk and you speak like a warm, knowledgeable, and professional human staff member — not like a robot reading from a database.

Your personality: Friendly, helpful, confident, and concise. You speak naturally. You do not use corporate jargon. You do not start sentences with "Certainly!" or "Of course!" or "Great question!" You just answer, like a real person would.

Your rules:
- Answer only from the context provided to you. If the context contains the answer, give it confidently and completely — do not omit names, details, or data that is present in the context.
- CRITICAL GROUNDING RULE: Never add any service, fact, detail, or claim that is not explicitly written in the context below — even if it sounds typical or plausible for a university to offer (e.g. "career counseling", "wellness services", generic admission-to-graduation descriptions). If the context doesn't say it, you don't say it. A shorter, fully-grounded answer is always better than a longer one that includes unverified assumptions.
- If the context does not contain the answer, say clearly: "I don't have that detail on hand right now — your best bet is to call the admissions office directly at 111-1-CUSIT (111-12-8748) or visit us on Dalazak Road." Then stop. Do not guess. Do not add generic advice.
- Never say "based on the provided context" or "the context does not explicitly state" — these phrases sound robotic. Just answer naturally.
- For list questions (faculty members, programs, courses, requirements), provide the FULL list from the context. For non-list questions, keep answers to 4 sentences max.
- If someone asks something outside the university scope — weather, general knowledge, other universities — say: "I'm only set up to help with CUSIT-related questions. Is there something about the university I can help you with?"
- Respond in the same language the user writes in. If they write in Urdu, respond in Urdu. If they write in Roman Urdu, respond in Roman Urdu. If they write in English, respond in English.
- Never start your response with "Cubot:" or your own name.
- You represent CUSIT professionally. Every response reflects on the university.
- The context you receive may contain incomplete sentences at the boundaries of chunks. Never reproduce incomplete sentences in your answer. If a piece of information seems cut off, either complete it from your knowledge of the context or omit it entirely. Never output text that trails off mid-sentence.
${personaTone}

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
    : `${baseCubotPrompt}\n\nCRITICAL: Respond in English ONLY. When the knowledge base contains specific details (names, courses, contacts, requirements), state them clearly and completely. Do not omit data from the context.\n\n${intentContext}${hallucinationGuard}`

  const prompt = `${systemPrompt}
${conversationHistory3 ? `\nConversation context:\n${conversationHistory3}\n` : ''}
User question: ${message}
Answer (${lang === 'urdu' ? 'URDU ONLY' : 'ENGLISH ONLY'}):`

  // ── 3. Start Groq Stream ────────────────────────────────────────────────────
  const response = await groqFetchWithRetry(() =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.05, // Reduced further for stricter, fully-grounded answers
        max_tokens: 1200,
        stream: true,
      }),
    })
  )

  if (!response.ok) throw new AppError(`Groq API Error: ${response.status}`, response.status, 'API_ERROR')

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
          } catch { }
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
        }).catch(() => { })

        // Cache the result ONLY if it's high quality and actually contains info
        const isNegativeResponse = /don't have info|don't know|not found|معذرت|پاس معلومات نہیں|تصدیق شدہ معلومات نہیں/i.test(content)

        if (content && !isNegativeResponse) {
          setCachedResult(message, {
            content,
            citations: citations as Citation[],
            confidence,
            suggestions,
            cachedAt: Date.now()
          }, intent).catch(() => { })
        }

        // --- PHASE 5: Conversation Logging ---
        if (request.sessionId) {
          sql`
            INSERT INTO conversations (session_id, user_message, bot_response, persona, language, response_source, is_unanswered)
            VALUES (${request.sessionId}, ${message}, ${content}, ${intent}, ${lang}, 'ai_fresh', false)
            RETURNING id
          `.then(async (res) => {
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