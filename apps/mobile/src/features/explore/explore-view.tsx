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
};

const ExploreViewContext = createContext<ExploreView>({
  mode: 'map',
  setMode: () => {},
  nearMe: true,
  setNearMe: () => {},
  text: '',
  setText: () => {},
});

/**
 * Mapa/Lista, "Mi ubicación" and the search text, shared by Explorar and Pet-friendly so switching
 * tabs keeps them (the radius is shared with Urgencias). They start on the map, around the user's
 * location, with Mi ubicación on and an empty search, and go back to that whenever the app
 * returns from the background (owner's rules).
 */
export function ExploreViewProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ExploreMode>('map');
  const [nearMe, setNearMe] = useState(true);
  const [text, setText] = useState('');
  useOnWake(() => {
    setMode('map');
    setNearMe(true);
    setText('');
  });
  const value = useMemo(
    () => ({ mode, setMode, nearMe, setNearMe, text, setText }),
    [mode, nearMe, text],
  );
  return <ExploreViewContext.Provider value={value}>{children}</ExploreViewContext.Provider>;
}

export function useExploreView(): ExploreView {
  return useContext(ExploreViewContext);
}
