import { Text, View } from 'react-native';

import { formatLongDate } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

import { DISCLAIMER_VERSION } from './disclaimer';

/** The notice's sections, in reading order (i18n `disclaimer.sections`). */
const SECTIONS = [
  'information',
  'veterinary',
  'petFriendly',
  'endorsement',
  'privacy',
  'thirdParties',
  'liability',
  'animals',
] as const;

/** The disclaimer's text: its title, introduction, sections and version date. */
export function DisclaimerText() {
  const { t } = useAppTranslation();
  const locale = useLocale();
  return (
    <View className="gap-4">
      <Text
        accessibilityRole="header"
        className="text-xl font-bold text-neutral-900 dark:text-white"
      >
        {t('disclaimer.title')}
      </Text>
      <Text className="text-[15px] leading-6 text-neutral-700 dark:text-neutral-300">
        {t('disclaimer.intro')}
      </Text>
      {SECTIONS.map((section) => (
        <View key={section} className="gap-1">
          <Text
            accessibilityRole="header"
            className="text-base font-semibold text-neutral-900 dark:text-white"
          >
            {t(`disclaimer.sections.${section}.title`)}
          </Text>
          <Text className="text-[15px] leading-6 text-neutral-700 dark:text-neutral-300">
            {t(`disclaimer.sections.${section}.body`)}
          </Text>
        </View>
      ))}
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('disclaimer.version', { date: formatLongDate(DISCLAIMER_VERSION, locale) })}
      </Text>
    </View>
  );
}
