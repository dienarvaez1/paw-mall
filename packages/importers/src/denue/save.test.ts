import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { type DenueRow, saveDenuePlaces } from './save.ts';

// Needs the local database (pnpm db:up && pnpm db:migrate), like the API tests.
const client = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(client, { casing: 'snake_case' });
// A state of its own, so removing "places no longer in DENUE" touches only this test's rows.
const STATE = 'Estado Prueba Importación';

const row = (externalId: string, name: string): DenueRow => ({
  externalId,
  activityCode: '541941',
  name,
  chain: null,
  categories: [{ slug: 'veterinarian', source: 'activity' }],
  open24hHint: false,
  address: 'Calle 1',
  city: 'Ciudad',
  state: STATE,
  phone: null,
  website: null,
  lat: 4,
  lng: -133,
  registeredOn: null,
  editionDate: '2026-05-20',
});

const names = async () =>
  (
    await client<{ name: string }[]>`
      SELECT name FROM places WHERE state = ${STATE} ORDER BY name`
  ).map((r) => r.name);
const runs = async () =>
  (
    await client<
      { count: number }[]
    >`SELECT count(*)::int AS count FROM import_runs WHERE source = 'denue'`
  )[0]!.count;

beforeEach(async () => {
  await client`DELETE FROM places WHERE state = ${STATE}`;
  await saveDenuePlaces(
    db,
    [row('test-save-1', 'Veterinaria Uno'), row('test-save-2', 'Veterinaria Dos')],
    {
      stateNames: new Set([STATE]),
      excludedCount: 0,
    },
  );
});

afterAll(async () => {
  await client`DELETE FROM places WHERE state = ${STATE}`;
  await client.end();
});

describe('saveDenuePlaces', () => {
  it('upserts the edition and removes places that left DENUE', async () => {
    const result = await saveDenuePlaces(
      db,
      [row('test-save-1', 'Veterinaria Uno Renombrada'), row('test-save-3', 'Veterinaria Tres')],
      { stateNames: new Set([STATE]), excludedCount: 0 },
    );
    expect(result).toEqual({ saved: 2, removed: 1 });
    expect(await names()).toEqual(['Veterinaria Tres', 'Veterinaria Uno Renombrada']);
  });

  it('leaves the previous data and no import run when an import fails part way', async () => {
    const runsBefore = await runs();
    // Batches of 2: the first saves a rename and a new place; the second repeats an id, which
    // Postgres refuses ("cannot affect row a second time"), as an interrupted import would stop.
    const broken = [
      row('test-save-1', 'Veterinaria Uno Cambiada'),
      row('test-save-5', 'Veterinaria Cinco'),
      row('test-save-6', 'Veterinaria Seis'),
      row('test-save-6', 'Veterinaria Seis Repetida'),
    ];
    await expect(
      saveDenuePlaces(db, broken, { stateNames: new Set([STATE]), excludedCount: 0, batchSize: 2 }),
    ).rejects.toThrow();
    expect(await names()).toEqual(['Veterinaria Dos', 'Veterinaria Uno']);
    expect(await runs()).toBe(runsBefore);
  });
});
