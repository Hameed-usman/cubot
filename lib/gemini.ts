import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Gemini AI client - lazily initialized when first used.
 * This ensures env vars are loaded before we check them.
 */

let clientInstance: GoogleGenerativeAI | null = null
let modelInstance: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
let embeddingInstance: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null

const getClient = (): GoogleGenerativeAI | null => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not configured - Gemini will not be available')
    return null
  }

  if (!clientInstance) {
    clientInstance = new GoogleGenerativeAI(apiKey)
  }
  return clientInstance
}

export const geminiModel = {
  get: () => {
    if (!modelInstance) {
      const client = getClient()
      if (client) {
        modelInstance = client.getGenerativeModel({ model: 'gemini-1.5-flash' })
      }
    }
    return modelInstance
  }
}

export const embeddingModel = {
  get: () => {
    if (!embeddingInstance) {
      const client = getClient()
      if (client) {
        embeddingInstance = client.getGenerativeModel({ model: 'embedding-001' })
      }
    }
    return embeddingInstance
  }
}

export const isGeminiConfigured = () => {
  return !!process.env.GEMINI_API_KEY
}

/**
 * Generate content with streaming support
 */
export async function* generateContentStream(prompt: string) {
  const model = geminiModel.get()
  if (!model) {
    throw new Error('Gemini is not configured. Set GEMINI_API_KEY.')
  }
  const result = await model.generateContentStream(prompt)
  for await (const chunk of result.stream) {
    yield chunk.text()
  }
}

/**
 * Generate content without streaming (fallback)
 */
export async function generateContent(prompt: string): Promise<string> {
  const model = geminiModel.get()
  if (!model) {
    throw new Error('Gemini is not configured. Set GEMINI_API_KEY.')
  }
  const result = await model.generateContent(prompt)
  return result.response.text()
}