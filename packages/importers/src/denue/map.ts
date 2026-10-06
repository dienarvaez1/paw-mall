// Maps INEGI DENUE rows to places. DENUE: Directorio Estadístico Nacional de Unidades Económicas,
// reusable under INEGI's free-use terms with attribution ("Fuente: INEGI, DENUE").
import type { CategorySlug } from '@paw-mall/shared';

/** SCIAN classes imported with a category of their own. */
const ACTIVITY_CATEGORIES: Record<string, CategorySlug> = {
  // Comercio al por menor de mascotas: pet stores, boutiques, pet food stores.
  '465911': 'pet_store',
  // Servicios veterinarios para mascotas prestados por el sector privado.
  '541941': 'veterinarian',
  // Servicios veterinarios para mascotas prestados por el sector público (e.g. Centros de Control
  // Canino, which the owner decided to list).
  '541942': 'public_vet_service',
  // Comercio al por mayor de medicamentos veterinarios y alimentos para animales: forrajerías.
  '434112': 'feed_store',
};

/**
 * Classes imported only by name: 812990 (otros servicios personales, a catch-all) for grooming,
 * boarding and pet funeral names; 812310 (servicios funerarios) for pet funeral names, since most
 * funeral homes there are for people.
 */
const NAME_ONLY_ACTIVITIES = new Set(['812990', '812310']);

const VET_ACTIVITIES = new Set(['541941', '541942']);

/** Words that say the business is about animals. */
const ANIMAL =
  /\b(CANIN[AO]S?|MASCOTAS?|PERR[OA]S?|PERRIT[OA]S?|GAT[OA]S?|GATIT[OA]S?|FELIN[OA]S?|PETS?|DOGS?|CATS?|ANIMAL(ES)?|PELUD[OA]S?|HUELLITAS?|PATITAS?|LOMIT[OA]S?|MININ[OA]S?|VETERINARI[OA]S?)\b/;
const GROOMING = /\b(ESTETICAS?|PELUQUERIAS?|PERRUQUERIAS?|SPA|BANOS?|BARBER(IA|SHOP)?|SALON)\b/;
const GROOMING_ALONE = /\bGROOM(ING|ER|ERS)?\b/;
const BOARDING =
  /\b(PENSION(ES)?|HOTEL(ES)?|GUARDERIAS?|HOSPEDAJE|ESTANCIAS?|RESORT|DAYCARE|KINDER|INN|CAMP|HOUSING|HOSTAL)\b/;
/** Shelters and rescues: a "hotel para perros abandonados" isn't a boarding business. */
const SHELTER = /\b(ABANDONAD[OA]S?|REFUGIOS?|ALBERGUES?|ADOPCION(ES)?|RESCATES?)\b/;
/** Pet crematoriums and funeral homes (owner's decision, 2026-10-05), with an animal word too. */
const FUNERAL =
  /\b(CREMATORIOS?|CREMACION(ES)?|FUNERARI[AO]S?|FUNERAL(ES)?|CEMENTERIOS?|PANTEON(ES)?|INCINERA\w*|MEMORIAL)\b/;
const BOUTIQUE = /\bBOUTIQUE\b/;
const HOSPITAL = /\bHOSPITAL\b/;
/** "24 horas" in a vet's name: a hint, unconfirmed until the owner says so. */
const OPEN_24H = /\b24 ?(HORAS|HRS|HR|H)\b/;

/**
 * Names linked to animal cruelty, which Paw Mall never lists (docs/PLAN.md, "No animal cruelty"):
 * slaughterhouses and butchers, cockfighting and bullfighting. Checked against both the business
 * name and the legal name. "El Rastro" alone is a common place name, so it doesn't count.
 * Cockfighting also shows up as its gear and breeders: blades (navajas), cages and accessories for
 * roosters, galleros (fighting-cock breeders) and rooster fincas. A rooster in the name alone
 * ("Veterinaria El Gallo de Oro") doesn't count, and neither does a spur ("La Espuela" is as
 * likely about horses; listed for the owner's review).
 */
export const CRUELTY =
  /(\b(?<!\bEL )RASTROS?\b|\b(MATADEROS?|CARNICERIAS?|OBRADOR(ES)?|EMPACADORA DE CARNES?|GALLOS? DE (COMBATE|PELEA)|GALLOS FINOS|GALLERAS?|GALLEROS?|PALENQUES? DE GALLOS|PELEAS? DE (GALLOS|PERROS)|TAURIN[OA]S?|TOROS DE LIDIA|PUPPY MILLS?|NAVAJAS?|(ACCESORIOS|JAULAS|PRODUCTOS|ARTICULOS) PARA GALLOS?)\b|\bFINCA\b.*\bGALLOS?\b)/;

/**
 * Breeding operations for pets or fighting cocks: the puppy-mill risk. Raising farm animals
 * ("forrajera la crianza", poultry supplies) is fine.
 */
