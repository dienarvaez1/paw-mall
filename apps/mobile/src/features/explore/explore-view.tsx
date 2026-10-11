import { type ReactNode, createContext, useContext, useMemo, useState } from 'react';

import { useOnWake } from '@/lib/use-on-wake';

export type ExploreMode = 'map' | 'list';

type ExploreView = {
  mode: ExploreMode;
  setMode: (mode: ExploreMode) => void;
  /** "Mi ubicación": on, the search looks around the user; off, the text names an area. */
  nearMe: boolean;
  setNearMe: (nearMe: boolean | ((current: boolean) => boolean)) => void;
};

const ExploreViewContext = createContext<ExploreView>({
  mode: 'map',
  setMode: () => {},
  nearMe: true,
  setNearMe: () => {},
});

/**
 * Mapa/Lista and "Mi ubicación", shared by Explorar and Pet-friendly so switching tabs keeps them
 * (the radius is shared through Ajustes). Both start on the map at the user's location, and go
 * back to that whenever the app returns from the background (owner's rules).
 */
export function ExploreViewProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ExploreMode>('map');
  const [nearMe, setNearMe] = useState(true);
  useOnWake(() => {
    setMode('map');
    setNearMe(true);
  });
  const value = useMemo(() => ({ mode, setMode, nearMe, setNearMe }), [mode, nearMe]);
  return <ExploreViewContext.Provider value={value}>{children}</ExploreViewContext.Provider>;
}

export function useExploreView(): ExploreView {
  return useContext(ExploreViewContext);
}
