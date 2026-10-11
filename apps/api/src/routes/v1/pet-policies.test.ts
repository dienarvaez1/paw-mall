import { placeListResponseSchema, placeSchema } from '@paw-mall/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';

const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
// Far from any real place (in the Pacific), so only these test places are near.
const AT = { lat: 2, lng: -131 };

type Policy = {
  dogs: boolean | null;
  cats: boolean | null;
  maxDogSize: 'small' | 'medium' | 'large' | null;
  maxWeightKg?: number | null;
};

async function addPlace(name: string, policy: Policy | null): Promise<number> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location)
    VALUES ('curated', ${`test-pets-${Math.random()}`}, ${name}, 'Calle 1', 'Ciudad', 'Estado',
            ST_SetSRID(ST_MakePoint(${AT.lng}, ${AT.lat}), 4326)::geography)
    RETURNING id`;
  const id = row!.id;
  if (policy) {
    await sql`
      INSERT INTO pet_policies (place_id, dogs, cats, max_dog_size, max_weight_kg, fee, areas,
                                source, source_name, source_url, last_confirmed_on)
      VALUES (${id}, ${policy.dogs}, ${policy.cats}, ${policy.maxDogSize},
              ${policy.maxWeightKg ?? null}, ${sql.json({ amount: 0 })}, ${['terrace']},
              'curated', 'Time Out México', 'https://example.com', '2026-10-01')`;
  }
  return id;
}

const ids: Record<string, number> = {};

beforeAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-pets-%'`;
  ids.anySize = await addPlace('Hotel Grande', { dogs: true, cats: true, maxDogSize: 'large' });
  ids.medium = await addPlace('Hotel Mediano', {
    dogs: true,
    cats: false,
    maxDogSize: 'medium',
    maxWeightKg: 15,
  });
  ids.unknownSize = await addPlace('Café Perros', { dogs: true, cats: null, maxDogSize: null });
  ids.catsOnly = await addPlace('Café Gatos', { dogs: false, cats: true, maxDogSize: null });
  ids.noPolicy = await addPlace('Restaurante Sin Política', null);
  await sql`INSERT INTO place_categories (place_id, category_id, source)
            SELECT ${ids.anySize!}, id, 'curated' FROM categories WHERE slug = 'lodging'`;
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-pets-%'`;
  await sql.end();
});

async function names(params: Record<string, string>) {
  const query = new URLSearchParams({
    ...params,
    lat: `${AT.lat}`,
    lng: `${AT.lng}`,
    radiusKm: '1',
  });
  const response = await app.request(`/v1/places?${query}`, {}, testEnv);
  expect(response.status).toBe(200);
  const body = placeListResponseSchema.parse(await response.json());
  return body.items.map((p) => p.name).sort();
}

