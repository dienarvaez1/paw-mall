import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { type OsmElement, mapOsmElement, slimElement } from './osm.ts';
import { saveOsmPlaces } from './save.ts';

const sample = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../test/fixtures/osm-sample.json'), 'utf8'),
) as { fetchedOn: string; elements: OsmElement[] };
const places = sample.elements.map(mapOsmElement).filter((p) => p !== null);

describe('mapOsmElement on the sample file', () => {
  it('keeps dog parks, and named parks and venues with a dog rule', () => {
    expect(places.map((p) => p.externalId)).toEqual(['node/1', 'way/2', 'node/3', 'node/4']);
  });

  it('reads the rule, the category and the address', () => {
    const [dogPark, park, restaurant, cafe] = places;
    expect(dogPark).toMatchObject({ name: null, category: 'park', dogs: true, dogPark: true });
    expect(park).toMatchObject({ category: 'park', dogs: true, leashed: true, lat: 19.42 });
    expect(restaurant).toMatchObject({
      category: 'restaurant',
      street: 'Calle Durango 12',
      website: 'https://fonda.example.mx',
      url: 'https://www.openstreetmap.org/node/3',
    });
    expect(cafe).toMatchObject({ category: 'cafe', dogs: false });
  });

  it('keeps only the tags the snapshot needs', () => {
    const slim = slimElement({
      type: 'node',
      id: 9,
      lat: 1,
      lon: 2,
      tags: { name: 'X', dog: 'yes', amenity: 'cafe', opening_hours: 'Mo-Fr', phone: '55' },
    });
    expect(slim).toEqual({
      type: 'node',
      id: 9,
      lat: 1,
      lon: 2,
      tags: { name: 'X', dog: 'yes', amenity: 'cafe' },
    });
  });
});

// Needs the test database, like the other importer tests. Sample ids are "node/1"…; test rows are
// removed after.
describe('saveOsmPlaces', () => {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const cleanup = () =>
    sql`DELETE FROM places WHERE source = 'osm' AND external_id = ANY(${places.map((p) => p.externalId)})`;
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it('saves places with an OpenStreetMap policy, and gives unnamed dog parks a name', async () => {
    const result = await saveOsmPlaces(sql, places, sample.fetchedOn, { removeMissing: false });
    expect(result).toMatchObject({ saved: 4, skipped: 0, ownerKept: 0, removed: 0 });
    const rows = await sql`
      SELECT p.external_id, p.name, pp.dogs, pp.max_dog_size, pp.rules, pp.source, pp.source_url,
             pp.last_confirmed_on::text AS checked
      FROM places p JOIN pet_policies pp ON pp.place_id = p.id
      WHERE p.source = 'osm' AND p.external_id = ANY(${places.map((p) => p.externalId)})
      ORDER BY p.external_id`;
    expect(rows.find((r) => r.external_id === 'node/1')).toMatchObject({
      name: expect.stringMatching(/^Parque canino/),
      dogs: true,
      max_dog_size: 'large',
      rules: 'Parque canino.',
      source: 'osm',
      checked: '2026-10-11',
    });
    expect(rows.find((r) => r.external_id === 'node/3')).toMatchObject({
      dogs: true,
      max_dog_size: null,
      source_url: 'https://www.openstreetmap.org/node/3',
    });
    expect(rows.find((r) => r.external_id === 'node/4')).toMatchObject({ dogs: false });
  });
});
