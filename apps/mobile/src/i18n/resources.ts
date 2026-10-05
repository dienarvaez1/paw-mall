import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enPlaces from './locales/en/places.json';
import enSettings from './locales/en/settings.json';
import esCommon from './locales/es/common.json';
import esErrors from './locales/es/errors.json';
import esPlaces from './locales/es/places.json';
import esSettings from './locales/es/settings.json';

export const NAMESPACES = ['common', 'places', 'settings', 'errors'] as const;

// `es` is the source of truth for keys; the key types are generated from it (see i18next.d.ts).
export const resources = {
  es: { common: esCommon, places: esPlaces, settings: esSettings, errors: esErrors },
  en: { common: enCommon, places: enPlaces, settings: enSettings, errors: enErrors },
} as const;
