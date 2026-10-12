// Weekly hours from OpenStreetMap's opening_hours tag, matched to places already listed:
// restaurants, cafés, vets and pet stores across Mexico. A match is
// the same kind of place within MATCH_METERS with a similar name (pg_trgm). © OpenStreetMap
// contributors, ODbL 1.0; the app credits the hours' source. Snapshot: data/osm-hours.json.
import type { CategorySlug, PlaceHours } from '@paw-mall/shared';
import type postgres from 'postgres';

import { parseOpeningHours } from '../hours/opening-hours.ts';
import { MEXICO_AREA, type OsmElement } from './osm.ts';

/** All of Mexico (Phase 10), by the country's boundary (see osm.ts). */
const REGION = 'area.mx';
export const OSM_HOURS_QUERY = `[out:json][timeout:300];
${MEXICO_AREA}
(
  nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream)$"]["opening_hours"]["name"](${REGION});
  nwr["amenity"="veterinary"]["opening_hours"]["name"](${REGION});
  nwr["shop"~"^(pet|pet_grooming)$"]["opening_hours"]["name"](${REGION});
);
out tags center;`;
export const HOURS_KEPT_TAGS = ['name', 'amenity', 'shop', 'opening_hours'] as const;

const MATCH_METERS = 100;
const MATCH_NAME_SIMILARITY = 0.4;

const KINDS: [tag: string, values: RegExp, categories: CategorySlug[]][] = [
  ['amenity', /^(restaurant|fast_food)$/, ['restaurant']],
  ['amenity', /^(cafe|ice_cream)$/, ['cafe']],
  ['amenity', /^veterinary$/, ['veterinarian', 'vet_hospital']],
  ['shop', /^pet$/, ['pet_store', 'boutique']],
  ['shop', /^pet_grooming$/, ['groomer']],
];

export type OsmHours = {
  externalId: string;
  name: string;
  categories: CategorySlug[];
  lat: number;
  lng: number;
  hours: PlaceHours;
};

/** An element with readable hours, a name and a kind we list; null otherwise. */
export function mapHoursElement(element: OsmElement): OsmHours | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const name = tags.name?.trim();
  const categories = KINDS.find(([tag, values]) => values.test(tags[tag] ?? ''))?.[2];
  if (lat === undefined || lng === undefined || !name || !categories || !tags.opening_hours) {
    return null;
  }
  const hours = parseOpeningHours(tags.opening_hours);
  if (!hours) return null;
  return { externalId: `${element.type}/${element.id}`, name, categories, lat, lng, hours };
}

/**
 * Gives each matched place its OpenStreetMap hours (source 'osm'), unless the owner or the
 * business's website gave them. Earlier OpenStreetMap hours are cleared first, so a tag removed
 * upstream disappears here too. Returns how many places got hours.
 */
export async function saveOsmHours(sql: postgres.Sql, entries: OsmHours[]) {
  return sql.begin(async (tx) => {
    await tx`UPDATE places SET hours = NULL, hours_source = NULL WHERE hours_source = 'osm'`;
    let matched = 0;
    for (const entry of entries) {
      const point = tx`ST_SetSRID(ST_MakePoint(${entry.lng}, ${entry.lat}), 4326)::geography`;
      const updated = await tx`
        UPDATE places SET hours = ${tx.json(entry.hours)}, hours_source = 'osm'
        WHERE id = (
          SELECT p.id FROM places p
          JOIN place_categories pc ON pc.place_id = p.id
          JOIN categories c ON c.id = pc.category_id AND c.slug = ANY(${entry.categories})
          WHERE ST_DWithin(p.location, ${point}, ${MATCH_METERS})
            AND p.hidden_at IS NULL
            AND p.hours_source IS NULL
            AND similarity(lower(f_unaccent(p.name)), lower(f_unaccent(${entry.name})))
                > ${MATCH_NAME_SIMILARITY}
          ORDER BY similarity(lower(f_unaccent(p.name)), lower(f_unaccent(${entry.name}))) DESC
          LIMIT 1)`;
      matched += updated.count;
    }
    return { matched };
  });
}
