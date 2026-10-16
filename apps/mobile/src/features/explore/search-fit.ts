import type { CategoryGroup, SearchArea } from '@pet-helper/shared';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useSectionReach } from '@/api/hooks';
import { searchFitRadiusKm } from '@/features/settings/radius';
import { useSettings } from '@/features/settings/settings-context';
import { otherSection, otherSectionFindsMore } from '@/lib/section-pick';

import { type PlaceChoice, useExploreView } from './explore-view';

/**
 * Per answer: whether the tab was chosen, and whether the radius was fitted. Shared by the list
 * and the map, so switching between them (or between the tabs) doesn't do either again.
 */
const tabChosen = new WeakSet<PlaceChoice>();
const fitted = new WeakMap<PlaceChoice, Set<CategoryGroup>>();

const TAB_ROUTES = { pet_business: '/explore', pet_friendly: '/pet-friendly' } as const;

/**
 * A confirmed search (a place picked from the suggestions, or the place question answered), once
 * per answer (owner's rules, 2026-10-13):
 * 1. The focus goes to the tab (Explorar or Pet-friendly) that finds more (section-pick.ts).
 * 2. On that tab, the radius fits the matches (searchFitRadiusKm): in to hold every match inside
 *    it, or out to the nearest when none is inside. Around a place it's that place's radius;
 *    around the user, Ajustes' (as the radius button). Once per search, not per tab: both tabs
 *    show one map, and a second fit on the other tab would move it (owner's rule, 2026-10-14).
 */
export function useConfirmedSearchFit({
  section,
  coords,
  name,
  ready,
  area,
  radiusKm,
  reach,
}: {
  section: CategoryGroup;
  /** Where the search is around (the user, or the circle they moved). */
  coords: { lat: number; lng: number };
  /** The search text the results are for. */
  name: string;
  /** The results are this search's own (loaded, not a previous search's, not refetching). */
  ready: boolean;
  area: SearchArea | null;
  /** The circle's current radius. */
  radiusKm: number;
  reach: { farthestKm: number | null; nearestBeyondKm: number | null } | undefined;
}) {
  const router = useRouter();
  const { placeChoice, setAreaRadius } = useExploreView();
  const { units, setRadiusKm } = useSettings();
  const confirmed = placeChoice !== null && placeChoice.text === name;
  const sections = useSectionReach(
    coords,
    name,
    confirmed && placeChoice !== null && !tabChosen.has(placeChoice),
  );
  const farthestKm = reach?.farthestKm ?? null;
  const nearestBeyondKm = reach?.nearestBeyondKm ?? null;
  useEffect(() => {
    if (!confirmed || !placeChoice) return;
    const done = fitted.get(placeChoice) ?? new Set<CategoryGroup>();
    fitted.set(placeChoice, done);
    if (!tabChosen.has(placeChoice)) {
      if (!sections.data) return;
      tabChosen.add(placeChoice);
      const other = otherSection(section);
      if (otherSectionFindsMore(sections.data[section], sections.data[other])) {
        // This tab keeps its radius; the other one fits its own when it shows.
        done.add(section);
        router.navigate(TAB_ROUTES[other]);
        return;
      }
    }
    if (done.has(section) || !ready) return;
    // Only this answer's results: around the place when read as a place, else around the user.
    if (placeChoice.asPlace !== (area !== null)) return;
    done.add('pet_business');
    done.add('pet_friendly');
    const fit = searchFitRadiusKm({ farthestKm, nearestBeyondKm }, radiusKm, units);
    if (fit === null) return;
    if (area) setAreaRadius({ text: name, km: fit });
    else setRadiusKm(fit);
  }, [
    confirmed,
    placeChoice,
    sections.data,
    section,
    router,
    name,
    ready,
    area,
    radiusKm,
    farthestKm,
    nearestBeyondKm,
    units,
    setAreaRadius,
    setRadiusKm,
  ]);
}
