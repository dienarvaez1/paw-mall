import { ExploreTabFrame } from '@/features/explore/explore-frame';

/**
 * Explorar: vets, stores and other pet businesses. The page itself is drawn once for both
 * Explorar and Pet-friendly by the tabs layout (explore-frame.tsx); this tab only makes room.
 */
export default function ExploreTab() {
  return <ExploreTabFrame />;
}
