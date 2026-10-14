/**
 * Loads the fixed end-to-end data (data/e2e-fixtures.json) into its own database, paw_mall_e2e, never the
 * dev or the Vitest one: creates it if missing, migrates it, empties the place tables and inserts
 * the fixtures. Safe to re-run before every Maestro run.
 *
 *   pnpm e2e:seed
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { nameKey } from '../areas/build.ts';

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://paw:paw@localhost:5434/paw_mall_e2e';

type Fixture = {
  name: string;
  key: string;
  category: string;
  address: string;
  kmNorth?: number;
  kmEast?: number;
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  socialUrl?: string;
  hours?: 'allDay';
  open24h?: boolean;
  petPolicy?: {
    dogs: boolean;
    maxDogSize: string;
    areas: string[];
    sourceName: string;
    lastConfirmedOn: string;
  };
};
type Area = {
  kind: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  businessCount: number;
};
type Fixtures = { user: { lat: number; lng: number }; places: Fixture[]; areas: Area[] };

const KM_PER_DEGREE_LAT = 111.32;
const ALL_DAY = Object.fromEntries(
  ['0', '1', '2', '3', '4', '5', '6'].map((day) => [day, { open: '00:00', close: '24:00' }]),
);
const quiet = { max: 1, connect_timeout: 3, onnotice: () => {} };

async function createDatabase() {
  const name = new URL(E2E_DATABASE_URL).pathname.slice(1);
  const serverUrl = new URL(E2E_DATABASE_URL);
  serverUrl.pathname = '/postgres';
  const server = postgres(serverUrl.href, quiet);
  try {
    const [found] = await server`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (!found) await server.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await server.end();
  }
}

async function main() {
  const fixtures = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../data/e2e-fixtures.json'), 'utf8'),
  ) as Fixtures;
  await createDatabase();
  const sql = postgres(E2E_DATABASE_URL, quiet);
  try {
    await migrate(drizzle(sql), {
      // The API owns the schema (as for the test database, apps/api/test/test-db.ts).
      migrationsFolder: join(import.meta.dirname, '../../../../apps/api/src/db/migrations'),
    });
    // Everything a flow can change goes back to the fixtures (categories stay: migrations own them).
    await sql`TRUNCATE places, search_areas, google_usage, google_lookups RESTART IDENTITY CASCADE`;

    const { user } = fixtures;
    const kmPerDegreeLng = KM_PER_DEGREE_LAT * Math.cos((user.lat * Math.PI) / 180);
    for (const place of fixtures.places) {
      const lat = place.lat ?? user.lat + (place.kmNorth ?? 0) / KM_PER_DEGREE_LAT;
      const lng = place.lng ?? user.lng + (place.kmEast ?? 0) / kmPerDegreeLng;
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO places (source, external_id, name, address, city, state, phone, website,
                            social_url, hours, hours_source, phone_source, website_source,
                            website_status, location)
        VALUES ('curated', ${`e2e-${place.key}`}, ${place.name}, ${place.address},
                ${place.city ?? 'Cuauhtémoc'}, ${place.state ?? 'Ciudad de México'},
                ${place.phone ?? null}, ${place.website ?? null}, ${place.socialUrl ?? null},
                ${place.hours === 'allDay' ? JSON.stringify(ALL_DAY) : null}::jsonb,
                ${place.hours ? 'owner' : null}, ${place.phone ? 'owner' : null},
                ${place.website ? 'owner' : null}, ${place.website ? 'ok' : null},
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)
        RETURNING id`;
      const id = row!.id;
      await sql`INSERT INTO place_categories (place_id, category_id, source)
                SELECT ${id}, id, 'activity' FROM categories WHERE slug = ${place.category}`;
      if (place.open24h) {
        await sql`INSERT INTO vet_details (place_id, open24h, open24h_source)
                  VALUES (${id}, true, 'owner')`;
      }
      if (place.petPolicy) {
        const policy = place.petPolicy;
        await sql`INSERT INTO pet_policies (place_id, dogs, max_dog_size, areas, source,
                                            source_name, last_confirmed_on)
                  VALUES (${id}, ${policy.dogs}, ${policy.maxDogSize}, ${policy.areas},
                          'curated', ${policy.sourceName}, ${policy.lastConfirmedOn})`;
      }
    }
    for (const area of fixtures.areas) {
      await sql`INSERT INTO search_areas (kind, name, name_key, state, location, business_count)
                VALUES (${area.kind}, ${area.name}, ${nameKey(area.name)}, ${area.state},
                        ST_SetSRID(ST_MakePoint(${area.lng}, ${area.lat}), 4326)::geography,
                        ${area.businessCount})`;
    }
    await sql`ANALYZE places`;
    console.log(
      `paw_mall_e2e: ${fixtures.places.length} places, ${fixtures.areas.length} search areas.`,
    );
  } finally {
    await sql.end();
  }
}

await main();
