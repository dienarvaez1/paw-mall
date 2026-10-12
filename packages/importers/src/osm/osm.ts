// OpenStreetMap places with a dog rule across Mexico: dog parks, and parks and venues
// tagged dog=yes|leashed|designated|no. © OpenStreetMap contributors, under the Open Database License
// (ODbL 1.0): credited wherever shown, and kept in their own rows (source 'osm'), never merged
// into another source's records. The snapshot is data/osm-dogs.json (`pnpm places:osm`).
import type { CategorySlug } from '@paw-mall/shared';

import { isCrueltyLinked } from '../denue/map.ts';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** All of Mexico (Phase 10): the country's boundary, not a box, so no US or Guatemalan places. */
export const MEXICO_AREA = 'area["ISO3166-1"="MX"][admin_level=2]->.mx;';
const REGION = 'area.mx';
export const OVERPASS_QUERY = `[out:json][timeout:180];
${MEXICO_AREA}
(
  nwr["leisure"="dog_park"](${REGION});
  nwr["dog"]["leisure"~"^(park|garden|nature_reserve)$"](${REGION});
  nwr["dog"]["amenity"~"^(restaurant|fast_food|cafe|ice_cream|bar|pub)$"](${REGION});
  nwr["dog"]["tourism"~"^(hotel|hostel|guest_house|motel|museum|attraction|zoo)$"](${REGION});
);
out tags center;`;

/** The tags the snapshot keeps; the rest of each element is dropped. */
export const KEPT_TAGS = [
  'name',
  'name:es',
  'leisure',
  'amenity',
  'tourism',
  'dog',
  'website',
  'contact:website',
  'addr:street',
  'addr:housenumber',
] as const;

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OsmPlace = {
  /** "way/123": the element's OpenStreetMap id. */
  externalId: string;
  /** Null only for unnamed dog parks, which get a generic name and the nearest colonia. */
  name: string | null;
  category: CategorySlug;
  lat: number;
  lng: number;
  dogs: boolean;
  leashed: boolean;
  dogPark: boolean;
  street: string | null;
  website: string | null;
  url: string;
};

const CATEGORIES: [tag: string, values: RegExp, category: CategorySlug][] = [
  ['leisure', /^(park|garden|nature_reserve)$/, 'park'],
  ['amenity', /^(restaurant|fast_food|bar|pub)$/, 'restaurant'],
  ['amenity', /^(cafe|ice_cream)$/, 'cafe'],
  ['tourism', /^(hotel|hostel|guest_house|motel)$/, 'lodging'],
  ['tourism', /^museum$/, 'museum'],
  ['tourism', /^(attraction|zoo)$/, 'tourist_site'],
];

const TAKES_DOGS = new Set(['yes', 'leashed', 'designated']);

/** An element as a place with its dog rule; null when it has none we can show, or no name. */
export function mapOsmElement(element: OsmElement): OsmPlace | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  const dogPark = tags.leisure === 'dog_park';
  const category = dogPark
    ? 'park'
    : CATEGORIES.find(([tag, values]) => values.test(tags[tag] ?? ''))?.[2];
  if (!category) return null;
  const dogs = dogPark || TAKES_DOGS.has(tags.dog ?? '') ? true : tags.dog === 'no' ? false : null;
  if (dogs === null) return null;

  const name = (tags['name:es'] ?? tags.name ?? '').trim() || null;
  if (!name && !dogPark) return null;
  if (name && isCrueltyLinked(name)) return null;
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  return {
    externalId: `${element.type}/${element.id}`,
    name,
    category,
    lat,
    lng,
    dogs,
    leashed: tags.dog === 'leashed',
    dogPark,
    street: street || null,
    website: tags.website ?? tags['contact:website'] ?? null,
    url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

/** The snapshot's copy of an element: its id, position and KEPT_TAGS. */
export function slimElement(element: OsmElement): OsmElement {
  const tags = Object.fromEntries(
    KEPT_TAGS.flatMap((key) => (element.tags?.[key] ? [[key, element.tags[key]]] : [])),
  );
  return {
    type: element.type,
    id: element.id,
    ...(element.lat !== undefined ? { lat: element.lat, lon: element.lon } : {}),
    ...(element.center ? { center: element.center } : {}),
    tags,
  };
}