describe('pet-friendly filter', () => {
  it('keeps only places whose policy takes pets', async () => {
    expect(await names({ petFriendly: 'true' })).toEqual([
      'Café Gatos',
      'Café Perros',
      'Hotel Grande',
      'Hotel Mediano',
    ]);
  });

  it('with unconfirmed places, adds venues without a policy, never those that say no', async () => {
    expect(await names({ petFriendly: 'true', withUnconfirmed: 'true' })).toEqual([
      'Café Gatos',
      'Café Perros',
      'Hotel Grande',
      'Hotel Mediano',
      'Restaurante Sin Política',
    ]);
    expect(
      await names({
        petFriendly: 'true',
        petSpecies: 'dog',
        dogSize: 'large',
        withUnconfirmed: 'true',
      }),
    ).toEqual(['Hotel Grande', 'Restaurante Sin Política']);
  });

  it('with a "perro grande" profile, keeps only places that allow large dogs', async () => {
    expect(await names({ petFriendly: 'true', petSpecies: 'dog', dogSize: 'large' })).toEqual([
      'Hotel Grande',
    ]);
    expect(await names({ petFriendly: 'true', petSpecies: 'dog', dogSize: 'medium' })).toEqual([
      'Hotel Grande',
      'Hotel Mediano',
    ]);
    // Size unknown: only when the profile gives no size.
    expect(await names({ petFriendly: 'true', petSpecies: 'dog' })).toEqual([
      'Café Perros',
      'Hotel Grande',
      'Hotel Mediano',
    ]);
  });

  it('with a cat profile, keeps only places that take cats', async () => {
    expect(await names({ petFriendly: 'true', petSpecies: 'cat' })).toEqual([
      'Café Gatos',
      'Hotel Grande',
    ]);
  });

  it('ignores the profile when the filter is off', async () => {
    expect(await names({ petSpecies: 'dog', dogSize: 'large' })).toHaveLength(5);
  });

  it('keeps only places in a category of the group', async () => {
    expect(await names({ group: 'pet_friendly' })).toEqual(['Hotel Grande']);
    expect(await names({ group: 'pet_business' })).toEqual([]);
  });

  it('lists OpenStreetMap places with their policy', async () => {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO places (source, external_id, name, address, city, state, location)
      VALUES ('osm', 'test-pets-osm', 'Parque canino', 'Col. Prueba', 'Ciudad', 'Estado',
              ST_SetSRID(ST_MakePoint(-131, 3), 4326)::geography)
      RETURNING id`;
    await sql`
      INSERT INTO pet_policies (place_id, dogs, max_dog_size, source, source_name, source_url,
                                last_confirmed_on)
      VALUES (${row!.id}, true, 'large', 'osm', 'OpenStreetMap',
              'https://www.openstreetmap.org/node/1', '2026-10-11')`;
    const response = await app.request(
      '/v1/places?lat=3&lng=-131&radiusKm=1&petFriendly=true',
      {},
      testEnv,
    );
    const body = placeListResponseSchema.parse(await response.json());
    expect(body.items[0]).toMatchObject({ source: 'osm', petPolicy: { source: 'osm' } });
  });

  it('returns the policy with its source and last confirmation', async () => {
    const response = await app.request(`/v1/places/${ids.medium}`, {}, testEnv);
    const place = placeSchema.parse(await response.json());
    expect(place.petPolicy).toMatchObject({
      dogs: true,
      maxDogSize: 'medium',
      maxWeightKg: 15,
      fee: { amount: 0 },
      areas: ['terrace'],
      source: 'curated',
      sourceName: 'Time Out México',
      lastConfirmedOn: '2026-10-01',
      confirmations: 0,
      disputes: 0,
      underReview: false,
    });
    const none = await app.request(`/v1/places/${ids.noPolicy}`, {}, testEnv);
    expect(placeSchema.parse(await none.json()).petPolicy).toBeNull();
  });
});

const post = (path: string, body: unknown) =>
  app.request(
    path,
    { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    testEnv,
  );
const phone = (n: number) => `phone-${String(n).padStart(16, '0')}`;
const policyOf = async (id: number) =>
  placeSchema.parse(await (await app.request(`/v1/places/${id}`, {}, testEnv)).json()).petPolicy;

describe('POST /v1/places/:id/policy-answers', () => {
  it('a confirmation counts once per phone and moves "last confirmed" to today', async () => {
    const id = await addPlace('Hotel Confirmado', { dogs: true, cats: null, maxDogSize: 'large' });
    for (const n of [1, 1]) {
      const response = await post(`/v1/places/${id}/policy-answers`, {
        answer: 'confirm',
        clientId: phone(n),
      });
      expect(response.status).toBe(201);
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
      new Date(),
    );
    expect(await policyOf(id)).toMatchObject({ confirmations: 1, lastConfirmedOn: today });
  });

  it('puts a policy under review when 3 phones dispute it, more than confirm it', async () => {
    const id = await addPlace('Hotel Disputado', { dogs: true, cats: null, maxDogSize: 'large' });
    await post(`/v1/places/${id}/policy-answers`, { answer: 'confirm', clientId: phone(1) });
    for (const n of [2, 3]) {
      await post(`/v1/places/${id}/policy-answers`, { answer: 'dispute', clientId: phone(n) });
    }
    expect((await policyOf(id))?.underReview).toBe(false);
    // A phone changing its answer counts once, with its latest answer.
    await post(`/v1/places/${id}/policy-answers`, { answer: 'dispute', clientId: phone(1) });
    expect(await policyOf(id)).toMatchObject({ underReview: true, disputes: 3, confirmations: 0 });
    // Under review: left out of the pet-friendly filter, still listed otherwise.
    expect(await names({ petFriendly: 'true' })).not.toContain('Hotel Disputado');
    expect(await names({})).toContain('Hotel Disputado');
  });

  it('rejects extra fields, and places without a policy', async () => {
    const extra = await post(`/v1/places/${ids.anySize}/policy-answers`, {
      answer: 'confirm',
      clientId: phone(9),
      lat: 19.4,
    });
    expect(extra.status).toBe(400);
    const none = await post(`/v1/places/${ids.noPolicy}/policy-answers`, {
      answer: 'confirm',
      clientId: phone(9),
    });
    expect(none.status).toBe(404);
    expect(await none.json()).toEqual({ error: { code: 'POLICY_NOT_FOUND' } });
    const [row] =
      await sql`SELECT count(*)::int AS n FROM policy_answers WHERE place_id = ${ids.noPolicy!}`;
    expect(row?.n).toBe(0);
  });
});

const addCategory = (id: number, slug: string) =>
  sql`INSERT INTO place_categories (place_id, category_id, source)
      SELECT ${id}, id, 'activity' FROM categories WHERE slug = ${slug}`;
const answerPet = (id: number, n: number, takesDogs: boolean, maxDogSize?: string) =>
  post(`/v1/places/${id}/pet-answers`, { takesDogs, maxDogSize, clientId: phone(n) });

describe('POST /v1/places/:id/pet-answers', () => {
  it('publishes a users policy once 2 phones agree, more than disagree', async () => {
    const id = await addPlace('Taquería Sin Política', null);
    await addCategory(id, 'restaurant');
    expect((await answerPet(id, 1, true, 'large')).status).toBe(201);
    expect(await policyOf(id)).toBeNull();
    await answerPet(id, 2, true, 'medium');
    expect(await policyOf(id)).toMatchObject({
      source: 'community',
      dogs: true,
      maxDogSize: 'medium',
      sourceName: null,
    });
    expect(await names({ petFriendly: 'true', petSpecies: 'dog', dogSize: 'medium' })).toContain(
      'Taquería Sin Política',
    );
    // Two phones saying no: a tie withdraws it.
    await answerPet(id, 3, false);
    await answerPet(id, 4, false);
    expect(await policyOf(id)).toBeNull();
    const [row] = await sql`SELECT count(*)::int AS n FROM pet_answers WHERE place_id = ${id}`;
    expect(row?.n).toBe(4);
  });

  it('only for pet-friendly venues without an owner or sourced policy', async () => {
    const vet = await addPlace('Veterinaria Pregunta', null);
    await addCategory(vet, 'veterinarian');
    const notVenue = await answerPet(vet, 1, true);
    expect(notVenue.status).toBe(409);
    expect(await notVenue.json()).toEqual({ error: { code: 'NOT_A_PET_VENUE' } });

    await addCategory(ids.anySize!, 'restaurant');
    const sourced = await answerPet(ids.anySize!, 1, false);
    expect(sourced.status).toBe(409);
    expect(await sourced.json()).toEqual({ error: { code: 'POLICY_EXISTS' } });

    const extra = await post(`/v1/places/${vet}/pet-answers`, {
      takesDogs: true,
      clientId: phone(1),
      lat: 19.4,
    });
    expect(extra.status).toBe(400);
  });
});
