import { SUPPORTED_LOCALES } from '@paw-mall/shared';
import { Image } from 'expo-image';
import { Pressable, Text, useColorScheme } from 'react-native';

import { ICONS } from '@/components/icons';
import { setLanguage } from '@/i18n';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

/**
 * A small globe with the active language's code ("ES" or "EN"); a tap switches to the other
 * language, as Ajustes does. The code is a symbol, so it isn't translated.
 */
export function LanguageToggle() {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const scheme = useColorScheme();
  const next = SUPPORTED_LOCALES.find((code) => code !== locale) ?? locale;
  return (
    <Pressable
      testID="language-toggle"
      accessibilityRole="button"
      accessibilityLabel={t('common.switchLanguage', { language: t(`common.language.${next}`) })}
      onPress={() => void setLanguage(next)}
      hitSlop={8}
      className="ml-1 flex-row items-center gap-1 border-l border-neutral-300 py-1 pl-2 dark:border-neutral-700"
    >
      <Image
        source={ICONS.website}
        style={{ width: 14, height: 14 }}
        tintColor={scheme === 'dark' ? '#5eead4' : '#115e59'}
      />
      <Text className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">
        {locale.toUpperCase()}
      </Text>
    </Pressable>
  );
}
