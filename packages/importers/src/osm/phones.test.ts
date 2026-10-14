import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import type { OsmElement } from './osm.ts';
import { mapPhoneElement, mexicanPhone, saveOsmPhones } from './phones.ts';

const sample = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../test/fixtures/osm-vet-phones-sample.json'), 'utf8'),
) as { elements: OsmElement[] };
const entries = sample.elements.map(mapPhoneElement).filter((e) => e !== null);

describe('mexicanPhone', () => {
  it('writes numbers as DENUE does, without +52 or the old mobile 1', () => {
    expect(mexicanPhone('+52 55 1234 5678; +52 55 8765 4321')).toBe('55 1234 5678');
    expect(mexicanPhone('+521 (442) 123-4567')).toBe('442 123 4567');
    expect(mexicanPhone('123')).toBeNull();
  });
});

describe('mapPhoneElement on the sample file', () => {
  it('keeps named vets with a phone we can read', () => {
    expect(entries.map((e) => [e.externalId, e.phone])).toEqual([
      ['node/21', '55 1234 5678'],
      ['way/22', '442 123 4567'],
    ]);
  });
});

// Needs the test database, like the other importer tests.
describe('saveOsmPhones', () => {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const add = async (id: string, name: string, lat: number, slug: string, phone?: string) => {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO places (source, external_id, name, address, city, state, location, phone,
                          phone_source)
      VALUES ('denue', ${id}, ${name}, 'Calle 1', 'Ciudad', 'Estado',
              ST_SetSRID(ST_MakePoint(-131, ${lat}), 4326)::geography,
              ${phone ?? null}, ${phone ? 'denue' : null})
      RETURNING id`;
    await sql`INSERT INTO place_categories (place_id, category_id, source)
              SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = ${slug}`;
  };
  const rows = () => sql`
    SELECT external_id, phone, phone_source FROM places
    WHERE external_id LIKE 'test-osm-phones-%' ORDER BY external_id`;
  const cleanup = () => sql`DELETE FROM places WHERE external_id LIKE 'test-osm-phones-%'`;
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it('fills vets without a phone and never replaces another source', async () => {
    await add('test-osm-phones-a', 'Veterinaria la Prueba', 3.0002, 'veterinarian');
    await add(
      'test-osm-phones-b',
      'Hospital Veterinario Prueba',
      3.002,
      'vet_hospital',
      '442 000 0000',
    );
    await add('test-osm-phones-c', 'Restaurante Prueba', 3.0001, 'restaurant');
    expect(await saveOsmPhones(sql, entries)).toEqual({ matched: 1 });
    expect((await rows()).map((r) => [r.external_id, r.phone, r.phone_source])).toEqual([
      ['test-osm-phones-a', '55 1234 5678', 'osm'],
      ['test-osm-phones-b', '442 000 0000', 'denue'],
      ['test-osm-phones-c', null, null],
    ]);

    // A phone removed upstream disappears on the next run.
    expect(await saveOsmPhones(sql, [])).toEqual({ matched: 0 });
    expect((await rows())[0]?.phone).toBeNull();
  });
});
