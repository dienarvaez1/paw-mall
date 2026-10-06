import type { Place, PlaceCluster } from '@paw-mall/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { type MapArea, useAreaRadiusKm, usePlaces, usePlacesMap } from '@/api/hooks';
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
import { CATEGORY_COLORS, CHIP_CATEGORIES, type ChipCategory, pinColor } from '@/lib/categories';
import { regionForBounds, regionForRadius } from '@/lib/map-region';
import { useDebounced } from '@/lib/use-debounced';
import { useDismissKeyboardOnBlur } from '@/lib/use-dismiss-keyboard-on-blur';

const MODES = ['list', 'map'] as const;
type Mode = (typeof MODES)[number];
/** Wait for the map to settle before loading its places (keeps panning cheap). */
const MAP_SETTLE_MS = 400;
const SEARCH_DEBOUNCE_MS = 300;
/** Cluster bubbles: light amber (amber-200) with dark amber numbers (amber-900). */
const CLUSTER_COLORS = { fill: '#fde68a', text: '#78350f' };
/** How long the map takes to zoom to a new radius. */
const MAP_FIT_MS = 500;
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
  // "Mi ubicación": off, the search text names an area to search around; on, business names
  // around the user within the Ajustes radius.
  const [nearMe, setNearMe] = useState(false);
  const [text, setText] = useState('');
  const name = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);
  useDismissKeyboardOnBlur();

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      {/* Search is for the list; the map shows every place in view, so it's grayed out there. */}
      <View className="px-4 pt-3">
        <SearchInput
          value={text}
          onChangeText={setText}
          placeholder={t(nearMe ? 'places.searchPlaceholderNearMe' : 'places.searchPlaceholder')}
          clearLabel={t('places.clearSearch')}
          disabled={mode === 'map'}
        />
      </View>
      <CategoryChips
        selected={category}
        onSelect={setCategory}
        nearMe={nearMe}
        onToggleNearMe={() => setNearMe((value) => !value)}
      />
      <View className="flex-row gap-2 border-b border-neutral-200 px-4 pb-3 pt-1 dark:border-neutral-800">
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
              mode === value ? 'bg-brand' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                mode === value ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {value === 'list' ? t('places.showList') : t('places.showMap')}
            </Text>
          </Pressable>
        ))}
      </View>
      {location.ready && location.source === 'fallback' ? (
        <Notice text={t('common.approximateLocation')} />
      ) : null}
      {mode === 'list' ? (
        <PlacesList name={name} category={category} nearMe={nearMe} />
      ) : (
        <PlacesMap category={category} />
      )}
    </View>
  );
}

