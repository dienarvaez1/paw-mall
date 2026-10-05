import { googleDetailsResponseSchema } from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type Database, createDb } from '../../db/client';
import { lookupGoogleDetails, userKey } from '../../queries/google';
import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';

const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
const { db, close } = createDb(TEST_DATABASE_URL);
// A month of its own, so these counters never mix with real usage.
const NOW = new Date('2099-03-15T18:00:00Z');
let placeId = 0;

beforeAll(async () => {
  await sql`DELETE FROM places WHERE source = 'curated' AND external_id = 'test-google-place'`;
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location)
    VALUES ('curated', 'test-google-place', 'Veterinaria Huellitas', 'Calle 1', 'Coyoacán',
            'Ciudad de México', ST_SetSRID(ST_MakePoint(-99.16, 19.35), 4326)::geography)
    RETURNING id`;
  placeId = row?.id ?? 0;
});

beforeEach(async () => {
  await sql`UPDATE places SET google_place_id = NULL, google_match_status = NULL, google_matched_at = NULL,
              hours = NULL WHERE id = ${placeId}`;
  await sql`DELETE FROM google_usage WHERE month = '2099-03'`;
  await sql`DELETE FROM google_lookups WHERE day = '2099-03-15'`;
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE source = 'curated' AND external_id = 'test-google-place'`;
  await sql`DELETE FROM google_usage WHERE month = '2099-03'`;
  await sql`DELETE FROM google_lookups WHERE day = '2099-03-15'`;
  await sql.end();
  await close();
});

const DETAILS = {
  id: 'place-1',
  displayName: { text: 'Huellitas Clínica Veterinaria' },
  location: { latitude: 19.3501, longitude: -99.16 },
  businessStatus: 'OPERATIONAL',
  regularOpeningHours: { openNow: true, weekdayDescriptions: ['lunes: 8:00–19:00'] },
  nationalPhoneNumber: '55 1234 5678',
  websiteUri: 'https://huellitas.example.mx',
  googleMapsUri: 'https://maps.google.com/?cid=1',
};

/** A fake Google that records each request's path and field mask. */
function fakeGoogle(search: unknown, details: unknown = DETAILS) {
  const calls: { path: string; fieldMask: string | null }[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({
      path: url.pathname,
      fieldMask: new Headers(init?.headers).get('X-Goog-FieldMask'),
    });
    return Response.json(url.pathname.endsWith(':searchText') ? search : details);
  }) as typeof fetch;
  return { fetcher, calls };
}

function lookup(dbArg: Database, fetcher: typeof fetch, extra: object = {}) {
  return lookupGoogleDetails(dbArg, placeId, {
    apiKey: 'test-key',
    fetcher,
    client: 'user-a',
    language: 'es',
    now: NOW,
    ...extra,
  });
}

async function usage() {
  const rows = await sql<{ sku: string; count: number }[]>`
    SELECT sku, count FROM google_usage WHERE month = '2099-03'`;
  return Object.fromEntries(rows.map((r) => [r.sku, r.count]));
}

