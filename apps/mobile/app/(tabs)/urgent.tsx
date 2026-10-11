import type { Place } from '@paw-mall/shared';
import { Link } from 'expo-router';
import { FlatList, Linking, Pressable, Text, View } from 'react-native';

import { useUrgentPlaces } from '@/api/hooks';
import { Button } from '@/components/button';
import { OpenStatus } from '@/components/open-status';
import { CategoryLine, usePlaceName } from '@/components/place-row';
import { EmptyState, ErrorState, Notice, SkeletonList } from '@/components/states';
import { useExploreView } from '@/features/explore/explore-view';
import { useUserLocation } from '@/features/location/location-context';
import { useDebounced } from '@/lib/use-debounced';
import { useSettings } from '@/features/settings/settings-context';
import { formatCount, formatDistance } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { phoneUrl } from '@/lib/links';
import { useOpenDirections } from '@/lib/open-url';

/** As on Explorar: wait for the typing to pause. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Urgencias: the nearest vet hospitals and 24-hour vets from the device's location (or where the
 * map was moved by hand, or the area the search box names), closest first, each with call and directions up front. The closest is
 * highlighted only while "Mi ubicación" is on and no searched area moved the list (owner's
 * rules). Most hours aren't confirmed yet, and each card says so.
 */
export default function UrgentScreen() {
  const { t } = useAppTranslation();
  const location = useUserLocation();
  // The search box of Explorar and Pet-friendly: a place it names moves Urgencias there.
  // A map moved by hand (or a tapped cluster) moves Urgencias' center there too (owner's rule).
  const { nearMe, text, focus } = useExploreView();
  const urgent = useUrgentPlaces(
    focus ?? location.coords,
    useDebounced(text.trim(), SEARCH_DEBOUNCE_MS),
  );
  const area = urgent.data?.area ?? null;
  const items = urgent.data?.items ?? [];
  const summaryArea = area
    ? area.municipality
      ? `${area.name}, ${area.municipality}`
      : area.name
    : (items[0]?.city ?? null);
  const locale = useLocale();
  const { units, radiusKm } = useSettings();

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      {location.ready && location.source === 'fallback' ? (
        <Notice text={t('common.approximateLocation')} />
      ) : null}
      {urgent.isPending ? (
        <SkeletonList rows={3} />
      ) : urgent.isError ? (
        <ErrorState error={urgent.error} onRetry={() => void urgent.refetch()} />
      ) : (
        <FlatList
          data={urgent.data.items}
          keyExtractor={(place) => String(place.id)}
          renderItem={({ item, index }) => (
            <UrgentCard place={item} first={nearMe && !area && !focus && index === 0} />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerClassName="p-4"
          ListHeaderComponent={
            // The same summary as Explorar's: around a searched area ("8 lugares a menos de 3 mi
            // de Xochimilco"), or around the user or a moved map, named by the closest place's
            // city ("7 lugares a menos de 5 km de Tlalnepantla de Baz").
            summaryArea && items.length > 0 ? (
              <Text className="pb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                {t('places.areaCount', {
                  count: items.length,
                  total: formatCount(items.length, locale),
                  distance: formatDistance(area?.radiusKm ?? radiusKm, locale, units),
                  area: summaryArea,
                })}
              </Text>
            ) : null
          }
          ListEmptyComponent={<EmptyState title={t('urgent.none')} hint={t('urgent.noneHint')} />}
          ListFooterComponent={
            urgent.data.items.length > 0 ? (
              <Text className="pt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                {t('urgent.disclaimer')}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

function UrgentCard({ place, first }: { place: Place; first: boolean }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { units } = useSettings();
  const name = usePlaceName(place);
  const openDirections = useOpenDirections();
  return (
    <View
      className={`gap-2 rounded-2xl border p-4 ${
        first
          ? 'border-brand bg-teal-50 dark:bg-teal-950'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-white">{name}</Text>
        {place.distanceKm !== null ? (
          <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            {t('places.distanceKm', { distance: formatDistance(place.distanceKm, locale, units) })}
          </Text>
        ) : null}
      </View>
      <CategoryLine place={place} selected={null} />
      <OpenStatus place={place} />
      <Text className="text-sm text-neutral-500 dark:text-neutral-400" numberOfLines={2}>
        {place.address}
      </Text>
      <View className="flex-row gap-3 pt-1">
        {place.phone ? (
          <Button
            label={t('places.call')}
            accessibilityLabel={t('places.callPlace', { name })}
            onPress={() => void Linking.openURL(phoneUrl(place.phone as string))}
          />
        ) : null}
        <Button
          variant={place.phone ? 'secondary' : 'primary'}
          label={t('common.getDirections')}
          onPress={() => openDirections(place)}
        />
      </View>
      <Link href={{ pathname: '/place/[id]', params: { id: place.id } }} asChild>
        <Pressable
          accessibilityRole="link"
          className="min-h-11 items-center justify-center rounded-xl active:bg-neutral-100 dark:active:bg-neutral-800"
        >
          <Text className="text-base font-semibold text-teal-800 dark:text-teal-300">
            {place.openNow === null ? t('urgent.checkHours') : t('urgent.details')}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
