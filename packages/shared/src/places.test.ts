import { describe, expect, it } from 'vitest';

import { categoryGroup } from './categories';
import { DEFAULT_RADIUS_KM, placeListQuerySchema, placeMapQuerySchema } from './places';

const base = { lat: '19.4', lng: '-99.1' };

describe('placeListQuerySchema', () => {
  it('coerces query strings and applies defaults', () => {
    expect(placeListQuerySchema.parse({ lat: '19.4326', lng: '-99.1332' })).toEqual({
      lat: 19.4326,
      lng: -99.1332,
      radiusKm: DEFAULT_RADIUS_KM,
      areaRadiusKm: 5,
      cityRadiusKm: 3 * 1.609344,
      page: 1,
      pageSize: 20,
    });
  });

  it('accepts a known category and rejects others', () => {
    expect(placeListQuerySchema.parse({ ...base, category: 'veterinarian' }).category).toBe(
      'veterinarian',
    );
    expect(placeListQuerySchema.safeParse({ ...base, category: 'butcher' }).success).toBe(false);
  });

  it('reads filters and trims the search', () => {
    expect(
      placeListQuerySchema.parse({ ...base, q: '  huellitas ', withPhone: 'true', named: 'false' }),
    ).toMatchObject({ q: 'huellitas', withPhone: true, named: false });
    expect(placeListQuerySchema.safeParse({ ...base, q: '   ' }).success).toBe(false);
  });

  it('caps the radius and page size', () => {
    expect(placeListQuerySchema.safeParse({ ...base, radiusKm: '160.9344' }).success).toBe(true);
    expect(placeListQuerySchema.safeParse({ ...base, radiusKm: '162' }).success).toBe(false);
    expect(placeListQuerySchema.safeParse({ ...base, pageSize: '201' }).success).toBe(false);
  });
});

describe('areaRadiusKm', () => {
  it('accepts a radius set by zooming the map, up to the largest radius', () => {
    expect(placeListQuerySchema.parse({ ...base, q: 'x', areaRadiusKm: '42.5' }).areaRadiusKm).toBe(
      42.5,
    );
    expect(placeListQuerySchema.safeParse({ ...base, areaRadiusKm: '162' }).success).toBe(false);
  });
});

describe('placeMapQuerySchema', () => {
  it('parses the visible box', () => {
    expect(placeMapQuerySchema.parse({ ...base, bbox: '-99.2,19.3,-99.0,19.5' }).bbox).toEqual({
      minLng: -99.2,
      minLat: 19.3,
      maxLng: -99,
      maxLat: 19.5,
    });
    expect(placeMapQuerySchema.safeParse({ ...base, bbox: '1,2,3' }).success).toBe(false);
  });
});

describe('categoryGroup', () => {
  it('puts each category in its tab', () => {
    expect(categoryGroup('veterinarian')).toBe('pet_business');
    expect(categoryGroup('feed_store')).toBe('pet_business');
    expect(categoryGroup('restaurant')).toBe('pet_friendly');
    expect(categoryGroup('tourist_site')).toBe('pet_friendly');
  });
});
