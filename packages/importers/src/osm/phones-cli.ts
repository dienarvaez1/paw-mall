// Gives listed vets without a phone their OpenStreetMap phone (see phones.ts) from the committed
// snapshot, data/osm-vet-phones.json. Safe to re-run; DENUE, Overture and owner phones always win.
//
//   pnpm places:osm-phones              load the snapshot
//   pnpm places:osm-phones --refresh    fetch a new snapshot from the Overpass API first (one request)
//   pnpm places:osm-phones --dry-run    report without writing to the database
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { OVERPASS_URL, type OsmElement } from './osm.ts';
import { OSM_PHONES_QUERY, PHONES_KEPT_TAGS, mapPhoneElement, saveOsmPhones } from './phones.ts';

const { values: args } = parseArgs({
  options: {
    refresh: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});
const snapshotPath = join(import.meta.dirname, '../../data/osm-vet-phones.json');

type Snapshot = { about: string; fetchedOn: string; elements: OsmElement[] };

if (args.refresh) {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'paw-mall-dev/0.1 (local development)',
    },
    body: new URLSearchParams({ data: OSM_PHONES_QUERY }),
  });
  if (!response.ok) throw new Error(`Overpass request failed (${response.status})`);
  const { elements } = (await response.json()) as { elements: OsmElement[] };
  const slim = elements.map((e) => ({
    type: e.type,
    id: e.id,
    ...(e.lat !== undefined ? { lat: e.lat, lon: e.lon } : {}),
    ...(e.center ? { center: e.center } : {}),
    tags: Object.fromEntries(
      PHONES_KEPT_TAGS.flatMap((key) => (e.tags?.[key] ? [[key, e.tags[key]]] : [])),
    ),
  }));
  const snapshot: Snapshot = {
    about:
      'OpenStreetMap phones of named vets across Mexico. © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). Refresh with `pnpm places:osm-phones --refresh`.',
    fetchedOn: new Date().toISOString().slice(0, 10),
    elements: slim.sort((a, b) => `${a.type}${a.id}`.localeCompare(`${b.type}${b.id}`)),
  };
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot)}\n`);
  console.log(`Fetched ${elements.length} elements.`);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot;
const entries = snapshot.elements.map(mapPhoneElement).filter((e) => e !== null);
console.log(
  `${entries.length} of ${snapshot.elements.length} elements have a phone we can read (snapshot ${snapshot.fetchedOn}).`,
);

if (!args['dry-run']) {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const { matched } = await saveOsmPhones(sql, entries);
    console.log(
      `Matched ${matched} listed vets without a phone; they now show the OpenStreetMap one.`,
    );
  } finally {
    await sql.end();
  }
}
