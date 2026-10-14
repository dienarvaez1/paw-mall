import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, testEnv } from '../../../test/env';
import app from '../../index';

const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

async function addPlace(extra: { owner?: boolean; website?: string } = {}): Promise<number> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location,
                        source_updated_on, owner_verified_at, website, website_status,
                        website_checked_at)
    VALUES ('denue', ${`test-verification-${Math.random()}`}, 'Veterinaria Prueba', 'Calle 1',
            'Ciudad', 'Estado', ST_SetSRID(ST_MakePoint(-131, 1), 4326)::geography, '2026-05-20',
            ${extra.owner ? sql`'2026-10-05 12:00-06'` : null}, ${extra.website ? 'https://example.com' : null},
            ${extra.website ? 'ok' : null}, ${extra.website ?? null})
    RETURNING id`;
  return row!.id;
}

const verification = async (id: number) =>
  ((await (await app.request(`/v1/places/${id}`, {}, testEnv)).json()) as { verification: unknown })
    .verification;

beforeAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-verification-%'`;
});

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-verification-%'`;
  await sql.end();
});

describe('place verification status', () => {
  it('is "listed" with the source edition date when nothing else confirms it', async () => {
    expect(await verification(await addPlace())).toEqual({
      status: 'listed',
      checkedOn: '2026-05-20',
    });
  });

  it('is "website_verified" after a recent website check, not after an old one', async () => {
    const recent = new Date().toISOString();
    expect(await verification(await addPlace({ website: recent }))).toMatchObject({
      status: 'website_verified',
    });
    expect(await verification(await addPlace({ website: '2024-01-01T00:00:00Z' }))).toEqual({
      status: 'listed',
      checkedOn: '2026-05-20',
    });
  });

  it('is "community_confirmed" when the pet policy comes from users', async () => {
    const id = await addPlace({ website: new Date().toISOString() });
    await sql`INSERT INTO pet_policies (place_id, dogs, source, last_confirmed_on)
              VALUES (${id}, true, 'community', '2026-10-01')`;
    expect(await verification(id)).toEqual({
      status: 'community_confirmed',
      checkedOn: '2026-10-01',
    });
  });

  it('is "owner_verified" on the approval date', async () => {
    expect(await verification(await addPlace({ owner: true }))).toEqual({
      status: 'owner_verified',
      checkedOn: '2026-10-05',
    });
  });

  it('is "needs_review" once a phone reports it, even when the owner verified it', async () => {
    const id = await addPlace({ owner: true });
    await sql`INSERT INTO place_reports (place_id, reason, client_id)
              VALUES (${id}, 'closed', 'phone-0000000000000001')`;
    expect(await verification(id)).toEqual({ status: 'needs_review', checkedOn: null });
  });
});
