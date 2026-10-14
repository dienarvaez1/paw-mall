import {
  KM_PER_MILE,
  areaLookupResponseSchema,
  areaSuggestResponseSchema,
  placeListResponseSchema,
  placeMapResponseSchema,
} from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';
import { nameKey, splitAreaSearch, suggestionPatterns } from '../../queries/areas';

// Test areas and places in the open Pacific, removed afterwards. The user stands at USER; the
// area "Plaza Prueba Paw" is 50 km east, far outside the user's radius.
const USER = { lat: 2, lng: -160 };
const kmEast = (km: number) => USER.lng + km / 111.32;
const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

async function addPlace(id: string, name: string, km: number, slug = 'veterinarian') {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location)
    VALUES ('curated', ${`test-area-${id}`}, ${name}, 'Calle 1', 'Ciudad', 'Estado',
            ST_SetSRID(ST_MakePoint(${kmEast(km)}, ${USER.lat}), 4326)::geography)
    RETURNING id`;
  await sql`INSERT INTO place_categories (place_id, category_id, source)
            SELECT ${row!.id}, id, 'activity' FROM categories WHERE slug = ${slug}`;
}

async function addArea(kind: string, name: string, km: number, businessCount = 0, key = name) {
  await sql`
    INSERT INTO search_areas (kind, name, name_key, state, location, business_count)
    VALUES (${kind}, ${name}, ${nameKey(key)}, 'Estado de Prueba',
            ST_SetSRID(ST_MakePoint(${kmEast(km)}, ${USER.lat}), 4326)::geography, ${businessCount})`;
}

beforeAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-area-%'`;
  await sql`DELETE FROM search_areas WHERE state = 'Estado de Prueba'`;
  await addPlace('near-user', 'Veterinaria Junto al Usuario', 0.5);
  await addPlace('at-plaza', 'Veterinaria de la Plaza', 50.3);
  await addPlace('plaza-4km', 'Estetica Cerca de la Plaza', 54, 'groomer');
  await addPlace('plaza-8km', 'Veterinaria Lejos de la Plaza', 58);
  // A town, with businesses named after it within 25 miles (40 km) of it, and beyond.
  await addArea('town', 'Pueblo Nombre Paw', 200);
  await addPlace('in-town', 'Veterinaria del Centro', 200.5);
  await addPlace('named-30km', 'Veterinaria Pueblo Nombre Paw', 230);
  await addPlace('named-45km', 'Estetica Pueblo Nombre Paw', 245, 'groomer');
  await addArea('landmark', 'Plaza Prueba Paw', 50);
  // The same colonia name twice: the one near the user wins.
  await addArea('colonia', 'Colonia Gemela Paw', 1);
  await addArea('colonia', 'Colonia Gemela Paw', 300);
  // Suggestions: names starting "Puertito Paw".
  await addArea('municipality', 'Puertito Paw Vallarta', 400, 16000);
  await addArea('town', 'Puertito Paw Escondido', 410, 5000);
  await addArea('colonia', 'Puertito Paw Centro', 2, 90000);
  await addArea('municipality', 'Puertito Pawllano', 420, 50000);
  // The same name twice: the suggestion is the one a search goes to (the nearer).
  await addArea('town', 'Puertito Paw Gemelo', 500, 10);
  await addArea('town', 'Puertito Paw Gemelo', 5, 1);
  // A landmark under two names, both shown as the same place.
  await addArea('landmark', 'Plazita Paw', 6, 0, 'Plazita Paw');
  await addArea('landmark', 'Plazita Paw', 6, 0, 'Plazita Paw Mayor');
  await addArea('colonia', 'Vallarta Paw Viejo', 7, 1);
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
  it('also lists businesses named after the place, up to 25 miles away', async () => {
    const result = await search('pueblo nombre paw');
    expect(result.items.map((p) => [p.name, p.distanceKm])).toEqual([
      ['Veterinaria del Centro', 0.5],
      ['Veterinaria Pueblo Nombre Paw', 30],
    ]);
    // With a business word too, only the town's own circle counts.
    const vets = await search('veterinaria en pueblo nombre paw');
    expect(vets.items.map((p) => p.name)).toEqual(['Veterinaria del Centro']);
  });

  it('narrows a busy city or town to 3 miles, but not a quiet one or a landmark', async () => {
    await addArea('municipality', 'Ciudad Llena Paw', 400);
    for (let i = 0; i < 11; i += 1)
      await addPlace(`busy-${i}`, `Veterinaria Llena ${i}`, 400.2 + i * 0.3);
    const busy = await search('ciudad llena paw');
    expect(busy.area).toMatchObject({ kind: 'municipality', radiusKm: 3 * KM_PER_MILE });
    expect(busy.total).toBe(11);
    // A radius the user picked (radius button, zoom) wins over the 3 mi rule.
    const picked = await search('ciudad llena paw', '&areaRadiusKm=8&fixedAreaRadius=true');
    expect(picked.area?.radiusKm).toBe(8);
    // Pueblo Nombre Paw has one place nearby: the usual 5 km.
    expect((await search('pueblo nombre paw')).area?.radiusKm).toBe(5);
  });

  it('moves the search to the area, within 5 km of it, leaving the radius setting alone', async () => {
    const result = await search('plaza prueba paw');
    expect(result.area).toMatchObject({ name: 'Plaza Prueba Paw', kind: 'landmark', radiusKm: 5 });
    // radiusKm=1 (the setting) would find nothing out here; the area search uses 5 km.
    expect(result.items.map((p) => [p.name, p.distanceKm])).toEqual([
      ['Veterinaria de la Plaza', 0.3],
      ['Estetica Cerca de la Plaza', 4],
    ]);
  });

  it('uses 3 miles when the app asks for it, and ignores accents and case, not letters', async () => {
    const result = await search('PLAZA PRÚEBA PAW', '&areaRadiusKm=4.828');
    expect(result.area?.radiusKm).toBe(4.828);
    expect(result.items.map((p) => p.name)).toEqual([
      'Veterinaria de la Plaza',
      'Estetica Cerca de la Plaza',
    ]);
    expect((await search('plaza prueva paw')).area).toBeNull();
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
    // A misspelled place name is no place.
    expect((await search('estetica plaza prueva paw')).area).toBeNull();
  });

  it('finds the place anywhere in the text and turns keywords into a category', async () => {
    for (const q of [
      'plaza prueba paw estetica',
      'estetica plaza prueba paw',
      'groomer en plaza prueba paw',
    ]) {
      const result = await search(q);
      expect([q, result.area?.name, result.searchCategory]).toEqual([
        q,
        'Plaza Prueba Paw',
        'groomer',
      ]);
      expect(result.items.map((p) => p.name)).toEqual(['Estetica Cerca de la Plaza']);
    }
    // "vet" finds vets by category, whatever their names say.
    const vets = await search('vet plaza prueba paw');
    expect(vets.searchCategory).toBe('veterinarian');
    expect(vets.items.map((p) => p.name)).toEqual(['Veterinaria de la Plaza']);
  });

  it('applies keywords around the user too, and lets a selected chip win', async () => {
    const near = await search('vet', '&radiusKm=1');
    expect(near).toMatchObject({ area: null, searchCategory: 'veterinarian' });
    expect(near.items.map((p) => p.name)).toEqual(['Veterinaria Junto al Usuario']);
    const chip = await search('estetica plaza prueba paw', '&category=veterinarian');
    expect(chip.items.map((p) => p.name)).toEqual(['Veterinaria de la Plaza']);
  });

  it('picks the nearest of several areas with the same name', async () => {
    const result = await search('gemela paw');
    expect(result.area?.location.lng).toBeCloseTo(kmEast(1), 4);
    expect(result.items.map((p) => p.name)).toEqual(['Veterinaria Junto al Usuario']);
  });

  it('never takes a name that sounds alike for the place ("tlaxcala" is not "Ixtacala")', async () => {
    await addArea('colonia', 'Ixtacala Paw', 3);
    await addPlace('ixtacala', 'Veterinaria Ixtacala Paw', 3);
    const result = await search('tlaxcala paw', '&namesOnly=true');
    expect(result.items.map((p) => p.name)).not.toContain('Veterinaria Ixtacala Paw');
    expect((await search('tlaxcala paw')).area?.name).not.toBe('Ixtacala Paw');
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

describe('searching on the map', () => {
  const map = async (q: string) => {
    // A box around both the user and the plaza.
    const bbox = `${USER.lng - 0.1},${USER.lat - 0.2},${kmEast(70)},${USER.lat + 0.2}`;
    const res = await app.request(
      `/v1/places/map?bbox=${bbox}&lat=${USER.lat}&lng=${USER.lng}&radiusKm=1&q=${encodeURIComponent(q)}`,
      {},
      testEnv,
    );
    return placeMapResponseSchema.parse(await res.json());
  };

  it('moves the circle to a named area, as the list does', async () => {
    const result = await map('plaza prueba paw');
    expect(result.area).toMatchObject({ name: 'Plaza Prueba Paw', radiusKm: 5 });
    expect(result).toMatchObject({ kind: 'places', total: 2, radiusTotal: 2 });
  });

  it('keeps only matching names around the user otherwise', async () => {
    const result = await map('junto al usuario');
    expect(result.area).toBeNull();
    expect(result.kind === 'places' && result.items.map((p) => p.name)).toEqual([
      'Veterinaria Junto al Usuario',
    ]);
  });
});

describe('GET /v1/places/area', () => {
  const lookup = async (q: string) =>
    areaLookupResponseSchema.parse(
      await (
        await app.request(
          `/v1/places/area?lat=${USER.lat}&lng=${USER.lng}&q=${encodeURIComponent(q)}`,
          {},
          testEnv,
        )
      ).json(),
    );

  it('names the place when the whole text is its name, and nothing otherwise', async () => {
    expect((await lookup('PLAZA prueba paw')).area).toMatchObject({
      name: 'Plaza Prueba Paw',
      kind: 'landmark',
    });
    expect((await lookup('veterinaria en plaza prueba paw')).area).toBeNull();
    expect((await lookup('tacos')).area).toBeNull();
  });
});

describe('GET /v1/places/area-suggestions', () => {
  async function suggest(q: string) {
    const res = await app.request(
      `/v1/places/area-suggestions?lat=${USER.lat}&lng=${USER.lng}&q=${encodeURIComponent(q)}`,
      {},
      testEnv,
    );
    expect(res.status).toBe(200);
    return areaSuggestResponseSchema.parse(await res.json()).suggestions;
  }

  it('completes the next word: "puertito paw v" is Vallarta, "puertito paw e" Escondido', async () => {
    expect((await suggest('Puertito Paw V')).map((s) => s.name)).toEqual(['Puertito Paw Vallarta']);
    expect((await suggest('puertito paw e')).map((s) => s.name)).toEqual([
      'Puertito Paw Escondido',
    ]);
  });

  it('puts cities, towns and landmarks before colonias, then the busiest', async () => {
    const names = (await suggest('Puertito Paw')).map((s) => s.name);
    expect(names).toEqual([
      'Puertito Pawllano',
      'Puertito Paw Vallarta',
      'Puertito Paw Escondido',
      'Puertito Paw Gemelo',
      'Puertito Paw Centro',
    ]);
  });

  it('matches whole words after a space', async () => {
    expect((await suggest('Puertito Paw ')).map((s) => s.name)).not.toContain('Puertito Pawllano');
  });

  it('suggests a shared name once, as the place a search for it goes to', async () => {
    const twins = (await suggest('puertito paw gem')).filter(
      (s) => s.name === 'Puertito Paw Gemelo',
    );
    expect(twins).toHaveLength(1);
    expect(twins[0]!.location.lng).toBeCloseTo(kmEast(5), 3);
  });

  it('suggests a landmark stored under several names once', async () => {
    const plazas = (await suggest('plazita paw')).filter((s) => s.name === 'Plazita Paw');
    expect(plazas).toHaveLength(1);
  });

  it('matches the typed words in any order, each starting a word of the name', async () => {
    for (const q of ['Vallarta Puertito', 'paw vall', 'v puertito paw']) {
      expect((await suggest(q)).map((s) => s.name)).toContain('Puertito Paw Vallarta');
    }
    // A word in the middle of another word is no match.
    expect((await suggest('allarta')).map((s) => s.name)).not.toContain('Puertito Paw Vallarta');
  });

  it('puts the exact name first', async () => {
    expect((await suggest('Puertito Pawllano'))[0]?.name).toBe('Puertito Pawllano');
  });

  it('puts names that start with the text as typed first', async () => {
    // A small colonia starting "Vallarta Paw" beats the busier city with the words out of order.
    const names = (await suggest('vallarta paw')).map((s) => s.name);
    expect(names.slice(0, 2)).toEqual(['Vallarta Paw Viejo', 'Puertito Paw Vallarta']);
  });

  it('suggests nothing under 3 letters', async () => {
    expect(await suggest('pu')).toEqual([]);
  });
});

describe('suggestionPatterns', () => {
  it('turns each word into a word-start pattern, the last a prefix', () => {
    expect(suggestionPatterns('Puerto V')).toEqual(['(^| )puerto', '(^| )v']);
  });

  it('makes the last word whole after a space', () => {
    expect(suggestionPatterns('puerto ')).toEqual(['(^| )puerto( |$)']);
  });

  it('leaves out stop words', () => {
    expect(suggestionPatterns('vet en coyo')).toEqual(['(^| )vet', '(^| )coyo']);
  });

  it('needs 3 letters', () => {
    expect(suggestionPatterns('pu')).toBeNull();
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
