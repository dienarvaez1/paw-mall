import { MAX_RADIUS_KM, type Place, type PlaceCluster } from '@paw-mall/shared';
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

import { type MapArea, usePlaces, usePlacesMap } from '@/api/hooks';
import { ICONS } from '@/components/icons';
import { PlaceRow, usePlaceName } from '@/components/place-row';
import { SearchInput } from '@/components/search-input';
import { EmptyState, ErrorState, Notice, SkeletonList } from '@/components/states';
import { useUserLocation } from '@/features/location/location-context';
import { nextRadiusKm } from '@/features/settings/radius';
import { useSettings } from '@/features/settings/settings-context';
import { formatCount, formatDistance, formatMonthYear } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { usePetProfileLabel, usePolicySummary } from '@/features/pet-policy/policy-text';
import {
  CATEGORY_COLORS,
  CHIP_CATEGORIES,
  type ChipCategory,
  isPetFriendlyCategory,
  pinColor,
} from '@/lib/categories';
import { isAwayFrom, radiusForRegion, regionForBounds, regionForRadius } from '@/lib/map-region';
import { useDebounced } from '@/lib/use-debounced';
import { useDismissKeyboardOnBlur } from '@/lib/use-dismiss-keyboard-on-blur';

const MODES = ['list', 'map'] as const;
type Mode = (typeof MODES)[number];
/** Wait for the map to settle before loading its places (keeps panning cheap). */
const MAP_SETTLE_MS = 400;
const SEARCH_DEBOUNCE_MS = 300;
/**
 * Cluster bubbles: lime green (lime-500) with dark lime numbers (lime-950), owner's choice. No
 * category uses green, so clusters never look like pins.
 */
const CLUSTER_COLORS = { fill: '#84cc16', text: '#1a2e05' };
// Explorar's controls (Lista/Mapa, Mi ubicación, the radius button, the selected chip) use the
// clusters' greens when on: bg-lime-500 (#84cc16) with text-lime-950 (#1a2e05).
/** How long the map takes to zoom to a new radius. */
const MAP_FIT_MS = 500;
/**
 * A region change counts as the user's own while a finger is on the map or this soon after it
 * lifts (a flick keeps gliding), unless the app itself is moving the map.
 */
const HAND_MOVE_GRACE_MS = 2500;
/** Extra time after an automatic move during which region changes are still the app's own. */
const AUTO_MOVE_GRACE_MS = 400;
/** The radius circle in the brand teal (teal-700 / teal-400), lightly filled. */
const RADIUS_COLORS = {
  light: { stroke: '#0f766e', fill: 'rgba(15, 118, 110, 0.10)' },
  dark: { stroke: '#2dd4bf', fill: 'rgba(45, 212, 191, 0.10)' },
};

