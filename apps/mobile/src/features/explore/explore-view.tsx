import { type CategorySlug, type SearchArea, areaLookupResponseSchema } from '@paw-mall/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Keyboard } from 'react-native';

import { apiGet } from '@/api/client';
import { useUserLocation } from '@/features/location/location-context';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';
import type { ChipCategory } from '@/lib/categories';
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
  /** The text the searches act on: the box's text, trimmed. */
  searchText: string;
  /**
   * A tapped place suggestion: its name in the box, searched around that place right away, with
   * no question (owner's rule: picking it says it's the place).
   */
  choosePlace: (place: Pick<SearchArea, 'name' | 'kind'>) => void;
  /**
   * The keyboard's search key: when the typed text is exactly a place's name ("Guadalajara") and
   * no suggestion was picked, the same question opens right away (owner's rule).
   */
  submitSearch: () => void;
  /** The search circle's center when it isn't the user: a tapped cluster or a hand pan. */
  focus: Point | null;
  setFocus: (focus: Point | null) => void;
  /** Satellite or standard map (the one map both tabs show). */
  satellite: boolean;
  setSatellite: (satellite: boolean) => void;
  /** Counts taps on the location button (either tab), so both maps fly back to the user. */
  locateRequest: number;
  requestLocate: () => void;
  /**
   * How the user said to read a picked place's name ("Tlaxcala"): as the place (search around it,
   * "Mi ubicación" turned off) or as a business name. Typed text is always a business name.
   */
  placeChoice: PlaceChoice | null;
  /** The area the search moved the circle to ("Iztapalapa"), as the list or map got it. */
  shownArea: SearchArea | null;
  setShownArea: (area: SearchArea | null) => void;
  /** A radius the user picked for this search's area (radius button, zoom), until the text changes. */
  areaRadius: AreaRadius | null;
  setAreaRadius: (areaRadius: AreaRadius | null) => void;
  /**
   * The map panned by hand off a searched place: the search lets go of it and follows the map
   * (owner's rule, 2026-10-14). The box empties, the circle goes to `center`, and "Mi ubicación"
   * stays off (unlike emptying the box by hand, which goes back to the user).
   */
  leaveArea: (center: Point) => void;
  /**
   * The name the list or map on screen gives its circle (the searched area, or the nearest
   * place's city), so Urgencias names the same place (owner's rule, 2026-10-14).
   */
  circleName: string | null;
  setCircleName: (name: string | null) => void;
};

export type AreaRadius = { text: string; km: number };

type Point = { lat: number; lng: number };
/**
 * How the user said to read the text. exactWords: "by that name" after the service-in-place
 * question, so "veterinaria mascota" is searched word for word in names.
 */
export type PlaceChoice = { text: string; asPlace: boolean; exactWords?: boolean };

/** Shorter texts are never looked up as places (as the API). */
const MIN_PLACE_LOOKUP = 3;

/**
 * How to read the search text: as a place only when the user picked it from the suggestions, or
 * answered "as a place" after the search key; any other text is a business name (owner's rule:
 * the search never moves to a place the user didn't pick or confirm).
 */
export function readsAsPlace(choice: PlaceChoice | null, text: string): boolean {
  return choice !== null && choice.text === text.trim() && choice.asPlace;
}

/** The API's reading of the search text (namesOnly, exactWords), as usePlaces and the map send it. */
export function searchReading(
  choice: PlaceChoice | null,
  text: string,
): { namesOnly?: true; exactWords?: true } {
  if (text === '' || readsAsPlace(choice, text)) return {};
  const exact = choice !== null && choice.text === text.trim() && choice.exactWords === true;
  return exact ? { namesOnly: true, exactWords: true } : { namesOnly: true };
}

