import type { Place } from '@paw-mall/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { usePlace } from '@/api/hooks';
import { Button } from '@/components/button';
import { CategoryLine, usePlaceName } from '@/components/place-row';
import { ErrorState, SkeletonList } from '@/components/states';
import { formatMonthYear } from '@/i18n/format';
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
        {p.open24h?.value ? (
          <Text className="text-sm text-amber-800 dark:text-amber-300">
            {t('places.open24hHint')}
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
    </ScrollView>
  );
}
