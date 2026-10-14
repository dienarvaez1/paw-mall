// Phones of vets from OpenStreetMap, for listed vets and vet hospitals that have none (164 of the
// 616 hospitals had none, Phase 14). A match is a vet within MATCH_METERS with a similar name
// (pg_trgm), as for hours. © OpenStreetMap contributors, ODbL 1.0; the app credits the phone's
// source. Snapshot: data/osm-vet-phones.json.
import type postgres from 'postgres';

import { formatPhone } from '../denue/map.ts';
import { MEXICO_AREA, type OsmElement } from './osm.ts';

/** All of Mexico (Phase 10), by the country's boundary (see osm.ts). */
const REGION = 'area.mx';
export const OSM_PHONES_QUERY = `[out:json][timeout:300];
${MEXICO_AREA}
(
  nwr["amenity"="veterinary"]["name"]["phone"](${REGION});
  nwr["amenity"="veterinary"]["name"]["contact:phone"](${REGION});
);
out tags center;`;
export const PHONES_KEPT_TAGS = ['name', 'amenity', 'phone', 'contact:phone'] as const;

const MATCH_METERS = 100;
const MATCH_NAME_SIMILARITY = 0.4;

export type OsmPhone = {
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  phone: string;
};

/**
 * A Mexican number as DENUE writes it ("55 1234 5678"): the first of several ("…; …"), without
 * +52 or the old mobile 1; null unless 10 digits are left.
 */
export function mexicanPhone(value: string): string | null {
  let digits = (value.split(/[;,/]/)[0] ?? '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
  if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
  return digits.length === 10 ? formatPhone(digits) : null;
}

/** A named vet with a phone we can read; null otherwise. */
export function mapPhoneElement(element: OsmElement): OsmPhone | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const name = tags.name?.trim();
  const phone = mexicanPhone(tags.phone ?? tags['contact:phone'] ?? '');
  if (lat === undefined || lng === undefined || !name || tags.amenity !== 'veterinary' || !phone) {
    return null;
  }
  return { externalId: `${element.type}/${element.id}`, name, lat, lng, phone };
}

/**
 * Gives each matched vet without a phone its OpenStreetMap phone (source 'osm'). Earlier
 * OpenStreetMap phones are cleared first, so a tag removed upstream disappears here too; DENUE,
 * Overture and owners' phones are never replaced. Returns how many places got a phone.
 */
export async function saveOsmPhones(sql: postgres.Sql, entries: OsmPhone[]) {
  return sql.begin(async (tx) => {
    await tx`UPDATE places SET phone = NULL, phone_source = NULL WHERE phone_source = 'osm'`;
    let matched = 0;
    for (const entry of entries) {
      const point = tx`ST_SetSRID(ST_MakePoint(${entry.lng}, ${entry.lat}), 4326)::geography`;
      const updated = await tx`
        UPDATE places SET phone = ${entry.phone}, phone_source = 'osm'
        WHERE id = (
          SELECT p.id FROM places p
          WHERE ST_DWithin(p.location, ${point}, ${MATCH_METERS})
            AND p.hidden_at IS NULL
            AND p.phone IS NULL
            AND EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                        WHERE pc.place_id = p.id AND c.slug IN ('veterinarian', 'vet_hospital'))
            AND similarity(lower(f_unaccent(p.name)), lower(f_unaccent(${entry.name})))
                > ${MATCH_NAME_SIMILARITY}
          ORDER BY similarity(lower(f_unaccent(p.name)), lower(f_unaccent(${entry.name}))) DESC
          LIMIT 1)`;
      matched += updated.count;
    }
    return { matched };
  });
}
