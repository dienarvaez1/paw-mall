import { type CategoryGroup, MAX_RADIUS_KM, type Place, type PlaceCluster } from '@paw-mall/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import {
  type MapArea,
  useAreaSuggestions,
  useBusinessSuggestions,
  usePlaces,
  usePlacesMap,
} from '@/api/hooks';
import { CategoryBadge } from '@/components/category-badge';
import { CategoryPin } from '@/components/category-pin';
import { ICONS } from '@/components/icons';
import { PlaceRow, usePlaceName } from '@/components/place-row';
import { BUTTON_HIT_SLOP } from '@/components/button';
import { EmptyState, ErrorState, Notice, SkeletonList } from '@/components/states';
import { useUserLocation } from '@/features/location/location-context';
import {
  coveringRadiusKm,
  isRadiusOption,
  nextRadiusKm,
  minRadiusKm,
} from '@/features/settings/radius';
import { useSettings } from '@/features/settings/settings-context';
import { SearchInput } from '@/components/search-input';
import { formatCount, formatDistance, formatMonthYear } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { usePetProfileLabel, usePolicySummary } from '@/features/pet-policy/policy-text';
import {
  CATEGORY_COLORS,
  CHIP_CATEGORIES,
  EXPLORE_CHIPS,
  PET_FRIENDLY_CHIPS,
  type ChipCategory,
  isPetFilterCategory,
  isPetFriendlyCategory,
  orderedCategories,
} from '@/lib/categories';
import { uniqueById } from '@/lib/unique';
import { circleForCluster, isAwayFrom, radiusForRegion, regionForRadius } from '@/lib/map-region';
import { MAP_TYPE, MAPS_AVAILABLE } from '@/lib/map-type';
import { useScreenFocused } from '@/lib/use-screen-focused';

import { nextPinLimit } from './pin-limit';
import { useDebounced } from '@/lib/use-debounced';
import { useDismissKeyboardOnBlur } from '@/lib/use-dismiss-keyboard-on-blur';
import { useOnWake } from '@/lib/use-on-wake';

import { CLUSTER_FONT_SIZE, clusterSize } from './cluster-size';
import { useExploreView } from './explore-view';
import { useConfirmedSearchFit } from './search-fit';
import { AutocompleteList, useAutocomplete } from './autocomplete-search';
import { useSuggestionItems } from './suggestion-items';

// Mapa first, then Lista (owner's order).
const MODES = ['map', 'list'] as const;
/** Wait for the map to settle before loading its places (keeps panning cheap). */
const MAP_SETTLE_MS = 400;
const SEARCH_DEBOUNCE_MS = 300;
/**
 * Cluster bubbles: the buttons' turquoise (bg-paw, tailwind.config.js) with dark teal numbers
 * (teal-950), owner's choice. Keep in step with the paw color.
 */
const CLUSTER_COLORS = { fill: '#46d2d1', text: '#042f2e' };
/** How long a cluster's marker redraws before it freezes (see ClusterMarker). */
const CLUSTER_SNAPSHOT_MS = 500;
// Explorar's controls (Lista/Mapa, Mi ubicación, the radius button, the selected chip) use the
// logo's turquoise, lightened, when on: bg-paw (#46d2d1) with text-teal-950 (#042f2e).
const ON_TEXT = '#042f2e';
// Off, they look like the radius button after zooming by hand: the `off` colors (tailwind.config.js)
// with amber-900 (dark: amber-200) labels.
const OFF_TEXT_LIGHT = '#78350f';
const OFF_TEXT_DARK = '#fde68a';
/** How long the map takes to zoom to a new radius. */
const MAP_FIT_MS = 500;
/**
 * A region change counts as the user's own while a finger is on the map or this soon after it
 * lifts (a flick keeps gliding), unless the app itself is moving the map.
 */
const HAND_MOVE_GRACE_MS = 2500;
/** Extra time after an automatic move during which region changes are still the app's own. */
const AUTO_MOVE_GRACE_MS = 400;

/**
 * Two radii read from the map are the same zoom: within 5% (at least 0.05 km). The map rounds the
 * view to the screen's shape, so a fitted circle never reads back exactly.
 */
function sameRadius(aKm: number, bKm: number): boolean {
  return Math.abs(aKm - bKm) < Math.max(0.05, 0.05 * Math.max(aKm, bKm));
}
/** The radius circle: a lime border (lime-500 / lime-400, owner's choice), lightly teal-filled. */
const RADIUS_COLORS = {
  light: { stroke: '#84cc16', fill: 'rgba(15, 118, 110, 0.10)' },
  dark: { stroke: '#a3e635', fill: 'rgba(45, 212, 191, 0.10)' },
};

/**
 * Explorar (pet businesses) and Pet-friendly (restaurants to parks): the same search, list and
 * map, each with its own category chips.
 */
