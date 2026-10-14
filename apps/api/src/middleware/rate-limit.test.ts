import { describe, expect, it, vi } from 'vitest';

import { testEnv } from '../../test/env';
import app from '../index';

/** A stand-in for Cloudflare's rate limiter: allows `allowed` calls, then refuses. */
function fakeLimiter(allowed: number) {
  let calls = 0;
  const keys: string[] = [];
  const limiter = {
    limit: vi.fn(async ({ key }: { key: string }) => {
      keys.push(key);
      calls += 1;
      return { success: calls <= allowed };
    }),
  };
  return { limiter, keys };
}

const report = (env: object, ip = '203.0.113.7') =>
  app.request(
    '/v1/places/999999999/reports',
    {
      method: 'POST',
      body: JSON.stringify({ reason: 'closed', clientId: 'phone-0000000000000001' }),
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    },
    { ...testEnv, ...env },
  );

describe('write rate limit', () => {
  it('answers 429 RATE_LIMITED once the limiter refuses, keyed by a hash of the IP', async () => {
    const { limiter, keys } = fakeLimiter(1);
    expect((await report({ WRITE_LIMITER: limiter })).status).toBe(404); // allowed: unknown place
    const refused = await report({ WRITE_LIMITER: limiter });
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toBe('60');
    expect(await refused.json()).toEqual({ error: { code: 'RATE_LIMITED' } });
    expect(keys[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(keys[0]).not.toContain('203.0.113.7');
  });

  it("doesn't limit reads, runs without the binding, or with WRITE_RATE_LIMIT off", async () => {
    const { limiter } = fakeLimiter(0);
    const read = await app.request('/v1/categories', {}, { ...testEnv, WRITE_LIMITER: limiter });
    expect(read.status).toBe(200);
    expect(limiter.limit).not.toHaveBeenCalled();
    expect((await report({})).status).toBe(404);
    expect((await report({ WRITE_LIMITER: limiter, WRITE_RATE_LIMIT: 'off' })).status).toBe(404);
    expect(limiter.limit).not.toHaveBeenCalled();
  });
});

describe('CORS', () => {
  const env = { ...testEnv, CORS_ORIGINS: 'http://localhost:8081' };
  const fromOrigin = (origin: string) =>
    app.request('/health', { headers: { Origin: origin } }, env);

  it('allows only the listed browser origins', async () => {
    const allowed = await fromOrigin('http://localhost:8081');
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081');
    const other = await fromOrigin('https://evil.example');
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('serves the phone app, which sends no Origin', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
  });
});
