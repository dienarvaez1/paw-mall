import { type ReactNode, createContext, useContext, useMemo, useState } from 'react';

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
};

type Point = { lat: number; lng: number };

const ExploreViewContext = createContext<ExploreView>({
  mode: 'map',
  setMode: () => {},
  nearMe: true,
  setNearMe: () => {},
  text: '',
  setText: () => {},
  focus: null,
  setFocus: () => {},
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
  useOnWake(() => {
    // After a search the app comes back to it as it was (owner's rule).
    if (text.trim()) return;
    setMode('map');
    setNearMe(true);
    setText('');
    setFocus(null);
  });
  const value = useMemo(
    () => ({ mode, setMode, nearMe, setNearMe, text, setText, focus, setFocus }),
    [mode, nearMe, text, focus],
  );
  return <ExploreViewContext.Provider value={value}>{children}</ExploreViewContext.Provider>;
}

export function useExploreView(): ExploreView {
  return useContext(ExploreViewContext);
}
