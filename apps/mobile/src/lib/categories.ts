import { type CategorySlug, PET_FRIENDLY_CATEGORIES, type Place } from '@paw-mall/shared';

/** Explorar's category chips (pet businesses), in order; null is "Todos". */
export const EXPLORE_CHIPS = [
  null,
  'veterinarian',
  'vet_hospital',
  'pet_store',
  'groomer',
  'boarding',
  'feed_store',
  'dog_trainer',
  'pet_funeral',
  'public_vet_service',
] as const satisfies readonly (CategorySlug | null)[];

/** The Pet-friendly tab's chips, in order; null is "Todos" (places that take pets). */
export const PET_FRIENDLY_CHIPS = [
  null,
  'restaurant',
  'cafe',
  'lodging',
  'museum',
  'park',
] as const satisfies readonly (CategorySlug | null)[];

/** Every chip of both tabs. */
export const CHIP_CATEGORIES = [...EXPLORE_CHIPS, ...PET_FRIENDLY_CHIPS.slice(1)] as const;
export type ChipCategory = (typeof CHIP_CATEGORIES)[number];

/** Pin and chip colors by category; the first match in this order wins for a place's pin. */
// Owner's rules: only hospitals get the bright red; no turquoise, orange, blue, pink, maroon or
// brown. Colors repeat only across tabs: Explorar
// shows pet businesses, Pet-friendly shows venues.
export const CATEGORY_COLORS: Partial<Record<CategorySlug, string>> = {
  vet_hospital: '#dc2626', // red-600: hospitals only
  veterinarian: '#16a34a', // green-600
  public_vet_service: '#4d7c0f', // lime-800 (olive)
  groomer: '#9333ea', // purple-600
  boarding: '#84cc16', // lime-500
  boutique: '#c026d3', // fuchsia-600
  pet_store: '#5b21b6', // violet-800
  feed_store: '#ca8a04', // yellow-600
  pet_funeral: '#6b7280', // gray-500
  dog_trainer: '#262626', // neutral-800
  restaurant: '#262626', // neutral-800
  cafe: '#eab308', // yellow-500
  lodging: '#6d28d9', // violet-700
  museum: '#c026d3', // fuchsia-600
  park: '#15803d', // green-700
  tourist_site: '#52525b', // zinc-600
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
