import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import esCommon from './locales/es/common.json';
import esHome from './locales/es/home.json';

export const NAMESPACES = ['common', 'home'] as const;

// `es` is the source of truth for keys; the key types are generated from it (see i18next.d.ts).
export const resources = {
  es: { common: esCommon, home: esHome },
  en: { common: enCommon, home: enHome },
} as const;
