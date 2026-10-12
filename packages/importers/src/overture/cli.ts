// Fills place phones, websites and social pages from Overture Maps places (CDLA-Permissive-2.0 /
// Apache-2.0 sources; credit "Overture Maps Foundation").
//
//   pnpm places:enrich-overture [--dry-run] [--release 2026-09-23.1]
//
// Downloads pet-type places for the region once per release (cached), matches them to our places
// by location and name, and fills only what's missing: a DENUE value is never replaced, an
// owner-verified value is never touched, and a dead website counts as missing. Re-running removes
// Overture values from places that no longer match.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { DuckDBInstance } from '@duckdb/node-api';
import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { PET_CATEGORIES, contributions, findMatches } from './match.ts';

const STAC_CATALOG = 'https://stac.overturemaps.org/catalog.json';
const PLACES = (release: string) =>
  `s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*`;
/**
 * A box around all of Mexico (Phase 10). It also takes in some of the US and Guatemala, which is
 * harmless: Overture places only add phones and websites to our own places, all in Mexico.
 */
const REGION = { minLng: -118.5, maxLng: -86.7, minLat: 14.5, maxLat: 32.8 };
const BATCH_SIZE = 500;

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    release: { type: 'string', default: 'latest' },
  },
});

async function latestRelease(): Promise<string> {
  const response = await fetch(STAC_CATALOG);
  if (!response.ok) throw new Error(`Overture catalog: HTTP ${response.status}`);
  const catalog = (await response.json()) as { latest?: string };
  if (!catalog.latest) throw new Error('Overture catalog has no "latest" release');
  return catalog.latest;
}

const release = args.release === 'latest' ? await latestRelease() : args.release;
const cacheDir = join(import.meta.dirname, '../../.cache/overture');
mkdirSync(cacheDir, { recursive: true });
// The region is part of the name, so a wider region downloads again instead of reusing a smaller box.
const regionKey = `${REGION.minLng}_${REGION.minLat}_${REGION.maxLng}_${REGION.maxLat}`;
const placesFile = join(cacheDir, `pet-places-${release}-${regionKey}.parquet`);

const duck = await (await DuckDBInstance.create(':memory:')).connect();
await duck.run('INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;');
await duck.run("SET s3_region = 'us-west-2';");

if (!existsSync(placesFile)) {
  console.log(`Downloading Overture places (release ${release}) for the region… (a few minutes)`);
  const categories = PET_CATEGORIES.map((c) => `'${c}'`).join(', ');
  await duck.run(`
    COPY (
      SELECT id, names.primary AS name, ST_Y(geometry) AS lat, ST_X(geometry) AS lng,
             phones, websites, socials
      FROM read_parquet('${PLACES(release)}', hive_partitioning = 1)
      WHERE bbox.xmin > ${REGION.minLng} AND bbox.xmax < ${REGION.maxLng}
        AND bbox.ymin > ${REGION.minLat} AND bbox.ymax < ${REGION.maxLat}
        AND taxonomy.primary IN (${categories})
    ) TO '${placesFile}' (FORMAT parquet)`);
}
await duck.run(`CREATE TABLE overture AS SELECT * FROM '${placesFile}'`);

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  const ours = await sql<{ id: number; name: string; lat: number; lng: number }[]>`
    SELECT id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM places WHERE source = 'denue' AND name IS NOT NULL`;
  await duck.run('CREATE TABLE ours (id INTEGER, name VARCHAR, lat DOUBLE, lng DOUBLE)');
  const appender = await duck.createAppender('ours');
  for (const s of ours) {
    appender.appendInteger(s.id);
    appender.appendVarchar(s.name);
    appender.appendDouble(s.lat);
    appender.appendDouble(s.lng);
    appender.endRow();
  }
  appender.closeSync();

  const matches = await findMatches(duck);
  const rows = matches.map((m) => ({ ...m, ...contributions(m) }));
  const places = Number(
    (await duck.runAndReadAll('SELECT count(*) AS n FROM overture')).getRowObjectsJS()[0]?.n,
  );
  console.log(
    `Release ${release}: ${places} pet-type places, ${ours.length} named places, ` +
      `${rows.length} matched (${rows.filter((r) => r.phone).length} with a phone, ` +
      `${rows.filter((r) => r.website).length} with a website, ${rows.filter((r) => r.social).length} with a social page).`,
  );

  if (args['dry-run']) {
    console.log('Dry run: nothing written.');
  } else {
    const ids = rows.map((r) => r.placeId);
    // Places that matched before but not now lose their Overture values.
    const stale = await sql`
      UPDATE places SET
        overture_id = NULL, social_url = NULL,
        phone = CASE WHEN phone_source = 'overture' THEN NULL ELSE phone END,
        phone_source = CASE WHEN phone_source = 'overture' THEN NULL ELSE phone_source END,
        website = CASE WHEN website_source = 'overture' THEN NULL ELSE website END,
        website_source = CASE WHEN website_source = 'overture' THEN NULL ELSE website_source END
      WHERE overture_id IS NOT NULL AND id <> ALL(${ids}::int[])`;

    let phones = 0;
    let websites = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const result = await sql<{ phone_filled: boolean; website_filled: boolean }[]>`
        WITH m AS (
          SELECT * FROM unnest(
            ${batch.map((r) => r.placeId)}::int[], ${batch.map((r) => r.overtureId)}::text[],
            ${batch.map((r) => r.phone)}::text[], ${batch.map((r) => r.website)}::text[],
            ${batch.map((r) => r.social)}::text[]) AS m(id, overture_id, phone, website, social)
        ),
        fill AS (
          SELECT s.id, m.overture_id, m.social, m.phone, m.website,
                 (s.owner_verified_at IS NULL AND m.phone IS NOT NULL
                   AND (s.phone IS NULL OR s.phone_source = 'overture')) AS fill_phone,
                 (s.owner_verified_at IS NULL AND m.website IS NOT NULL
                   AND (s.website IS NULL OR s.website_source = 'overture'
                        OR s.website_status = 'dead')) AS fill_website
          FROM places s JOIN m ON m.id = s.id
        )
        UPDATE places s SET
          overture_id = f.overture_id,
          social_url = f.social,
          phone = CASE WHEN f.fill_phone THEN f.phone ELSE s.phone END,
          phone_source = CASE WHEN f.fill_phone THEN 'overture' ELSE s.phone_source END,
          website = CASE WHEN f.fill_website THEN f.website ELSE s.website END,
          website_source = CASE WHEN f.fill_website THEN 'overture' ELSE s.website_source END,
          website_status = CASE WHEN f.fill_website AND s.website IS DISTINCT FROM f.website
                                THEN NULL ELSE s.website_status END,
          website_failures = CASE WHEN f.fill_website AND s.website IS DISTINCT FROM f.website
                                  THEN 0 ELSE s.website_failures END
        FROM fill f WHERE f.id = s.id
        RETURNING f.fill_phone AS phone_filled, f.fill_website AS website_filled`;
      phones += result.filter((r) => r.phone_filled).length;
      websites += result.filter((r) => r.website_filled).length;
    }
    console.log(
      `Saved: ${phones} places have an Overture phone, ${websites} an Overture ` +
        `website; ${stale.count} places no longer match. Run pnpm places:check-websites next.`,
    );
  }
} finally {
  await sql.end();
}
