// Distributed rate limiting via Upstash Redis.
// Falls back gracefully (allows all requests) when env vars are not set.

const inMemoryFallback = new Map<string, { count: number; resetAt: number }>();

// Module-level singleton to avoid reconnecting on every request
let cachedLimiterFactory: ((id: string, max: number, windowSec: number) => Promise<{ success: boolean; reset?: number }>) | null = null;

async function getLimiterFactory() {
  if (cachedLimiterFactory) return cachedLimiterFactory;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });

    cachedLimiterFactory = async (id: string, max: number, windowSec: number) => {
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      });
      const { success, reset } = await limiter.limit(id);
      return { success, reset };
    };
    return cachedLimiterFactory;
  } catch (err) {
    console.error('[ratelimit] Upstash init error — failing open:', err);
    return null;
  }
}

function checkInMemory(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): { success: boolean; retryAfter?: number } {
  // In-memory fallback (per-instance, not distributed — better than no
  // limit at all when Redis is unavailable or errors mid-request).
  const now = Date.now();
  const key = `${identifier}:${maxRequests}:${windowMs}`;
  const entry = inMemoryFallback.get(key);
  if (!entry || now > entry.resetAt) {
    inMemoryFallback.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }
  if (entry.count >= maxRequests) {
    return { success: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { success: true };
}

export async function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ success: boolean; retryAfter?: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ratelimit] Upstash not configured — falling back to in-memory rate limiting');
    }
    return checkInMemory(identifier, maxRequests, windowMs);
  }

  try {
    const factory = await getLimiterFactory();
    if (!factory) return checkInMemory(identifier, maxRequests, windowMs);
    const windowSec = Math.ceil(windowMs / 1000);
    const { success, reset } = await factory(identifier, maxRequests, windowSec);
    return {
      success,
      retryAfter: success ? undefined : Math.ceil(((reset ?? Date.now()) - Date.now()) / 1000),
    };
  } catch (err) {
    // A Redis outage must not turn into "no rate limiting at all" —
    // degrade to the per-instance in-memory limiter instead of open.
    console.error('[ratelimit] Upstash error — degrading to in-memory limiter:', err);
    return checkInMemory(identifier, maxRequests, windowMs);
  }
}
