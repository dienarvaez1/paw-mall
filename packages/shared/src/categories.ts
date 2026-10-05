/** Pet businesses: imported from INEGI DENUE (Phase 2). */
export const PET_BUSINESS_CATEGORIES = [
  'pet_store',
  'boutique',
  'veterinarian',
  'vet_hospital',
  'public_vet_service',
  'groomer',
  'boarding',
  'feed_store',
] as const;

/** Pet-friendly venues: filled from Phase 6 on. */
export const PET_FRIENDLY_CATEGORIES = [
  'restaurant',
  'cafe',
  'lodging',
  'museum',
  'park',
  'tourist_site',
] as const;

export const CATEGORY_SLUGS = [...PET_BUSINESS_CATEGORIES, ...PET_FRIENDLY_CATEGORIES] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CATEGORY_GROUPS = ['pet_business', 'pet_friendly'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];
