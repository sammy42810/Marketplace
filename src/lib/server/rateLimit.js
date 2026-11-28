// Imported by chat.js, which server.js loads unbundled: relative imports only, no "@/".
import {HttpError} from './auth.js';

// Per-user sliding windows, kept in memory. On globalThis so the bundled route handlers and the
// unbundled socket handlers share one count. This only works while the app runs as one process.
const limiters = (globalThis.marketplaceRateLimits ??= new Map());

// Throws a 429 once `userId` has done `name` `limit` times in the last `windowMs`.
// Call it before the expensive work, so rejected requests stay cheap.
export function rateLimit(name, userId, {limit, windowMs, message}) {
  const now = Date.now();
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = {hits: new Map(), sweptAt: now};
    limiters.set(name, limiter);
  }

  // Forget users who have been quiet for a whole window, so the map doesn't grow forever.
  if (now - limiter.sweptAt >= windowMs) {
    for (const [key, times] of limiter.hits) {
      if (now - times[times.length - 1] >= windowMs) limiter.hits.delete(key);
    }
    limiter.sweptAt = now;
  }

  const key = userId.toString();
  const recent = (limiter.hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) throw new HttpError(429, message);
  recent.push(now);
  limiter.hits.set(key, recent);
}
