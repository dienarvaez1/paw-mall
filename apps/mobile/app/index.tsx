import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHealth } from '@/api/hooks';
import { setLanguage } from '@/i18n';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

function ApiStatus() {
  const { t } = useAppTranslation();
  const health = useHealth();

  if (health.isPending) {
    return (
      <View className="flex-row items-center gap-2">
        <ActivityIndicator />
        <Text className="text-base text-gray-600 dark:text-gray-300">{t('home.api.checking')}</Text>
      </View>
    );
  }

  if (health.isError) {
    return (
      <View className="items-center gap-3">
        <Text className="text-center text-base text-red-700 dark:text-red-400">
          {t('home.api.unreachable')}
        </Text>
        <Pressable
          accessibilityRole="button"
          className="rounded-full bg-brand px-5 py-2 active:bg-brand-dark"
          onPress={() => health.refetch()}
        >
          <Text className="font-semibold text-white">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const { version, database } = health.data;
  return (
    <View className="items-center gap-1">
      <Text className="text-base text-green-700 dark:text-green-400">
        {t('home.api.connected', { version })}
      </Text>
      <Text className="text-center text-sm text-gray-600 dark:text-gray-300">
        {database.status === 'ok'
          ? t('home.api.databaseReady', { postgis: database.postgis })
          : t('home.api.databaseUnavailable')}
      </Text>
    </View>
  );
}

export default function Home() {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const otherLocale = locale === 'es' ? 'en' : 'es';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Text className="text-center text-3xl font-bold text-brand dark:text-teal-400">
          {t('home.title')}
        </Text>
        <Text className="text-center text-lg text-gray-800 dark:text-gray-100">
          {t('home.subtitle')}
        </Text>
        <ApiStatus />
        <Pressable accessibilityRole="button" onPress={() => setLanguage(otherLocale)}>
          <Text className="text-base text-brand underline dark:text-teal-400">
            {t('home.switchLanguage', { language: t(`common.language.${otherLocale}`) })}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
