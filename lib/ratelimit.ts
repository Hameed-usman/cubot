import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Upstash Redis client for rate limiting.
 * Initialized at module scope for performance in serverless environments.
 */

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.warn(
    'WARNING: Upstash Redis credentials not configured. Rate limiting will fail.'
  )
}

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL || '',
  token: UPSTASH_REDIS_REST_TOKEN || '',
})

/**
 * Rate limiter configuration:
 * - 10 requests per minute per IP address
 * - Uses sliding window algorithm for accurate rate limiting
 */
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'cubot:ratelimit',
})

/**
 * Check if a request should be rate-limited.
 * @param identifier - The identifier to check (typically user's IP address)
 * @returns Promise<{ success: boolean; reset: number }> - Rate limit status
 */
export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; reset: number }> {
  try {
    const result = await rateLimiter.limit(identifier)
    return {
      success: result.success,
      reset: result.reset,
    }
  } catch (error) {
    // If rate limiting fails, allow the request (fail open)
    console.error('Rate limit check failed:', error)
    return { success: true, reset: 0 }
  }
}