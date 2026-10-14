import { describe, expect, it } from 'vitest';

import { type SearchableItem, filterSearchItems, matchesAllTokens } from './search-filter';

const item = (
  id: string,
  name: string,
  category: string | null,
  neighborhood: string | null,
  state = 'Ciudad de México',
  kind: SearchableItem['kind'] = 'business',
): SearchableItem => ({ id, kind, name, category, neighborhood, state });

const ITEMS = [
  item('1', 'Huellitas', 'Veterinaria', 'Coyoacán'),
  item('2', 'Estética Canina Paw', 'Estética', 'Cuauhtémoc'),
  item('3', 'Veterinaria del Valle', 'Veterinaria', 'Benito Juárez'),
  item('4', 'Veterinaria Jalisco', 'Veterinaria', 'Guadalajara', 'Jalisco'),
  item('5', 'Puerto Vallarta', 'Ciudad', null, 'Jalisco', 'area'),
];
const names = (query: string) => filterSearchItems(ITEMS, query, 10).map((found) => found.name);

describe('matchesAllTokens', () => {
  it('needs every token to start a word of the name, category, neighborhood or state', () => {
    expect(matchesAllTokens(ITEMS[0]!, ['vet', 'coyo'])).toBe(true);
    expect(matchesAllTokens(ITEMS[0]!, ['vet', 'roma'])).toBe(false);
    // Inside a word is no match.
    expect(matchesAllTokens(ITEMS[0]!, ['ellitas'])).toBe(false);
  });
});

describe('filterSearchItems', () => {
  it('finds the same places in any word order', () => {
    expect(names('CDMX veterinaria')).toEqual(names('veterinaria CDMX'));
    expect(names('veterinaria CDMX')).toEqual(['Veterinaria del Valle', 'Huellitas']);
  });

  it('reads CDMX and DF as Ciudad de México', () => {
    expect(names('vet df')).not.toContain('Veterinaria Jalisco');
    expect(names('vet jalisco')).toEqual(['Veterinaria Jalisco']);
  });

  it('ignores case, accents and the stop words in, at, near, por, en, para', () => {
    expect(names('ESTETICA en cuauhtemoc')).toEqual(['Estética Canina Paw']);
    expect(names('vallarta puerto')).toEqual(['Puerto Vallarta']);
  });

  it('puts names that start with the text first, then names holding every word', () => {
    expect(names('vet')).toEqual(['Veterinaria del Valle', 'Veterinaria Jalisco', 'Huellitas']);
  });

  it('keeps each item once and stops at the limit', () => {
    const twice = [...ITEMS, ITEMS[1]!];
    expect(filterSearchItems(twice, 'canina', 10)).toHaveLength(1);
    expect(filterSearchItems(ITEMS, 'vet', 2)).toHaveLength(2);
  });

  it('suggests nothing without words', () => {
    expect(names('')).toEqual([]);
    expect(names(' en ')).toEqual([]);
  });
});
