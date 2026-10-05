import { categoryListResponseSchema, placeListResponseSchema } from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';

// Test places sit in the open Pacific, far from any real place, and are removed afterwards.
const ORIGIN = { lat: 0.5, lng: -150 };
const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

async function addPlace(
  externalId: string,
  name: string,
  kmEast: number,
  slugs: string[],
  extra: { hidden?: boolean; open24h?: boolean; deadWebsite?: boolean } = {},
) {
  const lng = ORIGIN.lng + kmEast / 111.32;
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location, website,
                        website_source, website_status, hidden_at)
    VALUES ('curated', ${`test-${externalId}`}, ${name}, 'Calle 1', 'Ciudad', 'Estado',
            ST_SetSRID(ST_MakePoint(${lng}, ${ORIGIN.lat}), 4326)::geography,
            'https://example.com', 'denue', ${extra.deadWebsite ? 'dead' : null},
            ${extra.hidden ? sql`now()` : null})
    RETURNING id`;
  await sql`
    INSERT INTO place_categories (place_id, category_id, source)
    SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = ANY(${slugs})`;
  if (extra.open24h) {
    await sql`INSERT INTO vet_details (place_id, open24h, open24h_source)
              VALUES (${row!.id}, true, 'name')`;
  }
}

beforeAll(async () => {
  await sql`DELETE FROM places WHERE source = 'curated' AND external_id LIKE 'test-%'`;
  await addPlace('vet-near', 'Veterinaria Cercana', 0.5, ['veterinarian', 'groomer'], {
    open24h: true,
  });
  await addPlace('store-mid', 'Tienda Media', 1.5, ['pet_store'], { deadWebsite: true });
  await addPlace('vet-far', 'Veterinaria Lejana', 3, ['veterinarian']);
  await addPlace('vet-out', 'Veterinaria Fuera', 20, ['veterinarian']);
  await addPlace('vet-hidden', 'Veterinaria Cerrada', 0.2, ['veterinarian'], { hidden: true });
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE source = 'curated' AND external_id LIKE 'test-%'`;
  await sql.end();
});

async function getPlaces(params: string) {
  const res = await app.request(
    `/v1/places?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&${params}`,
    {},
    testEnv,
  );
  return { status: res.status, body: await res.json() };
}

describe('GET /v1/places', () => {
  it('lists visible places within the radius, nearest first', async () => {
    const { status, body } = await getPlaces('radiusKm=5');
    expect(status).toBe(200);
    const list = placeListResponseSchema.parse(body);
    expect(list.items.map((p) => p.name)).toEqual([
      'Veterinaria Cercana',
      'Tienda Media',
      'Veterinaria Lejana',
    ]);
    expect(list.total).toBe(3);
    expect(list.items[0]?.distanceKm).toBe(0.5);
  });

  it('filters by category', async () => {
    const list = placeListResponseSchema.parse((await getPlaces('category=veterinarian')).body);
    expect(list.items.map((p) => p.name)).toEqual(['Veterinaria Cercana', 'Veterinaria Lejana']);
  });

  it('names categories in the requested language and reports 24-hour hints', async () => {
    const list = placeListResponseSchema.parse((await getPlaces('radiusKm=1&lang=en')).body);
    expect(list.items[0]).toMatchObject({
      categories: [
        { slug: 'veterinarian', name: 'Veterinarian' },
        { slug: 'groomer', name: 'Pet grooming' },
      ],
      open24h: { value: true, source: 'name' },
    });
  });

  it('hides dead websites', async () => {
    const list = placeListResponseSchema.parse((await getPlaces('category=pet_store')).body);
    expect(list.items[0]).toMatchObject({ website: null, websiteSource: null });
  });

  it('pages results and keeps the total past the end', async () => {
    const second = placeListResponseSchema.parse((await getPlaces('pageSize=2&page=2')).body);
    expect(second.items.map((p) => p.name)).toEqual(['Veterinaria Lejana']);
    const past = placeListResponseSchema.parse((await getPlaces('pageSize=2&page=5')).body);
    expect(past).toMatchObject({ items: [], total: 3 });
  });

  it('rejects unknown categories and missing coordinates', async () => {
    expect((await getPlaces('category=butcher')).status).toBe(400);
    const res = await app.request('/v1/places?lat=19.4', {}, testEnv);
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/categories', () => {
  it('lists every category with its name and visible places', async () => {
    const res = await app.request('/v1/categories?lang=en', {}, testEnv);
    const { items } = categoryListResponseSchema.parse(await res.json());
    expect(items.map((c) => c.slug).slice(0, 3)).toEqual(['pet_store', 'boutique', 'veterinarian']);
    expect(items.find((c) => c.slug === 'feed_store')?.name).toBe('Feed store');
    expect(items.find((c) => c.slug === 'museum')?.placeCount).toBe(0);
  });
});
