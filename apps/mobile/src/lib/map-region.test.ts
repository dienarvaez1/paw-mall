import { describe, expect, it } from 'vitest';

import { regionForBounds, regionForRadius } from './map-region';

describe('regionForRadius', () => {
  it('fits the circle with a margin, wider in longitude away from the equator', () => {
    const region = regionForRadius({ lat: 19.4326, lng: -99.1332 }, 10);
    expect(region.latitude).toBe(19.4326);
    expect(region.longitude).toBe(-99.1332);
    // 20 km across plus 15%: about 0.207 degrees of latitude.
    expect(region.latitudeDelta).toBeCloseTo(0.2066, 3);
    expect(region.longitudeDelta).toBeGreaterThan(region.latitudeDelta);
    expect(region.longitudeDelta).toBeCloseTo(0.2191, 3);
  });
});

describe('regionForBounds', () => {
  it('centers on the box with a margin, and never zooms in past a minimum span', () => {
    expect(regionForBounds([-99.2, 19.4, -99.1, 19.5])).toEqual({
      latitude: 19.45,
      longitude: -99.15000000000001,
      latitudeDelta: expect.closeTo(0.13, 5) as number,
      longitudeDelta: expect.closeTo(0.13, 5) as number,
    });
    expect(regionForBounds([-99.13, 19.43, -99.13, 19.43]).latitudeDelta).toBe(0.004);
  });
});
