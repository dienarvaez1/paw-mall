// Loads OpenStreetMap places with a dog rule across Mexico (see osm.ts) from the committed
// snapshot, data/osm-dogs.json. Safe to re-run.
//
//   pnpm places:osm              load the snapshot
//   pnpm places:osm --refresh    fetch a new snapshot from the Overpass API first (one request)
//   pnpm places:osm --dry-run    report without writing to the database
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import {
  OVERPASS_QUERY,
  OVERPASS_URL,
  type OsmElement,
  mapOsmElement,
  slimElement,
} from './osm.ts';
import { saveOsmPlaces } from './save.ts';

const { values: args } = parseArgs({
  options: {
    refresh: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});
const snapshotPath = join(import.meta.dirname, '../../data/osm-dogs.json');

type Snapshot = { about: string; fetchedOn: string; elements: OsmElement[] };

if (args.refresh) {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'paw-mall-dev/0.1 (local development)',
    },
    body: new URLSearchParams({ data: OVERPASS_QUERY }),
  });
  if (!response.ok) throw new Error(`Overpass request failed (${response.status})`);
  const { elements } = (await response.json()) as { elements: OsmElement[] };
  const snapshot: Snapshot = {
    about:
      'OpenStreetMap places with a dog rule across Mexico (dog parks; parks and venues tagged dog=*). © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). Refresh with `pnpm places:osm --refresh`.',
    fetchedOn: new Date().toISOString().slice(0, 10),
    elements: elements
      .map(slimElement)
      .sort((a, b) => `${a.type}${a.id}`.localeCompare(`${b.type}${b.id}`)),
  };
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Fetched ${elements.length} elements.`);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot;
const places = snapshot.elements.map(mapOsmElement).filter((p) => p !== null);
const count = (test: (p: (typeof places)[number]) => boolean) => places.filter(test).length;
console.log(
  `${places.length} of ${snapshot.elements.length} elements usable (snapshot ${snapshot.fetchedOn}): ${count((p) => p.dogPark)} dog parks, ${count((p) => !p.dogPark && p.category === 'park')} parks, ${count((p) => p.category !== 'park')} venues; ${count((p) => !p.dogs)} say no to dogs.`,
);

if (!args['dry-run']) {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const result = await saveOsmPlaces(sql, places, snapshot.fetchedOn);
    console.log(
      `Saved ${result.saved} places (${result.ownerKept} owner policies kept); skipped ${result.skipped} next to a curated one; removed ${result.removed}; hid ${result.duplicates} DENUE copies.`,
    );
  } finally {
    await sql.end();
  }
}
