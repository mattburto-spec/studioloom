/**
 * In-memory sliding window rate limiter.
 *
 * Tracks request timestamps per key. On Vercel, state resets per cold start
 * but still protects against burst abuse within an instance.
 */

export interface RateLimitWindow {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remaining: number;
}

// Global store — survives across requests within the same serverless instance
const store = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const maxAge = 31 * 24 * 60 * 60 * 1000; // 31 days (accommodates monthly rate limits)
  for (const [key, timestamps] of store.entries()) {
    const filtered = timestamps.filter((t) => now - t < maxAge);
    if (filtered.length === 0) {
      store.delete(key);
    } else {
      store.set(key, filtered);
    }
  }
}

/**
 * Check rate limit for a given key against one or more windows.
 *
 * @param key - Unique identifier (e.g. user ID)
 * @param windows - Array of rate limit windows to check (all must pass)
 * @returns Whether the request is allowed
 */
export function rateLimit(
  key: string,
  windows: RateLimitWindow[]
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const timestamps = store.get(key) || [];

  // Check each window
  for (const window of windows) {
    const windowStart = now - window.windowMs;
    const requestsInWindow = timestamps.filter((t) => t >= windowStart).length;

    if (requestsInWindow >= window.maxRequests) {
      // Find when the oldest request in this window expires
      const oldestInWindow = timestamps
        .filter((t) => t >= windowStart)
        .sort((a, b) => a - b)[0];
      const retryAfterMs = oldestInWindow
        ? oldestInWindow + window.windowMs - now
        : window.windowMs;

      return {
        allowed: false,
        retryAfterMs,
        remaining: 0,
      };
    }
  }

  // All windows pass — record this request
  timestamps.push(now);
  store.set(key, timestamps);

  // Calculate remaining for the tightest window
  const tightest = windows.reduce((min, w) => {
    const count = timestamps.filter((t) => t >= now - w.windowMs).length;
    const remaining = w.maxRequests - count;
    return remaining < min ? remaining : min;
  }, Infinity);

  return {
    allowed: true,
    remaining: tightest,
  };
}

// Pre-configured limits for the design assistant
export const DESIGN_ASSISTANT_LIMITS: RateLimitWindow[] = [
  { maxRequests: 30, windowMs: 60 * 1000 },        // 30/min
  { maxRequests: 200, windowMs: 60 * 60 * 1000 },   // 200/hour
];
