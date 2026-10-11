import { type CategorySlug, PET_FRIENDLY_CATEGORIES, type Place } from '@paw-mall/shared';

/** The category chips on Explorar, in order; null is "Todos". */
export const CHIP_CATEGORIES = [
  null,
  'veterinarian',
  'vet_hospital',
  'pet_store',
  'groomer',
  'boarding',
  'feed_store',
  'dog_trainer',
  'restaurant',
  'cafe',
  'lodging',
  'museum',
  'park',
  'pet_funeral',
  'public_vet_service',
] as const satisfies readonly (CategorySlug | null)[];
export type ChipCategory = (typeof CHIP_CATEGORIES)[number];

/** Pin and chip colors by category; the first match in this order wins for a place's pin. */
export const CATEGORY_COLORS: Partial<Record<CategorySlug, string>> = {
  vet_hospital: '#dc2626',
  veterinarian: '#2563eb',
  public_vet_service: '#475569',
  groomer: '#9333ea',
  // Not green: green is for map clusters (owner's rule).
  boarding: '#4f46e5',
  boutique: '#db2777',
  pet_store: '#ea580c',
  feed_store: '#ca8a04',
  pet_funeral: '#854d0e',
  dog_trainer: '#0369a1',
  restaurant: '#e11d48',
  cafe: '#d946ef',
  lodging: '#0891b2',
  museum: '#6d28d9',
  // Brown, not green (owner's rule).
  park: '#92400e',
  tourist_site: '#1e3a8a',
};
const DEFAULT_COLOR = '#525252';

/** The pin color for a place: its selected category's, or its most specific one's. */
export function pinColor(place: Pick<Place, 'categories'>, selected: ChipCategory): string {
  if (selected) return CATEGORY_COLORS[selected] ?? DEFAULT_COLOR;
  const slugs = new Set(place.categories.map((c) => c.slug));
  const first = (Object.keys(CATEGORY_COLORS) as CategorySlug[]).find((slug) => slugs.has(slug));
  return first ? (CATEGORY_COLORS[first] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
}

/** Pet-friendly venues (restaurants to parks): their rows and callouts show the pet policy. */
export function isPetFriendlyCategory(category: CategorySlug | null): boolean {
  return category !== null && (PET_FRIENDLY_CATEGORIES as readonly string[]).includes(category);
}

const PET_FILTER_CATEGORIES: readonly CategorySlug[] = ['restaurant', 'cafe', 'lodging'];

/**
 * Restaurants, cafés and lodging: their chips show only places whose pet policy takes pets.
 * Museums, parks and tourist sites show every place, including those that say no to pets.
 */
export function isPetFilterCategory(category: CategorySlug | null): boolean {
  return category !== null && PET_FILTER_CATEGORIES.includes(category);
}
