import {
  type PlaceHours,
  isOpenAt,
  placeListResponseSchema,
  urgentResponseSchema,
} from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';

// Test places sit in the open Pacific (away from places.test.ts too) and are removed afterwards.
const ORIGIN = { lat: -0.5, lng: -140 };
const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

const allDay = { open: '00:00', close: '24:00' };
const ALWAYS: PlaceHours = {
  '0': allDay,
  '1': allDay,
  '2': allDay,
  '3': allDay,
  '4': allDay,
  '5': allDay,
  '6': allDay,
};
const NEVER: PlaceHours = {
  '0': null,
  '1': null,
  '2': null,
  '3': null,
  '4': null,
  '5': null,
  '6': null,
};

async function addPlace(
  externalId: string,
  kmEast: number,
  slugs: string[],
  extra: { hours?: PlaceHours; open24h?: 'name' | 'owner' } = {},
) {
  const lng = ORIGIN.lng + kmEast / 111.32;
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location, hours, hours_source)
    VALUES ('curated', ${`test-urgent-${externalId}`}, ${externalId}, 'Calle 1', 'Ciudad', 'Estado',
            ST_SetSRID(ST_MakePoint(${lng}, ${ORIGIN.lat}), 4326)::geography,
            ${extra.hours ? sql.json(extra.hours) : null}, ${extra.hours ? 'owner' : null})
    RETURNING id`;
  await sql`
    INSERT INTO place_categories (place_id, category_id, source)
    SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = ANY(${slugs})`;
  if (extra.open24h) {
    await sql`INSERT INTO vet_details (place_id, open24h, open24h_source)
              VALUES (${row!.id}, true, ${extra.open24h})`;
  }
}

beforeAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-urgent-%'`;
  await addPlace('hospital-unknown-near', 0.5, ['veterinarian', 'vet_hospital']);
  await addPlace('hospital-closed-nearest', 0.2, ['veterinarian', 'vet_hospital'], {
    hours: NEVER,
  });
  await addPlace('hint-24h', 1, ['veterinarian'], { open24h: 'name' });
  await addPlace('owner-24h-far', 4, ['veterinarian'], { open24h: 'owner' });
  await addPlace('hospital-open', 3, ['veterinarian', 'vet_hospital'], { hours: ALWAYS });
  await addPlace('plain-vet', 0.1, ['veterinarian']);
  await addPlace('store-open', 0.3, ['pet_store'], { hours: ALWAYS });
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-urgent-%'`;
  await sql.end();
});

describe('GET /v1/places/urgent', () => {
  it('lists vet hospitals and 24-hour vets: open first, then unknown, then closed', async () => {
    const res = await app.request(
      `/v1/places/urgent?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radiusKm=10`,
      {},
      testEnv,
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const { items } = urgentResponseSchema.parse(await res.json());
    expect(items.map((p) => [p.name, p.openNow])).toEqual([
      ['hospital-open', true],
      ['owner-24h-far', true],
      ['hospital-unknown-near', null],
      ['hint-24h', null],
      ['hospital-closed-nearest', false],
    ]);
    expect(items.find((p) => p.name === 'hint-24h')?.open24h).toEqual({
      value: true,
      source: 'name',
    });
  });
});

describe('GET /v1/places/urgent with the Ajustes switches', () => {
  it('applies the radius and "only open now", like the other pages', async () => {
    const urgent = async (params: string) => {
      const res = await app.request(
        `/v1/places/urgent?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&${params}`,
        {},
        testEnv,
      );
      return urgentResponseSchema.parse(await res.json()).items.map((p) => p.name);
    };
    expect(await urgent('radiusKm=10&openNow=true')).toEqual(['hospital-open', 'owner-24h-far']);
    expect(await urgent('radiusKm=10&withPhone=true')).toEqual([]);
  });
});

describe('openNow filter', () => {
  it('keeps only places open by confirmed hours', async () => {
    const res = await app.request(
      `/v1/places?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radiusKm=10&openNow=true`,
      {},
      testEnv,
    );
    const { items } = placeListResponseSchema.parse(await res.json());
    expect(items.map((p) => p.name)).toEqual(['store-open', 'hospital-open', 'owner-24h-far']);
  });
});

describe('place_open_now()', () => {
  it('agrees with isOpenAt in packages/shared', async () => {
    const hours: PlaceHours = {
      '0': null,
      '1': { open: '09:00', close: '20:00' },
      '2': { open: '09:00', close: '20:00' },
      '3': null,
      '4': null,
      '5': { open: '20:00', close: '02:00' },
      '6': allDay,
    };
    const moments = [
      '2026-10-05T15:00:00Z',
      '2026-10-05T14:59:00Z',
      '2026-10-06T02:00:00Z',
      '2026-10-10T03:00:00Z',
      '2026-10-09T15:00:00Z',
      '2026-10-10T07:00:00Z',
      '2026-10-11T07:00:00Z',
      '2026-10-11T06:59:00Z',
    ];
    for (const at of moments) {
      const [row] = await sql<{ open: boolean | null }[]>`
        SELECT place_open_now(${sql.json(hours)}, NULL, NULL, ${at}::timestamptz) AS open`;
      expect([at, row?.open]).toEqual([at, isOpenAt(hours, null, new Date(at))]);
    }
  });
});
