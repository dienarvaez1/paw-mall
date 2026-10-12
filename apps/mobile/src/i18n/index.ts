import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LOCALE,
  type Locale,
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from '@paw-mall/shared';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { NAMESPACES, resources } from './resources';

export const i18n = createInstance();

const LANGUAGE_STORAGE_KEY = 'settings.language';

/**
 * The language chosen in Ajustes (owner's rule: Ajustes has the last word), or Spanish when none
 * was chosen; the device language doesn't decide.
 */
async function savedLanguage(): Promise<Locale> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: await savedLanguage(),
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

/** Switches the language immediately and remembers it for the next launch. */
export async function setLanguage(language: Locale): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The switch still applies for this session.
  }
}
