import { describe, expect, it } from 'vitest';

import { clusterSize } from './cluster-size';

describe('clusterSize', () => {
  it('gives small counts small bubbles', () => {
    expect(clusterSize('8')).toBe(22);
    expect(clusterSize('42')).toBe(25);
  });

  it('grows with each digit, so 5 and 6 digits fit', () => {
    const sizes = ['190', '1,237', '12,276', '123,456'].map(clusterSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(sizes.length);
    // Every digit (6.2 pt) and separator (3.2 pt) has room, plus 12 pt of padding.
    expect(clusterSize('12,276')).toBeGreaterThanOrEqual(5 * 6.2 + 3.2 + 12);
    expect(clusterSize('123,456')).toBeGreaterThanOrEqual(6 * 6.2 + 3.2 + 12);
  });

  it('counts a period separator (other locales) like a comma', () => {
    expect(clusterSize('12.276')).toBe(clusterSize('12,276'));
  });
});
