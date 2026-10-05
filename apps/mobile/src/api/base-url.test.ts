import { describe, expect, it } from 'vitest';

import { buildApiUrl, resolveApiBaseUrl } from './base-url';

describe('resolveApiBaseUrl', () => {
  it('prefers the env override, without a trailing slash', () => {
    expect(resolveApiBaseUrl('https://api.example.com/', '192.168.1.5:8081')).toBe(
      'https://api.example.com',
    );
  });

  it('uses the Expo dev host on the API port', () => {
    expect(resolveApiBaseUrl(undefined, '192.168.18.24:8081')).toBe('http://192.168.18.24:8787');
  });

  it('falls back to localhost', () => {
    expect(resolveApiBaseUrl(undefined, undefined)).toBe('http://localhost:8787');
  });
});

describe('buildApiUrl', () => {
  it('encodes parameters and skips undefined ones', () => {
    expect(
      buildApiUrl('http://h:8787', '/v1/places', { q: 'estética canina', lat: undefined, page: 2 }),
    ).toBe('http://h:8787/v1/places?q=est%C3%A9tica%20canina&page=2');
  });
});
