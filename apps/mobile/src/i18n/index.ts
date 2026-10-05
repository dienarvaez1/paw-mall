import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@paw-mall/shared';
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { NAMESPACES, resources } from './resources';
import { resolveLanguage } from './resolve-language';

export const i18n = createInstance();

const LANGUAGE_STORAGE_KEY = 'settings.language';

async function loadSavedLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function initI18n(): Promise<void> {
  const savedLanguage = await loadSavedLanguage();
  const deviceLanguageCodes = getLocales().map((locale) => locale.languageCode);

  await i18n.use(initReactI18next).init({
    resources,
    lng: resolveLanguage(savedLanguage, deviceLanguageCodes),
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
