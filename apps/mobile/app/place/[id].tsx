import { type Place, type PlaceReportReason, WEEK_ORDER } from '@paw-mall/shared';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View, useColorScheme } from 'react-native';
import MapView from 'react-native-maps';

import { usePlace } from '@/api/hooks';
import { Button } from '@/components/button';
import { CategoryPin } from '@/components/category-pin';
import { IconLink, IconLinkRow } from '@/components/icon-link';
import { ICONS } from '@/components/icons';
import { OpenStatus } from '@/components/open-status';
import { CategoryLine, usePlaceName } from '@/components/place-row';
import { SECTION, SECTION_TITLE } from '@/components/section';
import { ErrorState, SkeletonList } from '@/components/states';
import { VerificationLine } from '@/components/verification';
import { FavoriteButton } from '@/features/favorites/favorite-button';
import {
  GoogleHours,
  GoogleHoursLink,
  type GoogleHoursLookup,
  useGoogleHours,
} from '@/features/google/google-hours';
import { PetQuestionCard } from '@/features/pet-policy/pet-question';
import { PolicyCard } from '@/features/pet-policy/policy-card';
import { useReportPlace } from '@/features/reports/place-reports';
import { formatClockTime, formatLongDate, formatMonthYear, formatWeekday } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { isPetFriendlyCategory } from '@/lib/categories';
import { phoneUrl } from '@/lib/links';
import { useOpenDirections } from '@/lib/open-url';
import { MAP_TYPE, MAPS_AVAILABLE } from '@/lib/map-type';
import { placeLine } from '@/lib/place-line';
import { placeCopyText, placeShareMessage } from '@/lib/share-text';

