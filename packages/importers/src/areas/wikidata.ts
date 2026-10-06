// Landmarks from Wikidata (CC0): museums, metro stations, churches, universities,
// archaeological sites, monuments, parks, plazas, stadiums, airports… in the nine states of
// docs/PLAN.md, with their coordinates and Spanish names and aliases. Only items with a Spanish
// Wikipedia article are kept (a notability filter).
// The keyword list itself, not the package entry: plain Node can't resolve the package's
// extensionless imports, and this file only imports types.
import { detectCategory } from '../../../shared/src/search-keywords.ts';

import { type SearchArea, nameKey } from './build.ts';

/** Wikidata ids of the nine states. */
export const STATE_IDS: Record<string, string> = {
  Q1489: 'Ciudad de México',
  Q82112: 'México',
  Q66117: 'Morelos',
  Q80903: 'Hidalgo',
  Q79923: 'Puebla',
  Q82681: 'Tlaxcala',
  Q60158: 'Guerrero',
  Q79861: 'Michoacán de Ocampo',
  Q79754: 'Querétaro',
};

/** Kinds of landmark, as Wikidata labels them in Spanish. */
export const LANDMARK_TYPES = [
  'museo',
  'museo de arte',
  'museo de historia',
  'estación de metro',
  'estación subterránea',
  'estación en superficie',
  'estación elevada',
  'iglesia',
  'templo',
  'catedral',
  'convento',
  'basílica',
  'santuario',
  'universidad',
  'yacimiento arqueológico',
  'zona arqueológica',
  'monumento',
  'escultura',
  'estatua',
  'parque',
  'parque nacional de México',
  'parque urbano',
  'plaza',
  'plaza pública',
  'estadio',
  'estadio de fútbol',
  'aeropuerto',
  'teatro',
  'hospital',
  'centro comercial',
  'biblioteca',
  'centro cultural',
  'palacio',
  'edificio',
  'rascacielos',
  'zoológico',
  'jardín botánico',
  'mercado',
  'parque de atracciones',
  'sala de conciertos',
  'arena',
  'estación de ferrocarril',
  'terminal de autobuses',
  'punto de referencia',
  'atracción turística',
  'glorieta',
  'fuente',
  'acueducto',
  'castillo',
  'hacienda',
];

export type WikidataLandmark = {
  id: string;
  name: string;
  aliases: string[];
  types: string[];
  state: string;
  lat: number;
  lng: number;
};

/**
 * Landmark-type items with coordinates in the nine states' box, each with its direct "located in"
 * (P131) places. Which state they're in comes from statesQuery: following P131 to any depth for
 * every item at once times out on Wikidata's servers.
 */
export function landmarksQuery(): string {
  return `SELECT ?item ?itemLabel ?typeLabel ?coord
    (GROUP_CONCAT(DISTINCT ?admin; separator="|") AS ?admins)
    (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases) WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(-103.8 16.3)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(-96.7 21.7)"^^geo:wktLiteral . }
  ?item wdt:P31 ?type . ?type rdfs:label ?tl .
  FILTER(lang(?tl) = "es" && STR(?tl) IN (${LANDMARK_TYPES.map((t) => JSON.stringify(t)).join(', ')}))
  ?es schema:about ?item ; schema:isPartOf <https://es.wikipedia.org/> .
  OPTIONAL { ?item wdt:P131 ?admin }
  OPTIONAL { ?item skos:altLabel ?alias FILTER(lang(?alias) = "es") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es".
    ?item rdfs:label ?itemLabel . ?type rdfs:label ?typeLabel . }
} GROUP BY ?item ?itemLabel ?typeLabel ?coord`;
}

/** Which of the nine states each "located in" place belongs to (a short P131 chain from each). */
export function statesQuery(adminIds: string[]): string {
  return `SELECT ?admin ?state WHERE {
  VALUES ?admin { ${adminIds.map((id) => `wd:${id}`).join(' ')} }
  VALUES ?state { ${Object.keys(STATE_IDS)
    .map((id) => `wd:${id}`)
    .join(' ')} }
  ?admin wdt:P131* ?state .
}`;
}

type Binding = Record<string, { value: string } | undefined>;

const lastPart = (uri: string | undefined) => uri?.split('/').pop() ?? '';

/** The "located in" place ids of the landmark rows, to look their states up. */
export function adminIds(bindings: Binding[]): string[] {
  const ids = new Set<string>();
  for (const b of bindings) {
    for (const uri of (b.admins?.value ?? '').split('|').filter(Boolean)) ids.add(lastPart(uri));
  }
  return [...ids].sort();
}

/**
 * One landmark per Wikidata item, merging its types, with the state its "located in" places
 * belong to (`stateOf`: place id → state name). Items outside the nine states, or without a
 * Spanish name, are dropped.
 */
export function parseLandmarks(
  bindings: Binding[],
  stateOf: Map<string, string>,
): WikidataLandmark[] {
  const items = new Map<string, WikidataLandmark>();
  for (const b of bindings) {
    const id = lastPart(b.item?.value);
    const name = b.itemLabel?.value ?? '';
    const point = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? '');
    const state = (b.admins?.value ?? '')
      .split('|')
      .map((uri) => stateOf.get(lastPart(uri)))
      .find(Boolean);
    // Without a Spanish label, Wikidata returns the id itself ("Q6940502").
    if (!id || !point || !state || /^Q\d+$/.test(name)) continue;
    const item = items.get(id) ?? {
      id,
      name,
      aliases: (b.aliases?.value ?? '').split('|').filter(Boolean),
      types: [],
      state,
      lat: Number(point[2]),
      lng: Number(point[1]),
    };
    const type = b.typeLabel?.value;
    if (type && !item.types.includes(type)) item.types.push(type);
    items.set(id, item);
  }
  return [...items.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

const STATION = /^estaci[oó]n/i;

/**
 * The names a landmark answers to. Stations only as "Metro X" / "Estación X", since their bare
 * names ("Hidalgo", "Insurgentes") are also municipalities and colonias. One-word generic names
 * ("Catedral") and category keywords ("Hospital") are skipped.
 */
export function landmarkNames(item: WikidataLandmark): string[] {
  const all = [item.name, ...item.aliases];
  const names = item.types.some((t) => STATION.test(t))
    ? [
        ...all.filter((n) => /^(metro|estaci[oó]n)\s/i.test(n)),
        `Metro ${item.name}`,
        `Estación ${item.name}`,
      ]
    : all;
  const keys = new Set<string>();
  return names.filter((name) => {
    const key = nameKey(name);
    const generic = !key.includes(' ') && LANDMARK_TYPES.some((t) => nameKey(t) === key);
    const keyword = detectCategory(name).category !== null && detectCategory(name).words === '';
    if (key.length < 4 || generic || keyword || keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

/** Search areas for Wikidata landmarks, leaving out names a curated landmark already has. */
export function wikidataLandmarkAreas(
  items: WikidataLandmark[],
  curatedKeys: Set<string>,
): SearchArea[] {
  return items.flatMap((item) =>
    landmarkNames(item)
      .filter((name) => !curatedKeys.has(nameKey(name)))
      .map((name) => ({
        kind: 'landmark' as const,
        name: item.name,
        nameKey: nameKey(name),
        municipality: null,
        state: item.state,
        lat: item.lat,
        lng: item.lng,
        businessCount: 0,
      })),
  );
}