const ExploreViewContext = createContext<ExploreView>({
  mode: 'map',
  setMode: () => {},
  nearMe: true,
  setNearMe: () => {},
  text: '',
  setText: () => {},
  searchText: '',
  choosePlace: () => {},
  submitSearch: () => {},
  focus: null,
  setFocus: () => {},
  satellite: false,
  setSatellite: () => {},
  locateRequest: 0,
  requestLocate: () => {},
  placeChoice: null,
  shownArea: null,
  setShownArea: () => {},
  areaRadius: null,
  setAreaRadius: () => {},
  leaveArea: () => {},
  circleName: null,
  setCircleName: () => {},
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
  const [text, setTextValue] = useState('');
  const [focus, setFocus] = useState<Point | null>(null);
  const [shownArea, setShownArea] = useState<SearchArea | null>(null);
  const [areaRadius, setAreaRadius] = useState<AreaRadius | null>(null);
  const [circleName, setCircleName] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [locateRequest, setLocateRequest] = useState(0);
  const requestLocate = useCallback(() => setLocateRequest((n) => n + 1), []);
  // Emptying the search box (✕ or deleting every character) turns "Mi ubicación" back on, around
  // the user (owner's rule, 2026-10-13); the radius stays as it is.
  const setText = useCallback(
    (next: string) => {
      setTextValue(next);
      if (text.trim() !== '' && next.trim() === '') {
        setNearMe(true);
        setFocus(null);
        requestLocate();
      }
    },
    [text, requestLocate],
  );
  const leaveArea = useCallback((center: Point) => {
    setTextValue('');
    setAreaRadius(null);
    setFocus(center);
  }, []);
  useOnWake(() => {
    // After a search, or with "Mi ubicación" off, the app comes back as it was (owner's rules:
    // only the location button, a place pick, the place question and its answer, emptying the
    // search box, and moving the map change "Mi ubicación").
    if (text.trim() || !nearMe) return;
    setMode('map');
    setFocus(null);
  });
  const {
    choice: placeChoice,
    choosePlace,
    askAboutPlace,
    askAboutService,
    confirmBusinessName,
  } = usePlaceChoice(text, setText, setNearMe, setFocus);
  const queryClient = useQueryClient();
  const locale = useLocale();
  const { coords } = useUserLocation();
  // The search key: a place's name asks how to read it. A place with other words ("veterinaria
  // tlaxcala", "puerto vallarta taco", any order) goes there, or asks when it could also be a
  // business's name. Text with no place in it ("forrajeria") is confirmed as a business-name
  // search, so the tab and radius fit its matches (search-fit.ts).
  const submitSearch = useCallback(() => {
    const q = text.trim();
    if (!q || placeChoice?.text === q) return;
    if (q.length < MIN_PLACE_LOOKUP) {
      confirmBusinessName(q);
      return;
    }
    void queryClient
      .fetchQuery({
        queryKey: ['area-lookup', locale, q],
        queryFn: () =>
          apiGet('/v1/places/area', { q, ...coords }, locale, areaLookupResponseSchema),
        staleTime: Infinity,
      })
      .then(({ area, business, category, ambiguous }) => {
        if (!area) confirmBusinessName(q);
        else if (business === null) askAboutPlace(area);
        else if (ambiguous) askAboutService(q, area, category, business);
        else choosePlace({ ...area, name: q });
      })
      .catch(() => {});
  }, [
    text,
    placeChoice,
    queryClient,
    locale,
    coords,
    askAboutPlace,
    askAboutService,
    choosePlace,
    confirmBusinessName,
  ]);
  const searchText = text.trim();
  const value = useMemo(
    () => ({
      mode,
      setMode,
      nearMe,
      setNearMe,
      text,
      setText,
      searchText,
      choosePlace,
      submitSearch,
      focus,
      setFocus,
      satellite,
      setSatellite,
      locateRequest,
      requestLocate,
      placeChoice,
      shownArea,
      setShownArea,
      areaRadius,
      setAreaRadius,
      leaveArea,
      circleName,
      setCircleName,
    }),
    [
      mode,
      nearMe,
      text,
      setText,
      searchText,
      choosePlace,
      submitSearch,
      focus,
      satellite,
      locateRequest,
      requestLocate,
      placeChoice,
      shownArea,
      areaRadius,
      leaveArea,
      circleName,
    ],
  );
  return <ExploreViewContext.Provider value={value}>{children}</ExploreViewContext.Provider>;
}

/**
 * How a place's name is searched. Picked from the suggestions (choosePlace): around that place,
 * no question. Typed and sent with the search key (askAboutPlace): the place-or-business question.
 * "Mi ubicación" turns off as soon as a place is picked or the question comes up (owner's rule,
 * 2026-10-13), and stays off unless the answer is "as a business name". As a place: the search
 * goes around it (turning "Mi ubicación" back on clears the text). As a business name: only
 * business names match, around the user ("Mi ubicación" on again). Either puts the name in the
 * box and hides the keyboard; Cancel leaves the text as typed. Typing something else forgets the
 * answer.
 */
function usePlaceChoice(
  text: string,
  setText: (text: string) => void,
  setNearMe: (nearMe: boolean) => void,
  setFocus: (focus: Point | null) => void,
): {
  choice: PlaceChoice | null;
  choosePlace: (place: Pick<SearchArea, 'name' | 'kind'>) => void;
  askAboutPlace: (place: Pick<SearchArea, 'name' | 'kind'>) => void;
  askAboutService: (
    text: string,
    place: Pick<SearchArea, 'name' | 'state'>,
    category: CategorySlug | null,
    business: string,
  ) => void;
  confirmBusinessName: (text: string) => void;
} {
  const { t } = useAppTranslation();
  const [choice, setChoice] = useState<PlaceChoice | null>(null);
  const current = text.trim();
  if (choice && choice.text !== current) setChoice(null);
  const answer = useCallback(
    (name: string, asPlace: boolean, exactWords = false) => {
      setText(name);
      setChoice({ text: name, asPlace, ...(exactWords ? { exactWords } : {}) });
      // As a place: "Mi ubicación" off, the search goes around the place. As a business name:
      // "Mi ubicación" on, those businesses around the user (owner's rules).
      setNearMe(!asPlace);
      if (!asPlace) setFocus(null);
      Keyboard.dismiss();
    },
    [setText, setNearMe, setFocus],
  );
  const choosePlace = useCallback(
    (place: Pick<SearchArea, 'name' | 'kind'>) => answer(place.name, true),
    [answer],
  );
  const askAboutPlace = useCallback(
    (place: Pick<SearchArea, 'name' | 'kind'>) => {
      setNearMe(false);
      Alert.alert(
        t('places.placeAsk.title', { name: place.name }),
        t('places.placeAsk.message', {
          text: place.name,
          kind: t(`places.placeAsk.kind.${place.kind}`),
        }),
        [
          { text: t('places.placeAsk.asBusiness'), onPress: () => answer(place.name, false) },
          { text: t('places.placeAsk.asPlace'), onPress: () => answer(place.name, true) },
          { text: t('common.cancel'), style: 'cancel' },
        ],
        { cancelable: false },
      );
    },
    [t, answer, setNearMe],
  );
  // A place with other words that could also be a business's name ("veterinaria mascota": vets in
  // Mascota, Jalisco, or the many "Veterinaria Mi Mascota"): the user says which.
  const askAboutService = useCallback(
    (
      text: string,
      place: Pick<SearchArea, 'name' | 'state'>,
      category: CategorySlug | null,
      business: string,
    ) => {
      setNearMe(false);
      Alert.alert(
        t('places.serviceAsk.title'),
        t('places.serviceAsk.message', {
          text,
          // A kind of business by its chip's name (every slug a keyword names has a chip), else
          // the words as typed.
          what: category
            ? t(`places.chips.${category as Exclude<ChipCategory, null>}`).toLocaleLowerCase()
            : t('places.serviceAsk.words', { words: business }),
          place: place.name,
          state: place.state,
        }),
        [
          {
            text: t('places.serviceAsk.byName'),
            onPress: () => answer(text, false, true),
          },
          {
            text: t('places.serviceAsk.inPlace', { place: place.name }),
            onPress: () => answer(text, true),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ],
        { cancelable: false },
      );
    },
    [t, answer, setNearMe],
  );
  // Text that isn't a place's name, sent with the search key: a business-name search, confirmed
  // as is ("Mi ubicación" and the circle stay as they are).
  const confirmBusinessName = useCallback((name: string) => {
    setChoice({ text: name, asPlace: false });
    Keyboard.dismiss();
  }, []);
  return { choice, choosePlace, askAboutPlace, askAboutService, confirmBusinessName };
}

export function useExploreView(): ExploreView {
  return useContext(ExploreViewContext);
}
