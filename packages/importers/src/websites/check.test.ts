import { describe, expect, it } from 'vitest';

import { checkWebsite, classifyError, classifyStatus, nextState } from './check.ts';

describe('classifyStatus', () => {
  it('sorts HTTP responses', () => {
    expect(classifyStatus(200)).toBe('ok');
    expect(classifyStatus(301)).toBe('ok');
    expect(classifyStatus(403)).toBe('blocked');
    expect(classifyStatus(404)).toBe('dead');
    expect(classifyStatus(503)).toBe('unreachable');
  });
});

describe('classifyError', () => {
  it('treats a missing domain as dead and other failures as unreachable', () => {
    expect(classifyError({ cause: { code: 'ENOTFOUND' } })).toBe('dead');
    expect(classifyError({ cause: { code: 'ECONNREFUSED' } })).toBe('unreachable');
    expect(classifyError(new DOMException('timed out', 'TimeoutError'))).toBe('unreachable');
  });
});

describe('checkWebsite', () => {
  it('uses the response status', async () => {
    const ok = (async () => new Response('hi', { status: 200 })) as typeof fetch;
    const gone = (async () => new Response('', { status: 404 })) as typeof fetch;
    expect(await checkWebsite('https://x.mx', ok)).toBe('ok');
    expect(await checkWebsite('https://x.mx', gone)).toBe('dead');
  });
});

describe('nextState', () => {
  it('hides dead sites at once and unreachable ones after two failures in a row', () => {
    expect(nextState('dead', 0)).toEqual({ status: 'dead', failures: 1 });
    expect(nextState('unreachable', 0)).toEqual({ status: 'unreachable', failures: 1 });
    expect(nextState('unreachable', 1)).toEqual({ status: 'dead', failures: 2 });
  });

  it('shows a site again as soon as it works', () => {
    expect(nextState('ok', 3)).toEqual({ status: 'ok', failures: 0 });
    expect(nextState('blocked', 3)).toEqual({ status: 'blocked', failures: 0 });
  });
});
