// Database schema. Kept free of relative imports so the importers can load it with plain Node.
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * PostGIS point in WGS 84. Write it with `makePoint()`; read it with ST_X/ST_Y.
 * drizzle-kit quotes this type in generated SQL ("geography(Point, 4326)"), which Postgres rejects:
 * remove the quotes by hand in any migration that creates or alters this column.
 */
const geographyPoint = customType<{ data: string }>({
  dataType: () => 'geography(Point, 4326)',
});

/** Pet businesses and pet-friendly venues; slugs and groups are in packages/shared. */
export const categories = pgTable('categories', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  /** 'pet_business' or 'pet_friendly'. */
  group: text().notNull(),
  sortOrder: smallint().notNull(),
});

export const categoryTranslations = pgTable(
  'category_translations',
  {
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    locale: text().notNull(),
    name: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.locale] })],
);

/** Every business or venue. */
export const places = pgTable(
  'places',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Where the place came from: 'denue' (INEGI business directory), later 'owner' or 'curated'. */
    source: text().notNull(),
    /** The place's id in its source, e.g. the DENUE id. */
    externalId: text(),
    /** DENUE activity class (SCIAN), e.g. '541941' for private vets. */
    activityCode: text(),
    // Null when the source doesn't record it (DENUE has some unnamed businesses).
    name: text(),
    chain: text(),
    address: text().notNull(),
    city: text().notNull(),
    state: text().notNull(),
    phone: text(),
    website: text(),
    /** A social-media page (usually Facebook) from Overture Maps; many small businesses only have this. */
    socialUrl: text(),
    /** Opening hours; filled from Phase 4 on. */
    hours: jsonb(),
    location: geographyPoint().notNull(),
    /** When the source first registered the business (DENUE fecha_alta, first of the month). */
    registeredOn: date({ mode: 'string' }),
    /** Date of the source edition the place was last loaded from (e.g. DENUE 2026-05-20). */
    sourceUpdatedOn: date({ mode: 'string' }),
    /** Set when shoppers reported the place closed (hidden pending review) or it was confirmed. */
    hiddenAt: timestamp({ withTimezone: true }),
    hiddenReason: text(),
    /** Set when the owner's claim (checked against their SAT certificate) was approved. */
    ownerVerifiedAt: timestamp({ withTimezone: true }),
    /** Where phone and website came from: 'denue', 'overture' or 'owner'. */
    phoneSource: text(),
    websiteSource: text(),
    /**
     * Last website check (`pnpm places:check-websites`): ok, blocked, unreachable or dead. Dead
     * websites aren't shown unless the owner verified them.
     */
    websiteStatus: text(),
    /** Consecutive failed checks; unreachable sites become dead after two. */
    websiteFailures: integer().notNull().default(0),
    websiteCheckedAt: timestamp({ withTimezone: true }),
    /** The matching Overture Maps place, set by `pnpm places:enrich-overture`. */
    overtureId: text(),
  },
  (t) => [
    index('places_location_idx').using('gist', t.location),
    uniqueIndex('places_source_external_id_idx').on(t.source, t.externalId),
    // Name search: accent- and case-insensitive substring and typo matching.
    index('places_name_search_idx').using(
      'gin',
      sql`lower(f_unaccent(coalesce(${t.name}, ''))) gin_trgm_ops`,
    ),
    // Search by name, city or state, word by word. place_search_text() is defined in migration 0003.
    index('places_search_idx').using(
      'gin',
      sql`place_search_text(${t.name}, ${t.city}, ${t.state}) gin_trgm_ops`,
    ),
  ],
);

/** One or more categories per place (a vet that also grooms). */
export const placeCategories = pgTable(
  'place_categories',
  {
    placeId: integer()
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    categoryId: integer()
      .notNull()
      .references(() => categories.id),
    /** 'activity' (the DENUE class), 'name' (picked from the business name) or 'owner'. */
    source: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.categoryId] }),
    index('place_categories_category_id_idx').on(t.categoryId),
  ],
);

/** Vet-only details. */
export const vetDetails = pgTable('vet_details', {
  placeId: integer()
    .primaryKey()
    .references(() => places.id, { onDelete: 'cascade' }),
  open24h: boolean(),
  /** 'name' ("24 horas" in the business name: an unconfirmed hint) or 'owner'. */
  open24hSource: text(),
  acceptsEmergencies: boolean(),
  /** Species treated, e.g. ['dog', 'cat']; null when unknown. */
  species: text().array(),
});

export const importRuns = pgTable(
  'import_runs',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    source: text().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    rowsOk: integer().notNull().default(0),
    rowsFailed: integer().notNull().default(0),
    /** Rows left out on purpose, e.g. names linked to animal cruelty. */
    rowsExcluded: integer().notNull().default(0),
  },
  (t) => [uniqueIndex('import_runs_source_started_at_idx').on(t.source, t.startedAt)],
);

/** SQL for a PostGIS point from longitude/latitude. */
export function makePoint(lng: number, lat: number) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}
