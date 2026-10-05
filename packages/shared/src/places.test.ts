import { describe, expect, it } from 'vitest';

import { DEFAULT_RADIUS_KM, placeListQuerySchema } from './places';

describe('placeListQuerySchema', () => {
  it('coerces query strings and applies defaults', () => {
    expect(placeListQuerySchema.parse({ lat: '19.4326', lng: '-99.1332' })).toEqual({
      lat: 19.4326,
      lng: -99.1332,
      radiusKm: DEFAULT_RADIUS_KM,
      page: 1,
      pageSize: 20,
    });
  });

  it('accepts a known category and rejects others', () => {
    const base = { lat: '19.4', lng: '-99.1' };
    expect(placeListQuerySchema.parse({ ...base, category: 'veterinarian' }).category).toBe(
      'veterinarian',
    );
    expect(placeListQuerySchema.safeParse({ ...base, category: 'butcher' }).success).toBe(false);
  });

  it('caps the radius and page size', () => {
    const base = { lat: '19.4', lng: '-99.1' };
    expect(placeListQuerySchema.safeParse({ ...base, radiusKm: '51' }).success).toBe(false);
    expect(placeListQuerySchema.safeParse({ ...base, pageSize: '101' }).success).toBe(false);
  });
});
