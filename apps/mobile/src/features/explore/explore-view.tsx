import { areaLookupResponseSchema } from '@paw-mall/shared';
import { useQuery } from '@tanstack/react-query';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import type { Region } from 'react-native-maps';

import { apiGet } from '@/api/client';
import { useUserLocation } from '@/features/location/location-context';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import { useDebounced } from '@/lib/use-debounced';
import { useOnWake } from '@/lib/use-on-wake';

export type ExploreMode = 'map' | 'list';

type ExploreView = {
  mode: ExploreMode;
  setMode: (mode: ExploreMode) => void;
  /** "Mi ubicación": on, the search looks around the user; off, the text names an area. */
  nearMe: boolean;
  setNearMe: (nearMe: boolean | ((current: boolean) => boolean)) => void;
  /** The search box's text. */
  text: string;
  setText: (text: string) => void;
  /** The search circle's center when it isn't the user: a tapped cluster or a hand pan. */
  focus: Point | null;
  setFocus: (focus: Point | null) => void;
  /**
   * The view of the map on screen (written by the visible tab's map), so the other tab's map
   * opens on exactly the same view. Kept outside React state: panning doesn't re-render.
   */
  readMapView: () => Region | null;
  saveMapView: (region: Region) => void;
  /**
   * How the user said to read a search text that is a place's name ("Tlaxcala"): as the place
   * (search around it, "Mi ubicación" turned off) or as a business name.
   */
  placeChoice: PlaceChoice | null;
};

type Point = { lat: number; lng: number };
export type PlaceChoice = { text: string; asPlace: boolean };

/** Ask only once the typing has settled, so "Roma" isn't asked on the way to "Roma Norte". */
const PLACE_ASK_MS = 900;

/** The user's answer for this search text, if they gave one: true as a place, false as a name. */
export function readsAsPlace(choice: PlaceChoice | null, text: string): boolean | null {
  return choice && choice.text === text.trim() ? choice.asPlace : null;
}

const ExploreViewContext = createContext<ExploreView>({
  mode: 'map',
  setMode: () => {},
  nearMe: true,
  setNearMe: () => {},
  text: '',
  setText: () => {},
  focus: null,
  setFocus: () => {},
  readMapView: () => null,
  saveMapView: () => {},
  placeChoice: null,
});

/**
 * Mapa/Lista, "Mi ubicación", the search text and the circle's center, shared by Explorar and Pet-friendly so switching
 * tabs keeps them (the radius is shared with Urgencias). They start on the map, around the user's
 * location, with Mi ubicación on and an empty search, and go back to that whenever the app
 * returns from the background, unless a search is showing: then it comes back as it was (owner's
 * rules).
 */
export function ExploreViewProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ExploreMode>('map');
  const [nearMe, setNearMe] = useState(true);
  const [text, setText] = useState('');
  const [focus, setFocus] = useState<Point | null>(null);
  const mapView = useRef<Region | null>(null);
  const [mapViewAccess] = useState(() => ({
    readMapView: () => mapView.current,
    saveMapView: (region: Region) => {
      mapView.current = region;
    },
  }));
  useOnWake(() => {
    // After a search the app comes back to it as it was (owner's rule).
    if (text.trim()) return;
    setMode('map');
    setNearMe(true);
    setText('');
    setFocus(null);
  });
  const placeChoice = usePlaceQuestion(text, focus, setNearMe);
  const value = useMemo(
    () => ({
      mode,
      setMode,
      nearMe,
      setNearMe,
      text,
      setText,
      focus,
      setFocus,
      ...mapViewAccess,
      placeChoice,
    }),
    [mode, nearMe, text, focus, mapViewAccess, placeChoice],
  );
  return <ExploreViewContext.Provider value={value}>{children}</ExploreViewContext.Provider>;
}

/**
 * A search text that is exactly a city's, colonia's or landmark's name ("Tlaxcala") could also be
 * a business name, so the app asks once how to read it (owner's rule). As a place: the search
 * goes around it and "Mi ubicación" turns off (turning it back on clears the text). As a name: only
 * business names match. One dialog for both tabs, since the text is shared.
 */
function usePlaceQuestion(
  text: string,
  focus: Point | null,
  setNearMe: (nearMe: boolean) => void,
): PlaceChoice | null {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const location = useUserLocation();
  const [choice, setChoice] = useState<PlaceChoice | null>(null);
  const settled = useDebounced(text.trim(), PLACE_ASK_MS);
  const center = focus ?? location.coords;
  const answered = choice?.text === settled;
  const lookup = useQuery({
    // Not keyed by position: the same text keeps its answer while the map moves.
    queryKey: ['area-lookup', locale, settled],
    queryFn: () =>
      apiGet('/v1/places/area', { q: settled, ...center }, locale, areaLookupResponseSchema),
    enabled: settled.length >= 3 && !answered,
    staleTime: Infinity,
  });
  const asked = useRef<string | null>(null);
  const area = lookup.data?.area ?? null;
  const current = text.trim();
  useEffect(() => {
    if (!area || answered || asked.current === settled || current !== settled) return;
    asked.current = settled;
    Alert.alert(
      t('places.placeAsk.title', { name: area.name }),
      t('places.placeAsk.message', {
        text: settled,
        kind: t(`places.placeAsk.kind.${area.kind}`),
      }),
      [
        {
          text: t('places.placeAsk.asBusiness'),
          style: 'cancel',
          onPress: () => setChoice({ text: settled, asPlace: false }),
        },
        {
          text: t('places.placeAsk.asPlace'),
          onPress: () => {
            setChoice({ text: settled, asPlace: true });
            setNearMe(false);
          },
        },
      ],
      { cancelable: false },
    );
  }, [area, answered, settled, current, t, setNearMe]);
  return choice;
}

export function useExploreView(): ExploreView {
  return useContext(ExploreViewContext);
}
