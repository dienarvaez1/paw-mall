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

import { importRuns, makePoint, places } from '../../../../apps/api/src/db/schema.ts';
import { parseCsvRecords } from '../csv.ts';
import { STATE_FILES } from './files.ts';
import { databaseUrl } from '../db-url.ts';
import {
  type DenuePlace,
  type MappedRow,
  dedupeChainBranches,
  mapDenueRow,
  parseEditionDate,
} from './map.ts';

const DOWNLOAD_BASE = 'https://www.inegi.org.mx/contenidos/masiva/denue';
const BATCH_SIZE = 1000;

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

const rows = dedupeChainBranches([...found.values()]);
const countBy = (key: (p: DenuePlace) => string[]) => {
  const counts = new Map<string, number>();
  for (const place of rows) for (const k of key(place)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
};
console.log(`Found ${rows.length} places (${found.size - rows.length} chain duplicates merged).`);
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
  await db.transaction(async (tx) => {
    const [run] = await tx.insert(importRuns).values({ source: 'denue' }).returning();

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const saved = await tx
        .insert(places)
        .values(
          batch.map((p) => ({
            source: 'denue',
            externalId: p.externalId,
            activityCode: p.activityCode,
            name: p.name,
            chain: p.chain,
            address: p.address,
            city: p.city,
            state: p.state,
            phone: p.phone,
            phoneSource: p.phone ? 'denue' : null,
            website: p.website,
            websiteSource: p.website ? 'denue' : null,
            location: makePoint(p.lng, p.lat),
            registeredOn: p.registeredOn,
            sourceUpdatedOn: p.editionDate,
          })),
        )
        .onConflictDoUpdate({
          target: [places.source, places.externalId],
          set: {
            activityCode: sql`excluded.activity_code`,
            name: sql`excluded.name`,
            chain: sql`excluded.chain`,
            address: sql`excluded.address`,
            city: sql`excluded.city`,
            state: sql`excluded.state`,
            // Owner-verified values win; then DENUE's; an Overture value stays when DENUE has none.
            phone: sql`CASE WHEN places.owner_verified_at IS NOT NULL THEN places.phone
              WHEN excluded.phone IS NOT NULL THEN excluded.phone
              WHEN places.phone_source = 'overture' THEN places.phone END`,
            phoneSource: sql`CASE WHEN places.owner_verified_at IS NOT NULL THEN places.phone_source
              WHEN excluded.phone IS NOT NULL THEN 'denue'
              WHEN places.phone_source = 'overture' THEN 'overture' END`,
            website: sql`CASE WHEN places.owner_verified_at IS NOT NULL THEN places.website
              WHEN excluded.website IS NOT NULL THEN excluded.website
              WHEN places.website_source = 'overture' THEN places.website END`,
            websiteSource: sql`CASE WHEN places.owner_verified_at IS NOT NULL THEN places.website_source
              WHEN excluded.website IS NOT NULL THEN 'denue'
              WHEN places.website_source = 'overture' THEN 'overture' END`,
            // A website that changes needs a fresh check (only DENUE can change it here).
            websiteStatus: sql`CASE WHEN places.owner_verified_at IS NULL AND excluded.website IS NOT NULL
              AND places.website IS DISTINCT FROM excluded.website THEN NULL ELSE places.website_status END`,
            websiteFailures: sql`CASE WHEN places.owner_verified_at IS NULL AND excluded.website IS NOT NULL
              AND places.website IS DISTINCT FROM excluded.website THEN 0 ELSE places.website_failures END`,
            location: sql`excluded.location`,
            registeredOn: sql`excluded.registered_on`,
            sourceUpdatedOn: sql`excluded.source_updated_on`,
            // hidden_at is left alone: a place hidden by shopper reports stays hidden.
          },
        })
        .returning({ id: places.id, externalId: places.externalId });

      const idOf = new Map(saved.map((s) => [s.externalId, s.id]));
      const ids = saved.map((s) => s.id);
      const categoryRows = batch.flatMap((p) =>
        p.categories.map((c) => ({ placeId: idOf.get(p.externalId), ...c })),
      );
      const hints = batch.filter((p) => p.open24hHint).map((p) => idOf.get(p.externalId));

      // Categories from DENUE are replaced; ones an owner chose are kept.
      await tx.execute(sql`
        DELETE FROM place_categories
        WHERE place_id = ANY(${sql.param(ids)}::int[]) AND source <> 'owner'`);
      await tx.execute(sql`
        INSERT INTO place_categories (place_id, category_id, source)
        SELECT r.place_id, c.id, r.source
        FROM unnest(${sql.param(categoryRows.map((r) => r.placeId))}::int[],
                    ${sql.param(categoryRows.map((r) => r.slug))}::text[],
                    ${sql.param(categoryRows.map((r) => r.source))}::text[])
          AS r(place_id, slug, source)
        JOIN categories c ON c.slug = r.slug
        ON CONFLICT (place_id, category_id) DO NOTHING`);

      // "24 horas" name hints; an owner's answer is never overwritten.
      await tx.execute(sql`
        DELETE FROM vet_details
        WHERE place_id = ANY(${sql.param(ids)}::int[]) AND open24h_source = 'name'
          AND place_id <> ALL(${sql.param(hints)}::int[])`);
      await tx.execute(sql`
        INSERT INTO vet_details (place_id, open24h, open24h_source)
        SELECT unnest(${sql.param(hints)}::int[]), true, 'name'
        ON CONFLICT (place_id) DO UPDATE SET open24h = true, open24h_source = 'name'
        WHERE vet_details.open24h_source IS DISTINCT FROM 'owner'`);
    }

    // Businesses that left DENUE in the imported states, or are now excluded.
    const removed = await tx.execute(sql`
      DELETE FROM places
      WHERE source = 'denue'
        AND state = ANY(${sql.param([...stateNames])}::text[])
        AND external_id <> ALL(${sql.param(rows.map((p) => p.externalId))}::text[])`);

    await tx
      .update(importRuns)
      .set({ finishedAt: new Date(), rowsOk: rows.length, rowsExcluded: excluded.length })
      .where(sql`${importRuns.id} = ${run?.id}`);
    console.log(`Saved ${rows.length} places; removed ${removed.count} no longer in DENUE.`);
  });
} finally {
  await client.end();
}
