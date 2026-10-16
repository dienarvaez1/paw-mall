import type { CategoryGroup } from '@pet-helper/shared';

/** What a tab shows for a search: matches inside the circle, and the nearest one beyond it. */
export type SectionReach = { total: number; nearestBeyondKm: number | null };

export function otherSection(section: CategoryGroup): CategoryGroup {
  return section === 'pet_business' ? 'pet_friendly' : 'pet_business';
}

/**
 * After a confirmed search, whether the other tab (Explorar or Pet-friendly) should take the
 * focus (owner's rule, 2026-10-13): it finds more places inside the circle, or, with none inside
 * either, its nearest match is closer. Ties stay.
 */
export function otherSectionFindsMore(current: SectionReach, other: SectionReach): boolean {
  if (current.total !== other.total) return other.total > current.total;
  if (current.total > 0 || other.nearestBeyondKm === null) return false;
  return current.nearestBeyondKm === null || other.nearestBeyondKm < current.nearestBeyondKm;
}
