import { FlatList, Text, View } from 'react-native';

import { useUrgentPlaces } from '@/api/hooks';
import { PlaceRow } from '@/components/place-row';
import { EmptyState, ErrorState, Notice, SkeletonList } from '@/components/states';
import { readsAsPlace, useExploreView } from '@/features/explore/explore-view';
import { useUserLocation } from '@/features/location/location-context';
import { useDebounced } from '@/lib/use-debounced';
import { useSettings } from '@/features/settings/settings-context';
import { formatCount, formatDistance } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

/** As on Explorar: wait for the typing to pause. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Urgencias: the nearest vet hospitals and 24-hour vets from the device's location (or where the
 * map was moved by hand, or the area the search box names), closest first, in Explorar's cards.
 * The closest is highlighted only while "Mi ubicación" is on and no searched area moved the list
 * (owner's rules). Most hours aren't confirmed yet, and each card says so.
 */
export default function UrgentScreen() {
  const { t } = useAppTranslation();
  const location = useUserLocation();
  // The search box of Explorar and Pet-friendly: a place it names moves Urgencias there.
  // A map moved by hand (or a tapped cluster) moves Urgencias' center there too (owner's rule).
  // A text the user said is a business name, not the place, doesn't move Urgencias.
  // Around a searched place, the radius the map gives it (owner's rule: Urgencias, the list and
  // the map show the same circle).
  const { nearMe, searchText, focus, placeChoice, shownArea, circleName } = useExploreView();
  const searched = useDebounced(searchText, SEARCH_DEBOUNCE_MS);
  const q = readsAsPlace(placeChoice, searched) === false ? '' : searched;
  const urgent = useUrgentPlaces(focus ?? location.coords, q, q ? shownArea?.radiusKm : undefined);
  const area = urgent.data?.area ?? null;
  const items = urgent.data?.items ?? [];
  // Measured from the user ("Mi ubicación" on, no searched area, map not moved): only then is the
  // first card highlighted and do distances read "0.7 km away" (owner's rules).
  const fromUser = nearMe && !area && !focus;
  // Named as the list or map last on screen names its circle, so both read the same place
  // (owner's rule, 2026-10-14); before either has shown, as the list would.
  const summaryArea =
    circleName ??
    (area
      ? area.municipality
        ? `${area.name}, ${area.municipality}`
        : area.name
      : (items[0]?.city ?? urgent.data?.nearestMunicipality ?? null));
  // Every urgent place in the circle, not only the URGENT_LIMIT cards shown.
  const total = urgent.data?.total ?? 0;
  const locale = useLocale();
  const { units, radiusKm } = useSettings();

  return (
    <View className="flex-1 bg-off-bg dark:bg-neutral-950">
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
            <PlaceRow
              place={item}
              selected={null}
              away={fromUser}
              highlight={fromUser && index === 0}
              urgent
            />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerClassName="p-4"
          ListHeaderComponent={
            // The same summary as Explorar's: around a searched area ("8 lugares a menos de 3 mi
            // de Xochimilco"), or around the user or a moved map, named by the closest place's
            // city ("7 lugares a menos de 5 km de Tlalnepantla de Baz").
            summaryArea && items.length > 0 ? (
              <Text
                testID="urgent-count"
                className="pb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-200"
              >
                {t('places.areaCount', {
                  count: total,
                  total: formatCount(total, locale),
                  distance: formatDistance(area?.radiusKm ?? radiusKm, locale, units),
                  area: summaryArea,
                })}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            // Named like the summary: the searched area, or the list's or map's city.
            <EmptyState
              title={
                summaryArea
                  ? t('urgent.noneIn', {
                      distance: formatDistance(area?.radiusKm ?? radiusKm, locale, units),
                      area: summaryArea,
                    })
                  : t('urgent.none')
              }
              hint={t('urgent.noneHint')}
            />
          }
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
