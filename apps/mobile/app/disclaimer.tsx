import { Image, type ImageSource } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useDisclaimer } from '@/features/disclaimer/disclaimer-context';
import { DisclaimerText } from '@/features/disclaimer/disclaimer-text';
import { useAppTranslation } from '@/i18n/use-app-translation';

const LOGO = require('../assets/images/logo.png') as ImageSource;

/**
 * The disclaimer: on the first launch (and when its version changes) with Acepto and Cancelar;
 * from Ajustes (`?mode=review`) to read again, with Cerrar. Accepting opens the whole app;
 * cancelling leaves Urgencias and the notice tab (owner's request, 2026-10-14).
 */
export default function DisclaimerScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { accept, decline } = useDisclaimer();
  const { top, bottom } = useSafeAreaInsets();
  const review = mode === 'review';
  return (
    <View style={{ flex: 1, paddingTop: top }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
        <Image
          source={LOGO}
          contentFit="contain"
          style={{ height: 44, width: 132, alignSelf: 'center', marginBottom: 16 }}
          accessibilityIgnoresInvertColors
        />
        <DisclaimerText />
      </ScrollView>
      <View
        style={{ paddingBottom: bottom + 12 }}
        className="gap-3 border-t border-neutral-200 px-5 pt-3 dark:border-neutral-800"
      >
        {review ? (
          <View className="flex-row">
            <Button testID="disclaimer-close" label={t('disclaimer.close')} onPress={router.back} />
          </View>
        ) : (
          <>
            <Text className="text-sm leading-5 text-neutral-600 dark:text-neutral-400">
              {t('disclaimer.acceptHint')}
            </Text>
            <View className="flex-row gap-3">
              <Button
                testID="disclaimer-cancel"
                variant="secondary"
                label={t('disclaimer.cancel')}
                onPress={() => {
                  decline();
                  router.replace('/urgent');
                }}
              />
              <Button
                testID="disclaimer-accept"
                label={t('disclaimer.accept')}
                onPress={() => {
                  accept();
                  router.replace('/explore');
                }}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
