import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { mapHoursElement, saveOsmHours } from './hours.ts';
import type { OsmElement } from './osm.ts';

const sample = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../test/fixtures/osm-hours-sample.json'), 'utf8'),
) as { elements: OsmElement[] };
const entries = sample.elements.map(mapHoursElement).filter((e) => e !== null);

describe('mapHoursElement on the sample file', () => {
  it('keeps named places of a kind we list, with hours we can read', () => {
    expect(entries.map((e) => [e.externalId, e.categories])).toEqual([
      ['node/11', ['restaurant']],
      ['node/12', ['veterinarian', 'vet_hospital']],
    ]);
    expect(entries[0]?.hours['0']).toBeNull();
    expect(entries[0]?.hours['6']).toEqual({ open: '09:00', close: '22:00' });
  });
});

// Needs the test database, like the other importer tests.
describe('saveOsmHours', () => {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const add = async (id: string, name: string, lat: number, slug: string, hoursSource?: string) => {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO places (source, external_id, name, address, city, state, location, hours,
                          hours_source)
      VALUES ('denue', ${id}, ${name}, 'Calle 1', 'Ciudad', 'Estado',
              ST_SetSRID(ST_MakePoint(-131, ${lat}), 4326)::geography,
              ${hoursSource ? sql.json({ 0: null }) : null}, ${hoursSource ?? null})
      RETURNING id`;
    await sql`INSERT INTO place_categories (place_id, category_id, source)
              SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = ${slug}`;
  };
  const cleanup = () => sql`DELETE FROM places WHERE external_id LIKE 'test-osm-hours-%'`;
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it('matches by kind, distance and name, and never replaces owner hours', async () => {
    await add('test-osm-hours-taco', 'Taqueria el Prueba', 2.0001, 'restaurant');
    await add('test-osm-hours-other', 'Pizzas Lejanas', 2.0001, 'restaurant');
    await add('test-osm-hours-vet', 'Veterinaria Prueba', 2.001, 'veterinarian', 'owner');
    expect(await saveOsmHours(sql, entries)).toEqual({ matched: 1 });
    const rows = await sql`
      SELECT external_id, hours_source FROM places WHERE external_id LIKE 'test-osm-hours-%'
      ORDER BY external_id`;
    expect(rows.map((r) => [r.external_id, r.hours_source])).toEqual([
      ['test-osm-hours-other', null],
      ['test-osm-hours-taco', 'osm'],
      ['test-osm-hours-vet', 'owner'],
    ]);
  });
});
