// Builds the search areas (landmarks, municipalities, towns, colonias) that the search box can
// name, e.g. "Zócalo" or "Roma Norte".
//
//   pnpm places:areas
//
// Reads every business in the cached DENUE files (run pnpm places:import first) and the curated
// landmarks in data/landmarks.json, and replaces the search_areas table.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import postgres from 'postgres';

import { parseCsvRecords } from '../csv.ts';
import { databaseUrl } from '../db-url.ts';
import { STATE_FILES } from '../denue/files.ts';
import { AreaCollector, type Landmark, landmarkAreas } from './build.ts';

const cacheDir = join(import.meta.dirname, '../../.cache/denue');
const collector = new AreaCollector();
let rows = 0;
for (const file of Object.values(STATE_FILES).flat()) {
  const unzip = spawn('unzip', ['-p', join(cacheDir, file), 'conjunto_de_datos/*.csv']);
  unzip.stdout.setEncoding('latin1');
  for await (const row of parseCsvRecords(
    createInterface({ input: unzip.stdout, crlfDelay: Infinity }),
  )) {
    collector.add(row);
    rows++;
  }
  const code: number = await new Promise((resolve) => unzip.on('close', resolve));
  if (code !== 0)
    throw new Error(`unzip failed (${code}) for ${file}; run pnpm places:import first`);
}

const landmarks = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../data/landmarks.json'), 'utf8'),
) as Landmark[];
const areas = [...landmarkAreas(landmarks), ...collector.areas()];
const byKind = areas.reduce<Record<string, number>>((acc, a) => {
  acc[a.kind] = (acc[a.kind] ?? 0) + 1;
  return acc;
}, {});
console.log(`Read ${rows} DENUE businesses. Search areas:`, byKind);

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    await tx`TRUNCATE search_areas`;
    for (let i = 0; i < areas.length; i += 2000) {
      const batch = areas.slice(i, i + 2000);
      await tx`
        INSERT INTO search_areas (kind, name, name_key, municipality, state, location, business_count)
        SELECT kind, name, name_key, municipality, state,
               ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, business_count
        FROM unnest(${batch.map((a) => a.kind)}::text[], ${batch.map((a) => a.name)}::text[],
                    ${batch.map((a) => a.nameKey)}::text[], ${batch.map((a) => a.municipality)}::text[],
                    ${batch.map((a) => a.state)}::text[], ${batch.map((a) => a.lat)}::float8[],
                    ${batch.map((a) => a.lng)}::float8[], ${batch.map((a) => a.businessCount)}::int[])
          AS t(kind, name, name_key, municipality, state, lat, lng, business_count)`;
    }
  });
  console.log(`Saved ${areas.length} search areas.`);
} finally {
  await sql.end();
}
