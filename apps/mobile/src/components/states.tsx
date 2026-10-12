import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useIsOffline } from '@/features/network/network';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { BUTTON_HIT_SLOP } from '@/components/button';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useAppTranslation();
  const offline = useIsOffline();
  let message = t('errors.generic');
  if (offline) {
    message = t('errors.offline');
  } else if (error instanceof ApiError) {
    message =
      error.code === 'NETWORK_ERROR' ? t('errors.network') : t(`errors.codes.${error.code}`);
  }
  return (
    <View className="items-center gap-4 px-6 py-12">
      <Text className="text-center text-base text-neutral-700 dark:text-neutral-300">
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          hitSlop={BUTTON_HIT_SLOP}
          className="min-h-[38px] justify-center rounded-xl bg-neutral-900 px-5 dark:bg-white"
        >
          <Text className="text-[13px] font-semibold text-white dark:text-neutral-900">
            {t('common.retry')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="items-center gap-2 px-6 py-12">
      <Text className="text-center text-lg font-semibold text-neutral-800 dark:text-neutral-100">
        {title}
      </Text>
      {hint ? (
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">{hint}</Text>
      ) : null}
    </View>
  );
}

/** Grey placeholder rows shown while a list loads. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3 px-4 py-3">
          <View className="h-14 w-14 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          <View className="flex-1 gap-2">
            <View className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
            <View className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Notice({ text }: { text: string }) {
  return (
    <View className="mx-4 my-2 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-950">
      <Text className="text-sm text-amber-900 dark:text-amber-200">{text}</Text>
    </View>
  );
}

/** Shown at the top of every screen while the phone has no connection. */
export function OfflineBanner() {
  const { t } = useAppTranslation();
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <SafeAreaView edges={['top']} className="bg-neutral-900 dark:bg-neutral-100">
      <View accessibilityRole="alert" className="px-4 py-2">
        <Text className="text-center text-sm font-medium text-white dark:text-neutral-900">
          {t('errors.offline')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
