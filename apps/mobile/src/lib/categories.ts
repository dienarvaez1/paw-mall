import type { CategorySlug, Place } from '@paw-mall/shared';

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
};
const DEFAULT_COLOR = '#525252';

/** The pin color for a place: its selected category's, or its most specific one's. */
export function pinColor(place: Pick<Place, 'categories'>, selected: ChipCategory): string {
  if (selected) return CATEGORY_COLORS[selected] ?? DEFAULT_COLOR;
  const slugs = new Set(place.categories.map((c) => c.slug));
  const first = (Object.keys(CATEGORY_COLORS) as CategorySlug[]).find((slug) => slugs.has(slug));
  return first ? (CATEGORY_COLORS[first] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
}
