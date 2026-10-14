import { describe, expect, it } from 'vitest';

import { parseFavorites, toggleFavorite } from './favorites';

describe('parseFavorites', () => {
  it('reads nothing from an empty or broken value', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('not json')).toEqual([]);
    expect(parseFavorites('{"id":1}')).toEqual([]);
  });

  it('keeps valid entries, newest first, one per place', () => {
    const raw = JSON.stringify([
      { id: 1, savedAt: 100 },
      { id: 2, savedAt: 300 },
      { id: 'x', savedAt: 200 },
      { id: 1, savedAt: 50 },
    ]);
    expect(parseFavorites(raw)).toEqual([
      { id: 2, savedAt: 300 },
      { id: 1, savedAt: 100 },
    ]);
  });
});

describe('toggleFavorite', () => {
  it('adds a new place on top', () => {
    expect(toggleFavorite([{ id: 1, savedAt: 100 }], 2, 200)).toEqual([
      { id: 2, savedAt: 200 },
      { id: 1, savedAt: 100 },
    ]);
  });

  it('removes a saved place', () => {
    expect(toggleFavorite([{ id: 1, savedAt: 100 }], 1, 200)).toEqual([]);
  });
});
