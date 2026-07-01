/**
 * Groq Request Queue with Auto-Retry
 * 
 * Two protections:
 * 1. MAX_CONCURRENT = 6 — only 6 Groq calls at once (was 8, reduced to stay under limit)
 * 2. Auto-retry on 429 — waits and retries up to 3 times before giving up
 * 
 * This means users wait a few extra seconds instead of seeing an error.
 */

const MAX_CONCURRENT = 6
const MAX_WAIT_MS = 30000
const MAX_QUEUE_SIZE = 50

let activeRequests = 0
const waitingQueue: Array<{
  resolve: () => void
  reject: (err: Error) => void
  enqueuedAt: number
}> = []

function processQueue() {
  while (activeRequests < MAX_CONCURRENT && waitingQueue.length > 0) {
    const next = waitingQueue.shift()
    if (!next) break

    const waitedMs = Date.now() - next.enqueuedAt
    if (waitedMs > MAX_WAIT_MS) {
      next.reject(new Error('QUEUE_TIMEOUT'))
      processQueue()
      continue
    }

    activeRequests++
    next.resolve()
  }
}

export async function acquireGroqSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++
    return
  }

  if (waitingQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error('QUEUE_FULL')
  }

  return new Promise<void>((resolve, reject) => {
    waitingQueue.push({ resolve, reject, enqueuedAt: Date.now() })
  })
}

export function releaseGroqSlot(): void {
  activeRequests = Math.max(0, activeRequests - 1)
  processQueue()
}

export function getQueueStats() {
  return {
    active: activeRequests,
    waiting: waitingQueue.length,
    maxConcurrent: MAX_CONCURRENT,
  }
}

export async function withGroqQueue<T>(fn: () => Promise<T>): Promise<T> {
  await acquireGroqSlot()
  try {
    return await fn()
  } finally {
    releaseGroqSlot()
  }
}

/**
 * groqFetchWithRetry — wraps a Groq fetch call with:
 * 1. Queue slot management
 * 2. Automatic retry on 429 (up to 3 attempts)
 * 3. Exponential backoff: waits 2s, then 4s, then 8s between retries
 * 
 * Usage: replace withGroqQueue(() => fetch(...)) with groqFetchWithRetry(() => fetch(...))
 */
export async function groqFetchWithRetry(
  fn: () => Promise<Response>,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Wait before retrying (not before first attempt)
    if (attempt > 0) {
      const waitMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
      console.log(`[GroqQueue] 429 retry ${attempt}/${maxRetries - 1} — waiting ${waitMs}ms`)
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }

    await acquireGroqSlot()
    try {
      const response = await fn()

      // If 429, release slot and retry
      if (response.status === 429) {
        releaseGroqSlot()
        lastError = new Error('GROQ_429')
        
        // Read retry-after header if present
        const retryAfter = response.headers.get('retry-after')
        if (retryAfter && attempt === 0) {
          const waitMs = parseInt(retryAfter) * 1000 || 2000
          console.log(`[GroqQueue] Groq says retry after ${retryAfter}s`)
          await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 8000)))
        }
        continue
      }

      // Success — return the response (slot released in finally)
      return response
    } catch (err) {
      lastError = err as Error
      releaseGroqSlot()
      // Only retry on network errors, not logic errors
      if (attempt < maxRetries - 1) continue
      throw err
    } finally {
      // Only release if we didn't already release above (non-429 path)
      if (activeRequests > 0) {
        releaseGroqSlot()
      }
    }
  }

  // All retries exhausted
  throw new Error(`Groq API Error: 429`)
}
