import { placeListResponseSchema } from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';
import { nameKey, splitAreaSearch } from '../../queries/areas';

// Test areas and places in the open Pacific, removed afterwards. The user stands at USER; the
// area "Plaza Prueba Paw" is 50 km east, far outside the user's radius.
const USER = { lat: 2, lng: -160 };
const kmEast = (km: number) => USER.lng + km / 111.32;
const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

async function addPlace(id: string, name: string, km: number) {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location)
    VALUES ('curated', ${`test-area-${id}`}, ${name}, 'Calle 1', 'Ciudad', 'Estado',
            ST_SetSRID(ST_MakePoint(${kmEast(km)}, ${USER.lat}), 4326)::geography)
    RETURNING id`;
  await sql`INSERT INTO place_categories (place_id, category_id, source)
            SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = 'veterinarian'`;
}

async function addArea(kind: string, name: string, km: number) {
  await sql`
    INSERT INTO search_areas (kind, name, name_key, state, location)
    VALUES (${kind}, ${name}, ${nameKey(name)}, 'Estado de Prueba',
            ST_SetSRID(ST_MakePoint(${kmEast(km)}, ${USER.lat}), 4326)::geography)`;
}

beforeAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-area-%'`;
  await sql`DELETE FROM search_areas WHERE state = 'Estado de Prueba'`;
  await addPlace('near-user', 'Veterinaria Junto al Usuario', 0.5);
  await addPlace('at-plaza', 'Veterinaria de la Plaza', 50.3);
  await addPlace('plaza-4km', 'Estetica Cerca de la Plaza', 54);
  await addPlace('plaza-8km', 'Veterinaria Lejos de la Plaza', 58);
  await addArea('landmark', 'Plaza Prueba Paw', 50);
  // The same colonia name twice: the one near the user wins.
  await addArea('colonia', 'Colonia Gemela Paw', 1);
  await addArea('colonia', 'Colonia Gemela Paw', 300);
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-area-%'`;
  await sql`DELETE FROM search_areas WHERE state = 'Estado de Prueba'`;
  await sql.end();
});

async function search(q: string, extra = '') {
  const res = await app.request(
    `/v1/places?lat=${USER.lat}&lng=${USER.lng}&radiusKm=1&q=${encodeURIComponent(q)}${extra}`,
    {},
    testEnv,
  );
  return placeListResponseSchema.parse(await res.json());
}

describe('searching an area', () => {
  it('moves the search to the area, within 5 km of it, leaving the radius setting alone', async () => {
    const result = await search('plaza prueba paw');
    expect(result.area).toMatchObject({ name: 'Plaza Prueba Paw', kind: 'landmark', radiusKm: 5 });
    // radiusKm=1 (the setting) would find nothing out here; the area search uses 5 km.
    expect(result.items.map((p) => [p.name, p.distanceKm])).toEqual([
      ['Veterinaria de la Plaza', 0.3],
      ['Estetica Cerca de la Plaza', 4],
    ]);
  });

  it('uses 3 miles when the app asks for it, and ignores accents, case and small typos', async () => {
    const result = await search('PLAZA PRÚEBA PAW', '&areaRadiusKm=4.828');
    expect(result.area?.radiusKm).toBe(4.828);
    expect(result.items.map((p) => p.name)).toEqual([
      'Veterinaria de la Plaza',
      'Estetica Cerca de la Plaza',
    ]);
    expect((await search('plaza prueva paw')).area?.name).toBe('Plaza Prueba Paw');
  });

  it('searches business words near the area with "X en Y"', async () => {
    const result = await search('estetica en plaza prueba paw');
    expect(result.area?.name).toBe('Plaza Prueba Paw');
    expect(result.items.map((p) => p.name)).toEqual(['Estetica Cerca de la Plaza']);
  });

  it('reads an area name at the end of the search ("veterinario tlaxcala")', async () => {
    const result = await search('estetica plaza prueba paw');
    expect(result.area?.name).toBe('Plaza Prueba Paw');
    expect(result.items.map((p) => p.name)).toEqual(['Estetica Cerca de la Plaza']);
    // Only an exact area name counts at the end; a misspelled one stays a name search.
    expect((await search('estetica plaza prueva paw')).area).toBeNull();
  });

  it('picks the nearest of several areas with the same name', async () => {
    const result = await search('gemela paw');
    expect(result.area?.location.lng).toBeCloseTo(kmEast(1), 4);
    expect(result.items.map((p) => p.name)).toEqual(['Veterinaria Junto al Usuario']);
  });

  it('keeps everyday pet words as business searches', async () => {
    // "Animal" is a real colonia name; "animalia" is 0.60 similar to it.
    await addArea('colonia', 'Animal', 2);
    expect((await search('animalia')).area).toBeNull();
  });

  it('searches business names when the text is no area, or when asked to', async () => {
    const names = await search('junto al usuario');
    expect(names.area).toBeNull();
    expect(names.items.map((p) => p.name)).toEqual(['Veterinaria Junto al Usuario']);
    expect((await search('plaza prueba paw', '&namesOnly=true')).area).toBeNull();
  });
});

describe('splitAreaSearch', () => {
  it('splits "X en Y" and "X cerca de Y"', () => {
    expect(splitAreaSearch('veterinaria en Coyoacán')).toEqual({
      business: 'veterinaria',
      area: 'Coyoacán',
    });
    expect(splitAreaSearch('estética cerca del Zócalo')).toEqual({
      business: 'estética',
      area: 'Zócalo',
    });
    expect(splitAreaSearch('Roma Norte')).toEqual({ business: null, area: 'Roma Norte' });
  });
});
