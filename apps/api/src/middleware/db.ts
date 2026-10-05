import { createMiddleware } from 'hono/factory';

import { createDb } from '../db/client';
import type { AppEnv } from '../env';

export const dbMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const { db, close } = createDb(c.env.DATABASE_URL);
  c.set('db', db);
  try {
    await next();
  } finally {
    // On Workers, close after the response is sent; in tests there is no execution context.
    let executionCtx: { waitUntil(promise: Promise<unknown>): void } | undefined;
    try {
      executionCtx = c.executionCtx;
    } catch {
      executionCtx = undefined;
    }
    if (executionCtx) {
      executionCtx.waitUntil(close());
    } else {
      await close();
    }
  }
});
