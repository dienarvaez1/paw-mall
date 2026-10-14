import {
  type CategoryGroup,
  type Locale,
  areaSuggestResponseSchema,
  searchTokens,
  placeListResponseSchema,
  placeMapResponseSchema,
  placeSchema,
  urgentResponseSchema,
} from '@paw-mall/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { readsAsPlace, useExploreView } from '@/features/explore/explore-view';
import { useUserLocation } from '@/features/location/location-context';
import { startRadiusKm, toKm } from '@/features/settings/radius';
import { usePlaceFilters, useSettings } from '@/features/settings/settings-context';
import { useLocale } from '@/i18n/use-locale';
import type { ChipCategory } from '@/lib/categories';
import { useDebounced } from '@/lib/use-debounced';

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
 * user, nearest first, loaded page by page. `name` searches business names, unless the user
 * picked it from the place suggestions and said to search around that place (readsAsPlace): then
 * the search moves there within AREA_RADIUS. `nearMe` ("Mi ubicación") no longer changes how the
 * text is read. Every key includes the locale, so switching language refetches category names.
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
  // Business names only, unless the user picked a place and said to search around it.
  const namesOnly = name !== '' && !readsAsPlace(placeChoice, name);
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
  // Business names only, unless the user picked a place and said to search around it.
  const namesOnly = name !== '' && !readsAsPlace(placeChoice, name);
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

/** Wait after a keystroke before asking for suggestions, so fast typing asks once. */
const SUGGEST_DEBOUNCE_MS = 250;
/** Fewest letters before suggesting places (as the API). */
const MIN_SUGGEST_LETTERS = 3;

/**
 * Place names starting with the search box's text ("Puerto V" -> Puerto Vallarta), for the
 * suggestions under it; the nearest of a shared name, as the search would pick.
 */
export function useAreaSuggestions(text: string, enabled: boolean) {
  const locale = useLocale();
  const { coords } = useUserLocation();
  // Not trimmed at the end: "Puerto " (a finished word) suggests only names with more words.
  const typed = useDebounced(text.trimStart(), SUGGEST_DEBOUNCE_MS);
  const on = enabled && typed.trim().length >= MIN_SUGGEST_LETTERS;
  return useQuery({
    // Not keyed by position: the same text keeps its suggestions while the user moves.
    queryKey: ['area-suggestions', locale, typed],
    queryFn: () =>
      apiGet(
        '/v1/places/area-suggestions',
        { q: typed, ...coords },
        locale,
        areaSuggestResponseSchema,
      ),
    enabled: on,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
    select: (data) => (on ? data.suggestions : []),
  });
}

/** Most nearby businesses the suggestions look through. */
const BUSINESS_SUGGESTION_POOL = 20;

/**
 * Businesses near the user whose names, cities or states hold every typed word (the API's search,
 * stop words left out), as candidates for the search box's suggestions; the app then keeps only
 * those where each word starts a word (search-filter.ts).
 */
export function useBusinessSuggestions(text: string, group: CategoryGroup, enabled: boolean) {
  const locale = useLocale();
  const { coords } = useUserLocation();
  const { radiusKm } = useSettings();
  const filters = usePlaceFilters();
  const typed = useDebounced(searchTokens(text).join(' '), SUGGEST_DEBOUNCE_MS);
  const on = enabled && typed.length >= MIN_SUGGEST_LETTERS;
  return useQuery({
    queryKey: ['business-suggestions', locale, group, typed, coords, radiusKm, filters],
    queryFn: () =>
      apiGet(
        '/v1/places',
        {
          ...coords,
          radiusKm,
          group,
          q: typed,
          namesOnly: true,
          ...filters,
          pageSize: BUSINESS_SUGGESTION_POOL,
          page: 1,
        },
        locale,
        placeListResponseSchema,
      ),
    enabled: on,
    placeholderData: (previous) => previous,
    select: (data) => (on ? data.items : []),
  });
}
