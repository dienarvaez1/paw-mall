import { z } from 'zod';

import { CATEGORY_GROUPS, CATEGORY_SLUGS } from './categories';
import { SUPPORTED_LOCALES } from './constants';

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
export const valueSourceSchema = z.enum(['denue', 'overture', 'owner', 'shoppers', 'curated']);
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
  distanceKm: z.number().nullable(),
  /** Vets only: open 24 hours. A 'name' source is an unconfirmed hint from the business name. */
  open24h: z.object({ value: z.boolean(), source: z.enum(['name', 'owner']) }).nullable(),
  source: valueSourceSchema,
  phoneSource: valueSourceSchema.nullable(),
  websiteSource: valueSourceSchema.nullable(),
  /** Date of the source edition the place was last loaded from (e.g. DENUE 2026-05-20). */
  sourceUpdatedOn: z.string().nullable(),
});
export type Place = z.infer<typeof placeSchema>;

export const MAX_RADIUS_KM = 50;
export const DEFAULT_RADIUS_KM = 5;
export const MAX_PAGE_SIZE = 100;

export const placeListQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM),
  category: categorySlugSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  lang: z.enum(SUPPORTED_LOCALES).optional(),
});
export type PlaceListQuery = z.infer<typeof placeListQuerySchema>;

export const placeListResponseSchema = z.object({
  items: z.array(placeSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type PlaceListResponse = z.infer<typeof placeListResponseSchema>;
