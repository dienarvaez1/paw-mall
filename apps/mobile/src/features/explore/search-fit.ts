import type { SearchArea } from '@paw-mall/shared';
import { useEffect } from 'react';

import { searchFitRadiusKm } from '@/features/settings/radius';
import { useSettings } from '@/features/settings/settings-context';

import { type PlaceChoice, useExploreView } from './explore-view';

/** Answers already fitted, shared by the list and the map so switching between them doesn't refit. */
const fitted = new WeakSet<PlaceChoice>();

/**
 * A confirmed search (a place picked from the suggestions, or the place question answered) fits
 * the radius to its matches, once per answer (owner's rules, 2026-10-13; searchFitRadiusKm): in
 * to hold every match inside the radius, or out to the nearest when none is inside. Around a place
 * it's that place's radius; around the user, Ajustes' (as the radius button).
 */
export function useConfirmedSearchFit({
  name,
  ready,
  area,
  radiusKm,
  reach,
}: {
  /** The search text the results are for. */
  name: string;
  /** The results are this search's own (loaded, not a previous search's, not refetching). */
  ready: boolean;
  area: SearchArea | null;
  /** The circle's current radius. */
  radiusKm: number;
  reach: { farthestKm: number | null; nearestBeyondKm: number | null } | undefined;
}) {
  const { placeChoice, setAreaRadius } = useExploreView();
  const { units, setRadiusKm } = useSettings();
  const farthestKm = reach?.farthestKm ?? null;
  const nearestBeyondKm = reach?.nearestBeyondKm ?? null;
  useEffect(() => {
    if (!placeChoice || placeChoice.text !== name || fitted.has(placeChoice) || !ready) return;
    // Only this answer's results: around the place when read as a place, else around the user.
    if (placeChoice.asPlace !== (area !== null)) return;
    fitted.add(placeChoice);
    const fit = searchFitRadiusKm({ farthestKm, nearestBeyondKm }, radiusKm, units);
    if (fit === null) return;
    if (area) setAreaRadius({ text: name, km: fit });
    else setRadiusKm(fit);
  }, [
    placeChoice,
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
