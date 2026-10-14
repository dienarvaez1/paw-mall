import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL } from '../../test/env';

const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

async function addPlace(externalId: string) {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO places (source, external_id, name, address, city, state, location)
    VALUES ('curated', ${`test-pet-business-${externalId}`}, ${externalId}, 'Calle 1', 'Ciudad',
            'Estado', ST_SetSRID(ST_MakePoint(-150, -0.5), 4326)::geography)
    RETURNING id`;
  return row!.id;
}

async function setCategories(placeId: number, slugs: string[]) {
  await sql`DELETE FROM place_categories WHERE place_id = ${placeId}`;
  await sql`
    INSERT INTO place_categories (place_id, category_id, source)
    SELECT ${placeId}, id, 'activity' FROM categories WHERE slug = ANY(${slugs})`;
}

async function petBusiness(placeId: number) {
  const [row] = await sql<{ pet_business: boolean }[]>`
    SELECT pet_business FROM places WHERE id = ${placeId}`;
  return row!.pet_business;
}

afterAll(async () => {
  await sql`DELETE FROM places WHERE external_id LIKE 'test-pet-business-%'`;
  await sql.end();
});

describe('places.pet_business', () => {
  it('follows the place categories (migration 0013 triggers)', async () => {
    const vet = await addPlace('vet');
    const cafe = await addPlace('cafe');
    expect(await petBusiness(vet)).toBe(false);

    await setCategories(vet, ['veterinarian']);
    await setCategories(cafe, ['cafe']);
    expect(await petBusiness(vet)).toBe(true);
    expect(await petBusiness(cafe)).toBe(false);

    // A café that also sells pet food, then only a café again.
    await setCategories(cafe, ['cafe', 'pet_store']);
    expect(await petBusiness(cafe)).toBe(true);
    await setCategories(cafe, ['cafe']);
    expect(await petBusiness(cafe)).toBe(false);

    // Recategorized in place (an UPDATE, as an owner's claim could do).
    await sql`
      UPDATE place_categories SET category_id = (SELECT id FROM categories WHERE slug = 'restaurant')
      WHERE place_id = ${vet}`;
    expect(await petBusiness(vet)).toBe(false);
  });
});