export function ExploreScreen({ section }: { section: CategoryGroup }) {
  const { t } = useAppTranslation();
  const router = useRouter();
  const location = useUserLocation();
  // Mapa/Lista, "Mi ubicación", the search text and the circle's center are shared with the
  // other tab, start on the map around the user and go back there on wake unless a search is
  // showing (explore-view.tsx).
  // Mi ubicación on: business names around the user; off: the search text names an area.
  // The circle's center (focus) is a tapped cluster or a hand pan, until "Mi ubicación" brings
  // it back to the user.
  const {
    mode,
    setMode,
    nearMe,
    setNearMe,
    text,
    setText,
    searchText,
    choosePlace,
    submitSearch,
    requestLocate,
    placeChoice,
    focus,
    setFocus,
  } = useExploreView();
  // Autocomplete while typing, until a place is picked or the place question is answered for this
  // text: place names and businesses nearby, matching every typed word in any order.
  const [typing, setTyping] = useState(false);
  const decided = placeChoice !== null && placeChoice.text === text.trim();
  const areaSuggestions = useAreaSuggestions(text, typing && !decided);
  const businessSuggestions = useBusinessSuggestions(text, section, typing && !decided);
  const suggestionItems = useSuggestionItems(areaSuggestions.data, businessSuggestions.data);
  const autocomplete = useAutocomplete({
    items: suggestionItems,
    value: text,
    suggest: !decided,
    onTypingChange: setTyping,
  });
  const [suggestionsTop, setSuggestionsTop] = useState(0);
  // The one screen serves both tabs; each keeps its own chip (their chips differ).
  const [categories, setCategories] = useState<Record<CategoryGroup, ChipCategory>>({
    pet_business: null,
    pet_friendly: null,
  });
  const category = categories[section];
  const setCategory = (next: ChipCategory) =>
    setCategories((current) => ({ ...current, [section]: next }));
  // Ajustes has the last word on the radius (owner's rule): the radius button, a zoom by hand
  // (exactly as zoomed) and a tapped cluster all save their radius there.
  const name = useDebounced(searchText, SEARCH_DEBOUNCE_MS);
  // Pet-friendly searches show places that take pets; "Buscar también en lugares sin confirmar"
  // widens the current search to venues nobody has answered for yet (to ask on their page).
  // When no confirmed place matches, the search widens by itself (`auto`), with a notice.
  const [widenedFor, setWidenedFor] = useState<{ name: string; auto: boolean } | null>(null);
  const includeUnconfirmed = name !== '' && widenedFor?.name === name;
  // Pet-friendly "Todos", Restaurantes, Cafés and Hospedaje: only places whose pet policy takes
  // pets, narrowed by the pet profile. Museos and Parques list every place, including a no.
  const petFriendly =
    section === 'pet_friendly' && (category === null || isPetFilterCategory(category));
  // Ajustes "Solo lugares confirmados" off, or a widened search: unanswered venues too.
  const { onlyConfirmedPetPlaces, units, setRadiusKm } = useSettings();
  const withUnconfirmed = petFriendly && (!onlyConfirmedPetPlaces || includeUnconfirmed);
  useDismissKeyboardOnBlur();

  // Map mode: the map fills the screen and these controls float over it (owner's rule); the
  // place count sits at the map's bottom.
  const floating = mode === 'map';
  return (
    <View className="flex-1 bg-off-bg dark:bg-neutral-950">
      <View
        pointerEvents="box-none"
        className={floating ? 'absolute left-0 right-0 top-0 z-10' : ''}
      >
        <View
          pointerEvents="box-none"
          className="px-4 pt-3"
          // Where the suggestions start: the box's bottom (this row is at the page's top).
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setSuggestionsTop(y + height + 4);
          }}
        >
          <SearchInput
            floating={floating}
            value={text}
            onChangeText={setText}
            placeholder={t(nearMe ? 'places.searchPlaceholderNearMe' : 'places.searchPlaceholder')}
            clearLabel={t('places.clearSearch')}
            onSubmit={submitSearch}
            {...autocomplete.inputProps}
          />
        </View>
        <View pointerEvents="box-none" className="flex-row gap-2 px-4 pt-3">
          {MODES.map((value) => (
            <Pressable
              key={value}
              testID={`mode-${value}`}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === value }}
              onPress={() => {
                Keyboard.dismiss();
                setMode(value);
              }}
              hitSlop={BUTTON_HIT_SLOP}
              className={`min-h-[35px] flex-1 items-center justify-center rounded-xl border ${
                mode === value
                  ? 'border-paw bg-paw'
                  : 'border-off-border bg-off-bg dark:bg-off-bg-dark'
              }`}
            >
              <Text
                className={`text-[13px] font-semibold ${
                  mode === value ? 'text-teal-950' : 'text-amber-900 dark:text-amber-200'
                }`}
              >
                {value === 'list' ? t('places.showList') : t('places.showMap')}
              </Text>
            </Pressable>
          ))}
          <NearMeButton
            nearMe={nearMe}
            onPress={() => {
              // A switch the user can flip by hand (owner's rule, 2026-10-13): on -> off leaves the
              // search and the map as they are; off -> on starts over around the user: the search
              // box empties, the radius goes to the smallest preset and the map zooms to it.
              if (nearMe) {
                setNearMe(false);
                return;
              }
              setFocus(null);
              setText('');
              setRadiusKm(minRadiusKm(units));
              setNearMe(true);
              requestLocate();
            }}
          />
          {/* The same row in both modes, so Lista and Mapa never resize. */}
          <RadiusButton className="min-h-[35px]" />
        </View>
        <View
          pointerEvents="box-none"
          className={floating ? '' : 'border-b border-neutral-200 dark:border-neutral-800'}
        >
          <CategoryChips
            chips={section === 'pet_friendly' ? PET_FRIENDLY_CHIPS : EXPLORE_CHIPS}
            selected={category}
            onSelect={setCategory}
          />
          {section === 'pet_friendly' ? <PetProfileLine floating={floating} /> : null}
        </View>
        {location.ready && location.source === 'fallback' ? (
          <Notice text={t('common.approximateLocation')} />
        ) : null}
      </View>
      {mode === 'list' ? (
        <PlacesList
          name={name}
          category={category}
          nearMe={nearMe}
          petFriendly={petFriendly}
          group={section}
          withUnconfirmed={withUnconfirmed}
          focus={focus}
          widened={includeUnconfirmed ? (widenedFor?.auto ? 'auto' : 'manual') : null}
          onWiden={
            name !== '' && petFriendly && !withUnconfirmed
              ? (auto) => setWidenedFor({ name, auto })
              : undefined
          }
        />
      ) : !MAPS_AVAILABLE ? (
        // Centered, clear of the controls floating at the top.
        <View className="flex-1 justify-center">
          <EmptyState title={t('places.mapUnavailable')} hint={t('places.mapUnavailableHint')} />
        </View>
      ) : (
        <PlacesMap
          category={category}
          name={name}
          nearMe={nearMe}
          petFriendly={petFriendly}
          group={section}
          withUnconfirmed={withUnconfirmed}
          focus={focus}
          onMoveCircle={setFocus}
          onLeaveMyLocation={() => setNearMe(false)}
        />
      )}
      {autocomplete.open ? (
        <AutocompleteList
          results={autocomplete.results}
          top={suggestionsTop}
          onSelect={(item) => {
            // A place: search around it. A business: open its page.
            if (item.kind === 'area') choosePlace(item.area);
            else router.push({ pathname: '/place/[id]', params: { id: item.placeId } });
          }}
        />
      ) : null}
    </View>
  );
}