const BREEDING = /\b(CRIADEROS?|CRIANZA|CRIA DE)\b/;
const BRED_ANIMALS =
  /\b(CANIN[AO]S?|PERR[OA]S?|CACHORR[OA]S?|GAT[OA]S?|FELIN[OA]S?|MASCOTAS?|GALLOS?)\b/;

/** Whether a business's names tie it to animal cruelty. */
export function isCrueltyLinked(names: string): boolean {
  const text = plain(names);
  return CRUELTY.test(text) || (BREEDING.test(text) && BRED_ANIMALS.test(text));
}

type Chain = { pattern: RegExp; chain: string };

/** Chains recognized by name. Entries of one chain closer than SAME_PLACE_METERS are merged. */
const CHAINS: Chain[] = [
  { pattern: /\bPETCO\b/, chain: 'Petco' },
  { pattern: /(\+ ?KOTA\b|\bMAS KOTA\b)/, chain: '+Kota' },
  { pattern: /\bMASKOTA\b/, chain: 'Maskota' },
  { pattern: /\bPETLAND\b/, chain: 'Petland' },
  { pattern: /\bBANFIELD\b/, chain: 'Banfield' },
];
const SAME_PLACE_METERS = 100;

/** Chain sites pet owners can't visit: offices, warehouses, distribution centers. */
const NOT_A_PLACE = /\b(OFICINAS?|CORPORATIVO|CEDIS|ALMACEN|CENTRO DE DISTRIBUCION)\b/;

export type PlaceCategory = { slug: CategorySlug; source: 'activity' | 'name' };

export type DenuePlace = {
  externalId: string;
  activityCode: string;
  name: string | null;
  chain: string | null;
  categories: PlaceCategory[];
  /** "24 horas" in a vet's name. */
  open24hHint: boolean;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  /** First of the month INEGI registered the business ("2010-07" -> "2010-07-01"), if known. */
  registeredOn: string | null;
};

export type MappedRow =
  | { kind: 'place'; place: DenuePlace }
  /** A row that would be imported, left out because its name is linked to animal cruelty. */
  | { kind: 'excluded'; externalId: string; activityCode: string; name: string };

/** Upper case without accents or extra spaces: "Estética  Canina" -> "ESTETICA CANINA". */
export function plain(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Categories for a business from its DENUE class and name; empty when it isn't a pet business. */
export function categorize(activityCode: string, name: string): PlaceCategory[] {
  const text = plain(name);
  const out: PlaceCategory[] = [];
  const add = (slug: CategorySlug, source: PlaceCategory['source']) => {
    if (!out.some((c) => c.slug === slug)) out.push({ slug, source });
  };

  const own = ACTIVITY_CATEGORIES[activityCode];
  if (own) add(own, 'activity');
  else if (!NAME_ONLY_ACTIVITIES.has(activityCode)) return [];

  const animal = ANIMAL.test(text);
  if (GROOMING_ALONE.test(text) || (GROOMING.test(text) && animal)) add('groomer', 'name');
  if (BOARDING.test(text) && animal && !SHELTER.test(text)) add('boarding', 'name');
  if (FUNERAL.test(text) && animal) add('pet_funeral', 'name');
  if (own && BOUTIQUE.test(text)) add('boutique', 'name');
  if (HOSPITAL.test(text) && (VET_ACTIVITIES.has(activityCode) || animal)) {
    add('vet_hospital', 'name');
    if (activityCode !== '541942') add('veterinarian', 'name');
  }
  return out;
}

const SMALL_WORDS = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'y',
  'e',
  'en',
  'a',
  'con',
  'por',
  'para',
]);
const PLACEHOLDERS = new Set(['', 'NINGUNO', 'SN', 'S/N', 'OTRO(ESPECIFIQUE)', '0']);

/** "VETERINARIA LA ESPERANZA DEL SUR" -> "Veterinaria la Esperanza del Sur" (first word capitalized). */
export function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word)
        ? word
        : word.replace(/^(\p{L})/u, (first) => first.toUpperCase()),
    )
    .join(' ');
}

function clean(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  return PLACEHOLDERS.has(trimmed.toUpperCase()) ? '' : trimmed;
}

/** "CALLE" + "VILLA ANGELA" + "4" -> "Calle Villa Angela 4, Col. Desarrollo Urbano, C.P. 09700". */
export function buildAddress(row: Record<string, string>): string {
  const streetType = clean(row.tipo_vial);
  const street = clean(row.nom_vial);
  const number = [clean(row.numero_ext), clean(row.letra_ext)].filter(Boolean).join(' ');
  const settlementType = clean(row.tipo_asent).toUpperCase();
  const settlement = clean(row.nomb_asent);
  // Stored as a number in some files, which drops the leading zero (03310 -> 3310).
  const rawPostalCode = clean(row.cod_postal);
  const postalCode = /^\d{4}$/.test(rawPostalCode) ? `0${rawPostalCode}` : rawPostalCode;

  const parts: string[] = [];
  const streetLine = [streetType && street ? titleCase(streetType) : '', titleCase(street), number]
    .filter(Boolean)
    .join(' ');
  if (streetLine) parts.push(streetLine);
  if (settlement) {
    parts.push(
      `${settlementType === 'COLONIA' || !settlementType ? 'Col.' : titleCase(settlementType)} ${titleCase(settlement)}`,
    );
  }
  if (postalCode) parts.push(`C.P. ${postalCode}`);
  return parts.join(', ');
}

