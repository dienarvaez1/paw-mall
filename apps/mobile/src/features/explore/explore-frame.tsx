import { type ReactNode, createContext, useContext, useState } from 'react';
import { View } from 'react-native';

/**
 * Explorar and Pet-friendly are one page (owner's rule): the same controls and the same map, only
 * the places and the title change. So the tabs layout draws a single ExploreScreen over both tabs,
 * and the two tab pages are empty frames that only tell it how much room it has (the screen above
 * the tab bar).
 */
const FrameContext = createContext<{ height: number; setHeight: (height: number) => void }>({
  height: 0,
  setHeight: () => {},
});

export function ExploreFrameProvider({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(0);
  return <FrameContext.Provider value={{ height, setHeight }}>{children}</FrameContext.Provider>;
}

/** The room the shared ExploreScreen has: the tab page's height, 0 until it's laid out. */
export function useExploreFrameHeight(): number {
  return useContext(FrameContext).height;
}

/** Explorar's and Pet-friendly's tab page: empty, it only measures the room for the shared page. */
export function ExploreTabFrame() {
  const { setHeight } = useContext(FrameContext);
  return (
    <View
      style={{ flex: 1, backgroundColor: 'transparent' }}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    />
  );
}
