// Curated pet-friendly places (data/pet-friendly-cdmx.json): restaurants, cafés, lodging, museums
// and parks the team collected from public statements, each with its source and the date it was
// checked.
//
// Importer scripts run on plain Node, which can't load packages/shared's values (its imports have
// no file extensions), so this file imports only its types: the lists below must match them
// (`satisfies` checks that at typecheck) and curated.test.ts checks the size rule against shared.
import type { CategorySlug, DogSize, PetArea, PetFee, PetPolicyInput } from '@pet-helper/shared';
import { z } from 'zod';

import { isCrueltyLinked } from '../denue/map.ts';

const PET_FRIENDLY_CATEGORIES = [
  'restaurant',
  'cafe',
  'lodging',
  'museum',
  'park',
  'tourist_site',
] as const satisfies readonly CategorySlug[];
const PET_AREAS = ['indoor', 'terrace', 'outdoor'] as const satisfies readonly PetArea[];

/** As dogSizeForWeightLimit in packages/shared: pequeño up to 10 kg, mediano up to 25 kg. */
export function dogSizeForWeightLimit(maxWeightKg: number): DogSize {
  if (maxWeightKg > 25) return 'large';
  if (maxWeightKg > 10) return 'medium';
  return 'small';
}

const petFeeSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.enum(['MXN', 'USD']).optional(),
  per: z.enum(['night', 'stay', 'visit']).optional(),
}) satisfies z.ZodType<PetFee>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const entrySchema = z.strictObject({
  /** Stable id: the place's external_id with source 'curated'. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  categories: z.array(z.enum(PET_FRIENDLY_CATEGORIES)).min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  location: z.object({ lat: z.number().min(14).max(33), lng: z.number().min(-119).max(-86) }),
  phone: z.string().nullable(),
  website: z.url().nullable(),
  policy: z.strictObject({
    dogs: z.boolean().nullable(),
    cats: z.boolean().nullable(),
    otherPets: z.boolean().nullable(),
    /** The source says any size is welcome. */
    noSizeLimit: z.boolean().optional(),
    maxWeightKg: z.number().positive().nullable(),
    maxPets: z.number().int().positive().nullable(),
    fee: petFeeSchema.nullable(),
    areas: z.array(z.enum(PET_AREAS)),
    rules: z.string().nullable(),
  }),
  source: z.strictObject({ name: z.string().min(1), url: z.url(), checkedOn: isoDate }),
});
export type CuratedEntry = z.infer<typeof entrySchema>;

export const curatedFileSchema = z.object({
  about: z.string(),
  places: z.array(entrySchema).superRefine((places, ctx) => {
    const seen = new Set<string>();
    for (const [index, place] of places.entries()) {
      if (seen.has(place.id)) {
        ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `Duplicate id ${place.id}` });
      }
      seen.add(place.id);
    }
  }),
});

export type CuratedPlace = {
  externalId: string;
  name: string;
  categories: CategorySlug[];
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  policy: PetPolicyInput;
  sourceName: string;
  sourceUrl: string;
  checkedOn: string;
};

/**
 * The places to save, and the ones left out because their names look linked to animal cruelty
 * (CLAUDE.md: never list them, curated or not).
 */
export function readCuratedFile(json: unknown): { places: CuratedPlace[]; excluded: string[] } {
  const file = curatedFileSchema.parse(json);
  const excluded = file.places.filter((entry) => isCrueltyLinked(entry.name));
  return {
    places: file.places.filter((entry) => !isCrueltyLinked(entry.name)).map(toCuratedPlace),
    excluded: excluded.map((entry) => entry.id),
  };
}

export function toCuratedPlace(entry: CuratedEntry): CuratedPlace {
  const { noSizeLimit, ...policy } = entry.policy;
  // Any size when the source says so; otherwise the size the weight limit lets in; unknown
  // when the source gives neither, or takes no dogs.
  const maxDogSize =
    policy.dogs !== true
      ? null
      : noSizeLimit
        ? 'large'
        : policy.maxWeightKg !== null
          ? dogSizeForWeightLimit(policy.maxWeightKg)
          : null;
  return {
    externalId: entry.id,
    name: entry.name,
    categories: entry.categories,
    address: entry.address,
    city: entry.city,
    state: entry.state,
    lat: entry.location.lat,
    lng: entry.location.lng,
    phone: entry.phone,
    website: entry.website,
    policy: { ...policy, maxDogSize },
    sourceName: entry.source.name,
    sourceUrl: entry.source.url,
    checkedOn: entry.source.checkedOn,
  };
}