/** DENUE fecha_alta ("2010-07") as an ISO date for the first of that month. */
export function parseRegisteredMonth(value: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec((value ?? '').trim());
  return match ? `${match[1]}-${match[2]}-01` : null;
}

/** Edition date from the first line of a DENUE data dictionary: "… DENUE (20/05/2026)" -> "2026-05-20". */
export function parseEditionDate(dictionaryFirstLine: string): string | null {
  const match = /\((\d{2})\/(\d{2})\/(\d{4})\)/.exec(dictionaryFirstLine);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Mexican 10-digit numbers as "55 3708 8580"; anything else as digits, or null. */
export function formatPhone(value: string | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 10) {
    // Mexico City, Guadalajara and Monterrey use 2-digit area codes; others 3.
    const twoDigit = /^(55|56|33|81)/.test(digits);
    return twoDigit
      ? `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`
      : `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return digits;
}

/** Webmail domains: a "website" on one of these is an email address typed into the wrong field. */
const WEBMAIL = /(gmail|hotmail|yahoo|outlook|live|icloud|prodigy)\.(com|com\.mx|mx|net)$/;

export function normalizeWebsite(value: string | undefined): string | null {
  const site = (value ?? '').trim().toLowerCase();
  if (!site || !site.includes('.') || /\s/.test(site) || site.includes('@')) return null;
  const url = /^https?:\/\//.test(site) ? site : `https://${site}`;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  // "veterinaria.lapatita1gmail.com" is lapatita1@gmail.com without the @.
  // A real host name: labels separated by dots, ending in a letters-only domain (".no" isn't one).
  if (WEBMAIL.test(host) || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host)) return null;
  return url;
}

export function findChain(text: string): string | null {
  const upper = plain(text);
  return CHAINS.find(({ pattern }) => pattern.test(upper))?.chain ?? null;
}

/** A place from a DENUE row; an exclusion for cruelty-linked names; null for anything else. */
export function mapDenueRow(row: Record<string, string>): MappedRow | null {
  const activityCode = (row.codigo_act ?? '').trim();
  const lat = Number(row.latitud);
  const lng = Number(row.longitud);
  if (!row.id || !Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    return null;
  }
  const name = clean(row.nom_estab) || clean(row.raz_social);
  const categories = categorize(activityCode, name);
  if (categories.length === 0) return null;

  const names = plain(`${clean(row.nom_estab)} | ${clean(row.raz_social)}`);
  if (isCrueltyLinked(names)) return { kind: 'excluded', externalId: row.id, activityCode, name };

  const chain = findChain(names);
  if (chain && NOT_A_PLACE.test(plain(name))) return null;
  const isVet = categories.some((c) => c.slug === 'veterinarian' || c.slug === 'vet_hospital');
  return {
    kind: 'place',
    place: {
      externalId: row.id,
      activityCode,
      name: name ? titleCase(name) : null,
      chain,
      categories,
      open24hHint: isVet && OPEN_24H.test(plain(name)),
      address: buildAddress(row),
      city: (row.municipio ?? '').trim(),
      state: (row.entidad ?? '').trim(),
      phone: formatPhone(row.telefono),
      website: normalizeWebsite(row.www),
      lat,
      lng,
      registeredOn: parseRegisteredMonth(row.fecha_alta),
    },
  };
}

function meters(a: DenuePlace, b: DenuePlace): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Better entry first: contact data, then the newest registration, then the lower id. */
function preferred(a: DenuePlace, b: DenuePlace): number {
  const score = (p: DenuePlace) => [
    (p.phone ? 1 : 0) + (p.website ? 1 : 0),
    Number((p.registeredOn ?? '').replaceAll('-', '')),
  ];
  const [x, y] = [score(a), score(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return (y[i] ?? 0) - (x[i] ?? 0);
  return a.externalId.localeCompare(b.externalId);
}

/**
 * INEGI sometimes registers a chain branch twice, a few meters apart. Keeps one entry per chain
 * branch; places without a chain are never merged.
 */
export function dedupeChainBranches<T extends DenuePlace>(places: T[]): T[] {
  const kept: T[] = [];
  for (const place of places.filter((p) => p.chain !== null).sort(preferred)) {
    const twin = kept.some((k) => k.chain === place.chain && meters(k, place) < SAME_PLACE_METERS);
    if (!twin) kept.push(place);
  }
  return [...places.filter((p) => p.chain === null), ...kept];
}
