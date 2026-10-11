import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PET_FRIENDLY_CATEGORIES, dogSizeForWeightLimit as sharedSize } from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { type CuratedPlace, dogSizeForWeightLimit, readCuratedFile } from './curated.ts';
import { saveCuratedPlaces } from './save.ts';

const sample = () =>
  readCuratedFile(
    JSON.parse(
      readFileSync(join(import.meta.dirname, '../../test/fixtures/curated-sample.json'), 'utf8'),
    ),
  );

describe('the copies of shared rules', () => {
  it('maps weight limits to sizes as packages/shared does', () => {
    for (const kg of [1, 5, 10, 10.5, 15, 22.7, 25, 25.5, 35, 80]) {
      expect(dogSizeForWeightLimit(kg)).toBe(sharedSize(kg));
    }
  });

  it('takes every pet-friendly category', () => {
    const sample = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../test/fixtures/curated-sample.json'), 'utf8'),
    );
    const entry = sample.places[0];
    for (const slug of PET_FRIENDLY_CATEGORIES) {
      expect(() =>
        readCuratedFile({ ...sample, places: [{ ...entry, categories: [slug] }] }),
      ).not.toThrow();
    }
  });
});

describe('readCuratedFile', () => {
  it('derives the largest dog size and leaves out cruelty-linked names', () => {
    const { places, excluded } = sample();
    expect(excluded).toEqual(['gallos-de-pelea']);
    expect(places.map((p) => [p.externalId, p.policy.maxDogSize])).toEqual([
      ['hotel-any-size', 'large'],
      ['hotel-15-kg', 'medium'],
    ]);
    expect(places[1]).toMatchObject({
      sourceName: 'Cadena',
      checkedOn: '2026-10-09',
      policy: { fee: { amount: 350, currency: 'MXN', per: 'night' }, maxWeightKg: 15 },
    });
  });

  it('rejects duplicate ids and unknown fields', () => {
    const file = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../test/fixtures/curated-sample.json'), 'utf8'),
    );
    const first = file.places[0];
    expect(() => readCuratedFile({ ...file, places: [first, first] })).toThrow(/Duplicate id/);
    expect(() => readCuratedFile({ ...file, places: [{ ...first, email: 'x' }] })).toThrow();
  });
});

// Needs the local database (pnpm db:up && pnpm db:migrate), like the review tests. Test rows use
// ids starting with "test-curated-", and real curated places are left alone.
describe('saveCuratedPlaces', () => {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const testPlaces = (): CuratedPlace[] =>
    sample().places.map((p) => ({ ...p, externalId: `test-curated-${p.externalId}` }));
  const policyOf = async (externalId: string) =>
    (
      await sql`
        SELECT pp.* FROM pet_policies pp JOIN places p ON p.id = pp.place_id
        WHERE p.external_id = ${externalId}`
    )[0];

  beforeEach(async () => {
    await sql`DELETE FROM places WHERE external_id LIKE 'test-curated-%'`;
  });
  afterAll(async () => {
    await sql`DELETE FROM places WHERE external_id LIKE 'test-curated-%'`;
    await sql.end();
  });

  it('saves places, categories and policies, and keeps an owner policy', async () => {
    const result = await saveCuratedPlaces(sql, testPlaces(), { removeMissing: false });
    expect(result).toMatchObject({ saved: 2, policies: 2, ownerKept: 0, removed: 0 });
    expect(await policyOf('test-curated-hotel-15-kg')).toMatchObject({
      dogs: true,
      max_dog_size: 'medium',
      max_weight_kg: 15,
      source: 'curated',
      source_name: 'Cadena',
    });
    const [category] = await sql`
      SELECT c.slug FROM place_categories pc JOIN categories c ON c.id = pc.category_id
      JOIN places p ON p.id = pc.place_id WHERE p.external_id = 'test-curated-hotel-15-kg'`;
    expect(category?.slug).toBe('lodging');

    // The owner's policy wins over the next import.
    await sql`
      UPDATE pet_policies SET source = 'owner', max_dog_size = 'large'
      WHERE place_id = (SELECT id FROM places WHERE external_id = 'test-curated-hotel-15-kg')`;
    const again = await saveCuratedPlaces(sql, testPlaces(), { removeMissing: false });
    expect(again).toMatchObject({ policies: 1, ownerKept: 1 });
    expect(await policyOf('test-curated-hotel-15-kg')).toMatchObject({
      source: 'owner',
      max_dog_size: 'large',
    });
  });

  it('clears shopper answers when a curated policy changes', async () => {
    await saveCuratedPlaces(sql, testPlaces(), { removeMissing: false });
    const [place] =
      await sql`SELECT id FROM places WHERE external_id = 'test-curated-hotel-any-size'`;
    await sql`
      INSERT INTO policy_answers (place_id, answer, client_id)
      VALUES (${place!.id}, 'confirm', 'test-client-0000000001')`;

    // Same policy: answers stay.
    await saveCuratedPlaces(sql, testPlaces(), { removeMissing: false });
    expect((await sql`SELECT 1 FROM policy_answers WHERE place_id = ${place!.id}`).length).toBe(1);

    // Changed policy: answers go.
    const changed = testPlaces().map((p) =>
      p.externalId === 'test-curated-hotel-any-size'
        ? { ...p, policy: { ...p.policy, cats: false } }
        : p,
    );
    await saveCuratedPlaces(sql, changed, { removeMissing: false });
    expect((await sql`SELECT 1 FROM policy_answers WHERE place_id = ${place!.id}`).length).toBe(0);
  });
});
