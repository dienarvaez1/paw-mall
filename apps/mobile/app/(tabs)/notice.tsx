import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useDisclaimer } from '@/features/disclaimer/disclaimer-context';
import { DisclaimerText } from '@/features/disclaimer/disclaimer-text';
import { useAppTranslation } from '@/i18n/use-app-translation';

/**
 * Aviso: after cancelling the disclaimer, the notice to read again, with a button (always in view,
 * above the tab bar) to accept it and open the whole app. Hidden once accepted (the notice is then
 * in Ajustes).
 */
export default function NoticeScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const { accept } = useDisclaimer();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
        <View className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <Text className="text-sm leading-5 text-amber-900 dark:text-amber-100">
            {t('disclaimer.declined')}
          </Text>
        </View>
        <DisclaimerText />
      </ScrollView>
      <View className="flex-row border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <Button
          testID="notice-accept"
          label={t('disclaimer.acceptNow')}
          onPress={() => {
            accept();
            router.replace('/explore');
          }}
        />
      </View>
    </View>
  );
}
