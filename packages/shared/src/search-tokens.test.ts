import { describe, expect, it } from 'vitest';

import { expandAlias, plainText, searchTokens } from './search-tokens';

describe('searchTokens', () => {
  it('lower-cases, drops accents and splits on anything but letters and digits', () => {
    expect(searchTokens('Estética  Canina,Coyoacán!')).toEqual(['estetica', 'canina', 'coyoacan']);
  });

  it('leaves out the stop words in, at, near, por, en, para', () => {
    expect(searchTokens('vet en Coyoacán')).toEqual(['vet', 'coyoacan']);
    expect(searchTokens('groomer near me at Roma para perros por favor in CDMX')).toEqual([
      'groomer',
      'me',
      'roma',
      'perros',
      'favor',
      'cdmx',
    ]);
  });

  it('keeps ñ', () => {
    expect(plainText('Peñasco')).toBe('peñasco');
    expect(searchTokens('Puerto Peñasco')).toEqual(['puerto', 'peñasco']);
  });

  it('gives nothing for empty or stop-word-only text', () => {
    expect(searchTokens('  ')).toEqual([]);
    expect(searchTokens('en para')).toEqual([]);
  });
});

describe('expandAlias', () => {
  it('reads CDMX and DF as Ciudad de México', () => {
    expect(expandAlias('cdmx')).toEqual(['ciudad', 'de', 'mexico']);
    expect(expandAlias('df')).toEqual(['ciudad', 'de', 'mexico']);
    expect(expandAlias('roma')).toEqual(['roma']);
  });
});
