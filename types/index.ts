// ─── Chat & Messaging ─────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  isStreaming?: boolean
  error?: boolean
  intent?: string
  suggestions?: string[]
  citations?: Citation[]
  confidence?: ConfidenceLevel
}

export interface ChatRequest {
  message: string
  conversationHistory: Pick<Message, 'role' | 'content'>[]
  department?: Department
  sessionId?: string
}

export interface ChatResponse {
  content: string
  sources?: PineconeMatch[]
  citations?: Citation[]
  confidence?: ConfidenceLevel
}

export interface Citation {
  title: string
  url: string
  pageType: PageType
  category: string
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'no_data'

// ─── RAG Pipeline ─────────────────────────────────────────────────

export interface PineconeMatch {
  id: string
  score: number
  metadata: ChunkMetadata
}

/**
 * Rich metadata attached to every chunk stored in Pinecone and PostgreSQL.
 * This metadata powers classification, filtering, citations, and observability.
 */
export interface ChunkMetadata {
  text: string
  title: string
  sourceUrl: string
  department: string
  category: string
  pageType: PageType
  breadcrumb: string
  sourceType: SourceType
  contentHash: string
  crawledAt: string
  lastModified?: string
  chunkIndex: number
  totalChunks: number
}

/**
 * Classification of page content type.
 * Used for targeted retrieval and citation display.
 */
export type PageType =
  | 'notice'
  | 'faculty'
  | 'department'
  | 'policy'
  | 'admissions'
  | 'alumni'
  | 'event'
  | 'contact'
  | 'academic'
  | 'scholarship'
  | 'general'

/**
 * Origin type of a knowledge chunk.
 */
export type SourceType = 'webpage' | 'pdf' | 'docx' | 'xlsx' | 'manual'

export interface RAGContext {
  query: string
  retrievedChunks: RankedChunk[]
  augmentedPrompt: string
  citations: Citation[]
  confidence: ConfidenceLevel
}

export interface RankedChunk {
  id: string
  score: number           // vector similarity score
  bm25Score?: number      // keyword search score
  rrfScore?: number       // reciprocal rank fusion score
  rerankScore?: number    // final rerank score
  metadata: ChunkMetadata
}

// ─── Ingestion ────────────────────────────────────────────────────

export interface IngestRequest {
  department?: Department
}

export interface IngestResult {
  success: boolean
  chunksProcessed: number
  vectorsUpserted: number
  department: Department | 'all'
  durationMs: number
  error?: string
}

export interface TextChunk {
  text: string
  metadata: Omit<ChunkMetadata, 'text'>
}

export interface CrawlStats {
  runId: string
  pagesCrawled: number
  pagesFailed: number
  pagesUpdated: number
  pagesSkipped: number
  documentsProcessed: number
  chunksCreated: number
  embeddingsCreated: number
  durationSeconds: number
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
}

export interface CrawlDashboardData {
  lastRun: CrawlStats | null
  totalEntries: number
  byCategory: Record<string, number>
  bySourceType: Record<string, number>
  byPageType: Record<string, number>
  recentUpdates: Array<{ title: string; sourceUrl: string; updatedAt: string; pageType: PageType }>
  recentFailures: Array<{ url: string; error: string; attemptedAt: string }>
}

// ─── Departments ──────────────────────────────────────────────────

export type Department = 'general' | 'cs_it' | 'bba' | 'pharmacy' | 'nursing'

export const DEPARTMENTS: Department[] = [
  'general', 'cs_it', 'bba', 'pharmacy', 'nursing',
]

export const DEPARTMENT_LABELS: Record<Department, string> = {
  general:  'General Information',
  cs_it:    'CS & IT Department',
  bba:      'BBA Department',
  pharmacy: 'Pharmacy Department',
  nursing:  'Nursing Department',
}

// ─── Classification ───────────────────────────────────────────────

export interface Classification {
  pageType: PageType
  category: string
  department: string
}

// ─── UI State ─────────────────────────────────────────────────────

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  error: string | null
}

// ─── Database Models ──────────────────────────────────────────────

export interface DbConversation {
  id: string
  session_id: string
  user_message: string
  bot_response: string
  persona?: string
  language?: string
  response_source?: 'cache' | 'ai_fresh' | 'tier2' | 'tier3'
  is_unanswered: boolean
  feedback?: string
  created_at: Date
}

export interface DbUnansweredQuestion {
  id: string
  conversation_id?: string
  question_text: string
  language?: string
  persona?: string
  tier_reached?: string
  resolved: boolean
  resolved_entry_id?: string
  resolved_at?: Date
  created_at: Date
}

export interface DbAdminConfig {
  id: string
  key: string
  value: string
  updated_at: Date
}

export interface DbRateLimit {
  id: string
  session_id: string
  request_count: number
  window_start: Date
  updated_at: Date
}

export interface DbFeedbackLog {
  id: string
  conversation_id?: string
  session_id: string
  feedback: string
  created_at: Date
}