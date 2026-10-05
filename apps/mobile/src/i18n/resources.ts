import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enPlaces from './locales/en/places.json';
import enSettings from './locales/en/settings.json';
import enUrgent from './locales/en/urgent.json';
import esCommon from './locales/es/common.json';
import esErrors from './locales/es/errors.json';
import esPlaces from './locales/es/places.json';
import esSettings from './locales/es/settings.json';
import esUrgent from './locales/es/urgent.json';

export const NAMESPACES = ['common', 'places', 'urgent', 'settings', 'errors'] as const;

// `es` is the source of truth for keys; the key types are generated from it (see i18next.d.ts).
export const resources = {
  es: {
    common: esCommon,
    places: esPlaces,
    urgent: esUrgent,
    settings: esSettings,
    errors: esErrors,
  },
  en: {
    common: enCommon,
    places: enPlaces,
    urgent: enUrgent,
    settings: enSettings,
    errors: enErrors,
  },
} as const;
