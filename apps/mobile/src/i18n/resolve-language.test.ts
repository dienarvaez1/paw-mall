import { describe, expect, it } from 'vitest';

import { resolveLanguage } from './resolve-language';

describe('resolveLanguage', () => {
  it('prefers the saved language', () => {
    expect(resolveLanguage('en', ['es'])).toBe('en');
  });

  it('ignores an unsupported saved language', () => {
    expect(resolveLanguage('fr', ['en'])).toBe('en');
  });

  it('uses the first supported device language', () => {
    expect(resolveLanguage(null, ['fr', null, 'en', 'es'])).toBe('en');
  });

  it('falls back to Spanish', () => {
    expect(resolveLanguage(undefined, ['de', 'fr'])).toBe('es');
    expect(resolveLanguage(null, [])).toBe('es');
  });
});
