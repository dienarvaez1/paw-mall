import { errorResponseSchema, healthResponseSchema } from '@paw-mall/shared';
import { describe, expect, it } from 'vitest';

import { testEnv } from '../test/env';
import app from './index';

describe('GET /health', () => {
  it('reports the version and the PostGIS version', async () => {
    const res = await app.request('/health', {}, testEnv);

    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.version).toBe('0.1.0');
    expect(body.database).toEqual({ status: 'ok', postgis: expect.stringMatching(/^3\./) });
  });

  it('still answers when the database is unreachable', async () => {
    const res = await app.request('/health', {}, { DATABASE_URL: 'postgres://x:x@127.0.0.1:1/x' });

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await res.json()).database).toEqual({
      status: 'unavailable',
    });
  });
});

describe('unknown routes', () => {
  it('return a NOT_FOUND error', async () => {
    const res = await app.request('/nope', {}, testEnv);

    expect(res.status).toBe(404);
    expect(errorResponseSchema.parse(await res.json())).toEqual({ error: { code: 'NOT_FOUND' } });
  });
});