describe('lookupGoogleDetails', () => {
  it('finds the place with a free ids-only search, checks it and keeps only the id', async () => {
    const google = fakeGoogle({ places: [{ id: 'place-1' }] });
    const result = googleDetailsResponseSchema.parse(await lookup(db, google.fetcher));
    expect(result).toMatchObject({
      status: 'ok',
      weekdayHours: ['lunes: 8:00–19:00'],
      openNow: true,
      phone: '55 1234 5678',
      website: 'https://huellitas.example.mx',
    });
    expect(google.calls[0]).toEqual({ path: '/v1/places:searchText', fieldMask: 'places.id' });
    expect(google.calls[1]?.path).toBe('/v1/places/place-1');
    const [place] =
      await sql`SELECT google_place_id, google_match_status, phone, hours FROM places WHERE id = ${placeId}`;
    expect(place).toEqual({
      google_place_id: 'place-1',
      google_match_status: 'matched',
      phone: null,
      hours: null,
    });
    expect(await usage()).toEqual({ text_search_ids_only: 1, place_details_enterprise: 1 });

    // Next time the saved id skips the search.
    const again = fakeGoogle({ places: [] });
    expect((await lookup(db, again.fetcher))?.status).toBe('ok');
    expect(again.calls.map((c) => c.path)).toEqual(['/v1/places/place-1']);
  });

  it('remembers places Google has no listing for, without paying', async () => {
    const google = fakeGoogle({});
    expect(await lookup(db, google.fetcher)).toEqual({ status: 'not_found' });
    expect(await usage()).toEqual({ text_search_ids_only: 1 });
    // Not searched again.
    expect(await lookup(db, google.fetcher)).toEqual({ status: 'not_found' });
    expect(google.calls).toHaveLength(1);
  });

  it("doesn't show a listing that isn't the same business", async () => {
    const google = fakeGoogle(
      { places: [{ id: 'place-2' }] },
      { ...DETAILS, id: 'place-2', displayName: { text: 'Pet Shop Luna' } },
    );
    expect(await lookup(db, google.fetcher)).toEqual({ status: 'not_found' });
    const [place] =
      await sql`SELECT google_place_id, google_match_status FROM places WHERE id = ${placeId}`;
    expect(place).toEqual({ google_place_id: null, google_match_status: 'no_match' });
  });

  it("stops at the monthly limit and at each user's daily limit", async () => {
    const google = fakeGoogle({ places: [{ id: 'place-1' }] });
    expect((await lookup(db, google.fetcher, { monthlyLimit: 1 }))?.status).toBe('ok');
    expect(await lookup(db, google.fetcher, { monthlyLimit: 1, client: 'user-b' })).toEqual({
      status: 'unavailable',
    });
    expect(google.calls).toHaveLength(2); // the second details request never went out

    await sql`DELETE FROM google_usage WHERE month = '2099-03'`;
    for (let i = 0; i < 2; i++) {
      expect((await lookup(db, google.fetcher, { dailyLookups: 3 }))?.status).toBe('ok');
    }
    expect(await lookup(db, google.fetcher, { dailyLookups: 3 })).toEqual({
      status: 'limit_reached',
    });
  });

  it("doesn't call Google for places with known hours", async () => {
    await sql`UPDATE places SET hours = '{}'::jsonb WHERE id = ${placeId}`;
    const google = fakeGoogle({ places: [{ id: 'place-1' }] });
    expect(await lookup(db, google.fetcher)).toEqual({ status: 'unavailable' });
    expect(google.calls).toHaveLength(0);
  });
});

describe('userKey', () => {
  it('is anonymous and changes every day', async () => {
    const key = await userKey('203.0.113.7', NOW);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('203');
    expect(await userKey('203.0.113.7', new Date('2099-03-16T18:00:00Z'))).not.toBe(key);
  });
});

describe('POST /v1/places/:id/google', () => {
  it('is unavailable without an API key, and 404s unknown places', async () => {
    const res = await app.request(`/v1/places/${placeId}/google`, { method: 'POST' }, testEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(googleDetailsResponseSchema.parse(await res.json())).toEqual({ status: 'unavailable' });
    expect(
      (await app.request('/v1/places/999999999/google', { method: 'POST' }, testEnv)).status,
    ).toBe(404);
  });

  it('turns Google errors into "unavailable"', async () => {
    const env = { ...testEnv, GOOGLE_PLACES_API_KEY: 'test-key' };
    // This request uses the real date, so restore the real month's counters afterwards.
    const before = await sql`SELECT month, sku, count FROM google_usage`;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('denied', { status: 403 })) as typeof fetch;
    try {
      const res = await app.request(`/v1/places/${placeId}/google`, { method: 'POST' }, env);
      expect(await res.json()).toEqual({ status: 'unavailable' });
    } finally {
      globalThis.fetch = realFetch;
    }
    await sql`DELETE FROM google_lookups WHERE client = ${await userKey('unknown')}`;
    await sql`DELETE FROM google_usage`;
    if (before.length > 0) await sql`INSERT INTO google_usage ${sql(before)}`;
  });
});
