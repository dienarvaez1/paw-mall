import type { PlaceClaim, PlaceReport, PlaceReportReason } from '@paw-mall/shared';
import { sql } from 'drizzle-orm';

import type { Database } from '../db/client';

/** Distinct phones reporting a place within the window that hide it pending review. */
export const REPORTS_TO_HIDE: Record<PlaceReportReason, number> = { closed: 3, cruelty: 2 };
export const REPORT_WINDOW_DAYS = 90;

/**
 * Records a report (once per place, reason and phone). When enough different phones reported the
 * same reason recently, the place is hidden until reviewed (`pnpm places:reports`). Only the reason,
 * the date and the app's random id are stored (CLAUDE.md, "Reporter privacy").
 */
export async function reportPlace(db: Database, placeId: number, report: PlaceReport) {
  await db.execute(sql`
    INSERT INTO place_reports (place_id, reason, client_id)
    VALUES (${placeId}, ${report.reason}, ${report.clientId})
    ON CONFLICT (place_id, reason, client_id) DO NOTHING`);

  await db.execute(sql`
    UPDATE places SET hidden_at = now(), hidden_reason = ${`reported_${report.reason}`}
    WHERE id = ${placeId}
      AND hidden_at IS NULL
      AND (SELECT count(DISTINCT client_id) FROM place_reports
           WHERE place_id = ${placeId} AND reason = ${report.reason}
             AND created_at > now() - make_interval(days => ${REPORT_WINDOW_DAYS}))
          >= ${REPORTS_TO_HIDE[report.reason]}`);
}

/** Saves a pending claim for the owner's review (`pnpm places:claims`). */
export async function createClaim(db: Database, placeId: number, claim: PlaceClaim) {
  await db.execute(sql`
    INSERT INTO place_claims (place_id, phone, website, hours, open24h, accepts_emergencies,
                              contact_name, contact)
    VALUES (${placeId}, ${claim.phone ?? null}, ${claim.website ?? null},
            ${claim.hours ? JSON.stringify(claim.hours) : null}::jsonb,
            ${claim.open24h ?? null}, ${claim.acceptsEmergencies ?? null},
            ${claim.contactName}, ${claim.contact})`);
}
