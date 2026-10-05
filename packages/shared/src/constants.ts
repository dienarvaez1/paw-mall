/** Locales the app and API can serve. The first one is the default and fallback. */
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Region used for `Intl` formatting of numbers, distances, dates and times. */
export const REGION = 'MX';

/** Where the app centers when location is unavailable: Zócalo, Mexico City. */
export const FALLBACK_LOCATION = { lat: 19.4326, lng: -99.1332 } as const;
