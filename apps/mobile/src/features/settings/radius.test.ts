import { describe, expect, it } from 'vitest';

import { closestRadiusKm, isRadiusOption, nextRadiusKm, radiusOptionsKm, toKm } from './radius';

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

  it('starts from the smallest when the radius is not a choice', () => {
    expect(nextRadiusKm(7, 'km')).toBe(5);
  });
});
