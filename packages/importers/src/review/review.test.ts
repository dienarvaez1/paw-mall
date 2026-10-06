import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import {
  approveClaim,
  confirmReport,
  listPendingClaims,
  listReportedPlaces,
  rejectClaim,
  restorePlace,
} from './review.ts';

// Needs the local database (pnpm db:up && pnpm db:migrate), like the API tests.
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
const allDay = { open: '00:00', close: '24:00' };
const ALWAYS = {
  '0': allDay,
  '1': allDay,
  '2': allDay,
  '3': allDay,
  '4': allDay,
  '5': allDay,
  '6': allDay,
};
let placeId = 0;

beforeEach(async () => {
  await sql`DELETE FROM places WHERE external_id = 'test-review'`;
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location)
    VALUES ('curated', 'test-review', 'Veterinaria Prueba', 'Calle 1', 'Ciudad', 'Estado',
            ST_SetSRID(ST_MakePoint(-120, 2), 4326)::geography)
    RETURNING id`;
  placeId = row!.id;
  await sql`INSERT INTO vet_details (place_id, open24h, open24h_source) VALUES (${placeId}, true, 'name')`;
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id = 'test-review'`;
  await sql.end();
});

async function addClaim(fields: Record<string, unknown>) {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO place_claims ${sql({ place_id: placeId, contact_name: 'Ana', contact: 'ana@example.com', ...fields })}
    RETURNING id`;
  return row!.id;
}

describe('claims', () => {
  it('approving publishes the details as owner-verified and forgets the contact', async () => {
    const id = await addClaim({
      phone: '55 1234 5678',
      hours: sql.json(ALWAYS),
      accepts_emergencies: true,
    });
    expect((await listPendingClaims(sql)).find((c) => c.id === id)?.publishes).toContain(
      'phone 55 1234 5678',
    );
    expect(await approveClaim(sql, id)).toBe(placeId);

    const [place] = await sql`
      SELECT phone, phone_source, hours_source, owner_verified_at IS NOT NULL AS verified,
             place_open_now(p.hours, v.open24h, v.open24h_source, now()) AS open_now,
             v.accepts_emergencies, v.open24h_source
      FROM places p JOIN vet_details v ON v.place_id = p.id WHERE p.id = ${placeId}`;
    expect(place).toEqual({
      phone: '55 1234 5678',
      phone_source: 'owner',
      hours_source: 'owner',
      verified: true,
      // The owner's hours drive "open now".
      open_now: true,
      accepts_emergencies: true,
      // The name hint stays a hint: the owner didn't answer the 24-hour question.
      open24h_source: 'name',
    });
    const [claim] =
      await sql`SELECT status, contact_name, contact FROM place_claims WHERE id = ${id}`;
    expect(claim).toEqual({ status: 'approved', contact_name: null, contact: null });
    expect(await approveClaim(sql, id)).toBeNull(); // not pending anymore
  });

  it("an owner's 24-hour answer replaces the name hint and makes the place open", async () => {
    const id = await addClaim({ open24h: true });
    await approveClaim(sql, id);
    const [vet] = await sql`
      SELECT v.open24h_source, place_open_now(p.hours, v.open24h, v.open24h_source, now()) AS open_now
      FROM places p JOIN vet_details v ON v.place_id = p.id WHERE p.id = ${placeId}`;
    expect(vet).toEqual({ open24h_source: 'owner', open_now: true });
  });

  it('rejecting forgets the contact and publishes nothing', async () => {
    const id = await addClaim({ phone: '55 0000 0000' });
    expect(await rejectClaim(sql, id)).toBe(true);
    const [place] = await sql`SELECT phone, owner_verified_at FROM places WHERE id = ${placeId}`;
    expect(place).toEqual({ phone: null, owner_verified_at: null });
    const [claim] = await sql`SELECT status, contact FROM place_claims WHERE id = ${id}`;
    expect(claim).toEqual({ status: 'rejected', contact: null });
  });
});

describe('reports', () => {
  async function report(reason: string, clients: string[]) {
    for (const client of clients) {
      await sql`INSERT INTO place_reports (place_id, reason, client_id) VALUES (${placeId}, ${reason}, ${client})`;
    }
    await sql`UPDATE places SET hidden_at = now(), hidden_reason = ${`reported_${reason}`} WHERE id = ${placeId}`;
  }

  it('lists hidden places for review and restores a wrong report', async () => {
    await report('cruelty', ['a'.repeat(16), 'b'.repeat(16)]);
    const listed = (await listReportedPlaces(sql)).find((r) => r.id === placeId);
    expect(listed).toMatchObject({ status: 'HIDDEN, needs review', reports: 'cruelty ×2' });
    expect(await restorePlace(sql, placeId)).toBe(true);
    const [place] = await sql`SELECT hidden_at, hidden_reason FROM places WHERE id = ${placeId}`;
    expect(place).toEqual({ hidden_at: null, hidden_reason: null });
    expect(await sql`SELECT 1 FROM place_reports WHERE place_id = ${placeId}`).toHaveLength(0);
  });

  it('confirms a report, keeping the place hidden for good', async () => {
    await report('cruelty', ['c'.repeat(16), 'd'.repeat(16)]);
    expect(await confirmReport(sql, placeId, 'cruelty')).toBe(true);
    expect((await listReportedPlaces(sql)).find((r) => r.id === placeId)?.status).toBe(
      'confirmed cruelty',
    );
  });
});
