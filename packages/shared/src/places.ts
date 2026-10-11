import { z } from 'zod';

import { CATEGORY_GROUPS, CATEGORY_SLUGS } from './categories';
import { placeHoursSchema } from './hours';
import { DOG_SIZES, PET_SPECIES, petPolicySchema } from './pet-policy';

export const categorySlugSchema = z.enum(CATEGORY_SLUGS);

export const categorySchema = z.object({
  slug: categorySlugSchema,
  group: z.enum(CATEGORY_GROUPS),
  name: z.string(),
  /** Visible places in this category. */
  placeCount: z.number().int().nonnegative(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryListResponseSchema = z.object({ items: z.array(categorySchema) });
export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>;

/** Where a value came from. Owner-verified values always win over the others. */
export const valueSourceSchema = z.enum([
  'denue',
  'overture',
  'owner',
  'shoppers',
  'curated',
  'osm',
]);
export type ValueSource = z.infer<typeof valueSourceSchema>;

export const placeSchema = z.object({
  id: z.number().int(),
  /** Null when the source has no name (DENUE has some unnamed businesses). */
  name: z.string().nullable(),
  chain: z.string().nullable(),
  categories: z.array(z.object({ slug: categorySlugSchema, name: z.string() })),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  socialUrl: z.string().nullable(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  /** Null when the request had no lat/lng. */
  distanceKm: z.number().nullable(),
  /** Vets only: open 24 hours. A 'name' source is an unconfirmed hint from the business name. */
  open24h: z.object({ value: z.boolean(), source: z.enum(['name', 'owner']) }).nullable(),
  /** Confirmed weekly hours (owner-verified from Phase 5); null when unknown. */
  hours: placeHoursSchema.nullable(),
  /**
   * Open right now by confirmed hours (or an owner's 24-hour answer); null when unknown. A "24
   * horas" name hint alone stays null.
   */
  openNow: z.boolean().nullable(),
  source: valueSourceSchema,
  phoneSource: valueSourceSchema.nullable(),
  websiteSource: valueSourceSchema.nullable(),
  /** Date of the source edition the place was last loaded from (e.g. DENUE 2026-05-20). */
  sourceUpdatedOn: z.string().nullable(),
  /** When the source first registered the business (first of the month), if known. */
  registeredOn: z.string().nullable(),
  /** Date the owner's claim was approved ("Verificado por el dueño"); null when not verified. */
  ownerVerifiedOn: z.string().nullable(),
  /** Pet-friendly venues: what pets they take, who said so and when; null when unknown. */
  petPolicy: petPolicySchema.nullable(),
});
export type Place = z.infer<typeof placeSchema>;

export const DEFAULT_RADIUS_KM = 5;
/** The largest radius in Settings is 100 miles (160.9 km), the owner's choice (2026-10-05). */
export const MAX_RADIUS_KM = 161;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;
/**
 * When a search names an area ("Zócalo", "Roma Norte", "Coyoacán"), places within this distance
 * of it: 5 km, or 3 mi for users who chose miles (the app sends that). The radius in Ajustes is
 * left alone.
 */
export const AREA_RADIUS_KM = 5;

/** Most places the map shows one by one; with more in view it shows clusters. */
export const MAP_MAX_PLACES = 200;

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);
const radiusKm = z.coerce.number().positive().max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM);

/** Contact filters from Settings: "true" keeps only places that have it. */
const placeFilters = {
  category: categorySlugSchema.optional(),
  /** Only places in a category of this group (Explorar: pet businesses; Pet-friendly: venues). */
  group: z.enum(CATEGORY_GROUPS).optional(),
  withPhone: z.stringbool().optional(),
  withWebsite: z.stringbool().optional(),
  withSocial: z.stringbool().optional(),
  /** Hide places without a real name (none, or "… sin nombre"). */
  named: z.stringbool().optional(),
  /** Only places open right now by confirmed hours. */
  openNow: z.stringbool().optional(),
  /**
   * Only places whose pet policy takes pets (not under review); with the pet profile, only those
   * taking that species, and dogs of that size.
   */
  petFriendly: z.stringbool().optional(),
  /** With petFriendly: also venues without a pet policy yet (never those that say no). */
  withUnconfirmed: z.stringbool().optional(),
  petSpecies: z.enum(PET_SPECIES).optional(),
  dogSize: z.enum(DOG_SIZES).optional(),
};
export type PlaceFilters = { [K in keyof typeof placeFilters]?: z.infer<(typeof placeFilters)[K]> };

/** "minLng,minLat,maxLng,maxLat", e.g. the visible map area. */
const bbox = z
  .string()
  .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
  .transform((value) => {
    const [minLng, minLat, maxLng, maxLat] = value.split(',').map(Number) as [
      number,
      number,
      number,
      number,
    ];
    return { minLng, minLat, maxLng, maxLat };
  });

/** Places within radiusKm of lat/lng, nearest first; `q` searches name, city and state. */
export const placeListQuerySchema = z.object({
  lat: latitude,
  lng: longitude,
  radiusKm,
  /**
   * Business name, city or state; every word must match one of them (accents, case and small
   * typos ignored). CDMX, DF and Edomex work too.
   */
  q: z.string().trim().min(1).max(100).optional(),
  /** Radius around an area named by `q`; the Settings radius (radiusKm) stays as it is. */
  areaRadiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(AREA_RADIUS_KM),
  /** "true" searches `q` in business names only, even when it names an area. */
  namesOnly: z.stringbool().optional(),
  ...placeFilters,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PlaceListQuery = z.infer<typeof placeListQuerySchema>;

export const searchAreaSchema = z.object({
  name: z.string(),
  kind: z.enum(['landmark', 'municipality', 'town', 'colonia']),
  municipality: z.string().nullable(),
  state: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  radiusKm: z.number(),
});
export type SearchArea = z.infer<typeof searchAreaSchema>;

export const placeListResponseSchema = z.object({
  /**
   * The area `q` named, when it did: places are then within area.radiusKm of it, nearest to it
   * first, and their distances are from it.
   */
  area: searchAreaSchema.nullable().default(null),
  /** The category the search's keywords named ("vet" → veterinarian), applied as a filter. */
  searchCategory: categorySlugSchema.nullable().default(null),
  items: z.array(placeSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type PlaceListResponse = z.infer<typeof placeListResponseSchema>;

/** The map: places inside the visible box and within radiusKm of lat/lng (the circle). */
export const placeMapQuerySchema = z.object({
  bbox,
  lat: latitude,
  lng: longitude,
  radiusKm,
  /** The search box, as in the list: an area moves the map's search there; other text filters names. */
  q: z.string().trim().min(1).max(100).optional(),
  areaRadiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(AREA_RADIUS_KM),
  namesOnly: z.stringbool().optional(),
  ...placeFilters,
  /** Most places to return one by one before clustering (tests use a small number). */
  limit: z.coerce.number().int().min(1).max(MAP_MAX_PLACES).default(MAP_MAX_PLACES),
});
export type PlaceMapQuery = z.infer<typeof placeMapQuerySchema>;

export const placeClusterSchema = z.object({
  /** Average position of the cluster's places. */
  location: z.object({ lat: z.number(), lng: z.number() }),
  count: z.number().int().positive(),
  /** The box around the cluster's places [minLng, minLat, maxLng, maxLat], to zoom into it. */
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export type PlaceCluster = z.infer<typeof placeClusterSchema>;

const mapCounts = {
  /** The area the search named, as in the list: the circle is then around it. */
  area: searchAreaSchema.nullable().default(null),
  searchCategory: categorySlugSchema.nullable().default(null),
  /** Places in view (inside the box and the radius). */
  total: z.number().int(),
  /** Every place within radiusKm, in view or not. */
  radiusTotal: z.number().int(),
};

export const placeMapResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('places'), items: z.array(placeSchema), ...mapCounts }),
  z.object({ kind: z.literal('clusters'), clusters: z.array(placeClusterSchema), ...mapCounts }),
]);
export type PlaceMapResponse = z.infer<typeof placeMapResponseSchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** Urgencias: the nearest vet hospitals and 24-hour vets, open ones first. */
export const urgentQuerySchema = z.object({
  lat: latitude,
  lng: longitude,
  radiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(25),
});
export type UrgentQuery = z.infer<typeof urgentQuerySchema>;

export const URGENT_LIMIT = 20;

export const urgentResponseSchema = z.object({
  /** Open now (confirmed) first, then unconfirmed, then closed; nearest first within each. */
  items: z.array(placeSchema),
});
export type UrgentResponse = z.infer<typeof urgentResponseSchema>;
