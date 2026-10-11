import {
  communityPolicy,
  PET_ANSWER_WINDOW_DAYS,
  type PetAnswer,
  type PlaceClaim,
  type PlaceReport,
  type PlaceReportReason,
  POLICY_ANSWER_WINDOW_DAYS,
  POLICY_DISPUTES_TO_REVIEW,
  type PolicyAnswer,
} from '@paw-mall/shared';
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
                              pet_policy, contact_name, contact)
    VALUES (${placeId}, ${claim.phone ?? null}, ${claim.website ?? null},
            ${claim.hours ? JSON.stringify(claim.hours) : null}::jsonb,
            ${claim.open24h ?? null}, ${claim.acceptsEmergencies ?? null},
            ${claim.petPolicy ? JSON.stringify(claim.petPolicy) : null}::jsonb,
            ${claim.contactName}, ${claim.contact})`);
}

/**
 * Records a shopper's answer about a place's pet policy (one per phone; a new answer replaces the
 * old one). A confirmation moves "last confirmed" to today. When at least
 * POLICY_DISPUTES_TO_REVIEW phones recently said it changed, and more of them than confirmed it,
 * the policy goes under review (`pnpm places:policies`). Returns false when the place has no
 * policy. Only the answer, the date and the app's random id are stored.
 */
export async function answerPolicy(
  db: Database,
  placeId: number,
  { answer, clientId }: PolicyAnswer,
): Promise<boolean> {
  const [policy] = await db.execute<{ place_id: number }>(
    sql`SELECT place_id FROM pet_policies WHERE place_id = ${placeId}`,
  );
  if (!policy) return false;

  await db.execute(sql`
    INSERT INTO policy_answers (place_id, answer, client_id)
    VALUES (${placeId}, ${answer}, ${clientId})
    ON CONFLICT (place_id, client_id) DO UPDATE SET answer = EXCLUDED.answer, created_at = now()`);

  if (answer === 'confirm') {
    await db.execute(sql`
      UPDATE pet_policies
      SET last_confirmed_on = (now() AT TIME ZONE 'America/Mexico_City')::date
      WHERE place_id = ${placeId} AND review_since IS NULL`);
    return true;
  }
  await db.execute(sql`
    UPDATE pet_policies SET review_since = now()
    WHERE place_id = ${placeId} AND review_since IS NULL
      AND (SELECT count(*) FILTER (WHERE answer = 'dispute') >= ${POLICY_DISPUTES_TO_REVIEW}
                  AND count(*) FILTER (WHERE answer = 'dispute')
                      > count(*) FILTER (WHERE answer = 'confirm')
           FROM policy_answers
           WHERE place_id = ${placeId}
             AND created_at > now() - make_interval(days => ${POLICY_ANSWER_WINDOW_DAYS}))`);
  return true;
}

export type PetAnswerResult = 'saved' | 'not_a_pet_venue' | 'policy_exists';

/**
 * Records a user's "¿Acepta mascotas?" answer (one per phone; a new one replaces it), then
 * publishes, updates or withdraws the users' policy from the answers of the last
 * PET_ANSWER_WINDOW_DAYS days (see communityPolicy). Only for pet-friendly venues whose policy, if
 * any, came from users: owner, curated and OpenStreetMap policies take "¿Sigue siendo así?".
 */
export async function answerPet(
  db: Database,
  placeId: number,
  { takesDogs, maxDogSize, clientId }: PetAnswer,
): Promise<PetAnswerResult> {
  const [place] = await db.execute<{ venue: boolean; source: string | null }>(sql`
    SELECT EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                   WHERE pc.place_id = ${placeId} AND c."group" = 'pet_friendly') AS venue,
           (SELECT source FROM pet_policies WHERE place_id = ${placeId}) AS source`);
  if (!place?.venue) return 'not_a_pet_venue';
  if (place.source && place.source !== 'community') return 'policy_exists';

  await db.execute(sql`
    INSERT INTO pet_answers (place_id, takes_dogs, max_dog_size, client_id)
    VALUES (${placeId}, ${takesDogs}, ${takesDogs ? (maxDogSize ?? null) : null}, ${clientId})
    ON CONFLICT (place_id, client_id) DO UPDATE
    SET takes_dogs = EXCLUDED.takes_dogs, max_dog_size = EXCLUDED.max_dog_size, created_at = now()`);

  const answers = await db.execute<{
    takes_dogs: boolean;
    max_dog_size: PetAnswer['maxDogSize'];
  }>(sql`
    SELECT takes_dogs, max_dog_size FROM pet_answers
    WHERE place_id = ${placeId}
      AND created_at > now() - make_interval(days => ${PET_ANSWER_WINDOW_DAYS})`);
  const policy = communityPolicy(
    answers.map((a) => ({ takesDogs: a.takes_dogs, maxDogSize: a.max_dog_size })),
  );
  if (!policy) {
    await db.execute(
      sql`DELETE FROM pet_policies WHERE place_id = ${placeId} AND source = 'community'`,
    );
    return 'saved';
  }
  await db.execute(sql`
    INSERT INTO pet_policies (place_id, dogs, max_dog_size, source, last_confirmed_on)
    VALUES (${placeId}, ${policy.dogs}, ${policy.maxDogSize}, 'community',
            (now() AT TIME ZONE 'America/Mexico_City')::date)
    ON CONFLICT (place_id) DO UPDATE
    SET dogs = EXCLUDED.dogs, max_dog_size = EXCLUDED.max_dog_size,
        last_confirmed_on = EXCLUDED.last_confirmed_on
    WHERE pet_policies.source = 'community'`);
  return 'saved';
}
