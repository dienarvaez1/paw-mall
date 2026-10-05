import { describe, expect, it } from 'vitest';

import { findMissingKeys } from './missing-keys';
import { resources } from './resources';

describe('findMissingKeys', () => {
  it('reports nested keys missing from the target', () => {
    expect(
      findMissingKeys({ common: { a: 'x', b: { c: 'y' } } }, { common: { a: 'x', b: {} } }),
    ).toEqual(['common.b.c']);
  });

  it('finds no Spanish key missing in English', () => {
    expect(findMissingKeys(resources.es, resources.en)).toEqual([]);
  });
});
