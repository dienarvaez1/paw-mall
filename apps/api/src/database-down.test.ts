import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import app from './index';

// Nothing listens on port 1: every query fails at once, as when the database is down.
const env = { DATABASE_URL: 'postgres://paw:paw@127.0.0.1:1/paw_mall_down' };
let consoleError: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  consoleError.mockRestore();
});

describe('with the database down', () => {
  it('/health still answers and says the database is unavailable', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', database: { status: 'unavailable' } });
  });

  it('reads answer 500 INTERNAL_ERROR without leaking the error', async () => {
    for (const path of [
      '/v1/places?lat=19.4326&lng=-99.1332',
      '/v1/places/urgent?lat=19.4326&lng=-99.1332',
      '/v1/places/1',
      '/v1/categories',
    ]) {
      const res = await app.request(path, {}, env);
      expect(res.status, path).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text), path).toEqual({ error: { code: 'INTERNAL_ERROR' } });
      expect(text).not.toMatch(/ECONNREFUSED|postgres|127\.0\.0\.1/);
    }
  });

  it('writes answer 500 INTERNAL_ERROR too, and the error is logged for the operator', async () => {
    const res = await app.request(
      '/v1/places/1/reports',
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'closed', clientId: 'phone-0000000000000001' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: 'INTERNAL_ERROR' } });
    expect(consoleError).toHaveBeenCalled();
  });
});
