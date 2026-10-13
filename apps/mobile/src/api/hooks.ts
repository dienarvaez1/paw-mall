import {
  type CategoryGroup,
  type Locale,
  placeListResponseSchema,
  placeMapResponseSchema,
  placeSchema,
  urgentResponseSchema,
} from '@paw-mall/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { readsAsPlace, useExploreView } from '@/features/explore/explore-view';
import { startRadiusKm, toKm } from '@/features/settings/radius';
import { usePlaceFilters, useSettings } from '@/features/settings/settings-context';
import { useLocale } from '@/i18n/use-locale';
import type { ChipCategory } from '@/lib/categories';

import { apiGet } from './client';

type Coords = { lat: number; lng: number };

const PLACES_PAGE_SIZE = 50;

/** Around an area the search names ("Zócalo"): 5 km, or 3 mi for users who chose miles. */
const AREA_RADIUS = { km: 5, mi: 3 } as const;

export function useAreaRadiusKm(): number {
  const { units } = useSettings();
  return toKm(AREA_RADIUS[units], units);
}

/**
 * Places within the search radius (Ajustes, or the radius button on the list and the map) of the
 * user, nearest first, loaded page by page. With `nearMe` ("Mi ubicación" on), `name` searches
 * business names only. Without it, a `name` that names an area (a colonia, a city or a landmark
 * like the Zócalo) moves the search there within AREA_RADIUS; other text searches names, cities
 * and states. Every key includes the locale, so switching language refetches category names.
 */
export function usePlaces(
  coords: Coords,
  category: ChipCategory,
  name = '',
  nearMe = false,
  /** Only places whose pet policy takes pets (Pet-friendly decides when). */
  petFriendly = false,
  /** The tab's section: pet businesses (Explorar) or pet-friendly venues. */
  group?: CategoryGroup,
  /** With petFriendly: also venues without a pet policy yet. */
  withUnconfirmed = false,
) {
  const locale = useLocale();
  const settings = useSettings();
  const filters = usePlaceFilters(petFriendly, withUnconfirmed);
  const presetAreaRadiusKm = useAreaRadiusKm();
  const radiusKm = settings.radiusKm;
  // Around a searched area: the radius the user picked for it, else the preset (the API may
  // narrow a busy city to 3 mi).
  const { placeChoice, areaRadius } = useExploreView();
  const pickedKm = areaRadius && areaRadius.text === name ? areaRadius.km : null;
  const areaRadiusKm = pickedKm ?? presetAreaRadiusKm;
  // Business names only: "Mi ubicación" on, or the user said the place-like text is a name.
  const asPlace = readsAsPlace(placeChoice, name);
  const namesOnly = name !== '' && (asPlace === false || (nearMe && asPlace !== true));
  return useInfiniteQuery({
    queryKey: [
      'places',
      locale,
      radiusKm,
      filters,
      coords,
      category,
      group,
      name,
      namesOnly,
      areaRadiusKm,
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet(
        '/v1/places',
        {
          ...coords,
          radiusKm,
          category: category ?? undefined,
          group,
          q: name || undefined,
          areaRadiusKm: name ? areaRadiusKm : undefined,
          namesOnly: namesOnly || undefined,
          fixedAreaRadius: (name && pickedKm !== null) || undefined,
          // A busy city's circle in the user's units, so the radius button shows it as a preset.
          cityRadiusKm: name ? startRadiusKm(settings.units) : undefined,
          ...filters,
          pageSize: PLACES_PAGE_SIZE,
          page: pageParam,
        },
        locale,
        placeListResponseSchema,
      ),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

export type MapArea = { minLng: number; minLat: number; maxLng: number; maxLat: number };

/**
 * Places in the visible map area and within the Settings radius of the user (the circle on the
 * map), one by one or as clusters when too many are in view.
 */
export function usePlacesMap(
  area: MapArea | null,
  coords: Coords,
  category: ChipCategory,
  name = '',
  nearMe = false,
  petFriendly = false,
  group?: CategoryGroup,
  /** With petFriendly: also venues without a pet policy yet. */
  withUnconfirmed = false,
) {
  const locale = useLocale();
  const settings = useSettings();
  const filters = usePlaceFilters(petFriendly, withUnconfirmed);
  const presetAreaRadiusKm = useAreaRadiusKm();
  const radiusKm = settings.radiusKm;
  // Around a searched area: the radius the user picked for it, else the preset (the API may
  // narrow a busy city to 3 mi).
  const { placeChoice, areaRadius } = useExploreView();
  const pickedKm = areaRadius && areaRadius.text === name ? areaRadius.km : null;
  const areaRadiusKm = pickedKm ?? presetAreaRadiusKm;
  // Business names only: "Mi ubicación" on, or the user said the place-like text is a name.
  const asPlace = readsAsPlace(placeChoice, name);
  const namesOnly = name !== '' && (asPlace === false || (nearMe && asPlace !== true));
  return useQuery({
    queryKey: [
      'places-map',
      locale,
      filters,
      area,
      coords,
      radiusKm,
      areaRadiusKm,
      category,
      group,
      name,
      namesOnly,
    ],
    enabled: area !== null,
    placeholderData: (previous) => previous,
    queryFn: () => {
      const { minLng, minLat, maxLng, maxLat } = area as MapArea;
      return apiGet(
        '/v1/places/map',
        {
          bbox: [minLng, minLat, maxLng, maxLat].map((n) => n.toFixed(5)).join(','),
          ...coords,
          radiusKm,
          category: category ?? undefined,
          group,
          // The search box, as in the list (see usePlaces).
          q: name || undefined,
          areaRadiusKm: name ? areaRadiusKm : undefined,
          namesOnly: namesOnly || undefined,
          fixedAreaRadius: (name && pickedKm !== null) || undefined,
          // A busy city's circle in the user's units, so the radius button shows it as a preset.
          cityRadiusKm: name ? startRadiusKm(settings.units) : undefined,
          ...filters,
        },
        locale,
        placeMapResponseSchema,
      );
    },
  });
}

/** One place's page; Favoritos reads its saved places with the same query. */
export function placeQuery(id: number, locale: Locale) {
  return {
    queryKey: ['place', locale, id],
    queryFn: () => apiGet(`/v1/places/${id}`, {}, locale, placeSchema),
  };
}

export function usePlace(id: number) {
  const locale = useLocale();
  return useQuery(placeQuery(id, locale));
}

/** "Open now" changes by the minute, so Urgencias refreshes while it's on screen. */
const URGENT_REFRESH_MS = 60 * 1000;

/**
 * Urgencias: the nearest vet hospitals and 24-hour vets, within the radius set on the Explorar and
 * Pet-friendly maps and with the Ajustes place switches; around the area the search box names
 * ("Xochimilco"), if it does, else around the user.
 */
export function useUrgentPlaces(coords: Coords, q = '') {
  const locale = useLocale();
  const { radiusKm } = useSettings();
  const { withPhone, withWebsite, withSocial, named, openNow } = usePlaceFilters();
  const filters = { withPhone, withWebsite, withSocial, named, openNow };
  return useQuery({
    queryKey: ['urgent', locale, coords, radiusKm, filters, q],
    queryFn: () =>
      apiGet(
        '/v1/places/urgent',
        { ...coords, radiusKm, ...filters, q: q || undefined },
        locale,
        urgentResponseSchema,
      ),
    staleTime: 0,
    refetchInterval: URGENT_REFRESH_MS,
  });
}
