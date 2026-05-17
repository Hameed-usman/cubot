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
}

export interface ChatRequest {
  message: string
  conversationHistory: Pick<Message, 'role' | 'content'>[]
  department?: Department
}

export interface ChatResponse {
  content: string
  sources?: PineconeMatch[]
}

// ─── RAG Pipeline ─────────────────────────────────────────────────

export interface PineconeMatch {
  id: string
  score: number
  metadata: ChunkMetadata
}

export interface ChunkMetadata {
  text: string
  department: Department
  fileName: string
  chunkIndex: number
}

export interface RAGContext {
  query: string
  retrievedChunks: PineconeMatch[]
  augmentedPrompt: string
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
  metadata: ChunkMetadata
}

// ─── Departments ──────────────────────────────────────────────────

export type Department = 'general' | 'cs_it' | 'bba' | 'pharmacy' | 'nursing'

export const DEPARTMENTS: Department[] = [
  'general', 'cs_it', 'bba', 'pharmacy', 'nursing'
]

export const DEPARTMENT_LABELS: Record<Department, string> = {
  general:  'General Information',
  cs_it:    'CS & IT Department',
  bba:      'BBA Department',
  pharmacy: 'Pharmacy Department',
  nursing:  'Nursing Department',
}

// ─── UI State ─────────────────────────────────────────────────────

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  error: string | null
}