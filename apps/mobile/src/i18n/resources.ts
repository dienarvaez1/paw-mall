import enCommon from './locales/en/common.json';
import enDisclaimer from './locales/en/disclaimer.json';
import enErrors from './locales/en/errors.json';
import enFavorites from './locales/en/favorites.json';
import enPlaces from './locales/en/places.json';
import enSettings from './locales/en/settings.json';
import enUrgent from './locales/en/urgent.json';
import esCommon from './locales/es/common.json';
import esDisclaimer from './locales/es/disclaimer.json';
import esErrors from './locales/es/errors.json';
import esFavorites from './locales/es/favorites.json';
import esPlaces from './locales/es/places.json';
import esSettings from './locales/es/settings.json';
import esUrgent from './locales/es/urgent.json';

export const NAMESPACES = [
  'common',
  'places',
  'urgent',
  'favorites',
  'settings',
  'errors',
  'disclaimer',
] as const;

// `es` is the source of truth for keys; the key types are generated from it (see i18next.d.ts).
export const resources = {
  es: {
    common: esCommon,
    places: esPlaces,
    urgent: esUrgent,
    favorites: esFavorites,
    settings: esSettings,
    errors: esErrors,
    disclaimer: esDisclaimer,
  },
  en: {
    common: enCommon,
    places: enPlaces,
    urgent: enUrgent,
    favorites: enFavorites,
    settings: enSettings,
    errors: enErrors,
    disclaimer: enDisclaimer,
  },
} as const;
