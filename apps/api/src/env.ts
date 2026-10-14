import type { Locale } from '@paw-mall/shared';

import type { Database } from './db/client';

export type Bindings = {
  /** Postgres connection string (wrangler.toml [vars] locally). */
  DATABASE_URL: string;
  /** Google Places API key (secret: .dev.vars locally); without it "Ver horario" is unavailable. */
  GOOGLE_PLACES_API_KEY?: string;
  /** Paid Google detail requests allowed per month (default 950, under the 1,000 free). */
  GOOGLE_MONTHLY_LIMIT?: string;
  /** "Ver horario" lookups per user per day (default 5). */
  GOOGLE_DAILY_LOOKUPS?: string;
  /** Cloudflare's rate limiter for writes (wrangler.toml [[ratelimits]]); absent in tests. */
  WRITE_LIMITER?: RateLimit;
  /** "off" turns the write rate limit off (end-to-end runs post many answers in a row). */
  WRITE_RATE_LIMIT?: string;
  /** Browser origins allowed by CORS, comma-separated (Expo web in development). */
  CORS_ORIGINS?: string;
};

export type Variables = {
  db: Database;
  locale: Locale;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
