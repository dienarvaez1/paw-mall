import { type SearchArea, areaLookupResponseSchema } from '@paw-mall/shared';
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
  /**
   * The text the searches act on: the box's text once it's known not to be a place's name, or
   * once the user said how to read it; until then, the last such text (owner's rule).
   */
  searchText: string;
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
  /** The area the search moved the circle to ("Iztapalapa"), as the list or map got it. */
  shownArea: SearchArea | null;
  setShownArea: (area: SearchArea | null) => void;
  /** A radius the user picked for this search's area (radius button, zoom), until the text changes. */
  areaRadius: AreaRadius | null;
  setAreaRadius: (areaRadius: AreaRadius | null) => void;
};

export type AreaRadius = { text: string; km: number };

type Point = { lat: number; lng: number };
export type PlaceChoice = { text: string; asPlace: boolean };

/** Ask only once the typing has settled, so "Roma" isn't asked on the way to "Roma Norte". */
const PLACE_ASK_MS = 900;
/** Shorter texts are never looked up as places. */
const MIN_PLACE_LOOKUP = 3;

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
  searchText: '',
  focus: null,
  setFocus: () => {},
  readMapView: () => null,
  saveMapView: () => {},
  placeChoice: null,
  shownArea: null,
  setShownArea: () => {},
  areaRadius: null,
  setAreaRadius: () => {},
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
  const [shownArea, setShownArea] = useState<SearchArea | null>(null);
  const [areaRadius, setAreaRadius] = useState<AreaRadius | null>(null);
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
  const { choice: placeChoice, searchText } = usePlaceQuestion(text, focus, setNearMe);
  const value = useMemo(
    () => ({
      mode,
      setMode,
      nearMe,
      setNearMe,
      text,
      setText,
      searchText,
      focus,
      setFocus,
      ...mapViewAccess,
      placeChoice,
      shownArea,
      setShownArea,
      areaRadius,
      setAreaRadius,
    }),
    [mode, nearMe, text, searchText, focus, mapViewAccess, placeChoice, shownArea, areaRadius],
  );
  return <ExploreViewContext.Provider value={value}>{children}</ExploreViewContext.Provider>;
}

/**
 * A search text that is exactly a city's, colonia's or landmark's name ("Tlaxcala") could also be
 * a business name, so the app asks once how to read it (owner's rule). As a place: the search
 * goes around it and "Mi ubicación" turns off (turning it back on clears the text). As a name: only
 * business names match. One dialog for both tabs, since the text is shared.
 *
 * Nothing searches a text that may be a place until that's settled (owner's rule): while the
 * typing settles, while the lookup runs and while the question is open, `searchText` stays on the
 * last text that was settled.
 */
function usePlaceQuestion(
  text: string,
  focus: Point | null,
  setNearMe: (nearMe: boolean) => void,
): { choice: PlaceChoice | null; searchText: string } {
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
    enabled: settled.length >= MIN_PLACE_LOOKUP && !answered,
    staleTime: Infinity,
  });
  const asked = useRef<string | null>(null);
  const area = lookup.data?.area ?? null;
  const current = text.trim();
  const pending = isPlaceQuestionPending({
    current,
    settled,
    answered: choice?.text === current,
    looking: lookup.isFetching,
    foundArea: area !== null && lookup.data !== undefined,
  });
  const [searchText, setSearchText] = useState(current);
  if (!pending && searchText !== current) setSearchText(current);
  // Typing something else forgets the answer, so the same text typed again is asked again.
  const [answerFor, setAnswerFor] = useState(current);
  if (answerFor !== current) {
    setAnswerFor(current);
    if (choice && choice.text !== current) setChoice(null);
  }
  useEffect(() => {
    if (asked.current !== null && asked.current !== current) asked.current = null;
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
  return { choice, searchText };
}

/** Whether the searches wait on this text: it may still turn out to be a place's name. */
export function isPlaceQuestionPending({
  current,
  settled,
  answered,
  looking,
  foundArea,
}: {
  /** The box's text, trimmed. */
  current: string;
  /** The same text once the typing paused (the place lookup asks about this one). */
  settled: string;
  answered: boolean;
  /** The place lookup for `settled` is running. */
  looking: boolean;
  /** The lookup found a place with that name. */
  foundArea: boolean;
}): boolean {
  if (current.length < MIN_PLACE_LOOKUP || answered) return false;
  return settled !== current || looking || foundArea;
}

export function useExploreView(): ExploreView {
  return useContext(ExploreViewContext);
}
