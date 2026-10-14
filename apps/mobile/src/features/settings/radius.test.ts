import { describe, expect, it } from 'vitest';

import {
  fittingRadiusKm,
  searchFitRadiusKm,
  minRadiusKm,
  closestRadiusKm,
  isRadiusOption,
  nextRadiusKm,
  radiusOptionsKm,
  coveringRadiusKm,
  startRadiusKm,
  toKm,
} from './radius';

describe('search radius by unit', () => {
  it('keeps km choices as they are', () => {
    expect(radiusOptionsKm('km')).toEqual([5, 10, 15, 25, 50, 80, 160]);
  });

  it('converts mile choices to km for the API', () => {
    expect(toKm(10, 'mi')).toBeCloseTo(16.09344, 5);
    expect(radiusOptionsKm('mi').map((km) => Math.round(km * 100) / 100)).toEqual([
      4.83, 8.05, 16.09, 24.14, 40.23, 80.47, 160.93,
    ]);
  });

  it('moves a radius to the closest choice in the other unit', () => {
    expect(closestRadiusKm(15, 'mi')).toBeCloseTo(toKm(10, 'mi'));
    expect(closestRadiusKm(toKm(50, 'mi'), 'km')).toBe(80);
    expect(closestRadiusKm(toKm(3, 'mi'), 'km')).toBe(5);
    expect(closestRadiusKm(160, 'mi')).toBeCloseTo(toKm(100, 'mi'));
    expect(closestRadiusKm(toKm(100, 'mi'), 'km')).toBe(160);
  });

  it('recognizes choices despite float rounding', () => {
    expect(isRadiusOption(toKm(3, 'mi'), 'mi')).toBe(true);
    expect(isRadiusOption(4.8, 'mi')).toBe(false);
    expect(isRadiusOption(25, 'km')).toBe(true);
  });
});

describe('radius labels match the Settings choices', () => {
  it('shows every choice exactly as listed, in its own unit', async () => {
    const { formatDistance } = await import('@/i18n/format');
    const { RADIUS_OPTIONS } = await import('./radius');
    for (const unit of ['km', 'mi'] as const) {
      for (const value of RADIUS_OPTIONS[unit]) {
        expect(formatDistance(toKm(value, unit), 'es', unit)).toBe(`${value} ${unit}`);
      }
    }
  });
});

describe('nextRadiusKm', () => {
  it('cycles through the choices in the unit and wraps around', () => {
    expect(nextRadiusKm(5, 'km')).toBe(10);
    expect(nextRadiusKm(80, 'km')).toBe(160);
    expect(nextRadiusKm(160, 'km')).toBe(5);
    expect(nextRadiusKm(toKm(50, 'mi'), 'mi')).toBeCloseTo(toKm(100, 'mi'));
    expect(nextRadiusKm(toKm(100, 'mi'), 'mi')).toBeCloseTo(toKm(3, 'mi'));
  });

  it('goes to the next choice above a radius set by zooming the map', () => {
    expect(nextRadiusKm(7, 'km')).toBe(10);
    expect(nextRadiusKm(toKm(4, 'mi'), 'mi')).toBeCloseTo(toKm(5, 'mi'));
    expect(nextRadiusKm(200, 'km')).toBe(5);
  });
});

describe('coveringRadiusKm', () => {
  it('covers the cluster in whole kilometers', () => {
    expect(coveringRadiusKm(7)).toBe(7);
    expect(coveringRadiusKm(7.2)).toBe(8);
    expect(coveringRadiusKm(0.2)).toBe(1);
    expect(coveringRadiusKm(400)).toBe(161);
  });
});

describe('startRadiusKm', () => {
  it('starts a first launch at 3 miles, or the closest choice in km', () => {
    expect(startRadiusKm('mi')).toBeCloseTo(4.828, 3);
    expect(startRadiusKm('km')).toBe(5);
  });
});

describe('minRadiusKm', () => {
  it('is the smallest choice in the unit: 5 km, or 3 mi', () => {
    expect(minRadiusKm('km')).toBe(5);
    expect(minRadiusKm('mi')).toBeCloseTo(3 * 1.609344, 6);
  });
});

describe('fittingRadiusKm', () => {
  it('zooms in to the smallest choice that holds the farthest place', () => {
    expect(fittingRadiusKm(7.2, 25, 'km')).toBe(10);
    expect(fittingRadiusKm(0.4, 25, 'km')).toBe(5);
    expect(fittingRadiusKm(10, 50, 'km')).toBe(10);
    expect(fittingRadiusKm(4, 15 * 1.609344, 'mi')).toBeCloseTo(3 * 1.609344);
  });

  it('never zooms out, nor "zooms" to the same radius', () => {
    expect(fittingRadiusKm(30, 25, 'km')).toBeNull();
    expect(fittingRadiusKm(4, 5, 'km')).toBeNull();
    expect(fittingRadiusKm(200, 160, 'km')).toBeNull();
  });
});

describe('searchFitRadiusKm', () => {
  it('zooms in to hold every match inside the radius', () => {
    expect(searchFitRadiusKm({ farthestKm: 7, nearestBeyondKm: null }, 25, 'km')).toBe(10);
  });

  it('with none inside, widens to the smallest choice that reaches the nearest', () => {
    // "Guadalupe" as a business name: nothing within 5 km, the nearest at 8 km -> 10 km.
    expect(searchFitRadiusKm({ farthestKm: null, nearestBeyondKm: 8 }, 5, 'km')).toBe(10);
    expect(
      searchFitRadiusKm({ farthestKm: null, nearestBeyondKm: 6 }, 3 * 1.609344, 'mi'),
    ).toBeCloseTo(5 * 1.609344);
  });

  it('stays when nothing matches, or nothing within the largest choice', () => {
    expect(searchFitRadiusKm({ farthestKm: null, nearestBeyondKm: null }, 5, 'km')).toBeNull();
    expect(searchFitRadiusKm({ farthestKm: null, nearestBeyondKm: 160.5 }, 5, 'km')).toBeNull();
  });
});
