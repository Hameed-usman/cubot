/**
 * Groq Request Queue
 * 
 * Limits concurrent Groq API calls to MAX_CONCURRENT (8).
 * Extra requests wait in queue instead of all firing at once.
 * This prevents 429 errors when 25-35 students use the app together.
 * 
 * How it works:
 * - First 8 requests go through immediately
 * - Request 9,10,11... wait until a slot frees up
 * - Max wait time: 25 seconds (then returns friendly error)
 * - User sees "Cubot is thinking..." while waiting
 */

const MAX_CONCURRENT = 8      // Max simultaneous Groq calls
const MAX_WAIT_MS = 25000     // 25 seconds max queue wait
const MAX_QUEUE_SIZE = 40     // Max students waiting in queue

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

/**
 * Wraps any async function with queue protection.
 * Usage: const result = await withGroqQueue(() => callGroqAPI(...))
 */
export async function withGroqQueue<T>(fn: () => Promise<T>): Promise<T> {
  await acquireGroqSlot()
  try {
    return await fn()
  } finally {
    releaseGroqSlot()
  }
}