/** One chip per category; the list and the map show only the selected one. */
function CategoryChips({
  selected,
  onSelect,
  nearMe,
  onToggleNearMe,
}: {
  selected: ChipCategory;
  onSelect: (category: ChipCategory) => void;
  nearMe: boolean;
  onToggleNearMe: () => void;
}) {
  const { t } = useAppTranslation();
  const scheme = useColorScheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t('places.categoriesLabel')}
      className="grow-0"
      contentContainerClassName="gap-2 px-4 pb-4 pt-3"
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: nearMe }}
        accessibilityHint={t('places.nearMeHint')}
        onPress={onToggleNearMe}
        className={`min-h-10 flex-row items-center gap-2 rounded-full border px-4 ${
          nearMe
            ? 'border-brand bg-brand'
            : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
        }`}
      >
        <Image
          source={ICONS.locate}
          style={{ width: 16, height: 16 }}
          tintColor={nearMe ? '#ffffff' : scheme === 'dark' ? '#e5e5e5' : '#262626'}
        />
        <Text
          className={`text-sm font-semibold ${
            nearMe ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
          }`}
        >
          {t('places.nearMe')}
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
                ? 'border-brand bg-brand'
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
                active ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
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
}: {
  name: string;
  category: ChipCategory;
  nearMe: boolean;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { units, radiusKm, onlyOpenNow } = useSettings();
  const location = useUserLocation();
  const areaRadiusKm = useAreaRadiusKm();
  const places = usePlaces(location.coords, category, name, nearMe);
  const area = places.data?.pages[0]?.area ?? null;
  const items = useMemo(
    () => places.data?.pages.flatMap((page) => page.items) ?? [],
    [places.data],
  );
  const total = places.data?.pages[0]?.total ?? 0;
  // "Mi ubicación" and area searches use 5 km (3 mi); plain browsing uses the Ajustes radius.
  const distance = formatDistance(
    area ? area.radiusKm : nearMe ? areaRadiusKm : radiusKm,
    locale,
    units,
  );

  if (places.isPending) return <SkeletonList />;
  if (places.isError)
    return <ErrorState error={places.error} onRetry={() => void places.refetch()} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(place) => String(place.id)}
      renderItem={({ item }) => (
        <PlaceRow place={item} selected={category} distanceFrom={area ? 'area' : 'user'} />
      )}
      ItemSeparatorComponent={() => <View className="h-px bg-neutral-100 dark:bg-neutral-900" />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (places.hasNextPage && !places.isFetchingNextPage) void places.fetchNextPage();
      }}
      ListHeaderComponent={
        area ? (
          <View className="gap-1 px-4 pb-1 pt-3">
            <Text className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {t('places.areaCount', {
                count: total,
                total: formatCount(total, locale),
                distance,
                area: area.municipality ? `${area.name}, ${area.municipality}` : area.name,
              })}
            </Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('places.areaHint', { query: name })}
            </Text>
          </View>
        ) : items.length > 0 ? (
          <Text className="px-4 pb-1 pt-3 text-sm text-neutral-500 dark:text-neutral-400">
            {t('places.listCount', { count: total, total: formatCount(total, locale), distance })}
          </Text>
        ) : null
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListEmptyComponent={
        name ? (
          <EmptyState
            title={t('places.noMatchesNearby', { query: name, distance })}
            hint={t('places.noMatchesHint')}
          />
        ) : onlyOpenNow ? (
          <EmptyState
            title={t('places.noOpenPlaces', { distance })}
            hint={t('places.noOpenPlacesHint')}
          />
        ) : (
          <EmptyState title={t('places.noPlaces', { distance })} hint={t('places.noPlacesHint')} />
        )
      }
      ListFooterComponent={
        <>
          {places.isFetchingNextPage ? <SkeletonList rows={2} /> : null}
          <SourceNote places={items} />
        </>
      }
    />
  );
}

