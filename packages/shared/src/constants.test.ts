import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale } from './constants';

describe('locales', () => {
  it('defaults to Spanish, listed first', () => {
    expect(DEFAULT_LOCALE).toBe('es');
    expect(SUPPORTED_LOCALES[0]).toBe('es');
  });

  it('recognizes only supported locales', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
  });
});
