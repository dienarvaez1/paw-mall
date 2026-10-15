import {
  categoryListResponseSchema,
  placeListResponseSchema,
  placeMapResponseSchema,
  placeSchema,
} from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';
import { searchWords } from '../../queries/places';

// Test places sit in the open Pacific, far from any real place, and are removed afterwards.
const ORIGIN = { lat: 0.5, lng: -150 };
const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

async function addPlace(
  externalId: string,
  name: string,
  kmEast: number,
  slugs: string[],
  extra: {
    hidden?: boolean;
    open24h?: boolean;
    deadWebsite?: boolean;
    phone?: string;
    city?: string;
  } = {},
) {
  const lng = ORIGIN.lng + kmEast / 111.32;
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location, website,
                        website_source, website_status, hidden_at, phone)
    VALUES ('curated', ${`test-places-${externalId}`}, ${name}, 'Calle 1', ${extra.city ?? 'Ciudad'}, 'Estado',
            ST_SetSRID(ST_MakePoint(${lng}, ${ORIGIN.lat}), 4326)::geography,
            'https://example.com', 'denue', ${extra.deadWebsite ? 'dead' : null},
            ${extra.hidden ? sql`now()` : null}, ${extra.phone ?? null})
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
  await sql`DELETE FROM places WHERE source = 'curated' AND external_id LIKE 'test-places-%'`;
  await addPlace('vet-near', 'Veterinaria Cercana', 0.5, ['veterinarian', 'groomer'], {
    open24h: true,
    phone: '55 1234 5678',
  });
  await addPlace('store-mid', 'Tienda Media', 1.5, ['pet_store'], { deadWebsite: true });
  await addPlace('vet-far', 'Veterinaria Lejana', 3, ['veterinarian'], { city: 'Coyoacán' });
  await addPlace('vet-out', 'Veterinaria Fuera', 20, ['veterinarian']);
  await addPlace('vet-hidden', 'Veterinaria Cerrada', 0.2, ['veterinarian'], { hidden: true });
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE source = 'curated' AND external_id LIKE 'test-places-%'`;
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
    expect(items.find((c) => c.slug === 'tourist_site')?.placeCount).toBe(0);
  });
});

describe('GET /v1/places search and filters', () => {
  it('finds every word in the name or city, letter for letter, ignoring case and accents', async () => {
    const byName = placeListResponseSchema.parse((await getPlaces('q=lejana')).body);
    expect(byName.items.map((p) => p.name)).toEqual(['Veterinaria Lejana']);
    const byCity = placeListResponseSchema.parse(
      (await getPlaces('q=veterinaria%20coyoacan&namesOnly=true')).body,
    );
    expect(byCity.items.map((p) => p.name)).toEqual(['Veterinaria Lejana']);
    const accents = placeListResponseSchema.parse((await getPlaces('q=CERCÁNA')).body);
    expect(accents.items.map((p) => p.name)).toEqual(['Veterinaria Cercana']);
    // A typo or a word that only sounds alike matches nothing ("tlaxcala" is not "Ixtacala").
    const typo = placeListResponseSchema.parse((await getPlaces('q=cercanna')).body);
    expect(typo.total).toBe(0);
  });

  it('requires every word, except en, la, el, de, del, los, las, y and para', async () => {
    const both = await getPlaces('q=lejana%20coyoacan&namesOnly=true');
    expect(placeListResponseSchema.parse(both.body).items.map((p) => p.name)).toEqual([
      'Veterinaria Lejana',
    ]);
    // "tlalpan" matches nothing, so nothing is listed, not just the "lejana" matches.
    const missing = await getPlaces('q=lejana%20tlalpan&namesOnly=true');
    expect(placeListResponseSchema.parse(missing.body).total).toBe(0);
    const vague = await getPlaces('q=la%20lejana%20de%20los%20y%20para%20del%20las&namesOnly=true');
    expect(placeListResponseSchema.parse(vague.body).items.map((p) => p.name)).toEqual([
      'Veterinaria Lejana',
    ]);
  });

  it('reads a keyword as a category only where it fits the chip and the tab', async () => {
    const parse = async (params: string) =>
      placeListResponseSchema.parse((await getPlaces(params)).body);
    // Explorar, no chip: "vet" is the vets category.
    const vets = await parse('q=vet&group=pet_business');
    expect(vets.searchCategory).toBe('veterinarian');
    expect(vets.items.map((p) => p.name)).toEqual(['Veterinaria Cercana', 'Veterinaria Lejana']);
    // With the Tiendas chip, "vet" is a word in the name: no store is called that (it used to
    // list every store).
    expect(await parse('q=vet&group=pet_business&category=pet_store')).toMatchObject({
      total: 0,
      searchCategory: null,
    });
    // On Pet-friendly, no venue is a vet: "vet" finds nothing (owner's rule, 2026-10-14).
    expect(await parse('q=vet&group=pet_friendly')).toMatchObject({
      total: 0,
      searchCategory: 'veterinarian',
    });
  });

  it('matches a short word only at the start of a word, a longer one anywhere', async () => {
    const names = async (q: string) =>
      placeListResponseSchema
        .parse((await getPlaces(`q=${q}&namesOnly=true`)).body)
        .items.map((p) => p.name);
    expect(await names('cer')).toEqual(['Veterinaria Cercana']);
    // "erc" is inside "Cercana", not at a word's start (search benchmark: "vet me" found "Gómez").
    expect(await names('erc')).toEqual([]);
    expect(await names('ercana')).toEqual(['Veterinaria Cercana']);
  });

  it('keeps only places with a phone or a live website', async () => {
    const phone = placeListResponseSchema.parse((await getPlaces('withPhone=true')).body);
    expect(phone.items.map((p) => p.name)).toEqual(['Veterinaria Cercana']);
    const website = placeListResponseSchema.parse((await getPlaces('withWebsite=true')).body);
    expect(website.items.map((p) => p.name)).toEqual(['Veterinaria Cercana', 'Veterinaria Lejana']);
  });
});

describe('GET /v1/places/map', () => {
  // About 11 km around the origin; vet-out (20 km) is in the box but outside a 5 km radius.
  const bbox = `${ORIGIN.lng - 0.1},${ORIGIN.lat - 0.1},${ORIGIN.lng + 0.2},${ORIGIN.lat + 0.1}`;
  const map = async (params: string) =>
    placeMapResponseSchema.parse(
      await (
        await app.request(
          `/v1/places/map?bbox=${bbox}&lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&${params}`,
          {},
          testEnv,
        )
      ).json(),
    );

  it('returns places one by one when few are in view', async () => {
    const result = await map('radiusKm=5');
    expect(result).toMatchObject({ kind: 'places', total: 3, radiusTotal: 3 });
  });

  it('clusters when more than the limit are in view', async () => {
    const result = await map('radiusKm=5&limit=2');
    expect(result.kind).toBe('clusters');
    if (result.kind !== 'clusters') return;
    expect(result.clusters.reduce((sum, c) => sum + c.count, 0)).toBe(3);
    expect(result.total).toBe(3);
  });

  it('names the city of the place nearest the circle, with clusters too', async () => {
    expect((await map('radiusKm=5')).nearestCity).toBe('Ciudad');
    expect((await map('radiusKm=5&limit=2')).nearestCity).toBe('Ciudad');
    // Without the nearer two, Veterinaria Lejana (Coyoacán) is the nearest.
    expect((await map('radiusKm=5&q=lejana')).nearestCity).toBe('Coyoacán');
  });

  it('filters the map by category', async () => {
    expect(await map('radiusKm=5&category=pet_store')).toMatchObject({ total: 1, radiusTotal: 1 });
  });

  it('says where the matches are, so a confirmed search can fit its radius to them', async () => {
    // Inside the radius: the farthest (Lejana, 3 km); clusters carry it too.
    expect(await map('radiusKm=5')).toMatchObject({ nearestBeyondKm: null });
    expect((await map('radiusKm=5')).farthestKm).toBeCloseTo(3, 1);
    expect((await map('radiusKm=5&limit=2')).farthestKm).toBeCloseTo(3, 1);
    expect((await map('radiusKm=5&category=pet_store')).farthestKm).toBeCloseTo(1.5, 1);
    // None inside 5 km: the nearest beyond it (Veterinaria Fuera, 20 km); none at all: both null.
    const beyond = await map('radiusKm=5&q=fuera');
    expect(beyond).toMatchObject({ radiusTotal: 0, farthestKm: null });
    expect(beyond.nearestBeyondKm).toBeCloseTo(20, 0);
    expect(await map('radiusKm=5&q=nadaquecoincida')).toMatchObject({
      farthestKm: null,
      nearestBeyondKm: null,
    });
  });
});

describe('GET /v1/places/:id', () => {
  it('returns a visible place with its categories', async () => {
    const list = placeListResponseSchema.parse((await getPlaces('radiusKm=1')).body);
    const id = list.items[0]?.id;
    const res = await app.request(`/v1/places/${id}?lang=en`, {}, testEnv);
    const place = placeSchema.parse(await res.json());
    expect(place).toMatchObject({ name: 'Veterinaria Cercana', distanceKm: null });
    expect(place.categories.map((c) => c.name)).toEqual(['Veterinarian', 'Pet grooming']);
  });

  it('answers 404 for hidden or unknown places', async () => {
    const [hidden] = await sql<{ id: number }[]>`
      SELECT id FROM places WHERE external_id = 'test-places-vet-hidden'`;
    for (const id of [hidden?.id, 999999999]) {
      const res = await app.request(`/v1/places/${id}`, {}, testEnv);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { code: 'PLACE_NOT_FOUND' } });
    }
  });
});

describe('searchWords', () => {
  it('reads CDMX and DF as the state Ciudad de México, in any order', () => {
    expect(searchWords('CDMX veterinaria')).toEqual(['ciudad de mexico', 'veterinaria']);
    expect(searchWords('veterinaria df')).toEqual(['veterinaria', 'ciudad de mexico']);
  });
});

describe('GET /v1/places search reach', () => {
  const list = async (params: string) =>
    placeListResponseSchema.parse(
      await (
        await app.request(`/v1/places?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&${params}`, {}, testEnv)
      ).json(),
    );

  it('gives the farthest match inside the radius, or the nearest beyond it, on page 1', async () => {
    expect((await list('radiusKm=5&q=veterinaria')).farthestKm).toBeCloseTo(3, 1);
    const beyond = await list('radiusKm=5&q=fuera');
    expect(beyond).toMatchObject({ total: 0, farthestKm: null });
    expect(beyond.nearestBeyondKm).toBeCloseTo(20, 0);
    expect(await list('radiusKm=5&q=veterinaria&page=2&pageSize=1')).toMatchObject({
      farthestKm: null,
      nearestBeyondKm: null,
    });
  });
});
