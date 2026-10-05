import { describe, expect, it } from 'vitest';

import { distanceMeters, isSamePlace, jaroWinkler, normalizeName } from './place-match';

const place = { name: 'Veterinaria Huellitas', lat: 19.4, lng: -99.1 };

describe('isSamePlace', () => {
  it('accepts the same business nearby, written differently', () => {
    expect(
      isSamePlace(place, {
        name: 'Huellitas Clínica Veterinaria',
        location: { lat: 19.4005, lng: -99.1 },
      }),
    ).toBe(true);
    expect(isSamePlace(place, { name: 'Huelitas', location: { lat: 19.4, lng: -99.1 } })).toBe(
      true,
    );
  });

  it('rejects another business, a far listing or a listing without name or location', () => {
    expect(isSamePlace(place, { name: 'Pet Shop Luna', location: { lat: 19.4, lng: -99.1 } })).toBe(
      false,
    );
    expect(isSamePlace(place, { name: 'Huellitas', location: { lat: 19.402, lng: -99.1 } })).toBe(
      false,
    );
    expect(isSamePlace(place, { name: null, location: { lat: 19.4, lng: -99.1 } })).toBe(false);
    expect(isSamePlace(place, { name: 'Huellitas', location: null })).toBe(false);
  });
});

describe('helpers', () => {
  it('normalizes names and measures similarity and distance', () => {
    expect(normalizeName('Clínica Veterinaria y Estética "Los Ángeles", S.A. de C.V.')).toBe(
      'angeles',
    );
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('abc', '')).toBe(0);
    expect(distanceMeters({ lat: 19.4, lng: -99.1 }, { lat: 19.401, lng: -99.1 })).toBeCloseTo(
      111,
      0,
    );
  });
});