function PlacesMap({ category }: { category: ChipCategory }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { radiusKm, units, setRadiusKm } = useSettings();
  const router = useRouter();
  const location = useUserLocation();
  const scheme = useColorScheme();
  // Opens showing the whole search radius from Settings, and refits when the radius or the user's
  // location changes (the tab stays mounted while Settings changes the radius).
  const mapRef = useRef<MapView>(null);
  const initialRegion: Region = regionForRadius(location.coords, radiusKm);
  const fitted = useRef({ radiusKm, ...location.coords });
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
    mapRef.current?.animateToRegion(regionForRadius(location.coords, radiusKm), MAP_FIT_MS);
  }, [radiusKm, location.coords]);
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
  const places = usePlacesMap(area, location.coords, category);
  const items = places.data?.kind === 'places' ? places.data.items : [];
  const clusters = places.data?.kind === 'clusters' ? places.data.clusters : [];
  const fitCircle = () =>
    mapRef.current?.animateToRegion(regionForRadius(location.coords, radiusKm), MAP_FIT_MS);
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
  const pointNorth = () => mapRef.current?.animateCamera({ heading: 0 }, { duration: MAP_FIT_MS });
  // "My location": read the position again and fit the radius circle around it.
  const [locating, setLocating] = useState(false);
  const goToMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const coords = await location.refresh();
      mapRef.current?.animateToRegion(regionForRadius(coords, radiusKm), MAP_FIT_MS);
    } finally {
      setLocating(false);
    }
  };

  return (
    // Any touch on the map (pan, zoom, pin) hides the keyboard.
    <View className="flex-1" onTouchStart={() => Keyboard.dismiss()}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        onRegionChange={readHeading}
        onRegionChangeComplete={(next) => {
          setRegion(next);
          readHeading();
        }}
        showsCompass={false}
        showsUserLocation={location.source === 'device'}
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
      >
        {/* The search radius from Settings, around the user's location. */}
        <Circle
          center={{ latitude: location.coords.lat, longitude: location.coords.lng }}
          radius={radiusKm * 1000}
          strokeWidth={2}
          strokeColor={scheme === 'dark' ? RADIUS_COLORS.dark.stroke : RADIUS_COLORS.light.stroke}
          fillColor={scheme === 'dark' ? RADIUS_COLORS.dark.fill : RADIUS_COLORS.light.fill}
        />
        {items.map((place) => (
          <PlaceMarker
            key={place.id}
            place={place}
            category={category}
            onOpen={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}
          />
        ))}
        {clusters.map((cluster) => (
          <ClusterMarker
            key={`${cluster.location.lat},${cluster.location.lng},${cluster.count}`}
            cluster={cluster}
            onPress={() =>
              mapRef.current?.animateToRegion(regionForBounds(cluster.bounds), MAP_FIT_MS)
            }
          />
        ))}
      </MapView>
      {places.data ? (
        <MapCountLegend
          inView={places.data.total}
          inRadius={places.data.radiusTotal}
          onPress={fitCircle}
        />
      ) : null}
      {/*
        The radius from Ajustes, changed in place: each tap picks the next choice (and saves it,
        so Ajustes shows it); the map then refits the circle around the user.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('places.radiusButton', {
          distance: formatDistance(radiusKm, locale, units),
        })}
        accessibilityHint={t('places.radiusButtonHint')}
        onPress={() => setRadiusKm(nextRadiusKm(radiusKm, units))}
        className="absolute bottom-[144px] right-3 h-12 min-w-12 items-center justify-center rounded-full bg-white px-3 shadow active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
      >
        <Text className="text-sm font-bold text-teal-800 dark:text-teal-300">
          {formatDistance(radiusKm, locale, units)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('places.compass')}
        onPress={pointNorth}
        className="absolute bottom-[84px] right-3 h-12 w-12 items-center justify-center rounded-full bg-white shadow active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
      >
        <Image
          source={ICONS.compass}
          style={{ width: 28, height: 28, transform: [{ rotate: `${-heading}deg` }] }}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('places.myLocation')}
        accessibilityState={{ busy: locating }}
        onPress={() => void goToMyLocation()}
        className="absolute bottom-6 right-3 h-12 w-12 items-center justify-center rounded-full bg-white shadow active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
      >
        <Image
          source={ICONS.locate}
          style={{ width: 24, height: 24, opacity: locating ? 0.4 : 1 }}
          tintColor={scheme === 'dark' ? '#f5f5f5' : '#262626'}
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

/** A pin in its category's color; tapping its callout opens the place. */
function PlaceMarker({
  place,
  category,
  onOpen,
}: {
  place: Place;
  category: ChipCategory;
  onOpen: () => void;
}) {
  const locale = useLocale();
  const { units } = useSettings();
  const name = usePlaceName(place);
  const kinds = place.categories.map((c) => c.name).join(' · ');
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

/** A small light-amber bubble with the number of places it groups; wider for longer numbers. */
function ClusterMarker({ cluster, onPress }: { cluster: PlaceCluster; onPress: () => void }) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const label = formatCount(cluster.count, locale);
  const size = 16 + Math.min(label.length, 5) * 4;
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
        <Text style={{ color: CLUSTER_COLORS.text, fontWeight: '700', fontSize: 9 }}>{label}</Text>
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
  onPress,
}: {
  inView: number;
  inRadius: number;
  onPress: () => void;
}) {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const { radiusKm, units } = useSettings();
  const distance = formatDistance(radiusKm, locale, units);
  const total = formatCount(inRadius, locale);
  const partial = inView < inRadius;
  const label = partial
    ? t('places.mapCountPartial', {
        count: inRadius,
        shown: formatCount(inView, locale),
        total,
        distance,
      })
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