export default function ExploreScreen() {
  const { t } = useAppTranslation();
  const location = useUserLocation();
  const [mode, setMode] = useState<Mode>('list');
  const [category, setCategory] = useState<ChipCategory>(null);
  // "Pet-friendly": only places whose pet policy takes pets, narrowed by the pet profile.
  const [petFriendly, setPetFriendly] = useState(false);
  // "Mi ubicación": off, the search text names an area to search around; on, business names
  // around the user within the Ajustes radius.
  const [nearMe, setNearMe] = useState(false);
  // A radius set by zooming the map by hand: it replaces the presets for the list and the map
  // until the radius button is tapped (it's never saved to Ajustes).
  const [customRadiusKm, setCustomRadiusKm] = useState<number | null>(null);
  const [text, setText] = useState('');
  const name = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);
  useDismissKeyboardOnBlur();

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <View className="px-4 pt-3">
        <SearchInput
          value={text}
          onChangeText={setText}
          placeholder={t(nearMe ? 'places.searchPlaceholderNearMe' : 'places.searchPlaceholder')}
          clearLabel={t('places.clearSearch')}
        />
      </View>
      <View className="flex-row gap-2 px-4 pt-3">
        {MODES.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === value }}
            onPress={() => {
              Keyboard.dismiss();
              setMode(value);
            }}
            className={`min-h-11 flex-1 items-center justify-center rounded-xl ${
              mode === value ? 'bg-lime-500' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                mode === value ? 'text-lime-950' : 'text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {value === 'list' ? t('places.showList') : t('places.showMap')}
            </Text>
          </Pressable>
        ))}
        <NearMeButton nearMe={nearMe} onToggle={() => setNearMe((value) => !value)} />
        {/* The same row in both modes, so Lista and Mapa never resize. */}
        <RadiusButton
          className="min-h-11"
          customRadiusKm={customRadiusKm}
          onClearCustom={() => setCustomRadiusKm(null)}
        />
      </View>
      <View className="border-b border-neutral-200 dark:border-neutral-800">
        <CategoryChips
          selected={category}
          onSelect={setCategory}
          petFriendly={petFriendly}
          onTogglePetFriendly={() => setPetFriendly((value) => !value)}
        />
      </View>
      {location.ready && location.source === 'fallback' ? (
        <Notice text={t('common.approximateLocation')} />
      ) : null}
      {mode === 'list' ? (
        <PlacesList
          name={name}
          category={category}
          nearMe={nearMe}
          customRadiusKm={customRadiusKm}
          petFriendly={petFriendly}
        />
      ) : (
        <PlacesMap
          category={category}
          name={name}
          nearMe={nearMe}
          customRadiusKm={customRadiusKm}
          petFriendly={petFriendly}
          onZoomByHand={setCustomRadiusKm}
          onLeaveMyLocation={() => setNearMe(false)}
        />
      )}
    </View>
  );
}

/**
 * The pet-friendly toggle, then one chip per category; the list and the map show only the
 * selected one.
 */
function CategoryChips({
  selected,
  onSelect,
  petFriendly,
  onTogglePetFriendly,
}: {
  selected: ChipCategory;
  onSelect: (category: ChipCategory) => void;
  petFriendly: boolean;
  onTogglePetFriendly: () => void;
}) {
  const { t } = useAppTranslation();
  const profile = usePetProfileLabel();
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
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: petFriendly }}
        accessibilityHint={t('places.petFriendly.hint')}
        onPress={onTogglePetFriendly}
        className={`min-h-10 flex-row items-center gap-2 rounded-full border px-4 ${
          petFriendly
            ? 'border-lime-500 bg-lime-500'
            : 'border-teal-700 bg-white dark:border-teal-400 dark:bg-neutral-900'
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            petFriendly ? 'text-lime-950' : 'text-teal-800 dark:text-teal-300'
          }`}
        >
          {petFriendly && profile
            ? t('places.petFriendly.withProfile', { profile })
            : t('places.petFriendly.toggle')}
        </Text>
      </Pressable>
      {CHIP_CATEGORIES.map((slug) => {
        const active = selected === slug;
        const color = slug ? CATEGORY_COLORS[slug] : undefined;
        return (
          <Pressable
            key={slug ?? 'all'}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onSelect(slug)}
            className={`min-h-10 flex-row items-center gap-2 rounded-full border px-4 ${
              active
                ? 'border-lime-500 bg-lime-500'
                : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
            }`}
          >
            {color ? (
              <View
                className="h-2.5 w-2.5 rounded-full border border-white"
                style={{ backgroundColor: color }}
              />
            ) : null}
            <Text
              className={`text-sm font-semibold ${
                active ? 'text-lime-950' : 'text-neutral-800 dark:text-neutral-200'
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
  customRadiusKm,
  petFriendly,
}: {
  name: string;
  category: ChipCategory;
  nearMe: boolean;
  customRadiusKm: number | null;
  petFriendly: boolean;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { units, radiusKm, onlyOpenNow } = useSettings();
  const location = useUserLocation();
  const places = usePlaces(location.coords, category, name, nearMe, customRadiusKm, petFriendly);
  const petMode = petFriendly || isPetFriendlyCategory(category);
  const area = places.data?.pages[0]?.area ?? null;
  const items = useMemo(
    () => places.data?.pages.flatMap((page) => page.items) ?? [],
    [places.data],
  );
  const total = places.data?.pages[0]?.total ?? 0;
  // Area searches use 5 km (3 mi); everything around the user uses the shared radius.
  const distance = formatDistance(
    area ? area.radiusKm : (customRadiusKm ?? radiusKm),
    locale,
    units,
  );

  if (places.isPending) return <SkeletonList />;
  if (places.isError)
    return <ErrorState error={places.error} onRetry={() => void places.refetch()} />;

  // The summary stays put above the list while it scrolls: "69 lugares a menos de 5 km de
  // Tlaxcala", or "1,237 lugares a menos de 5 km" around the user.
  const summary = area
    ? t('places.areaCount', {
        count: total,
        total: formatCount(total, locale),
        distance,
        area: area.municipality ? `${area.name}, ${area.municipality}` : area.name,
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
      <FlatList
        data={items}
        keyExtractor={(place) => String(place.id)}
        renderItem={({ item }) => (
          <PlaceRow place={item} selected={category} away={nearMe} showPolicy={petMode} />
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-100 dark:bg-neutral-900" />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (places.hasNextPage && !places.isFetchingNextPage) void places.fetchNextPage();
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          name ? (
            <EmptyState
              title={t('places.noMatchesNearby', { query: name, distance })}
              hint={t('places.noMatchesHint')}
            />
          ) : petMode ? (
            <EmptyState
              title={t('places.noPetFriendlyPlaces', { distance })}
              hint={t('places.noPetFriendlyPlacesHint')}
            />
          ) : onlyOpenNow ? (
            <EmptyState
              title={t('places.noOpenPlaces', { distance })}
              hint={t('places.noOpenPlacesHint')}
            />
          ) : (
            <EmptyState
              title={t('places.noPlaces', { distance })}
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
  customRadiusKm,
  petFriendly,
  onZoomByHand,
  onLeaveMyLocation,
}: {
  category: ChipCategory;
  name: string;
  nearMe: boolean;
  customRadiusKm: number | null;
  petFriendly: boolean;
  /** The radius of the view after the user zoomed or panned the map by hand. */
  onZoomByHand: (radiusKm: number) => void;
  /** The user moved the map away from their location by hand: "Mi ubicación" turns off. */
  onLeaveMyLocation: () => void;
}) {
  const { t } = useAppTranslation();
  const { radiusKm } = useSettings();
  const router = useRouter();
  const location = useUserLocation();
  const scheme = useColorScheme();
  // Opens showing the whole search radius from Settings, and refits when the radius or the user's
  // location changes (the tab stays mounted while Settings changes the radius).
  const mapRef = useRef<MapView>(null);
  // Apple Maps (iOS) never tells whether a region change came from a gesture (react-native-maps
  // sends isGesture only with Google Maps), so the app tells its own moves apart: every automatic
  // move goes through moveMap, and a finger on the map marks the rest as the user's.
  const autoMoveUntil = useRef(0);
  const touch = useRef({ down: false, liftedAt: 0 });
  const moveMap = useCallback((region: Region) => {
    autoMoveUntil.current = Date.now() + MAP_FIT_MS + AUTO_MOVE_GRACE_MS;
    mapRef.current?.animateToRegion(region, MAP_FIT_MS);
  }, []);
  const movedByHand = (isGesture: boolean | undefined) => {
    const now = Date.now();
    if (now < autoMoveUntil.current) return false;
    return (
      isGesture === true || touch.current.down || now - touch.current.liftedAt < HAND_MOVE_GRACE_MS
    );
  };
  const initialRegion: Region = regionForRadius(location.coords, radiusKm);
  const fitted = useRef({ radiusKm, ...location.coords });
  // While a searched area is shown, its circle has its own radius: don't fly back to the user.
  const showingArea = useRef(false);
  useEffect(() => {
    const last = fitted.current;
    if (
      last.radiusKm === radiusKm &&
      last.lat === location.coords.lat &&
      last.lng === location.coords.lng
    ) {
      return;
    }
    fitted.current = { radiusKm, ...location.coords };
    if (showingArea.current) return;
    moveMap(regionForRadius(location.coords, radiusKm));
  }, [radiusKm, location.coords, moveMap]);
  // Turning "Mi ubicación" on in map view: read the device's position again and fly back to it,
  // with the circle fitted around it. Turning it off leaves the map where it is.
  const wasNearMe = useRef(nearMe);
  const { refresh } = location;
  useEffect(() => {
    const was = wasNearMe.current;
    wasNearMe.current = nearMe;
    if (!nearMe || was) return;
    void refresh().then((coords) => moveMap(regionForRadius(coords, customRadiusKm ?? radiusKm)));
  }, [nearMe, refresh, customRadiusKm, radiusKm, moveMap]);
  // Back to the presets (the radius button): fit the preset circle again. A zoom by hand sets a
  // custom radius without moving the map.
  const hadCustom = useRef(customRadiusKm !== null);
  useEffect(() => {
    const had = hadCustom.current;
    hadCustom.current = customRadiusKm !== null;
    if (!had || customRadiusKm !== null || showingArea.current) return;
    moveMap(regionForRadius(location.coords, radiusKm));
  }, [customRadiusKm, location.coords, radiusKm, moveMap]);
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
  const places = usePlacesMap(
    area,
    location.coords,
    category,
    name,
    nearMe,
    customRadiusKm,
    petFriendly,
  );
  const petMode = petFriendly || isPetFriendlyCategory(category);
  // A searched area ("Zócalo") moves the circle there with its own radius; otherwise the circle is
  // the user's radius around the user.
  const searchedArea = places.data?.area ?? null;
  const circle = searchedArea
    ? { center: searchedArea.location, radiusKm: searchedArea.radiusKm }
    : { center: location.coords, radiusKm: customRadiusKm ?? radiusKm };
  // Fly to a newly searched area, and back to the user when the search no longer names one.
  const shownArea = useRef<string | null>(null);
  const loaded = places.data !== undefined;
  const { lat: centerLat, lng: centerLng } = circle.center;
  const circleKm = circle.radiusKm;
  // By place only: a zoom by hand changes the radius but must not fly the map anywhere.
  const areaKey = searchedArea ? `${centerLat},${centerLng}` : null;
  useEffect(() => {
    if (!loaded || areaKey === shownArea.current) return;
    shownArea.current = areaKey;
    showingArea.current = areaKey !== null;
    moveMap(regionForRadius({ lat: centerLat, lng: centerLng }, circleKm));
  }, [loaded, areaKey, centerLat, centerLng, circleKm, moveMap]);
  const items = places.data?.kind === 'places' ? places.data.items : [];
  const clusters = places.data?.kind === 'clusters' ? places.data.clusters : [];
  const fitCircle = () => moveMap(regionForRadius(circle.center, circle.radiusKm));
  // The compass needle follows the map's rotation; tapping it turns the map north-up again.
  const [heading, setHeading] = useState(0);
  // getCamera() answers asynchronously; when the map closes first (e.g. switching to the list)
  // the native view is gone, so the answer is ignored and its error swallowed.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
        onRegionChange={readHeading}
        onRegionChangeComplete={(next, details) => {
          setRegion(next);
          readHeading();
          // Only the user's own zooms and pans: the map's own moves (fitting a circle, a cluster,
          // the location button) keep the radius as it is.
          // A pan alone leaves the scale (and so the radius) as it was.
          if (movedByHand(details?.isGesture)) {
            const handRadiusKm = radiusForRegion(next, MAX_RADIUS_KM);
            if (Math.abs(handRadiusKm - circle.radiusKm) >= 0.05) onZoomByHand(handRadiusKm);
            // The center moved by hand off the user: no longer "at my location".
            if (nearMe && isAwayFrom(next, location.coords)) onLeaveMyLocation();
          }
        }}
        showsCompass={false}
        showsUserLocation={location.source === 'device'}
        showsMyLocationButton={false}
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
      >
        {/* The search radius from Settings, around the user's location. */}
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
            key={`${cluster.location.lat},${cluster.location.lng},${cluster.count}`}
            cluster={cluster}
            onPress={() => moveMap(regionForBounds(cluster.bounds))}
          />
        ))}
      </MapView>
      {places.data ? (
        <MapCountLegend
          inView={places.data.total}
          inRadius={places.data.radiusTotal}
          radiusKm={circle.radiusKm}
          areaName={searchedArea?.name ?? null}
          onPress={fitCircle}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('places.compass')}
        onPress={pointNorth}
        className="absolute bottom-6 right-3 h-12 w-12 items-center justify-center rounded-full bg-white shadow active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
      >
        <Image
          source={ICONS.compass}
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
  const kinds = showPolicy && policy ? policy : place.categories.map((c) => c.name).join(' · ');
  return (
    <Marker
      coordinate={{ latitude: place.location.lat, longitude: place.location.lng }}
      pinColor={pinColor(place, category)}
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

/** INEGI's terms ask for attribution wherever DENUE data is shown; includes the edition date. */
function SourceNote({ places }: { places: Place[] }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const denue = places.find((place) => place.source === 'denue');
  if (!denue) return null;
  const overture = places.some(
    (p) => p.phoneSource === 'overture' || p.websiteSource === 'overture' || p.socialUrl,
  );
  return (
    <View className="gap-1 px-4 py-4">
      <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        {denue.sourceUpdatedOn
          ? t('places.sourceDenueUpdated', {
              date: formatMonthYear(denue.sourceUpdatedOn, locale),
            })
          : t('places.sourceDenue')}
      </Text>
      {overture ? (
        <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          {t('places.sourceOverture')}
        </Text>
      ) : null}
    </View>
  );
}

/** A small lime-green bubble with the number of places it groups; wider for longer numbers. */
function ClusterMarker({ cluster, onPress }: { cluster: PlaceCluster; onPress: () => void }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const label = formatCount(cluster.count, locale);
  const size = 20 + Math.min(label.length, 5) * 4;
  return (
    <Marker
      coordinate={{ latitude: cluster.location.lat, longitude: cluster.location.lng }}
      onPress={onPress}
      tracksViewChanges={false}
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
        <Text style={{ color: CLUSTER_COLORS.text, fontWeight: '700', fontSize: 10 }}>{label}</Text>
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
  const shown = formatCount(inView, locale);
  const partial = inView < inRadius;
  const label = areaName
    ? partial
      ? t('places.mapAreaCountPartial', { count: inRadius, shown, total, distance, area: areaName })
      : t('places.areaCount', { count: inRadius, total, distance, area: areaName })
    : partial
      ? t('places.mapCountPartial', { count: inRadius, shown, total, distance })
      : t('places.mapCount', { count: inRadius, total, distance });
  return (
    <View pointerEvents="box-none" className="absolute left-3 right-3 top-3 items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('places.mapShowAll')}
        onPress={onPress}
        className="items-center rounded-2xl bg-white/95 px-4 py-2 active:bg-neutral-100 dark:bg-neutral-900/95 dark:active:bg-neutral-800"
      >
        <Text className="text-center text-sm font-semibold text-neutral-800 dark:text-neutral-100">
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
function RadiusButton({
  className,
  customRadiusKm,
  onClearCustom,
}: {
  className: string;
  /** A radius from zooming the map by hand: shown in amber; a tap goes back to the presets. */
  customRadiusKm: number | null;
  onClearCustom: () => void;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { radiusKm, units, setRadiusKm } = useSettings();
  const custom = customRadiusKm !== null;
  const distance = formatDistance(customRadiusKm ?? radiusKm, locale, units);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(custom ? 'places.radiusButtonCustom' : 'places.radiusButton', {
        distance,
      })}
      accessibilityHint={t(custom ? 'places.radiusButtonCustomHint' : 'places.radiusButtonHint')}
      onPress={() => (custom ? onClearCustom() : setRadiusKm(nextRadiusKm(radiusKm, units)))}
      className={`min-w-12 items-center justify-center rounded-full border px-3 active:bg-neutral-100 dark:active:bg-neutral-800 ${
        custom ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : 'border-lime-500 bg-lime-500'
      } ${className}`}
    >
      <Text
        className={`text-sm font-bold ${
          custom ? 'text-amber-900 dark:text-amber-200' : 'text-lime-950'
        }`}
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
function NearMeButton({ nearMe, onToggle }: { nearMe: boolean; onToggle: () => void }) {
  const { t } = useAppTranslation();
  const scheme = useColorScheme();
  // Just the icon; screen readers announce "Mi ubicación" and whether it's on.
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={t('places.nearMe')}
      accessibilityState={{ checked: nearMe }}
      accessibilityHint={t('places.nearMeHint')}
      onPress={onToggle}
      className={`h-11 w-11 items-center justify-center rounded-full border ${
        nearMe
          ? 'border-lime-500 bg-lime-500'
          : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
      }`}
    >
      <Image
        source={ICONS.locate}
        style={{ width: 22, height: 22 }}
        tintColor={nearMe ? CLUSTER_COLORS.text : scheme === 'dark' ? '#e5e5e5' : '#262626'}
      />
    </Pressable>
  );
}