const COPIED_MS = 3000;

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
  const googleHours = useGoogleHours(p.id);
  const router = useRouter();
  const scheme = useColorScheme();
  // "Copiado" shows for a moment after tapping the address.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <ScrollView className="flex-1 bg-off-bg dark:bg-neutral-950" contentContainerClassName="pb-10">
      <Stack.Screen options={{ title: name }} />
      {MAPS_AVAILABLE ? (
        <MapView
          style={{ height: 240 }}
          mapType={MAP_TYPE}
          initialRegion={{ ...coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <CategoryPin place={p} category={null} title={name} />
        </MapView>
      ) : null}

      <View className="gap-1.5 px-4 pt-4">
        <Text testID="place-name" className="text-xl font-bold text-neutral-900 dark:text-white">
          {name}
        </Text>
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <CategoryLine place={p} selected={null} />
          </View>
          <FavoriteButton placeId={p.id} name={name} />
        </View>
        <View className="mt-2.5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <View className="flex-row items-start gap-3">
            <Pressable
              testID="place-address"
              accessibilityRole="button"
              accessibilityLabel={t('places.copyAddress')}
              onPress={() => {
                void Clipboard.setStringAsync(placeCopyText(name, p)).then(() => setCopied(true));
              }}
              className="flex-1 rounded-md active:bg-neutral-100 dark:active:bg-neutral-900"
            >
              <Text className="text-sm text-neutral-700 dark:text-neutral-300">{p.address}</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{placeLine(p)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('places.share', { name })}
              onPress={() => void Share.share({ message: placeShareMessage(name, p) })}
              hitSlop={10}
              className="p-1"
            >
              <Image
                source={ICONS.share}
                style={{ width: 20, height: 20 }}
                tintColor={scheme === 'dark' ? '#5eead4' : '#115e59'}
              />
            </Pressable>
          </View>
          {copied ? (
            <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t('places.addressCopied')}
            </Text>
          ) : null}
          {p.phone ? (
            <Text selectable className="text-sm text-neutral-700 dark:text-neutral-300">
              {p.phone}
            </Text>
          ) : null}
        </View>
        {p.ownerVerifiedOn ? (
          <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {t('places.ownerVerified', { date: formatLongDate(p.ownerVerifiedOn, locale) })}
          </Text>
        ) : (
          <VerificationLine verification={p.verification} />
        )}
      </View>

      <View className="mx-4 mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <IconLinkRow>
          <IconLink
            icon="directions"
            label={t('common.getDirections')}
            onPress={() => openDirections(p)}
          />
          {p.phone ? (
            <IconLink
              icon="phone"
              label={t('places.call')}
              accessibilityLabel={t('places.callPlace', { name })}
              onPress={() => void Linking.openURL(phoneUrl(p.phone as string))}
            />
          ) : null}
          {p.website ? (
            <IconLink
              icon="website"
              label={t('places.website')}
              onPress={() => void Linking.openURL(p.website as string)}
            />
          ) : null}
          {p.socialUrl ? (
            <IconLink
              icon="social"
              label={t('places.social')}
              onPress={() => void Linking.openURL(p.socialUrl as string)}
            />
          ) : null}
        </IconLinkRow>
      </View>

      <View className="mx-4 mt-4 flex-row flex-wrap items-center gap-x-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <OpenStatus place={p} />
        {canAskGoogle(p) ? <GoogleHoursLink lookup={googleHours} /> : null}
      </View>

      <HoursSection place={p} googleHours={googleHours} />

      <View className={SECTION}>
        {!p.ownerVerifiedOn ? (
          <IconLink
            inline
            icon="store"
            label={t('places.claim.button')}
            onPress={() => router.push({ pathname: '/claim/[placeId]', params: { placeId: p.id } })}
          />
        ) : null}
        <ReportButton placeId={p.id} reason="closed" />
        <ReportButton placeId={p.id} reason="cruelty" />
      </View>

      {p.petPolicy ? (
        <PolicyCard placeId={p.id} policy={p.petPolicy} />
      ) : p.categories.some((c) => isPetFriendlyCategory(c.slug)) ? (
        <PetQuestionCard placeId={p.id} />
      ) : null}

      {p.source === 'denue' ? (
        <View className="mx-4 mt-4 gap-0.5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
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
          {p.phoneSource === 'osm' ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('places.sourceOsmPhone')}
            </Text>
          ) : null}
        </View>
      ) : null}
      {p.source === 'curated' ? (
        <View className="mx-4 mt-4 gap-0.5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('places.sourceCurated')}
          </Text>
        </View>
      ) : null}
      {p.source === 'osm' ? (
        <View className="mx-4 mt-4 gap-0.5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('places.sourceOsm')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Hours unknown, so "Ver horario" can ask Google (a place without a name can't be looked up). */
function canAskGoogle(p: Place): boolean {
  return !p.hours && !(p.open24h?.value && p.open24h.source === 'owner') && p.name !== null;
}

/**
 * Confirmed weekly hours when known; otherwise only a "24 horas" name hint or Google's answer
 * ("Ver horario" sits beside the open status, above).
 */
function HoursSection({ place: p, googleHours }: { place: Place; googleHours: GoogleHoursLookup }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const known = Boolean(p.hours) || Boolean(p.open24h?.value && p.open24h.source === 'owner');
  // Unknown hours: the top already says "Horario sin confirmar" beside "Ver horario", so this
  // section shows only a "24 horas" name hint or Google's answer (with its heading).
  if (!known && !p.open24h?.value && !googleHours.isSuccess && !googleHours.isError) return null;
  return (
    <View className={SECTION}>
      {known || googleHours.isSuccess ? (
        <Text accessibilityRole="header" className={SECTION_TITLE}>
          {t('places.hours.title')}
        </Text>
      ) : null}
      {p.open24h?.value && p.open24h.source === 'owner' ? (
        <Text className="text-sm text-neutral-900 dark:text-white">
          {t('places.hours.allDayEveryDay')}
        </Text>
      ) : p.hours ? (
        <>
          {WEEK_ORDER.map((day) => {
            const hours = p.hours?.[day] ?? null;
            const allDay = hours?.open === '00:00' && ['24:00', '00:00'].includes(hours.close);
            return (
              <View key={day} className="flex-row justify-between py-0.5">
                <Text className="text-sm capitalize text-neutral-600 dark:text-neutral-400">
                  {formatWeekday(day, locale)}
                </Text>
                <Text className="text-sm text-neutral-900 dark:text-white">
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
          })}
          {p.hoursSource ? (
            <Text className="pt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {t(`places.hours.source.${p.hoursSource}`)}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {p.open24h?.value ? (
            <Text className="text-sm text-amber-800 dark:text-amber-300">
              {t('places.open24hHint')}
            </Text>
          ) : null}
          <GoogleHours lookup={googleHours} />
        </>
      )}
    </View>
  );
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
      <IconLink
        inline
        icon={reason === 'closed' ? 'flag' : 'alert'}
        label={t(`places.report.${reason}.button`)}
        onPress={() => setConfirming(true)}
      />
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
