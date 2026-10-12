import { KM_PER_MILE, MAX_RADIUS_KM } from '@paw-mall/shared';

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

/** A first launch starts at 3 miles (5 km in km); after that, Ajustes decides. */
export const START_RADIUS_MILES = 3;

/** The start radius as a choice in the unit: 3 mi, or the closest in km (5 km). */
export function startRadiusKm(unit: DistanceUnit): number {
  return closestRadiusKm(toKm(START_RADIUS_MILES, 'mi'), unit);
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
 * A tapped map cluster's radius: the whole kilometers that cover its places (1 km steps, owner's
 * rule), at least 1 km and at most the largest radius.
 */
export function coveringRadiusKm(neededKm: number): number {
  return Math.min(MAX_RADIUS_KM, Math.max(1, Math.ceil(neededKm - 1e-9)));
}

/**
 * The map's radius button: the next choice above the radius in the unit (also from a radius set by
 * zooming the map), back to the smallest after the largest.
 */
export function nextRadiusKm(radiusKm: number, unit: DistanceUnit): number {
  const options = radiusOptionsKm(unit);
  return options.find((option) => option > radiusKm + 1e-6) ?? options[0] ?? radiusKm;
}
