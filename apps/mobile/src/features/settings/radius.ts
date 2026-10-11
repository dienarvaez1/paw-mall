import { KM_PER_MILE } from '@paw-mall/shared';

export const UNIT_OPTIONS = ['km', 'mi'] as const;
export type DistanceUnit = (typeof UNIT_OPTIONS)[number];

/** Search radius choices in each unit's own round numbers, up to 100 miles (160 km). */
export const RADIUS_OPTIONS = {
  km: [5, 10, 15, 25, 50, 80, 160],
  mi: [3, 5, 10, 15, 25, 50, 100],
} as const satisfies Record<DistanceUnit, readonly number[]>;

export function toKm(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * KM_PER_MILE : value;
}

/** The radius choices for a unit, in km (what the API takes). */
export function radiusOptionsKm(unit: DistanceUnit): number[] {
  return RADIUS_OPTIONS[unit].map((value) => toKm(value, unit));
}

/** The choice in `unit` closest to a radius in km, e.g. 15 km -> 10 mi (16.09 km). */
export function closestRadiusKm(radiusKm: number, unit: DistanceUnit): number {
  const options = radiusOptionsKm(unit);
  return options.reduce((best, option) =>
    Math.abs(option - radiusKm) < Math.abs(best - radiusKm) ? option : best,
  );
}

/** True when the radius is one of the unit's choices (allowing for float rounding). */
export function isRadiusOption(radiusKm: number, unit: DistanceUnit): boolean {
  return radiusOptionsKm(unit).some((option) => Math.abs(option - radiusKm) < 1e-6);
}

/**
 * A tapped map cluster zooms one ring closer: the largest choice in the unit below the view's
 * radius, or half of it below the smallest.
 */
export function smallerRadiusKm(viewRadiusKm: number, unit: DistanceUnit): number {
  const below = radiusOptionsKm(unit).filter((option) => option < viewRadiusKm * 0.99);
  return below.at(-1) ?? viewRadiusKm / 2;
}

/** The map's radius button: the next choice in the unit, back to the smallest after the largest. */
export function nextRadiusKm(radiusKm: number, unit: DistanceUnit): number {
  const options = radiusOptionsKm(unit);
  const current = options.findIndex((option) => Math.abs(option - radiusKm) < 1e-6);
  return options[(current + 1) % options.length] ?? options[0] ?? radiusKm;
}
