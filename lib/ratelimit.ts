import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const isUpstashConfigured = !!(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);

let rateLimiter: Ratelimit | null = null;

if (isUpstashConfigured) {
  const redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  })

  rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'cubot:ratelimit',
  })
} else {
  console.warn('WARNING: Upstash Redis credentials not configured. Using in-memory fallback rate limiter. Note: This resets on server restart and is not suitable for multi-instance deployments.')
}

// In-memory fallback
const fallbackMap = new Map<string, { count: number, resetAt: number }>();

export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; reset: number }> {
  if (process.env.NODE_ENV === 'development') {
    return { success: true, reset: Date.now() + 60000 }
  }
  try {
    if (rateLimiter) {
      const result = await rateLimiter.limit(identifier)
      return {
        success: result.success,
        reset: result.reset,
      }
    }

    // Fallback implementation
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    let record = fallbackMap.get(identifier);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
    }

    record.count += 1;
    fallbackMap.set(identifier, record);

    if (record.count > 10) {
      return { success: false, reset: record.resetAt };
    }

    return { success: true, reset: record.resetAt };

  } catch (error) {
    console.error('Rate limit check failed:', error)
    return { success: true, reset: 0 }
  }
}