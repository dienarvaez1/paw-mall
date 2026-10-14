import { describe, expect, it } from 'vitest';

import {
  circleForCluster,
  distanceKm,
  isAwayFrom,
  radiusForRegion,
  regionForBounds,
  regionForRadius,
} from './map-region';

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

describe('radiusForRegion', () => {
  it('reverses regionForRadius', () => {
    for (const km of [0.5, 5, 25, 160]) {
      expect(
        radiusForRegion(regionForRadius({ lat: 19.4326, lng: -99.1332 }, km), 200),
      ).toBeCloseTo(km, 1);
    }
  });

  it('uses the narrower side of the view, and stays within limits', () => {
    const tall = { latitude: 19.4, longitude: -99.1, latitudeDelta: 0.5, longitudeDelta: 0.1 };
    expect(radiusForRegion(tall, 200)).toBe(4.6);
    const world = { latitude: 19.4, longitude: -99.1, latitudeDelta: 40, longitudeDelta: 40 };
    expect(radiusForRegion(world, 161)).toBe(161);
    const tiny = {
      latitude: 19.4,
      longitude: -99.1,
      latitudeDelta: 0.0001,
      longitudeDelta: 0.0001,
    };
    expect(radiusForRegion(tiny, 161)).toBe(0.1);
  });
});

describe('isAwayFrom', () => {
  const me = { lat: 19.4326, lng: -99.1332 };
  const around = regionForRadius(me, 5);

  it('stays at the point when the map is centered on it, give or take a small drift', () => {
    expect(isAwayFrom(around, me)).toBe(false);
    expect(isAwayFrom(regionForRadius(me, 1), me)).toBe(false);
    expect(isAwayFrom({ ...around, latitude: me.lat + around.latitudeDelta * 0.04 }, me)).toBe(
      false,
    );
  });

  it('is away as soon as the center moves off the point', () => {
    expect(isAwayFrom({ ...around, latitude: me.lat + around.latitudeDelta * 0.1 }, me)).toBe(true);
    expect(isAwayFrom({ ...around, longitude: me.lng - around.longitudeDelta * 0.2 }, me)).toBe(
      true,
    );
  });
});

describe('circleForCluster', () => {
  // Most places near the box's south-west corner (the average), a few far to the north-east.
  const bounds = [-99.2, 19.3, -98.8, 19.7] as const;
  const average = { lat: 19.35, lng: -99.15 };

  it('centers on the average position, not the middle of the box', () => {
    expect(circleForCluster(average, bounds).center).toEqual(average);
  });

  it('reaches every corner of the box', () => {
    const { radiusKm } = circleForCluster(average, bounds);
    const farCorner = distanceKm(average, { lat: 19.7, lng: -98.8 });
    expect(radiusKm).toBeCloseTo(farCorner, 6);
    for (const corner of [
      { lat: 19.3, lng: -99.2 },
      { lat: 19.3, lng: -98.8 },
      { lat: 19.7, lng: -99.2 },
    ]) {
      expect(radiusKm).toBeGreaterThanOrEqual(distanceKm(average, corner));
    }
  });
});
