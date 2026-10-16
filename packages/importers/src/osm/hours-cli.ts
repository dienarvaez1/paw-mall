// Gives listed places their OpenStreetMap hours (see hours.ts) from the committed snapshot,
// data/osm-hours.json. Safe to re-run; owner and website hours always win.
//
//   pnpm places:osm-hours              load the snapshot
//   pnpm places:osm-hours --refresh    fetch a new snapshot from the Overpass API first (one request)
//   pnpm places:osm-hours --dry-run    report without writing to the database
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { HOURS_KEPT_TAGS, OSM_HOURS_QUERY, mapHoursElement, saveOsmHours } from './hours.ts';
import { OVERPASS_URL, type OsmElement } from './osm.ts';

const { values: args } = parseArgs({
  options: {
    refresh: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});
const snapshotPath = join(import.meta.dirname, '../../data/osm-hours.json');

type Snapshot = { about: string; fetchedOn: string; elements: OsmElement[] };

if (args.refresh) {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'pet-helper-dev/0.1 (local development)',
    },
    body: new URLSearchParams({ data: OSM_HOURS_QUERY }),
  });
  if (!response.ok) throw new Error(`Overpass request failed (${response.status})`);
  const { elements } = (await response.json()) as { elements: OsmElement[] };
  const slim = elements.map((e) => ({
    type: e.type,
    id: e.id,
    ...(e.lat !== undefined ? { lat: e.lat, lon: e.lon } : {}),
    ...(e.center ? { center: e.center } : {}),
    tags: Object.fromEntries(
      HOURS_KEPT_TAGS.flatMap((key) => (e.tags?.[key] ? [[key, e.tags[key]]] : [])),
    ),
  }));
  const snapshot: Snapshot = {
    about:
      'OpenStreetMap opening_hours of restaurants, cafés, vets and pet stores across Mexico. © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). Refresh with `pnpm places:osm-hours --refresh`.',
    fetchedOn: new Date().toISOString().slice(0, 10),
    elements: slim.sort((a, b) => `${a.type}${a.id}`.localeCompare(`${b.type}${b.id}`)),
  };
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot)}\n`);
  console.log(`Fetched ${elements.length} elements.`);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot;
const entries = snapshot.elements.map(mapHoursElement).filter((e) => e !== null);
console.log(
  `${entries.length} of ${snapshot.elements.length} elements have hours we can read (snapshot ${snapshot.fetchedOn}).`,
);

if (!args['dry-run']) {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const { matched } = await saveOsmHours(sql, entries);
    console.log(`Matched ${matched} listed places; they now show OpenStreetMap hours.`);
  } finally {
    await sql.end();
  }
}
