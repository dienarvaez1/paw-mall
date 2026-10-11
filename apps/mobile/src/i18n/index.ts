import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@paw-mall/shared';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { NAMESPACES, resources } from './resources';

export const i18n = createInstance();

/**
 * Every launch starts in Spanish (owner's rule), whatever the device language or an earlier
 * choice; Ajustes can switch to English for the session, and returning from the background goes
 * back to Spanish (startInSpanish).
 */
export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    ns: NAMESPACES,
    defaultNS: 'common',
    nsSeparator: '.',
    interpolation: {
      // React already escapes rendered values.
      escapeValue: false,
    },
  });
}

/** Switches the language for this session (the next launch or wake starts in Spanish again). */
export async function setLanguage(language: Locale): Promise<void> {
  await i18n.changeLanguage(language);
}

/** Back to Spanish, as on launch. */
export function startInSpanish(): void {
  if (i18n.isInitialized && i18n.language !== DEFAULT_LOCALE)
    void i18n.changeLanguage(DEFAULT_LOCALE);
}
