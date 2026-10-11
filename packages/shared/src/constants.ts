/** Locales the app and API can serve. The first one is the default and fallback. */
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Region used for `Intl` formatting of numbers, distances, dates and times. */
export const REGION = 'MX';

/** International mile. */
export const KM_PER_MILE = 1.609344;

/**
 * A search that is just a place's name ("Tlaxcala") also lists businesses with that word in their
 * name up to this far from the place: 25 miles (owner's rule).
 */
export const AREA_NAME_RADIUS_KM = 25 * KM_PER_MILE;

/** A city or town searched by name with more than CITY_BUSY_MATCHES places: 3 mi around it. */
export const CITY_AREA_RADIUS_KM = 3 * KM_PER_MILE;
export const CITY_BUSY_MATCHES = 10;

/** Where the app centers when location is unavailable: Zócalo, Mexico City. */
export const FALLBACK_LOCATION = { lat: 19.4326, lng: -99.1332 } as const;
