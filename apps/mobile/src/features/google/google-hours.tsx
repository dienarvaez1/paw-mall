import { type GoogleDetailsResponse, googleDetailsResponseSchema } from '@paw-mall/shared';
import { useMutation } from '@tanstack/react-query';
import { Linking, Text, View } from 'react-native';

import { apiPost } from '@/api/client';
import { Button } from '@/components/button';
import { ErrorState } from '@/components/states';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { phoneUrl } from '@/lib/links';

const MUTED = 'text-base text-neutral-500 dark:text-neutral-400';

/**
 * "Ver horario" for places whose hours we don't know: asks Google only when tapped (each answer
 * uses part of a small free monthly allowance) and shows it for this visit only.
 */
export function GoogleHours({ placeId }: { placeId: number }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const lookup = useMutation({
    mutationFn: () =>
      apiPost(`/v1/places/${placeId}/google`, {}, locale, googleDetailsResponseSchema),
  });

  if (lookup.isSuccess) return <GoogleResult result={lookup.data} />;
  return (
    <View className="gap-3">
      <Text className={MUTED}>{t('places.hours.unconfirmed')}</Text>
      <View className="flex-row">
        <Button
          variant="secondary"
          label={lookup.isPending ? t('places.google.loading') : t('places.google.showHours')}
          onPress={() => {
            if (!lookup.isPending) lookup.mutate();
          }}
        />
      </View>
      {lookup.isError ? <ErrorState error={lookup.error} /> : null}
    </View>
  );
}

function GoogleResult({ result }: { result: GoogleDetailsResponse }) {
  const { t } = useAppTranslation();
  if (result.status !== 'ok') {
    return <Text className={MUTED}>{t(`places.google.${result.status}`)}</Text>;
  }
  const closed =
    result.businessStatus === 'CLOSED_PERMANENTLY' ||
    result.businessStatus === 'CLOSED_TEMPORARILY';
  return (
    <View className="gap-2">
      {closed ? (
        <Text className="text-base font-medium text-red-700 dark:text-red-400">
          {t(
            result.businessStatus === 'CLOSED_PERMANENTLY'
              ? 'places.google.closedPermanently'
              : 'places.google.closedTemporarily',
          )}
        </Text>
      ) : null}
      {result.openNow !== null && !closed ? (
        <Text
          className={`text-base font-medium ${
            result.openNow
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-neutral-700 dark:text-neutral-300'
          }`}
        >
          {t(result.openNow ? 'places.google.openNow' : 'places.google.closedNow')}
        </Text>
      ) : null}
      {result.weekdayHours.length > 0 ? (
        result.weekdayHours.map((line) => (
          <Text key={line} className="text-base text-neutral-900 dark:text-white">
            {line.charAt(0).toUpperCase() + line.slice(1)}
          </Text>
        ))
      ) : (
        <Text className={MUTED}>{t('places.google.noHours')}</Text>
      )}
      {result.phone || result.website || result.googleMapsUrl ? (
        <View className="flex-row flex-wrap gap-3 pt-2">
          {result.phone ? (
            <Button
              variant="secondary"
              label={t('places.call')}
              onPress={() => void Linking.openURL(phoneUrl(result.phone as string))}
            />
          ) : null}
          {result.website ? (
            <Button
              variant="secondary"
              label={t('places.website')}
              onPress={() => void Linking.openURL(result.website as string)}
            />
          ) : null}
          {result.googleMapsUrl ? (
            <Button
              variant="secondary"
              label={t('places.google.openInGoogleMaps')}
              onPress={() => void Linking.openURL(result.googleMapsUrl as string)}
            />
          ) : null}
        </View>
      ) : null}
      {result.phone ? <Text className={MUTED}>{result.phone}</Text> : null}
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('places.google.credit')}
      </Text>
    </View>
  );
}
