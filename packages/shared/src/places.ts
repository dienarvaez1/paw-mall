import { z } from 'zod';

import { CITY_AREA_RADIUS_KM } from './constants';
import { CATEGORY_GROUPS, CATEGORY_SLUGS } from './categories';
import { placeHoursSchema } from './hours';
import { DOG_SIZES, PET_SPECIES, petPolicySchema } from './pet-policy';
import { verificationSchema } from './verification';

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
/** Who gave a place's weekly hours (Google's are never stored). */
export const HOURS_SOURCES = ['owner', 'website', 'osm'] as const;

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
  /** Weekly hours from the owner, the business's website or OpenStreetMap; null when unknown. */
  hours: placeHoursSchema.nullable(),
  hoursSource: z.enum(HOURS_SOURCES).nullable(),
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
  /** How far the place's details are confirmed (see VERIFICATION_STATUSES). */
  verification: verificationSchema,
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

/**
 * How many places in view the map shows one by one before it groups them into clusters: the
 * map's pin button steps through these (owner's rule, 2026-10-14); 200 until changed.
 */
export const MAP_PIN_LIMITS = [50, 100, 150, 200, 300] as const;
export const MAP_DEFAULT_PINS = 200;
/** The largest of MAP_PIN_LIMITS: the most places the map API returns one by one. */
export const MAP_MAX_PLACES = 300;

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
   * Business name, city or state; every word must match one of them (accents and case ignored;
   * typos are not, see the search benchmark). CDMX, DF and Edomex work too.
   */
  q: z.string().trim().min(1).max(100).optional(),
  /** Radius around an area named by `q`; the Settings radius (radiusKm) stays as it is. */
  areaRadiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(AREA_RADIUS_KM),
  /** "true" when the user picked areaRadiusKm (radius button, zoom): no busy-city 3 mi rule. */
  fixedAreaRadius: z.stringbool().optional(),
  /** A busy city's radius in the user's units: 3 mi, or 5 km (the closest km preset). */
  cityRadiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(CITY_AREA_RADIUS_KM),
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

/** Whether the whole search text is a place's name (to ask the user how to read it). */
export const areaLookupQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  lat: latitude,
  lng: longitude,
});
export type AreaLookupQuery = z.infer<typeof areaLookupQuerySchema>;

export const areaLookupResponseSchema = z.object({
  /** The nearest place with that exact name (accents and case aside), or null. */
  area: searchAreaSchema.omit({ radiusKm: true }).nullable(),
});
export type AreaLookupResponse = z.infer<typeof areaLookupResponseSchema>;

/** Place names starting with what's typed in the search box ("Puerto V" -> "Puerto Vallarta"). */
export const areaSuggestQuerySchema = z.object({
  // Not trimmed: a trailing space means the word is finished ("puerto " is not "Puertollano").
  q: z.string().min(1).max(100),
  lat: latitude,
  lng: longitude,
});
export type AreaSuggestQuery = z.infer<typeof areaSuggestQuerySchema>;

/** Most suggestions shown under the search box. */
export const AREA_SUGGESTIONS_MAX = 5;

export const areaSuggestResponseSchema = z.object({
  /**
   * Up to AREA_SUGGESTIONS_MAX places, one per name (the one a search for that name goes to):
   * cities, towns and landmarks before colonias, then the busiest first.
   */
  suggestions: z.array(searchAreaSchema.omit({ radiusKm: true })),
});
export type AreaSuggestResponse = z.infer<typeof areaSuggestResponseSchema>;

/**
 * Where a search's matches are, so the app can fit the radius to them after a confirmed search
 * (owner's rule, 2026-10-13): the farthest inside the radius, or, with none inside, the nearest
 * within MAX_RADIUS_KM. Distances in km from the circle's center; null when they don't apply.
 */
const searchReach = {
  /** The farthest match inside the radius; null when none is. */
  farthestKm: z.number().nullable().default(null),
  /** With no match inside the radius: the nearest one within MAX_RADIUS_KM; else null. */
  nearestBeyondKm: z.number().nullable().default(null),
};

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
  /** On the first page only (null on the others). */
  ...searchReach,
  /**
   * With nothing found around the user or a moved circle: the municipality nearest the center,
   * to say where ("No places within 5 km of Chiautempan"). Null otherwise.
   */
  nearestMunicipality: z.string().nullable().default(null),
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
  /** "true" when the user picked areaRadiusKm (radius button, zoom): no busy-city 3 mi rule. */
  fixedAreaRadius: z.stringbool().optional(),
  /** A busy city's radius in the user's units: 3 mi, or 5 km (the closest km preset). */
  cityRadiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(CITY_AREA_RADIUS_KM),
  namesOnly: z.stringbool().optional(),
  ...placeFilters,
  /** Most places to return one by one before clustering (tests use a small number). */
  limit: z.coerce.number().int().min(1).max(MAP_MAX_PLACES).default(MAP_DEFAULT_PINS),
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
  ...searchReach,
  /**
   * The city of the place in view nearest the circle's center, to name where the circle is; with
   * none in view, the municipality nearest the center.
   */
  nearestCity: z.string().nullable().default(null),
};

export const placeMapResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('places'), items: z.array(placeSchema), ...mapCounts }),
  z.object({ kind: z.literal('clusters'), clusters: z.array(placeClusterSchema), ...mapCounts }),
]);
export type PlaceMapResponse = z.infer<typeof placeMapResponseSchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

/**
 * Urgencias: the nearest vet hospitals and 24-hour vets, open ones first, within the Ajustes radius
 * and with its place switches (phone, website, social, named, open now).
 */
export const urgentQuerySchema = z.object({
  lat: latitude,
  lng: longitude,
  radiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(25),
  withPhone: placeFilters.withPhone,
  withWebsite: placeFilters.withWebsite,
  withSocial: placeFilters.withSocial,
  named: placeFilters.named,
  openNow: placeFilters.openNow,
  /** The search box: when it names an area ("Xochimilco"), the radius is around it instead. */
  q: z.string().trim().min(1).max(100).optional(),
});
export type UrgentQuery = z.infer<typeof urgentQuerySchema>;

export const URGENT_LIMIT = 20;

export const urgentResponseSchema = z.object({
  /** The area the search named, when it did: distances are then from it. */
  area: searchAreaSchema.nullable().default(null),
  /** Closest first, up to URGENT_LIMIT. */
  items: z.array(placeSchema),
  /** Every urgent place in the radius, beyond the URGENT_LIMIT shown (the summary counts them). */
  total: z.number().int().nonnegative(),
  /** With no places and no area: the municipality nearest the circle's center, to name it. */
  nearestMunicipality: z.string().nullable(),
});
export type UrgentResponse = z.infer<typeof urgentResponseSchema>;
