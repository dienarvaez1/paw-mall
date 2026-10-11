import type postgres from 'postgres';

import type { CuratedPlace } from './curated.ts';

type Sql = postgres.Sql;

/**
 * Upserts curated places, their categories and policies in one transaction, and (unless
 * removeMissing is false, as in tests) removes curated places that left the file.
 * Owner-verified phones and websites, owner categories and owner policies are never replaced.
 */
export async function saveCuratedPlaces(
  sql: Sql,
  places: CuratedPlace[],
  { removeMissing = true } = {},
) {
  return sql.begin(async (tx) => {
    let policies = 0;
    let ownerKept = 0;
    const ids: number[] = [];
    for (const p of places) {
      const [row] = await tx<{ id: number }[]>`
        INSERT INTO places (source, external_id, name, address, city, state, location,
                            phone, phone_source, website, website_source, source_updated_on)
        VALUES ('curated', ${p.externalId}, ${p.name}, ${p.address}, ${p.city}, ${p.state},
                ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography,
                ${p.phone}, ${p.phone ? 'overture' : null}, ${p.website},
                ${p.website ? 'curated' : null}, ${p.checkedOn})
        ON CONFLICT (source, external_id) DO UPDATE SET
          name = EXCLUDED.name, address = EXCLUDED.address, city = EXCLUDED.city,
          state = EXCLUDED.state, location = EXCLUDED.location,
          phone = CASE WHEN places.owner_verified_at IS NULL THEN EXCLUDED.phone ELSE places.phone END,
          phone_source = CASE WHEN places.owner_verified_at IS NULL THEN EXCLUDED.phone_source
            ELSE places.phone_source END,
          website = CASE WHEN places.owner_verified_at IS NULL THEN EXCLUDED.website
            ELSE places.website END,
          website_source = CASE WHEN places.owner_verified_at IS NULL THEN EXCLUDED.website_source
            ELSE places.website_source END,
          source_updated_on = EXCLUDED.source_updated_on
        RETURNING id`;
      const id = row!.id;
      ids.push(id);

      await tx`DELETE FROM place_categories WHERE place_id = ${id} AND source <> 'owner'`;
      await tx`
        INSERT INTO place_categories (place_id, category_id, source)
        SELECT ${id}, c.id, 'curated' FROM categories c WHERE c.slug = ANY(${p.categories})
        ON CONFLICT (place_id, category_id) DO NOTHING`;

      const [existing] = await tx<{ source: string; same: boolean }[]>`
        SELECT source,
               (dogs, cats, other_pets, max_dog_size, max_weight_kg, max_pets, fee, areas, rules)
               IS NOT DISTINCT FROM
               (${p.policy.dogs}::boolean, ${p.policy.cats}::boolean,
                ${p.policy.otherPets}::boolean, ${p.policy.maxDogSize}::text,
                ${p.policy.maxWeightKg}::float8, ${p.policy.maxPets}::smallint,
                ${p.policy.fee ? tx.json(p.policy.fee) : null}::jsonb, ${p.policy.areas}::text[],
                ${p.policy.rules}::text) AS same
        FROM pet_policies WHERE place_id = ${id}`;
      if (existing?.source === 'owner') {
        ownerKept++;
        continue;
      }
      if (existing && !existing.same) {
        await tx`DELETE FROM policy_answers WHERE place_id = ${id}`;
      }
      await tx`
        INSERT INTO pet_policies (place_id, dogs, cats, other_pets, max_dog_size, max_weight_kg,
                                  max_pets, fee, areas, rules, source, source_name, source_url,
                                  last_confirmed_on)
        VALUES (${id}, ${p.policy.dogs}, ${p.policy.cats}, ${p.policy.otherPets},
                ${p.policy.maxDogSize}, ${p.policy.maxWeightKg}, ${p.policy.maxPets},
                ${p.policy.fee ? tx.json(p.policy.fee) : null}, ${p.policy.areas},
                ${p.policy.rules}, 'curated', ${p.sourceName}, ${p.sourceUrl}, ${p.checkedOn})
        ON CONFLICT (place_id) DO UPDATE SET
          dogs = EXCLUDED.dogs, cats = EXCLUDED.cats, other_pets = EXCLUDED.other_pets,
          max_dog_size = EXCLUDED.max_dog_size, max_weight_kg = EXCLUDED.max_weight_kg,
          max_pets = EXCLUDED.max_pets, fee = EXCLUDED.fee, areas = EXCLUDED.areas,
          rules = EXCLUDED.rules, source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          -- A shopper's later confirmation stays; a changed policy starts from the new check.
          last_confirmed_on = CASE WHEN ${existing?.same ?? false}
            THEN GREATEST(pet_policies.last_confirmed_on, EXCLUDED.last_confirmed_on)
            ELSE EXCLUDED.last_confirmed_on END,
          review_since = CASE WHEN ${existing?.same ?? false} THEN pet_policies.review_since END`;
      policies++;
    }
    const removed = removeMissing
      ? (await tx`DELETE FROM places WHERE source = 'curated' AND id <> ALL(${ids}::int[])`).count
      : 0;
    return { saved: ids.length, policies, ownerKept, removed };
  });
}
