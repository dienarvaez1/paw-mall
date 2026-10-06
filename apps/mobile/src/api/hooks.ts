import {
  placeListResponseSchema,
  placeMapResponseSchema,
  placeSchema,
  urgentResponseSchema,
} from '@paw-mall/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { toKm } from '@/features/settings/radius';
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
  /** A radius the user set by zooming the map by hand; replaces the presets while set. */
  customRadiusKm: number | null = null,
) {
  const locale = useLocale();
  const settings = useSettings();
  const filters = usePlaceFilters();
  const presetAreaRadiusKm = useAreaRadiusKm();
  const radiusKm = customRadiusKm ?? settings.radiusKm;
  const areaRadiusKm = customRadiusKm ?? presetAreaRadiusKm;
  return useInfiniteQuery({
    queryKey: ['places', locale, radiusKm, filters, coords, category, name, nearMe, areaRadiusKm],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet(
        '/v1/places',
        {
          ...coords,
          radiusKm,
          category: category ?? undefined,
          q: name || undefined,
          areaRadiusKm: name ? areaRadiusKm : undefined,
          namesOnly: (name && nearMe) || undefined,
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
  customRadiusKm: number | null = null,
) {
  const locale = useLocale();
  const settings = useSettings();
  const filters = usePlaceFilters();
  const presetAreaRadiusKm = useAreaRadiusKm();
  const radiusKm = customRadiusKm ?? settings.radiusKm;
  const areaRadiusKm = customRadiusKm ?? presetAreaRadiusKm;
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
      name,
      nearMe,
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
          // The search box, as in the list (see usePlaces).
          q: name || undefined,
          areaRadiusKm: name ? areaRadiusKm : undefined,
          namesOnly: (name && nearMe) || undefined,
          ...filters,
        },
        locale,
        placeMapResponseSchema,
      );
    },
  });
}

export function usePlace(id: number) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['place', locale, id],
    queryFn: () => apiGet(`/v1/places/${id}`, {}, locale, placeSchema),
  });
}

/** "Open now" changes by the minute, so Urgencias refreshes while it's on screen. */
const URGENT_REFRESH_MS = 60 * 1000;

/** Urgencias: the nearest vet hospitals and 24-hour vets, open ones first. */
export function useUrgentPlaces(coords: Coords) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['urgent', locale, coords],
    queryFn: () => apiGet('/v1/places/urgent', { ...coords }, locale, urgentResponseSchema),
    staleTime: 0,
    refetchInterval: URGENT_REFRESH_MS,
  });
}
