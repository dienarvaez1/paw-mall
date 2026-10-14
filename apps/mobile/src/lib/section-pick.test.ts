import { describe, expect, it } from 'vitest';

import { otherSection, otherSectionFindsMore } from './section-pick';

const reach = (total: number, nearestBeyondKm: number | null = null) => ({
  total,
  nearestBeyondKm,
});

describe('otherSectionFindsMore', () => {
  it('moves to the tab that finds more places inside the circle', () => {
    expect(otherSectionFindsMore(reach(0, 7), reach(3))).toBe(true);
    expect(otherSectionFindsMore(reach(2), reach(5))).toBe(true);
    expect(otherSectionFindsMore(reach(5), reach(2))).toBe(false);
  });

  it('with none inside either, moves to the one whose nearest match is closer', () => {
    expect(otherSectionFindsMore(reach(0, 9), reach(0, 6))).toBe(true);
    expect(otherSectionFindsMore(reach(0, null), reach(0, 40))).toBe(true);
    expect(otherSectionFindsMore(reach(0, 6), reach(0, 9))).toBe(false);
    expect(otherSectionFindsMore(reach(0, 6), reach(0, null))).toBe(false);
  });

  it('stays on a tie', () => {
    expect(otherSectionFindsMore(reach(4), reach(4))).toBe(false);
    expect(otherSectionFindsMore(reach(0, null), reach(0, null))).toBe(false);
    expect(otherSectionFindsMore(reach(0, 6), reach(0, 6))).toBe(false);
  });
});

describe('otherSection', () => {
  it('pairs Explorar and Pet-friendly', () => {
    expect(otherSection('pet_business')).toBe('pet_friendly');
    expect(otherSection('pet_friendly')).toBe('pet_business');
  });
});
