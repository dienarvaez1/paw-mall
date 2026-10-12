import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { applyChains, chainPolicy, chainsFileSchema } from './chains.ts';

const { chains } = chainsFileSchema.parse(
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../../test/fixtures/chains-sample.json'), 'utf8'),
  ),
);

describe('chainPolicy', () => {
  it('maps the weight limit to the largest dog size', () => {
    expect(chainPolicy(chains[0]!)).toMatchObject({ maxWeightKg: 15, maxDogSize: 'medium' });
  });

  it('reads the committed chains file', () => {
    const file = readFileSync(
      join(import.meta.dirname, '../../data/pet-friendly-chains.json'),
      'utf8',
    );
    expect(chainsFileSchema.parse(JSON.parse(file)).chains.length).toBeGreaterThan(0);
  });
});

// Needs the test database, like the other importer tests.
describe('applyChains', () => {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const add = async (key: string, name: string, slug: string) => {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO places (source, external_id, name, address, city, state, location)
      VALUES ('denue', ${`test-chains-${key}`}, ${name}, 'Calle 1', 'Ciudad', 'Estado',
              ST_SetSRID(ST_MakePoint(-131, 2), 4326)::geography)
      RETURNING id`;
    await sql`INSERT INTO place_categories (place_id, category_id, source)
              SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = ${slug}`;
    return row!.id;
  };
  const cleanup = () => sql`DELETE FROM places WHERE external_id LIKE 'test-chains-%'`;
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it('gives matching branches the policy, keeps other sources, and drops stale ones', async () => {
    const branch = await add('branch', 'Hotel Prueba Reforma', 'lodging');
    await add('restaurant', 'Restaurante Hotel Prueba', 'restaurant');
    const owner = await add('owner', 'Hotel Prueba Centro', 'lodging');
    await sql`INSERT INTO pet_policies (place_id, dogs, source, last_confirmed_on)
              VALUES (${owner}, false, 'owner', '2026-10-01')`;
    expect(await applyChains(sql, chains)).toMatchObject({ branches: { 'Hoteles Prueba': 1 } });
    const [policy] = await sql`SELECT * FROM pet_policies WHERE place_id = ${branch}`;
    expect(policy).toMatchObject({ source: 'chain', max_dog_size: 'medium', max_pets: 1 });
    const [kept] = await sql`SELECT source FROM pet_policies WHERE place_id = ${owner}`;
    expect(kept?.source).toBe('owner');

    await sql`UPDATE places SET name = 'Hotel Otro' WHERE id = ${branch}`;
    await applyChains(sql, chains);
    expect(await sql`SELECT 1 FROM pet_policies WHERE place_id = ${branch}`).toHaveLength(0);
  });
});
