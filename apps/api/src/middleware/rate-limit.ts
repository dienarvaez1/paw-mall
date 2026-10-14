import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../env';
import { errorResponse } from '../lib/http';
import { userKey } from '../queries/google';

/**
 * Caps writes (reports, claims, answers, Google lookups) per user and minute with Cloudflare's
 * rate limiter (WRITE_LIMITER in wrangler.toml), so rotating the app's random id doesn't allow
 * floods. The key is the IP hashed with the day (as for Google); the limiter only counts it in
 * memory, and the API never stores it (CLAUDE.md, "Reporter privacy"). Without the binding (tests)
 * or with WRITE_RATE_LIMIT "off" (end-to-end runs) nothing is limited.
 */
export const writeRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const limiter = c.env.WRITE_LIMITER;
  if (c.req.method !== 'POST' || !limiter || c.env.WRITE_RATE_LIMIT === 'off') return next();
  const key = await userKey(c.req.header('CF-Connecting-IP') ?? 'unknown');
  const { success } = await limiter.limit({ key });
  if (!success) {
    c.header('Retry-After', '60');
    return errorResponse(c, 429, 'RATE_LIMITED');
  }
  return next();
});
