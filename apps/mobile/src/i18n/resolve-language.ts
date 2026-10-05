import { DEFAULT_LOCALE, type Locale, isSupportedLocale } from '@paw-mall/shared';

/**
 * Picks the app language: the user's saved choice, then the first supported device
 * language, then the default (`es`).
 */
export function resolveLanguage(
  savedLanguage: string | null | undefined,
  deviceLanguageCodes: readonly (string | null | undefined)[],
): Locale {
  if (isSupportedLocale(savedLanguage)) {
    return savedLanguage;
  }
  const deviceLanguage = deviceLanguageCodes.find(isSupportedLocale);
  return deviceLanguage ?? DEFAULT_LOCALE;
}
