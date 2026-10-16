import { type GoogleDetailsResponse, googleDetailsResponseSchema } from '@pet-helper/shared';
import { useMutation } from '@tanstack/react-query';
import { Linking, Text, View } from 'react-native';

import { apiPost } from '@/api/client';
import { IconLink, IconLinkRow } from '@/components/icon-link';
import { ErrorState } from '@/components/states';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { phoneUrl } from '@/lib/links';

const MUTED = 'text-base text-neutral-500 dark:text-neutral-400';

/**
 * "Ver horario" for places whose hours we don't know: asks Google only when tapped (each answer
 * uses part of a small free monthly allowance) and shows it for this visit only. The link sits
 * at the top of the place, beside its "Horario sin confirmar"; the answer shows in its Hours
 * section, so both share this lookup.
 */
export function useGoogleHours(placeId: number) {
  const locale = useLocale();
  return useMutation({
    mutationFn: () =>
      apiPost(`/v1/places/${placeId}/google`, {}, locale, googleDetailsResponseSchema),
  });
}

export type GoogleHoursLookup = ReturnType<typeof useGoogleHours>;

/** The "Ver horario" link; gone once Google has answered. */
export function GoogleHoursLink({ lookup }: { lookup: GoogleHoursLookup }) {
  const { t } = useAppTranslation();
  if (lookup.isSuccess) return null;
  return (
    <IconLink
      inline
      compact
      icon="clock"
      label={lookup.isPending ? t('places.google.loading') : t('places.google.showHours')}
      onPress={() => {
        if (!lookup.isPending) lookup.mutate();
      }}
    />
  );
}

/** Google's answer once asked, or why asking failed; nothing before (the link is at the top). */
export function GoogleHours({ lookup }: { lookup: GoogleHoursLookup }) {
  if (lookup.isSuccess) return <GoogleResult result={lookup.data} />;
  if (lookup.isError) return <ErrorState error={lookup.error} />;
  return null;
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
        <View className="pt-2">
          <IconLinkRow>
            {result.phone ? (
              <IconLink
                icon="phone"
                label={t('places.call')}
                onPress={() => void Linking.openURL(phoneUrl(result.phone as string))}
              />
            ) : null}
            {result.website ? (
              <IconLink
                icon="website"
                label={t('places.website')}
                onPress={() => void Linking.openURL(result.website as string)}
              />
            ) : null}
            {result.googleMapsUrl ? (
              <IconLink
                icon="map"
                label={t('places.google.openInGoogleMaps')}
                onPress={() => void Linking.openURL(result.googleMapsUrl as string)}
              />
            ) : null}
          </IconLinkRow>
        </View>
      ) : null}
      {result.phone ? <Text className={MUTED}>{result.phone}</Text> : null}
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('places.google.credit')}
      </Text>
    </View>
  );
}
