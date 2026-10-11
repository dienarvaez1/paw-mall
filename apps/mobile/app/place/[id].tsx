import { type Place, type PlaceReportReason, WEEK_ORDER } from '@paw-mall/shared';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { usePlace } from '@/api/hooks';
import { Button } from '@/components/button';
import { OpenStatus } from '@/components/open-status';
import { CategoryLine, usePlaceName } from '@/components/place-row';
import { ErrorState, SkeletonList } from '@/components/states';
import { GoogleHours } from '@/features/google/google-hours';
import { PolicyCard } from '@/features/pet-policy/policy-card';
import { useReportPlace } from '@/features/reports/place-reports';
import { formatClockTime, formatDate, formatMonthYear, formatWeekday } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { pinColor } from '@/lib/categories';
import { phoneUrl } from '@/lib/links';
import { useOpenDirections } from '@/lib/open-url';
import { placeLine } from '@/lib/place-line';

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = usePlace(Number(id));

  if (place.isPending) return <SkeletonList rows={4} />;
  if (place.isError) return <ErrorState error={place.error} onRetry={() => void place.refetch()} />;
  return <PlaceDetail place={place.data} />;
}

function PlaceDetail({ place: p }: { place: Place }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const name = usePlaceName(p);
  const openDirections = useOpenDirections();
  const coordinate = { latitude: p.location.lat, longitude: p.location.lng };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-neutral-950" contentContainerClassName="pb-10">
      <Stack.Screen options={{ title: name }} />
      <MapView
        style={{ height: 180 }}
        initialRegion={{ ...coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Marker coordinate={coordinate} title={name} pinColor={pinColor(p, null)} />
      </MapView>

      <View className="gap-2 px-4 pt-5">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">{name}</Text>
        <CategoryLine place={p} selected={null} />
        <OpenStatus place={p} />
        {p.ownerVerifiedOn ? (
          <Text className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {t('places.ownerVerified', { date: formatLongDate(p.ownerVerifiedOn, locale) })}
          </Text>
        ) : null}
      </View>

      <View className="flex-row gap-3 px-4 pt-5">
        <Button label={t('common.getDirections')} onPress={() => openDirections(p)} />
        {p.phone ? (
          <Button
            variant="secondary"
            label={t('places.call')}
            accessibilityLabel={t('places.callPlace', { name })}
            onPress={() => void Linking.openURL(phoneUrl(p.phone as string))}
          />
        ) : null}
      </View>
      {p.website || p.socialUrl ? (
        <View className="flex-row gap-3 px-4 pt-3">
          {p.website ? (
            <Button
              variant="secondary"
              label={t('places.website')}
              onPress={() => void Linking.openURL(p.website as string)}
            />
          ) : null}
          {p.socialUrl ? (
            <Button
              variant="secondary"
              label={t('places.social')}
              onPress={() => void Linking.openURL(p.socialUrl as string)}
            />
          ) : null}
        </View>
      ) : null}

      <View className="gap-1 px-4 pt-6">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
          {t('places.address')}
        </Text>
        <Text className="text-base text-neutral-700 dark:text-neutral-300">{p.address}</Text>
        <Text className="text-base text-neutral-700 dark:text-neutral-300">{placeLine(p)}</Text>
        {p.phone ? (
          <Text className="pt-1 text-base text-neutral-700 dark:text-neutral-300">{p.phone}</Text>
        ) : null}
      </View>

      {p.petPolicy ? <PolicyCard placeId={p.id} policy={p.petPolicy} /> : null}

      <HoursSection place={p} />

      <View className="gap-3 px-4 pt-8">
        <ReportButton placeId={p.id} reason="closed" />
        <ReportButton placeId={p.id} reason="cruelty" />
      </View>

      {!p.ownerVerifiedOn ? (
        <View className="flex-row px-4 pt-3">
          <Link href={{ pathname: '/claim/[placeId]', params: { placeId: p.id } }} asChild>
            <Pressable
              accessibilityRole="link"
              className="min-h-12 flex-1 items-center justify-center rounded-xl px-4 active:bg-neutral-100 dark:active:bg-neutral-900"
            >
              <Text className="text-base font-semibold text-teal-800 dark:text-teal-300">
                {t('places.claim.button')}
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {p.source === 'denue' ? (
        <View className="gap-1 px-4 pt-6">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {p.sourceUpdatedOn
              ? t('places.sourceDenueUpdated', { date: formatMonthYear(p.sourceUpdatedOn, locale) })
              : t('places.sourceDenue')}
          </Text>
          {p.registeredOn ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('places.registeredSince', { year: p.registeredOn.slice(0, 4) })}
            </Text>
          ) : null}
          {p.phoneSource === 'overture' || p.websiteSource === 'overture' || p.socialUrl ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('places.sourceOverture')}
            </Text>
          ) : null}
        </View>
      ) : null}
      {p.source === 'curated' ? (
        <View className="gap-1 px-4 pt-6">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('places.sourceCurated')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * Confirmed weekly hours when known; otherwise says they're unconfirmed (mentioning a "24 horas"
 * name hint) and offers "Ver horario" from Google for named places.
 */
function HoursSection({ place: p }: { place: Place }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  return (
    <View className="gap-1 px-4 pt-6">
      <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
        {t('places.hours.title')}
      </Text>
      {p.open24h?.value && p.open24h.source === 'owner' ? (
        <Text className="text-base text-neutral-900 dark:text-white">
          {t('places.hours.allDayEveryDay')}
        </Text>
      ) : p.hours ? (
        WEEK_ORDER.map((day) => {
          const hours = p.hours?.[day] ?? null;
          const allDay = hours?.open === '00:00' && ['24:00', '00:00'].includes(hours.close);
          return (
            <View key={day} className="flex-row justify-between py-1">
              <Text className="text-base capitalize text-neutral-700 dark:text-neutral-300">
                {formatWeekday(day, locale)}
              </Text>
              <Text className="text-base text-neutral-900 dark:text-white">
                {!hours
                  ? t('places.hours.closed')
                  : allDay
                    ? t('places.hours.allDay')
                    : t('places.hours.range', {
                        open: formatClockTime(hours.open, locale),
                        close: formatClockTime(hours.close, locale),
                      })}
              </Text>
            </View>
          );
        })
      ) : (
        <>
          {p.open24h?.value ? (
            <Text className="text-base text-amber-800 dark:text-amber-300">
              {t('places.open24hHint')}
            </Text>
          ) : null}
          {p.name ? (
            <GoogleHours placeId={p.id} />
          ) : (
            <Text className="text-base text-neutral-500 dark:text-neutral-400">
              {t('places.hours.unconfirmed')}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

/** An ISO date ("2026-10-05") in the long local format ("5 de octubre de 2026"). */
function formatLongDate(isoDate: string, language: Parameters<typeof formatDate>[1]): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return formatDate(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1), language);
}

/**
 * "¿Cerró?" or "Reportar maltrato animal", with a confirm step. Several phones' reports hide the
 * place pending the owner's review; only the reason and the app's random id are sent.
 */
function ReportButton({ placeId, reason }: { placeId: number; reason: PlaceReportReason }) {
  const { t } = useAppTranslation();
  const [confirming, setConfirming] = useState(false);
  const { alreadyReported, report, isPending, isError, error } = useReportPlace(placeId, reason);

  if (alreadyReported) {
    return (
      <Text className="text-sm text-neutral-600 dark:text-neutral-300">
        {t(`places.report.${reason}.thanks`)}
      </Text>
    );
  }
  if (!confirming) {
    return (
      <View className="flex-row">
        <Button
          variant="secondary"
          label={t(`places.report.${reason}.button`)}
          onPress={() => setConfirming(true)}
        />
      </View>
    );
  }
  return (
    <View className="gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <Text className="text-base text-neutral-900 dark:text-white">
        {t(`places.report.${reason}.confirm`)}
      </Text>
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('places.report.privacy')}
      </Text>
      <View className="flex-row gap-3">
        <Button
          label={t('places.report.yes')}
          onPress={() => {
            if (!isPending) report();
          }}
        />
        <Button
          variant="secondary"
          label={t('common.cancel')}
          onPress={() => setConfirming(false)}
        />
      </View>
      {isError ? <ErrorState error={error} /> : null}
    </View>
  );
}
