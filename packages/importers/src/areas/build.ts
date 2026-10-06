// Search areas from DENUE: the center of each municipality, town and colonia is the median
// position of every business registered there (all kinds of business, not just pet ones).
import { titleCase } from '../denue/map.ts';

export type AreaKind = 'landmark' | 'municipality' | 'town' | 'colonia';

export type SearchArea = {
  kind: AreaKind;
  name: string;
  nameKey: string;
  municipality: string | null;
  state: string;
  lat: number;
  lng: number;
  businessCount: number;
};

/** Fewer businesses than this and a colonia or town center isn't trusted (or worth searching). */
export const MIN_COLONIA_BUSINESSES = 5;
export const MIN_TOWN_BUSINESSES = 20;

const PREFIXES =
  /^(colonia|col|barrio|bo|fraccionamiento|fracc|pueblo|unidad habitacional|u hab|ampliacion|amp)\s+/;

/** "Col. Roma Norte" -> "roma norte"; the same key for typed searches and stored names. */
export function nameKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
    .replace(PREFIXES, '')
    .trim();
}

const PLACEHOLDERS = new Set(['', 'ninguno', 'sin nombre', 'sn', 'otro especifique']);

type Group = {
  kind: AreaKind;
  name: string;
  municipality: string | null;
  state: string;
  lats: number[];
  lngs: number[];
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Collects DENUE rows (any business) and returns municipality, town and colonia centers. */
export class AreaCollector {
  private groups = new Map<string, Group>();

  add(row: Record<string, string>): void {
    const lat = Number(row.latitud);
    const lng = Number(row.longitud);
    const state = (row.entidad ?? '').trim();
    const municipality = (row.municipio ?? '').trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || !state || !municipality) {
      return;
    }
    this.push('municipality', municipality, null, state, lat, lng);
    const town = (row.localidad ?? '').trim();
    if (town && nameKey(town) !== nameKey(municipality)) {
      this.push('town', town, municipality, state, lat, lng);
    }
    const colonia = (row.nomb_asent ?? '').trim();
    if (!PLACEHOLDERS.has(nameKey(colonia))) {
      this.push('colonia', titleCase(colonia), municipality, state, lat, lng);
    }
  }

  private push(
    kind: AreaKind,
    name: string,
    municipality: string | null,
    state: string,
    lat: number,
    lng: number,
  ) {
    const key = `${kind}|${state}|${municipality ?? ''}|${nameKey(name)}`;
    let group = this.groups.get(key);
    if (!group) {
      group = { kind, name, municipality, state, lats: [], lngs: [] };
      this.groups.set(key, group);
    }
    group.lats.push(lat);
    group.lngs.push(lng);
  }

  areas(): SearchArea[] {
    const min: Record<AreaKind, number> = {
      landmark: 0,
      municipality: 1,
      town: MIN_TOWN_BUSINESSES,
      colonia: MIN_COLONIA_BUSINESSES,
    };
    return [...this.groups.values()]
      .filter((g) => g.lats.length >= min[g.kind])
      .map((g) => ({
        kind: g.kind,
        name: g.name,
        nameKey: nameKey(g.name),
        municipality: g.municipality,
        state: g.state,
        lat: median(g.lats),
        lng: median(g.lngs),
        businessCount: g.lats.length,
      }));
  }
}

export type Landmark = {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  state?: string;
};

/** One search area per landmark name and alias, all at the landmark's point. */
export function landmarkAreas(landmarks: Landmark[]): SearchArea[] {
  return landmarks.flatMap((l) =>
    [l.name, ...l.aliases].map((name) => ({
      kind: 'landmark' as const,
      name: l.name,
      nameKey: nameKey(name),
      municipality: null,
      state: l.state ?? 'Ciudad de México',
      lat: l.lat,
      lng: l.lng,
      businessCount: 0,
    })),
  );
}
