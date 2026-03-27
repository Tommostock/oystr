/**
 * gemini-rate-limit.ts — In-memory rate limiter for Gemini API
 *
 * Tracks request timestamps to stay safely within the free tier:
 *   - Max 12 requests per minute (free limit is 15)
 *   - Max 800 requests per day (free limit is 1,000)
 *
 * This runs server-side in the API route. Since Vercel serverless
 * functions can cold-start, this is "best effort" — it prevents
 * bursts but won't be perfectly accurate across multiple instances.
 * For a personal app like Oystr, this is more than sufficient.
 */

/* ========================================
 * REQUEST TIMESTAMP STORAGE
 * Stored in-memory — resets on cold start.
 * ======================================== */

/** Timestamps of recent requests (within the last 60 seconds) */
const minuteRequests: number[] = [];

/** Timestamps of recent requests (within the last 24 hours) */
const dayRequests: number[] = [];

/* ========================================
 * LIMITS
 * Set conservatively below the actual free tier limits
 * to give ourselves a safety margin.
 * ======================================== */
const MAX_PER_MINUTE = 12;
const MAX_PER_DAY = 800;

/**
 * Check whether a new request is allowed.
 *
 * @returns Object with `allowed` boolean and optional `retryAfterSeconds`
 */
export function checkRateLimit(): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();

  /* Clean up old timestamps */
  purgeOld(minuteRequests, 60_000);
  purgeOld(dayRequests, 24 * 60 * 60_000);

  /* Check per-minute limit */
  if (minuteRequests.length >= MAX_PER_MINUTE) {
    const oldestInWindow = minuteRequests[0];
    const retryAfterSeconds = Math.ceil((oldestInWindow + 60_000 - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  /* Check per-day limit */
  if (dayRequests.length >= MAX_PER_DAY) {
    const oldestInWindow = dayRequests[0];
    const retryAfterSeconds = Math.ceil(
      (oldestInWindow + 24 * 60 * 60_000 - now) / 1000
    );
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  return { allowed: true };
}

/**
 * Record that a request was made.
 * Call this after a successful Gemini call.
 */
export function recordRequest(): void {
  const now = Date.now();
  minuteRequests.push(now);
  dayRequests.push(now);
}

/**
 * Remove timestamps older than `maxAge` milliseconds.
 */
function purgeOld(timestamps: number[], maxAge: number): void {
  const cutoff = Date.now() - maxAge;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
}
