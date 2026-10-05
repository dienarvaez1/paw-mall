import type { Place } from '@paw-mall/shared';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useSettings } from '@/features/settings/settings-context';
import { formatDistance } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { type ChipCategory, pinColor } from '@/lib/categories';
import { placeLine } from '@/lib/place-line';

/** The place's name, or a translated label for businesses registered without one. */
export function usePlaceName(place: Pick<Place, 'name'>): string {
  const { t } = useAppTranslation();
  return place.name ?? t('places.unnamed');
}

/** The place's categories as a line ("Veterinaria · Estética para mascotas"). */
export function CategoryLine({ place, selected }: { place: Place; selected: ChipCategory }) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: pinColor(place, selected) }}
      />
      <Text className="flex-1 text-sm text-neutral-600 dark:text-neutral-300" numberOfLines={1}>
        {place.categories.map((c) => c.name).join(' · ')}
      </Text>
    </View>
  );
}

/** A place in a list. */
export function PlaceRow({ place, selected }: { place: Place; selected: ChipCategory }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { units } = useSettings();
  const name = usePlaceName(place);
  return (
    <Link href={{ pathname: '/place/[id]', params: { id: place.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        className="gap-1 px-4 py-3 active:bg-neutral-100 dark:active:bg-neutral-900"
      >
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-white">
            {name}
          </Text>
          {place.distanceKm !== null ? (
            <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              {t('places.distanceKm', {
                distance: formatDistance(place.distanceKm, locale, units),
              })}
            </Text>
          ) : null}
        </View>
        <CategoryLine place={place} selected={selected} />
        <Text className="text-sm text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
          {place.address}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
          {placeLine(place)}
        </Text>
      </Pressable>
    </Link>
  );
}