/** One chip per category of the section; the list and the map show only the selected one. */
function CategoryChips({
  chips,
  selected,
  onSelect,
}: {
  chips: readonly ChipCategory[];
  selected: ChipCategory;
  onSelect: (category: ChipCategory) => void;
}) {
  const { t } = useAppTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t('places.categoriesLabel')}
      // Its own height: a ScrollView grows and shrinks by default, which the list would squeeze.
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerClassName="gap-2 px-4 pb-2 pt-3"
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((slug) => {
        const active = selected === slug;
        const color = slug ? CATEGORY_COLORS[slug] : undefined;
        return (
          <Pressable
            key={slug ?? 'all'}
            testID={`chip-${slug ?? 'all'}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onSelect(slug)}
            hitSlop={BUTTON_HIT_SLOP}
            className={`min-h-8 flex-row items-center gap-1.5 rounded-full border px-3 ${
              active ? 'border-paw bg-paw' : 'border-off-border bg-off-bg dark:bg-off-bg-dark'
            }`}
          >
            {slug && color ? <CategoryBadge slug={slug} color={color} size={18} /> : null}
            <Text
              className={`text-xs font-semibold ${
                active ? 'text-teal-950' : 'text-amber-900 dark:text-amber-200'
              }`}
            >
              {t(`places.chips.${slug ?? 'all'}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PlacesList({
  name,
  category,
  nearMe,
  petFriendly,
  group,
  withUnconfirmed,
  focus,
  widened,
  onWiden,
}: {
  name: string;
  category: ChipCategory;
  nearMe: boolean;
  petFriendly: boolean;
  group: CategoryGroup;
  withUnconfirmed: boolean;
  /** A tapped cluster's center, which replaces the user's location as the circle's center. */
  focus: { lat: number; lng: number } | null;
  /** Pet-friendly search widened to unanswered venues: by the user, or because none matched. */
  widened: 'auto' | 'manual' | null;
  /** Pet-friendly search: widen it to venues nobody has answered for yet. */
  onWiden?: (auto: boolean) => void;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { units, radiusKm, onlyOpenNow } = useSettings();
  const location = useUserLocation();
  const places = usePlaces(
    focus ?? location.coords,
    category,
    name,
    nearMe,
    petFriendly,
    group,
    withUnconfirmed,
  );
  const petMode = petFriendly || isPetFriendlyCategory(category);
  const area = places.data?.pages[0]?.area ?? null;
  // The radius button shows and changes this area's radius while it's shown.
  const { setShownArea } = useExploreView();
  useEffect(() => {
    if (places.data) setShownArea(area);
  }, [places.data, area, setShownArea]);
  useConfirmedSearchFit({
    section: group,
    coords: focus ?? location.coords,
    name,
    ready: places.data !== undefined && !places.isPlaceholderData && !places.isFetching,
    area,
    radiusKm: area ? area.radiusKm : radiusKm,
    reach: places.data?.pages[0],
  });
  const items = useMemo(
    () => uniqueById(places.data?.pages.flatMap((page) => page.items) ?? []),
    [places.data],
  );
  const total = places.data?.pages[0]?.total ?? 0;
  // No place that takes pets matches the search: show unanswered venues instead, with a notice.
  const noConfirmedMatch = onWiden !== undefined && places.isSuccess && total === 0;
  useEffect(() => {
    if (noConfirmedMatch) onWiden?.(true);
  }, [noConfirmedMatch, onWiden]);
  // Area searches use 5 km (3 mi); everything around the user uses the shared radius.
  const distance = formatDistance(area ? area.radiusKm : radiusKm, locale, units);
  // The list is nearest first: its first place's city names the circle (Urgencias names it too,
  // from the tab on screen only).
  const nearestCity =
    places.data?.pages[0]?.items[0]?.city ?? places.data?.pages[0]?.nearestMunicipality ?? null;
  const summaryArea = area
    ? area.municipality
      ? `${area.name}, ${area.municipality}`
      : area.name
    : nearestCity;
  const { setCircleName } = useExploreView();
  const focused = useScreenFocused();
  const listLoaded = places.data !== undefined;
  useEffect(() => {
    if (focused && listLoaded) setCircleName(summaryArea);
  }, [focused, listLoaded, summaryArea, setCircleName]);

  if (places.isPending) return <SkeletonList />;
  if (places.isError)
    return <ErrorState error={places.error} onRetry={() => void places.refetch()} />;

  // The summary stays put above the list while it scrolls: "69 lugares a menos de 5 km de
  // Tlaxcala", or around the user (or a moved circle) named by the nearest place's city: "1,237
  // lugares a menos de 5 km de Coyoacán" (the list is nearest first).
  const summary = summaryArea
    ? t('places.areaCount', {
        count: total,
        total: formatCount(total, locale),
        distance,
        area: summaryArea,
      })
    : t('places.listCount', { count: total, total: formatCount(total, locale), distance });
  // A keyword in the search picked the category ("tlaxcala vet"): say so up front, unless a chip
  // is already showing it.
  const searchCategory = places.data?.pages[0]?.searchCategory ?? null;
  const chipSlug = searchCategory as Exclude<ChipCategory, null> | null;
  const shownSummary =
    chipSlug && !category && (CHIP_CATEGORIES as readonly ChipCategory[]).includes(chipSlug)
      ? t('places.categorySummary', { category: t(`places.chips.${chipSlug}`), summary })
      : summary;

  return (
    <View className="flex-1">
      <Text
        accessibilityRole="summary"
        className="border-b border-neutral-100 px-4 py-2 text-sm font-bold text-neutral-900 dark:border-neutral-900 dark:text-white"
      >
        {shownSummary}
      </Text>
      {onWiden ? <UnconfirmedLink onPress={() => onWiden(false)} /> : null}
      {widened === 'auto' ? <Notice text={t('places.widenedAuto', { query: name })} /> : null}
      <FlatList
        data={items}
        keyExtractor={(place) => String(place.id)}
        renderItem={({ item }) => (
          <PlaceRow place={item} selected={category} away={nearMe} showPolicy={petMode} />
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerClassName="p-4"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (places.hasNextPage && !places.isFetchingNextPage) void places.fetchNextPage();
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          // Named where the circle is (the searched area, or the municipality nearest a moved or
          // user's circle; owner's rule, 2026-10-14).
          name ? (
            <EmptyState
              title={
                summaryArea
                  ? t('places.noMatchesNearbyIn', { query: name, distance, area: summaryArea })
                  : t('places.noMatchesNearby', { query: name, distance })
              }
              hint={t('places.noMatchesHint')}
            />
          ) : petMode ? (
            <EmptyState
              title={
                summaryArea
                  ? t('places.noPetFriendlyPlacesIn', { distance, area: summaryArea })
                  : t('places.noPetFriendlyPlaces', { distance })
              }
              hint={t('places.noPetFriendlyPlacesHint')}
            />
          ) : onlyOpenNow ? (
            <EmptyState
              title={
                summaryArea
                  ? t('places.noOpenPlacesIn', { distance, area: summaryArea })
                  : t('places.noOpenPlaces', { distance })
              }
              hint={t('places.noOpenPlacesHint')}
            />
          ) : (
            <EmptyState
              title={
                summaryArea
                  ? t('places.noPlacesIn', { distance, area: summaryArea })
                  : t('places.noPlaces', { distance })
              }
              hint={t('places.noPlacesHint')}
            />
          )
        }
        ListFooterComponent={
          <>
            {places.isFetchingNextPage ? <SkeletonList rows={2} /> : null}
            <SourceNote places={items} />
          </>
        }
      />
    </View>
  );
}

function PlacesMap({
  category,
  name,
  nearMe,
  petFriendly,
  group,
  withUnconfirmed,
  focus,
  onMoveCircle,
  onLeaveMyLocation,
}: {
  category: ChipCategory;
  name: string;
  nearMe: boolean;
  petFriendly: boolean;
  group: CategoryGroup;
  withUnconfirmed: boolean;
  focus: { lat: number; lng: number } | null;
  /**
   * The search circle moves: to a tapped cluster's center (its radius goes to Ajustes), or to the
   * map's center after a pan by hand.
   */
  onMoveCircle: (center: { lat: number; lng: number }) => void;
  /** The user moved the map away from their location by hand: "Mi ubicación" turns off. */
  onLeaveMyLocation: () => void;
}) {
  const { t } = useAppTranslation();
  const { radiusKm, setRadiusKm, mapPinLimit, setMapPinLimit } = useSettings();
  const locale = useLocale();
  const router = useRouter();
  const location = useUserLocation();
  const scheme = useColorScheme();
  // Satellite (with street names) or the muted map; for this visit only.
  // Opens showing the whole search radius from Settings, and refits when the radius or the user's
  // location changes (the tab stays mounted while Settings changes the radius).
  const mapRef = useRef<MapView>(null);
  // Apple Maps (iOS) never tells whether a region change came from a gesture (react-native-maps
  // sends isGesture only with Google Maps), so the app tells its own moves apart: every automatic
  // move goes through moveMap, and a finger on the map marks the rest as the user's.
  const autoMoveUntil = useRef(0);
  const touch = useRef({ down: false, liftedAt: 0 });
  // Where the last automatic move went: a map busy drawing pins can report the end of that move
  // late, and it must still not count as the user's zoom (it would save an off-preset radius).
  const autoTarget = useRef<Region | null>(null);
  // Counts the app's own moves, so the area shown is read again after each (see readShownArea).
  const [autoMoves, setAutoMoves] = useState(0);
  const moveMap = useCallback((region: Region) => {
    autoMoveUntil.current = Date.now() + MAP_FIT_MS + AUTO_MOVE_GRACE_MS;
    autoTarget.current = region;
    mapRef.current?.animateToRegion(region, MAP_FIT_MS);
    setAutoMoves((n) => n + 1);
  }, []);
  const movedByHand = useCallback((isGesture: boolean | undefined, next: Region) => {
    const now = Date.now();
    if (now < autoMoveUntil.current) return false;
    const target = autoTarget.current;
    if (
      target &&
      !isAwayFrom(next, { lat: target.latitude, lng: target.longitude }) &&
      sameRadius(radiusForRegion(next, MAX_RADIUS_KM), radiusForRegion(target, MAX_RADIUS_KM))
    ) {
      return false;
    }
    return (
      isGesture === true || touch.current.down || now - touch.current.liftedAt < HAND_MOVE_GRACE_MS
    );
  }, []);
  // One map for both tabs (owner's rule): its view, rotation and satellite switch are simply the
  // same; only the places on it change with the tab.
  const { satellite, setSatellite, locateRequest } = useExploreView();
  const initialRegion: Region = regionForRadius(focus ?? location.coords, radiusKm);
  // The compass needle follows the map's rotation; tapping it turns the map north-up again.
  const [heading, setHeading] = useState(0);
  // The circle the view is fitted to. Its radius and center are shared by both tabs' maps (the
  // radius in Ajustes, the center in explore-view.tsx), so a zoom, pan or cluster tap on one map
  // refits the other; the map that made the change records it here first and doesn't move.
  const { lat: fitLat, lng: fitLng } = focus ?? location.coords;
  const fitted = useRef({ radiusKm, lat: fitLat, lng: fitLng });
  // While a searched area is shown, its circle has its own radius: don't fly back to the user.
  const showingArea = useRef(false);
  useEffect(() => {
    const last = fitted.current;
    if (last.radiusKm === radiusKm && last.lat === fitLat && last.lng === fitLng) {
      return;
    }
    fitted.current = { radiusKm, lat: fitLat, lng: fitLng };
    if (showingArea.current) return;
    moveMap(regionForRadius({ lat: fitLat, lng: fitLng }, radiusKm));
  }, [radiusKm, fitLat, fitLng, moveMap]);
  // The location button (on or already on): read the device's position again and fly back to it,
  // zoomed to the smallest preset radius around it.
  const { refresh } = location;
  const { units } = useSettings();
  useEffect(() => {
    if (locateRequest === 0) return;
    void refresh().then((coords) => moveMap(regionForRadius(coords, minRadiusKm(units))));
    // Only a new tap flies the map; a units change alone doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateRequest]);
  // A zoom or pan by hand: the radius (exactly as zoomed) goes to Ajustes and the center to the
  // shared circle, recorded as fitted so this map stays put while the other one follows.
  const saveCircle = useCallback(
    (nextKm: number, center: { lat: number; lng: number } | null) => {
      fitted.current = { ...fitted.current, ...center, radiusKm: nextKm };
      if (Math.abs(nextKm - radiusKm) >= 1e-6) setRadiusKm(nextKm);
      if (center) onMoveCircle(center);
    },
    [radiusKm, setRadiusKm, onMoveCircle],
  );
  // Back from the background: read the position again and fly back to the user, unless a search
  // is showing (it comes back as it was).
  useOnWake(() => {
    // Back to the user only while "Mi ubicación" is on and nothing is searched.
    if (name || !nearMe) return;
    void refresh().then((coords) => moveMap(regionForRadius(coords, radiusKm)));
  });
  const [region, setRegion] = useState<Region>(initialRegion);
  const [area, setArea] = useState<MapArea | null>(null);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setArea({
          minLng: region.longitude - region.longitudeDelta / 2,
          minLat: region.latitude - region.latitudeDelta / 2,
          maxLng: region.longitude + region.longitudeDelta / 2,
          maxLat: region.latitude + region.latitudeDelta / 2,
        }),
      MAP_SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [region]);

  // Places inside the radius circle: up to 200 one by one; with more in view, clusters (counting
  // only places inside the circle) that zoom in when tapped.
  const center = focus ?? location.coords;
  const places = usePlacesMap(
    area,
    center,
    category,
    name,
    nearMe,
    petFriendly,
    group,
    withUnconfirmed,
  );
  const petMode = petFriendly || isPetFriendlyCategory(category);
  // A searched area ("Zócalo") moves the circle there with its own radius; otherwise the circle is
  // the user's radius around the user.
  const searchedArea = places.data?.area ?? null;
  const { setShownArea, setAreaRadius, leaveArea, setCircleName } = useExploreView();
  useEffect(() => {
    if (places.data) setShownArea(searchedArea);
  }, [places.data, searchedArea, setShownArea]);
  // The name under the map (MapCountLegend), shared only by the tab on screen: both tabs keep a
  // map, and the hidden one's nearest place is of the other kind.
  const focused = useScreenFocused();
  const mapName = searchedArea?.name ?? places.data?.nearestCity ?? null;
  useEffect(() => {
    if (focused && places.data) setCircleName(mapName);
  }, [focused, places.data, mapName, setCircleName]);
  const circle = searchedArea
    ? { center: searchedArea.location, radiusKm: searchedArea.radiusKm }
    : { center, radiusKm };
  useConfirmedSearchFit({
    section: group,
    coords: center,
    name,
    ready: places.data !== undefined && !places.isPlaceholderData && !places.isFetching,
    area: searchedArea,
    radiusKm: circle.radiusKm,
    reach: places.data,
  });
  // Fly to a newly searched area, and back to the user when the search no longer names one.
  const shownArea = useRef<string | null>(null);
  const loaded = places.data !== undefined;
  const { lat: centerLat, lng: centerLng } = circle.center;
  const circleKm = circle.radiusKm;
  // By place and radius (the radius button refits the area's circle); a zoom by hand records its
  // own key first, so it doesn't fly the map anywhere.
  const areaKey = searchedArea ? `${centerLat},${centerLng},${circleKm}` : null;
  useEffect(() => {
    if (!loaded || areaKey === shownArea.current) return;
    shownArea.current = areaKey;
    showingArea.current = areaKey !== null;
    moveMap(regionForRadius({ lat: centerLat, lng: centerLng }, circleKm));
  }, [loaded, areaKey, centerLat, centerLng, circleKm, moveMap]);
  const items = places.data?.kind === 'places' ? places.data.items : [];
  const clusters = places.data?.kind === 'clusters' ? places.data.clusters : [];
  const fitCircle = () => moveMap(regionForRadius(circle.center, circle.radiusKm));
  // getCamera() answers asynchronously; when the map closes first (e.g. switching to the list)
  // the native view is gone, so the answer is ignored and its error swallowed.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // The places are asked for the area in `region`, which the map reports after each move. iOS
  // doesn't always report the app's own moves (opening on a later initialRegion, a jump to the
  // other tab's view, a fly to a searched place), which left the circle and its places off the
  // screen; so after each of them, and when the map is ready, read the area actually shown.
  const readShownArea = useCallback(() => {
    mapRef.current
      ?.getMapBoundaries()
      .then(({ northEast, southWest }) => {
        if (!mounted.current) return;
        setRegion({
          latitude: (northEast.latitude + southWest.latitude) / 2,
          longitude: (northEast.longitude + southWest.longitude) / 2,
          latitudeDelta: northEast.latitude - southWest.latitude,
          longitudeDelta: northEast.longitude - southWest.longitude,
        });
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (autoMoves === 0) return;
    const timer = setTimeout(readShownArea, MAP_FIT_MS + AUTO_MOVE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [autoMoves, readShownArea]);
  const readHeading = () => {
    mapRef.current
      ?.getCamera()
      .then((camera) => {
        if (mounted.current) setHeading(camera.heading ?? 0);
      })
      .catch(() => {});
  };
  const pointNorth = () => {
    autoMoveUntil.current = Date.now() + MAP_FIT_MS + AUTO_MOVE_GRACE_MS;
    mapRef.current?.animateCamera({ heading: 0 }, { duration: MAP_FIT_MS });
  };
  return (
    // Any touch on the map (pan, zoom, pin) hides the keyboard.
    <View
      className="flex-1"
      onTouchStart={() => {
        Keyboard.dismiss();
        touch.current.down = true;
      }}
      onTouchEnd={() => {
        touch.current = { down: false, liftedAt: Date.now() };
      }}
      onTouchCancel={() => {
        touch.current = { down: false, liftedAt: Date.now() };
      }}
    >
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        onMapReady={readShownArea}
        onRegionChange={readHeading}
        onRegionChangeComplete={(next, details) => {
          setRegion(next);
          readHeading();
          // Only the user's own zooms and pans: the map's own moves (fitting a circle, a cluster,
          // the location button) keep the radius as it is.
          // A pan alone leaves the scale (and so the radius) as it was.
          if (movedByHand(details?.isGesture, next)) {
            autoTarget.current = null;
            // Zoomed: the radius exactly as zoomed, even between the presets. Panned: the circle
            // follows to the map's new center. Both maps take it (owner's rules).
            const handRadiusKm = radiusForRegion(next, MAX_RADIUS_KM);
            const zoomed = !sameRadius(handRadiusKm, circle.radiusKm);
            const panned = isAwayFrom(next, circle.center);
            if (searchedArea && panned) {
              // Panned off a searched place: the search lets go of it and follows the map, with
              // the place's radius (or the zoomed one); the box empties (owner's rule, 2026-10-14).
              shownArea.current = null;
              showingArea.current = false;
              const center = { lat: next.latitude, lng: next.longitude };
              saveCircle(zoomed ? handRadiusKm : circle.radiusKm, center);
              leaveArea(center);
            } else if (searchedArea && zoomed) {
              // Zoomed around a searched area: its circle takes the zoomed radius (owner's rule).
              shownArea.current = `${centerLat},${centerLng},${handRadiusKm}`;
              setAreaRadius({ text: name, km: handRadiusKm });
              setRadiusKm(handRadiusKm);
            }
            if (!searchedArea && (zoomed || panned)) {
              // A zoom keeps the view's center too (a pinch shifts it a little), so the other
              // tab's map shows exactly this view (owner's rule: the maps stay in sync).
              saveCircle(zoomed ? handRadiusKm : radiusKm, {
                lat: next.latitude,
                lng: next.longitude,
              });
            }
            // Any zoom or pan by hand turns "Mi ubicación" off (owner's rule).
            if (nearMe && (zoomed || isAwayFrom(next, location.coords))) onLeaveMyLocation();
          }
        }}
        showsCompass={false}
        showsUserLocation={location.source === 'device'}
        // Your location: a plain blue dot (iOS draws it in the map's tint; Android's is blue already).
        tintColor="#007aff"
        showsMyLocationButton={false}
        mapType={satellite ? 'hybrid' : MAP_TYPE}
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
      >
        {/* The search radius: around the user, a tapped cluster or where the map was panned. */}
        <Circle
          center={{ latitude: circle.center.lat, longitude: circle.center.lng }}
          radius={circle.radiusKm * 1000}
          strokeWidth={2}
          strokeColor={scheme === 'dark' ? RADIUS_COLORS.dark.stroke : RADIUS_COLORS.light.stroke}
          fillColor={scheme === 'dark' ? RADIUS_COLORS.dark.fill : RADIUS_COLORS.light.fill}
        />
        {items.map((place) => (
          <PlaceMarker
            key={place.id}
            place={place}
            category={category}
            showPolicy={petMode}
            onOpen={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}
          />
        ))}
        {clusters.map((cluster) => (
          <ClusterMarker
            key={`${category},${cluster.location.lat},${cluster.location.lng},${cluster.count}`}
            cluster={cluster}
            category={category}
            onPress={() => {
              // The cluster becomes the circle: centered on its places' average position, in whole
              // kilometers just big enough for all of them, and the map (and the other tab's)
              // centers it on screen.
              const covering = circleForCluster(cluster.location, cluster.bounds);
              // Viewing a cluster is looking away from the user: "Mi ubicación" off.
              if (nearMe) onLeaveMyLocation();
              const clusterKm = coveringRadiusKm(covering.radiusKm);
              saveCircle(clusterKm, covering.center);
              moveMap(regionForRadius(covering.center, clusterKm));
            }}
          />
        ))}
      </MapView>
      {places.data ? (
        <MapCountLegend
          inView={places.data.total}
          inRadius={places.data.radiusTotal}
          radiusKm={circle.radiusKm}
          // A searched area by its name; otherwise the nearest place's city.
          areaName={searchedArea?.name ?? places.data.nearestCity}
          onPress={fitCircle}
        />
      ) : null}
      {/* Pins up to this many places in view, then clusters: steps through MAP_PIN_LIMITS (owner's
          rule, 2026-10-14). Saved in Ajustes' storage; both maps follow it. */}
      <Pressable
        accessibilityRole="button"
        testID="map-pins"
        accessibilityLabel={t('places.mapPins', { count: mapPinLimit })}
        accessibilityHint={t('places.mapPinsHint')}
        onPress={() => setMapPinLimit(nextPinLimit(mapPinLimit))}
        hitSlop={BUTTON_HIT_SLOP}
        className="absolute bottom-[120px] right-3 h-9 w-9 items-center justify-center rounded-full bg-white shadow active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
      >
        <Text className="text-[11px] font-bold text-teal-800 dark:text-teal-300">
          {formatCount(mapPinLimit, locale)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID="map-layers"
        accessibilityLabel={t(satellite ? 'places.mapStandard' : 'places.mapSatellite')}
        accessibilityState={{ selected: satellite }}
        onPress={() => setSatellite(!satellite)}
        hitSlop={BUTTON_HIT_SLOP}
        className={`absolute bottom-[72px] right-3 h-9 w-9 items-center justify-center rounded-full shadow ${
          satellite
            ? 'bg-paw active:bg-paw-dark'
            : 'bg-white active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800'
        }`}
      >
        <Image
          source={ICONS.layers}
          style={{ width: 20, height: 20 }}
          tintColor={satellite ? '#042f2e' : scheme === 'dark' ? '#5eead4' : '#115e59'}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID="map-compass"
        accessibilityLabel={t('places.compass')}
        onPress={pointNorth}
        hitSlop={BUTTON_HIT_SLOP}
        className="absolute bottom-6 right-3 h-9 w-9 items-center justify-center rounded-full bg-white shadow active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
      >
        <Image
          source={ICONS.compass}
          // Larger than the other map icons, in the same 36 pt circle (owner's rule, 2026-10-14).
          style={{ width: 28, height: 28, transform: [{ rotate: `${-heading}deg` }] }}
        />
      </Pressable>
      {places.isError ? (
        <View className="absolute bottom-3 left-3 right-3 rounded-xl bg-white dark:bg-neutral-900">
          <ErrorState error={places.error} onRetry={() => void places.refetch()} />
        </View>
      ) : null}
    </View>
  );
}

/** "Buscar también en lugares sin confirmar": the same search, with unanswered venues too. */
function UnconfirmedLink({ onPress }: { onPress: () => void }) {
  const { t } = useAppTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 justify-center border-b border-neutral-100 px-4 active:bg-teal-50 dark:border-neutral-900 dark:active:bg-teal-950"
    >
      <Text className="text-sm font-semibold text-teal-800 underline dark:text-teal-300">
        {t('places.searchUnconfirmed')}
      </Text>
    </Pressable>
  );
}

/** Pet-friendly: whose pet the places are for, when one is set in Ajustes (nothing otherwise). */
function PetProfileLine({ floating }: { floating: boolean }) {
  const { t } = useAppTranslation();
  const profile = usePetProfileLabel();
  if (!profile) return null;
  return (
    <Text
      className={`text-sm text-neutral-600 dark:text-neutral-300 ${
        floating
          ? 'mx-4 mb-2 self-start rounded-full bg-white/90 px-3 py-0.5 dark:bg-neutral-900/90'
          : 'px-4 pb-2'
      }`}
    >
      {t('places.petFriendly.forProfile', { profile })}
    </Text>
  );
}

/**
 * A pin in its category's color; tapping its callout opens the place. In pet-friendly mode the
 * callout tells the pet policy, its source and last confirmation.
 */
function PlaceMarker({
  place,
  category,
  showPolicy,
  onOpen,
}: {
  place: Place;
  category: ChipCategory;
  showPolicy: boolean;
  onOpen: () => void;
}) {
  const locale = useLocale();
  const { units } = useSettings();
  const name = usePlaceName(place);
  const policy = usePolicySummary(place.petPolicy);
  const kinds =
    showPolicy && policy
      ? policy
      : orderedCategories(place, category)
          .map((c) => c.name)
          .join(' · ');
  return (
    <CategoryPin
      place={place}
      category={category}
      title={name}
      description={
        place.distanceKm === null
          ? kinds
          : `${kinds} · ${formatDistance(place.distanceKm, locale, units)}`
      }
      onCalloutPress={onOpen}
    />
  );
}

/**
 * INEGI's terms ask for attribution wherever DENUE data is shown (with the edition date), and
 * OpenStreetMap's license wherever its data is.
 */
function SourceNote({ places }: { places: Place[] }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const denue = places.find((place) => place.source === 'denue');
  const osm = places.some((place) => place.source === 'osm' || place.phoneSource === 'osm');
  if (!denue && !osm) return null;
  const overture = places.some(
    (p) => p.phoneSource === 'overture' || p.websiteSource === 'overture' || p.socialUrl,
  );
  return (
    <View className="gap-1 px-4 py-4">
      {denue ? (
        <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          {denue.sourceUpdatedOn
            ? t('places.sourceDenueUpdated', {
                date: formatMonthYear(denue.sourceUpdatedOn, locale),
              })
            : t('places.sourceDenue')}
        </Text>
      ) : null}
      {osm ? (
        <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          {t('places.sourceOsm')}
        </Text>
      ) : null}
      {overture ? (
        <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          {t('places.sourceOverture')}
        </Text>
      ) : null}
    </View>
  );
}

/** A small turquoise bubble with the number of places it groups, sized to fit it (clusterSize). */
/** A cluster's number takes the selected chip's color; with "Todos" it stays dark teal. */
function ClusterMarker({
  cluster,
  category,
  onPress,
}: {
  cluster: PlaceCluster;
  category: ChipCategory;
  onPress: () => void;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const label = formatCount(cluster.count, locale);
  const size = clusterSize(label);
  // Android draws a marker from a snapshot; taken before the count's text is laid out, the
  // circle shows empty. Keep tracking until the first frames are drawn, then stop (cheap).
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDrawn(true), CLUSTER_SNAPSHOT_MS);
    return () => clearTimeout(timer);
  }, [label]);
  return (
    <Marker
      coordinate={{ latitude: cluster.location.lat, longitude: cluster.location.lng }}
      onPress={onPress}
      tracksViewChanges={!drawn}
      accessibilityLabel={t('places.clusterLabel', { count: cluster.count })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: '#ffffff',
          backgroundColor: CLUSTER_COLORS.fill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: (category && CATEGORY_COLORS[category]) || CLUSTER_COLORS.text,
            fontWeight: '600',
            fontSize: CLUSTER_FONT_SIZE,
          }}
          // The bubble is sized for this font size; a larger system text size would overflow it.
          allowFontScaling={false}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Marker>
  );
}

/**
 * "152 de 1,340 lugares a menos de 5 km" at the top of the map: places in view out of all places
 * in the radius, updated as the map moves. Tapping it zooms out to the whole circle.
 */
function MapCountLegend({
  inView,
  inRadius,
  radiusKm,
  areaName,
  onPress,
}: {
  inView: number;
  inRadius: number;
  radiusKm: number;
  /** The searched area ("Zócalo"), when the circle is around it. */
  areaName: string | null;
  onPress: () => void;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { units } = useSettings();
  const distance = formatDistance(radiusKm, locale, units);
  const total = formatCount(inRadius, locale);
  const partial = inView < inRadius;
  // Every place in the circle, worded as on the list and Urgencias (owner's rule): "7 lugares a
  // menos de 5 km de Tlalnepantla de Baz"; when some are out of view, "Ver todo" fits the circle.
  const label = areaName
    ? t('places.areaCount', { count: inRadius, total, distance, area: areaName })
    : t('places.mapCount', { count: inRadius, total, distance });
  return (
    // At the bottom, clear of the floating controls above and the compass on the right.
    <View pointerEvents="box-none" className="absolute bottom-6 left-16 right-16 items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('places.mapShowAll')}
        onPress={onPress}
        className="items-center rounded-2xl bg-white/95 px-4 py-2 active:bg-neutral-100 dark:bg-neutral-900/95 dark:active:bg-neutral-800"
      >
        <Text
          testID="map-count"
          className="text-center text-sm font-semibold text-neutral-800 dark:text-neutral-100"
        >
          {label}
        </Text>
        {partial ? (
          <Text className="text-center text-xs text-teal-800 dark:text-teal-300">
            {t('places.mapShowAll')}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * The search radius, changed in place: each tap picks the next choice in the user's unit and
 * saves it to the same setting as Ajustes, so the list, the map, "Mi ubicación" and Ajustes always
 * agree.
 */
function RadiusButton({ className }: { className: string }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { radiusKm: settingKm, units, setRadiusKm } = useSettings();
  // Around a searched area ("Iztapalapa") the button shows and changes that circle's radius.
  const { shownArea, setAreaRadius, text } = useExploreView();
  const radiusKm = shownArea?.radiusKm ?? settingKm;
  const distance = formatDistance(radiusKm, locale, units);
  // A radius from zooming the map (or a tapped cluster) is off the presets: the button shows off
  // (amber) until pressed, which moves to the next preset and turns it on (owner's rule).
  const preset = isRadiusOption(radiusKm, units);
  const press = () => {
    const next = nextRadiusKm(radiusKm, units);
    if (shownArea) setAreaRadius({ text: text.trim(), km: next });
    setRadiusKm(next);
  };
  return (
    <Pressable
      accessibilityRole="button"
      testID="radius-button"
      accessibilityLabel={t('places.radiusButton', { distance })}
      accessibilityHint={t('places.radiusButtonHint')}
      onPress={press}
      hitSlop={BUTTON_HIT_SLOP}
      accessibilityState={{ checked: preset }}
      className={`min-w-[38px] items-center justify-center rounded-full border px-2.5 ${
        preset
          ? 'border-paw bg-paw active:bg-paw-dark'
          : 'border-off-border bg-off-bg active:bg-off-pressed dark:bg-off-bg-dark'
      } ${className}`}
    >
      <Text
        className={`text-xs font-bold ${preset ? 'text-teal-950' : 'text-amber-900 dark:text-amber-200'}`}
      >
        {distance}
      </Text>
    </Pressable>
  );
}

/**
 * "Mi ubicación": off, the search text names an area to search around ("Zócalo"); on, it
 * searches business names around the user within the chosen radius.
 */
function NearMeButton({ nearMe, onPress }: { nearMe: boolean; onPress: () => void }) {
  const { t } = useAppTranslation();
  const scheme = useColorScheme();
  // Just the icon; screen readers announce "Mi ubicación" and whether it's on.
  return (
    <Pressable
      accessibilityRole="button"
      testID="near-me"
      accessibilityLabel={t('places.nearMe')}
      accessibilityState={{ selected: nearMe }}
      accessibilityHint={t('places.nearMeHint')}
      onPress={onPress}
      hitSlop={BUTTON_HIT_SLOP}
      className={`h-[35px] w-[35px] items-center justify-center rounded-full border ${
        nearMe ? 'border-paw bg-paw' : 'border-off-border bg-off-bg dark:bg-off-bg-dark'
      }`}
    >
      <Image
        source={ICONS.locate}
        style={{ width: 18, height: 18 }}
        tintColor={nearMe ? ON_TEXT : scheme === 'dark' ? OFF_TEXT_DARK : OFF_TEXT_LIGHT}
      />
    </Pressable>
  );
}
