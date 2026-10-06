import {
  placeListResponseSchema,
  placeMapResponseSchema,
  placeSchema,
  urgentResponseSchema,
} from '@paw-mall/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { usePlaceFilters, useSettings } from '@/features/settings/settings-context';
import { useLocale } from '@/i18n/use-locale';
import type { ChipCategory } from '@/lib/categories';

import { apiGet } from './client';

type Coords = { lat: number; lng: number };

const PLACES_PAGE_SIZE = 50;

/**
 * Places within the search radius chosen in Settings, nearest first, loaded page by page; `name`
 * searches by name, city or state. Every key includes the locale, so switching language refetches
 * category names.
 */
export function usePlaces(coords: Coords, category: ChipCategory, name = '') {
  const locale = useLocale();
  const { radiusKm } = useSettings();
  const filters = usePlaceFilters();
  return useInfiniteQuery({
    queryKey: ['places', locale, radiusKm, filters, coords, category, name],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet(
        '/v1/places',
        {
          ...coords,
          radiusKm,
          category: category ?? undefined,
          q: name || undefined,
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
export function usePlacesMap(area: MapArea | null, coords: Coords, category: ChipCategory) {
  const locale = useLocale();
  const { radiusKm } = useSettings();
  const filters = usePlaceFilters();
  return useQuery({
    queryKey: ['places-map', locale, filters, area, coords, radiusKm, category],
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
