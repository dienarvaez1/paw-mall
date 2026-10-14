import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout } from './fetch-timeout';

/** A server that never answers: the request only ends when it's aborted. */
const hangingFetch = ((_url: string, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  })) as typeof fetch;

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchWithTimeout', () => {
  it('gives up on a server that never answers', async () => {
    vi.useFakeTimers();
    const request = fetchWithTimeout('http://api.test/v1/places', {}, 15_000, hangingFetch);
    const outcome = expect(request).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(15_000);
    await outcome;
  });

  it('returns the answer of a server that responds in time, keeping the request options', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const response = await fetchWithTimeout(
      'http://api.test/v1/places',
      { method: 'POST' },
      15_000,
      fetchImpl as unknown as typeof fetch,
    );
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/v1/places',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    );
  });
});
