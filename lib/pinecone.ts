import { Pinecone } from '@pinecone-database/pinecone'

/**
 * Pinecone client - lazily initialized when first used.
 */

let pineconeClient: Pinecone | null = null
let indexInstance: ReturnType<Pinecone['Index']> | null = null

const initPinecone = () => {
  const apiKey = process.env.PINECONE_API_KEY
  const indexName = process.env.PINECONE_INDEX_NAME
  const dimension = process.env.PINECONE_DIMENSION

  if (!apiKey || !indexName) {
    console.warn('Pinecone credentials not configured - vector search will not work')
    return null
  }

  if (dimension !== '768') {
    console.warn(
      `WARNING: PINECONE_DIMENSION is "${dimension}" but Google gemini-embedding-001 outputs 768 dimensions. ` +
      `This mismatch will cause all vector operations to fail.`
    )
  }

  try {
    const client = new Pinecone({ apiKey })
    pineconeClient = client
    indexInstance = client.Index(indexName)
    return indexInstance
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error)
    return null
  }
}

export const pineconeIndex = {
  get: () => {
    if (!indexInstance) {
      initPinecone()
    }
    return indexInstance
  }
}

export const isPineconeConfigured = () => {
  return !!(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX_NAME)
}