import { DEFAULT_LOCALE, type Locale, isSupportedLocale } from '@pet-helper/shared';

import { useAppTranslation } from './use-app-translation';

/** The active app language, narrowed to a supported locale. */
export function useLocale(): Locale {
  const { i18n } = useAppTranslation();
  return isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}
