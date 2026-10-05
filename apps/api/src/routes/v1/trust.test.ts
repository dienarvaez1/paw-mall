import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';

const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
let placeId = 0;

async function addPlace(): Promise<number> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location)
    VALUES ('curated', ${`test-trust-${Math.random()}`}, 'Veterinaria Prueba', 'Calle 1', 'Ciudad',
            'Estado', ST_SetSRID(ST_MakePoint(-130, 1), 4326)::geography)
    RETURNING id`;
  return row!.id;
}

beforeAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-trust-%'`;
  placeId = await addPlace();
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-trust-%'`;
  await sql.end();
});

const post = (path: string, body: unknown) =>
  app.request(
    path,
    { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    testEnv,
  );
const phone = (n: number) => `phone-${String(n).padStart(16, '0')}`;
const hidden = async (id: number) =>
  (
    await sql<{ hidden_reason: string | null }[]>`SELECT hidden_reason FROM places WHERE id = ${id}`
  )[0]?.hidden_reason;

describe('POST /v1/places/:id/reports', () => {
  it('hides a place after 3 phones report it closed, counting each phone once', async () => {
    const id = await addPlace();
    for (const n of [1, 1, 2]) {
      expect(
        (await post(`/v1/places/${id}/reports`, { reason: 'closed', clientId: phone(n) })).status,
      ).toBe(201);
    }
    expect(await hidden(id)).toBeNull();
    await post(`/v1/places/${id}/reports`, { reason: 'closed', clientId: phone(3) });
    expect(await hidden(id)).toBe('reported_closed');
    // Hidden places disappear from the API.
    expect((await app.request(`/v1/places/${id}`, {}, testEnv)).status).toBe(404);
  });

  it('hides a place after 2 animal-cruelty reports', async () => {
    const id = await addPlace();
    await post(`/v1/places/${id}/reports`, { reason: 'cruelty', clientId: phone(1) });
    expect(await hidden(id)).toBeNull();
    await post(`/v1/places/${id}/reports`, { reason: 'cruelty', clientId: phone(2) });
    expect(await hidden(id)).toBe('reported_cruelty');
  });

  it('accepts no location or personal data, and stores none', async () => {
    const extra = { reason: 'closed', clientId: phone(9), lat: 19.4, lng: -99.1 };
    expect((await post(`/v1/places/${placeId}/reports`, extra)).status).toBe(400);
    expect(
      (
        await post(`/v1/places/${placeId}/reports`, {
          reason: 'closed',
          clientId: phone(9),
          name: 'Ana',
        })
      ).status,
    ).toBe(400);
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'place_reports'
      ORDER BY ordinal_position`;
    expect(columns.map((c) => c.column_name)).toEqual([
      'id',
      'place_id',
      'reason',
      'client_id',
      'created_at',
    ]);
  });

  it('rejects unknown reasons and places', async () => {
    expect(
      (await post(`/v1/places/${placeId}/reports`, { reason: 'spam', clientId: phone(1) })).status,
    ).toBe(400);
    expect(
      (await post('/v1/places/999999999/reports', { reason: 'closed', clientId: phone(1) })).status,
    ).toBe(404);
  });
});

describe('POST /v1/places/:id/claims', () => {
  it('saves a pending claim with its contact', async () => {
    const res = await post(`/v1/places/${placeId}/claims`, {
      phone: '55 1234 5678',
      open24h: true,
      acceptsEmergencies: true,
      contactName: 'Ana López',
      contact: 'ana@example.com',
      consent: true,
    });
    expect(res.status).toBe(201);
    const [claim] = await sql`
      SELECT status, phone, open24h, accepts_emergencies, contact FROM place_claims
      WHERE place_id = ${placeId}`;
    expect(claim).toEqual({
      status: 'pending',
      phone: '55 1234 5678',
      open24h: true,
      accepts_emergencies: true,
      contact: 'ana@example.com',
    });
  });

  it('rejects claims without consent or anything to publish', async () => {
    const contact = { contactName: 'Ana López', contact: 'ana@example.com' };
    expect((await post(`/v1/places/${placeId}/claims`, { ...contact, consent: true })).status).toBe(
      400,
    );
    expect(
      (await post(`/v1/places/${placeId}/claims`, { ...contact, phone: '5512345678' })).status,
    ).toBe(400);
  });
});
