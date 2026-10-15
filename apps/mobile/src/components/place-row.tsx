import type { Place } from '@paw-mall/shared';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, useColorScheme, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ICONS } from '@/components/icons';
import { OpenStatus } from '@/components/open-status';
import { usePolicySummary } from '@/features/pet-policy/policy-text';
import { useSettings } from '@/features/settings/settings-context';
import { formatDistance } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import {
  CATEGORY_COLORS,
  type ChipCategory,
  DEFAULT_CATEGORY_COLOR,
  orderedCategories,
  pinCategory,
  pinColor,
} from '@/lib/categories';
import { placeLine } from '@/lib/place-line';

/** The place's name, or a translated label for businesses registered without one. */
export function usePlaceName(place: Pick<Place, 'name'>): string {
  const { t } = useAppTranslation();
  return place.name ?? t('places.unnamed');
}

/**
 * The place's categories, each with its badge: the selected one first, and each other one on a
 * line of its own under it (owner's rules, 2026-10-15).
 */
export function CategoryLine({
  place,
  selected,
  small = false,
}: {
  place: Place;
  selected: ChipCategory;
  /** List rows: one point smaller (13 pt). */
  small?: boolean;
}) {
  const [first, ...others] = orderedCategories(place, selected);
  const text = `${small ? 'text-[13px]' : 'text-sm'} text-neutral-600 dark:text-neutral-300`;
  const badge = small ? 18 : 20;
  return (
    <View>
      <View className="flex-row items-center gap-2">
        <CategoryBadge
          slug={pinCategory(place, selected)}
          color={pinColor(place, selected)}
          size={badge}
        />
        <Text className={`flex-1 ${text}`} numberOfLines={1}>
          {first?.name ?? ''}
        </Text>
      </View>
      {others.map((category) => (
        // Each other category on a line of its own, with its own badge (owner's rule, 2026-10-15).
        <View key={category.slug} className="mt-0.5 flex-row items-center gap-2">
          <CategoryBadge
            slug={category.slug}
            color={CATEGORY_COLORS[category.slug] ?? DEFAULT_CATEGORY_COLOR}
            size={badge}
          />
          <Text className={`flex-1 ${text}`} numberOfLines={1}>
            {category.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A place in a list, in a bordered card; tapping it opens the place. Its distance reads "0.3 mi
 * away" with `away` (Explorar's "Mi ubicación" on: distances from the user) and just "0.3 mi"
 * otherwise (owner's rule). With `showPolicy` (pet-friendly mode), a line tells the pet policy, its
 * source and last confirmation, or that nobody has confirmed it yet. Small icons in the
 * bottom-right corner tell which contacts the place has: phone, website, social media (they
 * only tell; tapping anywhere opens the place). `highlight` marks the card (Urgencias' closest
 * place).
 */
export function PlaceRow({
  place,
  selected,
  away = true,
  showPolicy = false,
  highlight = false,
}: {
  place: Place;
  selected: ChipCategory;
  away?: boolean;
  showPolicy?: boolean;
  highlight?: boolean;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { units } = useSettings();
  const name = usePlaceName(place);
  const policy = usePolicySummary(showPolicy ? place.petPolicy : null);
  const scheme = useColorScheme();
  return (
    <Link href={{ pathname: '/place/[id]', params: { id: place.id } }} asChild>
      <Pressable
        testID="place-row"
        accessibilityRole="button"
        className={`gap-1 rounded-2xl border px-4 py-3 ${
          highlight
            ? 'border-brand bg-teal-50 active:bg-teal-100 dark:bg-teal-950 dark:active:bg-teal-900'
            : 'border-neutral-200 bg-white active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:active:bg-neutral-800'
        }`}
      >
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-[15px] font-semibold text-neutral-900 dark:text-white">
            {name}
          </Text>
          {place.distanceKm !== null ? (
            <Text className="text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
              {!away
                ? formatDistance(place.distanceKm, locale, units)
                : t('places.distanceKm', {
                    distance: formatDistance(place.distanceKm, locale, units),
                  })}
            </Text>
          ) : null}
        </View>
        <CategoryLine place={place} selected={selected} small />
        <Text className="text-[13px] text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
          {place.address}
        </Text>
        <Text className="text-[13px] text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
          {placeLine(place)}
        </Text>
        {policy ? (
          <Text
            className="text-[13px] font-medium text-teal-800 dark:text-teal-300"
            numberOfLines={2}
          >
            {policy}
          </Text>
        ) : showPolicy ? (
          <Text className="text-[13px] text-neutral-500 dark:text-neutral-400">
            {t('places.pets.ask.rowUnknown')}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <OpenStatus place={place} small />
          </View>
          {contactIcons(place).map((icon) => (
            <Image
              key={icon}
              source={ICONS[icon]}
              style={{ width: 16, height: 16 }}
              tintColor={scheme === 'dark' ? '#5eead4' : '#115e59'}
            />
          ))}
        </View>
      </Pressable>
    </Link>
  );
}

/** The contacts a place has, as list-row icons, in a fixed order. */
function contactIcons(place: Place): ('phone' | 'website' | 'social')[] {
  return [
    place.phone ? ('phone' as const) : null,
    place.website ? ('website' as const) : null,
    place.socialUrl ? ('social' as const) : null,
  ].filter((icon) => icon !== null);
}
