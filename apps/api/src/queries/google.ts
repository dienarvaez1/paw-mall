import type { GoogleDetailsResponse, Locale } from '@paw-mall/shared';
import { sql } from 'drizzle-orm';

import type { Database } from '../db/client';
import { type GoogleConfig, findPlaceId, getPlaceDetails } from '../lib/google-places';
import { isSamePlace } from '../lib/place-match';

/** Stay under Google's 1,000 free Place Details Enterprise requests a month. */
export const DEFAULT_MONTHLY_LIMIT = 950;
/** "Ver horario" lookups per user per day, so one person can't use up the month. */
export const DEFAULT_DAILY_LOOKUPS = 5;
const DETAILS_SKU = 'place_details_enterprise';
const SEARCH_SKU = 'text_search_ids_only';

export type GoogleLookupOptions = GoogleConfig & {
  /** Hash of the user's IP and the day (see userKey). */
  client: string;
  language: Locale;
  monthlyLimit?: number;
  dailyLookups?: number;
  now?: Date;
};

function dateIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now); // YYYY-MM-DD
}

/** An anonymous per-day key for a user: the IP is hashed with the day and never stored. */
export async function userKey(ip: string, now = new Date()): Promise<string> {
  const data = new TextEncoder().encode(`${dateIn('America/Mexico_City', now)}:${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Adds one to a counter if it's below the limit; false when the limit is reached. */
async function takeLookup(db: Database, client: string, limit: number, now: Date) {
  const day = dateIn('America/Mexico_City', now);
  await db.execute(sql`DELETE FROM google_lookups WHERE day < ${day}::date - 1`);
  const rows = await db.execute(sql`
    INSERT INTO google_lookups (day, client, count) VALUES (${day}, ${client}, 1)
    ON CONFLICT (day, client) DO UPDATE SET count = google_lookups.count + 1
      WHERE google_lookups.count < ${limit}
    RETURNING count`);
  return rows.length > 0;
}

/** Google bills by Pacific-time month; a request is reserved before it's made. */
async function takeBudget(db: Database, sku: string, limit: number, now: Date) {
  const month = dateIn('America/Los_Angeles', now).slice(0, 7);
  const rows = await db.execute(sql`
    INSERT INTO google_usage (month, sku, count) VALUES (${month}, ${sku}, 1)
    ON CONFLICT (month, sku) DO UPDATE SET count = google_usage.count + 1
      WHERE google_usage.count < ${limit}
    RETURNING count`);
  return rows.length > 0;
}

async function setMatch(db: Database, id: number, placeId: string | null) {
  await db.execute(sql`
    UPDATE places SET google_place_id = ${placeId},
      google_match_status = ${placeId ? 'matched' : 'no_match'}, google_matched_at = now()
    WHERE id = ${id}`);
}

/**
 * "Ver horario": the place's hours, phone and website from Google, for this view only. Free as long
 * as the monthly limit stays under Google's allowance; never stores what Google returns.
 */
export async function lookupGoogleDetails(
  db: Database,
  id: number,
  options: GoogleLookupOptions,
): Promise<GoogleDetailsResponse | null> {
  const now = options.now ?? new Date();
  const [row] = await db.execute<{
    name: string | null;
    lat: number;
    lng: number;
    has_hours: boolean;
    google_place_id: string | null;
    google_match_status: string | null;
  }>(sql`
    SELECT name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
           hours IS NOT NULL AS has_hours, google_place_id, google_match_status
    FROM places WHERE id = ${id} AND hidden_at IS NULL`);
  if (!row) return null;
  // Without a name there's nothing safe to match; known hours don't need Google.
  if (!row.name || row.google_match_status === 'no_match') return { status: 'not_found' };
  if (row.has_hours) return { status: 'unavailable' };

  if (!(await takeLookup(db, options.client, options.dailyLookups ?? DEFAULT_DAILY_LOOKUPS, now))) {
    return { status: 'limit_reached' };
  }

  const place = { name: row.name, lat: row.lat, lng: row.lng };
  let placeId = row.google_place_id;
  if (!placeId) {
    await takeBudget(db, SEARCH_SKU, 2_000_000_000, now); // free and unlimited; counted to watch usage
    placeId = await findPlaceId(options, place);
    if (!placeId) {
      await setMatch(db, id, null);
      return { status: 'not_found' };
    }
  }

  if (!(await takeBudget(db, DETAILS_SKU, options.monthlyLimit ?? DEFAULT_MONTHLY_LIMIT, now))) {
    return { status: 'unavailable' };
  }
  const details = await getPlaceDetails(options, placeId, options.language);
  // The free search only returns an id, so the paid answer is checked before it's shown.
  if (!isSamePlace(place, details)) {
    await setMatch(db, id, null);
    return { status: 'not_found' };
  }
  if (row.google_match_status !== 'matched' || row.google_place_id !== details.id) {
    await setMatch(db, id, details.id);
  }
  return {
    status: 'ok',
    weekdayHours: details.weekdayHours,
    openNow: details.openNow,
    phone: details.phone,
    website: details.website,
    googleMapsUrl: details.googleMapsUrl,
    businessStatus: details.businessStatus,
  };
}
