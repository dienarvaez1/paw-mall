// Matches our places to Overture Maps places by location and name, inside DuckDB.
import type { DuckDBConnection } from '@duckdb/node-api';

import { formatPhone, normalizeWebsite } from '../denue/map.ts';

/**
 * Overture categories for pet businesses and feed stores (release 2026-09-23.1). Breeders,
 * butchers and slaughterhouse-like categories are left out on purpose.
 */
export const PET_CATEGORIES = [
  'veterinarian',
  'animal_hospital',
  'emergency_pet_hospital',
  'pet_store',
  'aquatic_pet_store',
  'animal_or_pet_service',
  'pet_groomer',
  'pet_boarding',
  'pet_sitting',
  'animal_shelter',
  'livestock_feed_and_supply_store',
  'farm_equipment_and_supply',
];

/** A match must be this close and this similar by name (as in Ferre Mall's pilot). */
export const MAX_DISTANCE_M = 100;
export const MIN_NAME_SIMILARITY = 0.93;

/** About 110 m of latitude; a cheap box filter before measuring real distances. */
const BOX_DEGREES = 0.001;

/** Lower-case, accent-free name without words many pet businesses share. */
function normalizedName(column: string): string {
  return `trim(regexp_replace(regexp_replace(lower(strip_accents(coalesce(${column}, ''))),
    '\\b(veterinaria|veterinario|clinica|consultorio|hospital|estetica|canina|canino|mascotas?|tienda|forrajeria|forrajera|y|de|del|la|el|los|las|para|sa|cv|s a|c v)\\b',
    ' ', 'g'), '[^a-z0-9]+', ' ', 'g'))`;
}

export type OvertureMatch = {
  placeId: number;
  overtureId: string;
  phones: string[];
  websites: string[];
  socials: string[];
};

/**
 * Best Overture place per place from tables `ours(id, name, lat, lng)` and
 * `overture(id, name, lat, lng, phones, websites, socials)`. Unnamed places aren't matched.
 */
export async function findMatches(
  con: DuckDBConnection,
  minSimilarity = MIN_NAME_SIMILARITY,
): Promise<OvertureMatch[]> {
  const reader = await con.runAndReadAll(`
    WITH pairs AS (
      SELECT s.id AS place_id, p.id AS overture_id, p.phones, p.websites, p.socials,
             ST_Distance_Sphere(ST_Point(s.lng, s.lat), ST_Point(p.lng, p.lat)) AS meters,
             jaro_winkler_similarity(${normalizedName('s.name')}, ${normalizedName('p.name')}) AS sim
      FROM ours s JOIN overture p
        ON p.lat BETWEEN s.lat - ${BOX_DEGREES} AND s.lat + ${BOX_DEGREES}
       AND p.lng BETWEEN s.lng - ${BOX_DEGREES} AND s.lng + ${BOX_DEGREES}
      WHERE s.name IS NOT NULL AND p.name IS NOT NULL
        AND ${normalizedName('s.name')} <> ''
    )
    SELECT place_id, overture_id, phones, websites, socials FROM (
      SELECT *, row_number() OVER (PARTITION BY place_id ORDER BY sim DESC, meters) AS rank
      FROM pairs WHERE meters < ${MAX_DISTANCE_M} AND sim >= ${minSimilarity})
    WHERE rank = 1
    ORDER BY place_id`);
  return reader.getRowObjectsJS().map((row) => ({
    placeId: Number(row.place_id),
    overtureId: String(row.overture_id),
    phones: (row.phones as string[] | null) ?? [],
    websites: (row.websites as string[] | null) ?? [],
    socials: (row.socials as string[] | null) ?? [],
  }));
}

/** Overture phones are international ("+52 55 3708 8580"); show them like DENUE's. */
export function normalizeOverturePhone(value: string | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits;
  return formatPhone(national);
}

/** First usable https social page (Facebook, Instagram, …). */
export function pickSocial(socials: string[]): string | null {
  return socials.find((url) => /^https:\/\/[^\s]+\.[a-z]{2,}\//i.test(url)) ?? null;
}

/** The phone, website and social page a match can contribute. */
export function contributions(match: OvertureMatch) {
  return {
    phone: match.phones.map(normalizeOverturePhone).find(Boolean) ?? null,
    website: match.websites.map(normalizeWebsite).find(Boolean) ?? null,
    social: pickSocial(match.socials),
  };
}
