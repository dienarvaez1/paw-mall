import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { importRuns, makePoint, places } from '../../../../apps/api/src/db/schema.ts';
import type { DenuePlace } from './map.ts';

export type DenueRow = DenuePlace & { editionDate: string | null };

const BATCH_SIZE = 1000;

/**
 * Saves an import in one transaction: places upserted by DENUE id, with their categories and
 * "24 horas" hints, and places of the imported states no longer in DENUE removed. An import that
 * fails or is interrupted part way leaves nothing behind, not even its import_runs row.
 */
export async function saveDenuePlaces(
  db: PostgresJsDatabase,
  rows: DenueRow[],
  {
    stateNames,
    excludedCount,
    batchSize = BATCH_SIZE,
  }: { stateNames: Set<string>; excludedCount: number; batchSize?: number },
): Promise<{ saved: number; removed: number }> {
  return db.transaction(async (tx) => {
    const [run] = await tx.insert(importRuns).values({ source: 'denue' }).returning();

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
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
      .set({ finishedAt: new Date(), rowsOk: rows.length, rowsExcluded: excludedCount })
      .where(sql`${importRuns.id} = ${run?.id}`);
    return { saved: rows.length, removed: removed.count };
  });
}
