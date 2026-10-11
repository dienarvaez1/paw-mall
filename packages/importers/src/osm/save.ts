import type postgres from 'postgres';

import { hideDenueCopies } from '../curated/save.ts';
import type { OsmPlace } from './osm.ts';

/** An OpenStreetMap park this close to a curated one of the same kind is the same park. */
const SAME_AS_CURATED_METERS = 150;

/**
 * Upserts OpenStreetMap places (source 'osm') with their categories and pet policies, dated by the
 * snapshot. Addresses: the tagged street, else the nearest colonia (`pnpm places:areas`). Places
 * near a curated one of the same kind are skipped (the curated one has the fuller policy); owner
 * policies always win. Removes 'osm' places that left the snapshot (unless removeMissing is false,
 * as in tests) and hides DENUE copies of the venues.
 */
export async function saveOsmPlaces(
  sql: postgres.Sql,
  places: OsmPlace[],
  fetchedOn: string,
  { removeMissing = true } = {},
) {
  return sql.begin(async (tx) => {
    const ids: number[] = [];
    let skipped = 0;
    let ownerKept = 0;
    for (const p of places) {
      const point = tx`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`;
      const [curated] = await tx`
        SELECT 1 FROM places v
        JOIN place_categories vc ON vc.place_id = v.id
        JOIN categories c ON c.id = vc.category_id AND c.slug = ${p.category}
        WHERE v.source = 'curated' AND ST_DWithin(v.location, ${point}, ${SAME_AS_CURATED_METERS})
        LIMIT 1`;
      if (curated) {
        skipped++;
        continue;
      }
      const [colonia] = await tx<{ name: string; municipality: string | null; state: string }[]>`
        SELECT name, municipality, state FROM search_areas
        WHERE kind = 'colonia' ORDER BY location <-> ${point} LIMIT 1`;
      const area = colonia ? `Col. ${colonia.name}` : null;
      const name = p.name ?? (area ? `Parque canino, ${area}` : 'Parque canino');
      const address = [p.street, area].filter(Boolean).join(', ') || 'Ciudad de México';

      const [row] = await tx<{ id: number }[]>`
        INSERT INTO places (source, external_id, name, address, city, state, location,
                            website, website_source, source_updated_on)
        VALUES ('osm', ${p.externalId}, ${name}, ${address}, ${colonia?.municipality ?? ''},
                ${colonia?.state ?? 'Ciudad de México'}, ${point}, ${p.website},
                ${p.website ? 'osm' : null}, ${fetchedOn})
        ON CONFLICT (source, external_id) DO UPDATE SET
          name = EXCLUDED.name, address = EXCLUDED.address, city = EXCLUDED.city,
          state = EXCLUDED.state, location = EXCLUDED.location,
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
        SELECT ${id}, c.id, 'osm' FROM categories c WHERE c.slug = ${p.category}
        ON CONFLICT (place_id, category_id) DO NOTHING`;

      const [owner] = await tx`
        SELECT 1 FROM pet_policies WHERE place_id = ${id} AND source = 'owner'`;
      if (owner) {
        ownerKept++;
        continue;
      }
      // Public parks publish no size limit, so they take any dog (as the curated parks do).
      const park = p.category === 'park';
      const rules = p.dogPark ? 'Parque canino.' : p.leashed ? 'Con correa.' : null;
      await tx`
        INSERT INTO pet_policies (place_id, dogs, max_dog_size, areas, rules, source, source_name,
                                  source_url, last_confirmed_on)
        VALUES (${id}, ${p.dogs}, ${p.dogs && park ? 'large' : null},
                ${park && p.dogs ? ['outdoor'] : []}, ${rules}, 'osm', 'OpenStreetMap', ${p.url},
                ${fetchedOn})
        ON CONFLICT (place_id) DO UPDATE SET
          dogs = EXCLUDED.dogs, max_dog_size = EXCLUDED.max_dog_size, areas = EXCLUDED.areas,
          rules = EXCLUDED.rules, source = 'osm', source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          last_confirmed_on = GREATEST(pet_policies.last_confirmed_on, EXCLUDED.last_confirmed_on)`;
    }
    const removed = removeMissing
      ? (await tx`DELETE FROM places WHERE source = 'osm' AND id <> ALL(${ids}::int[])`).count
      : 0;
    const duplicates = await hideDenueCopies(tx, 'osm');
    return { saved: ids.length, skipped, ownerKept, removed, duplicates };
  });
}
