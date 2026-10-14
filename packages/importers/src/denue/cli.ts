// Imports pet businesses from INEGI's DENUE bulk files into `places`.
//
//   pnpm places:import [--dry-run] [--states 09,15,17]
//
// Places are upserted by DENUE id (source 'denue'), with their categories and vet details. Names
// linked to animal cruelty are left out and listed. Places of the imported states that are no
// longer in DENUE (or are now excluded) are removed.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { parseCsvRecords } from '../csv.ts';
import { STATE_FILES } from './files.ts';
import { databaseUrl } from '../db-url.ts';
import {
  type DenuePlace,
  type MappedRow,
  dedupeChainBranches,
  dedupeSameBusiness,
  mapDenueRow,
  parseEditionDate,
} from './map.ts';
import { saveDenuePlaces } from './save.ts';

const DOWNLOAD_BASE = 'https://www.inegi.org.mx/contenidos/masiva/denue';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    states: { type: 'string', default: Object.keys(STATE_FILES).join(',') },
  },
});

const cacheDir = join(import.meta.dirname, '../../.cache/denue');
mkdirSync(cacheDir, { recursive: true });

async function download(file: string): Promise<string> {
  const path = join(cacheDir, file);
  if (existsSync(path)) return path;
  console.log(`Downloading ${file}…`);
  const response = await fetch(`${DOWNLOAD_BASE}/${file}`);
  if (!response.ok || !response.body)
    throw new Error(`Download failed (${response.status}): ${file}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(`${path}.part`));
  renameSync(`${path}.part`, path);
  return path;
}

/** The edition date printed in the zip's data dictionary, e.g. "2026-05-20". */
async function readEditionDate(zipPath: string): Promise<string | null> {
  const unzip = spawn('unzip', ['-p', zipPath, 'diccionario_de_datos/*.csv']);
  unzip.stdout.setEncoding('latin1');
  const lines = createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  for await (const line of lines) {
    unzip.kill();
    return parseEditionDate(line);
  }
  return null;
}

/** Streams the data CSV out of a DENUE zip (INEGI files are Latin-1). */
async function* readRows(zipPath: string): AsyncGenerator<MappedRow> {
  const unzip = spawn('unzip', ['-p', zipPath, 'conjunto_de_datos/*.csv']);
  unzip.stdout.setEncoding('latin1');
  const lines = createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  for await (const row of parseCsvRecords(lines)) {
    const mapped = mapDenueRow(row);
    if (mapped) yield mapped;
  }
  const code: number = await new Promise((resolve) => unzip.on('close', resolve));
  if (code !== 0) throw new Error(`unzip failed (${code}) for ${zipPath}`);
}

const states = args.states.split(',').map((code) => code.trim());
const unknown = states.filter((code) => !STATE_FILES[code]);
if (unknown.length > 0) throw new Error(`Unknown state codes: ${unknown.join(', ')}`);

const found = new Map<string, DenuePlace & { editionDate: string | null }>();
const excluded: Extract<MappedRow, { kind: 'excluded' }>[] = [];
const stateNames = new Set<string>();
for (const code of states) {
  for (const file of STATE_FILES[code] ?? []) {
    const zipPath = await download(file);
    const editionDate = await readEditionDate(zipPath);
    for await (const mapped of readRows(zipPath)) {
      if (mapped.kind === 'excluded') {
        excluded.push(mapped);
        continue;
      }
      found.set(mapped.place.externalId, { ...mapped.place, editionDate });
      stateNames.add(mapped.place.state);
    }
  }
}

const rows = dedupeSameBusiness(dedupeChainBranches([...found.values()]));
const countBy = (key: (p: DenuePlace) => string[]) => {
  const counts = new Map<string, number>();
  for (const place of rows) for (const k of key(place)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
};
console.log(`Found ${rows.length} places (${found.size - rows.length} duplicates merged).`);
console.log('By DENUE class:', Object.fromEntries(countBy((p) => [p.activityCode])));
console.log('By category:', Object.fromEntries(countBy((p) => p.categories.map((c) => c.slug))));
console.log('By state:', Object.fromEntries(countBy((p) => [p.state])));
console.log(`Vets with "24 horas" in the name: ${rows.filter((p) => p.open24hHint).length}`);
console.log(`Excluded ${excluded.length} names linked to animal cruelty:`);
for (const e of excluded) console.log(`  ${e.activityCode} ${e.externalId} ${e.name}`);

if (args['dry-run']) {
  console.log('Dry run: nothing written.');
  process.exit(0);
}

const client = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(client, { casing: 'snake_case' });

try {
  const { saved, removed } = await saveDenuePlaces(db, rows, {
    stateNames,
    excludedCount: excluded.length,
  });
  console.log(`Saved ${saved} places; removed ${removed} no longer in DENUE.`);
  // Fresh planner statistics after a big write: with stale ones, Pet-friendly's "sin confirmar"
  // query in a dense city took 2.2 s instead of 0.14 s (Phase 10, all of Mexico).
  await db.execute(sql`ANALYZE places`);
} finally {
  await client.end();
}
