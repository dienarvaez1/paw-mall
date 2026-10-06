// The owner's review of claims and reports (command-line until an admin page exists; see
// docs/DEPLOYMENT.md, "Pending owner reviews").
import type postgres from 'postgres';

type Sql = postgres.Sql;

/** Personal data kept only while a claim is pending. */
const FORGET_CONTACT = 'contact_name = NULL, contact = NULL';

export type PendingClaim = {
  id: number;
  createdAt: Date;
  placeId: number;
  placeName: string | null;
  placeAddress: string;
  contactName: string | null;
  contact: string | null;
  publishes: string;
};

export async function listPendingClaims(sql: Sql): Promise<PendingClaim[]> {
  const rows = await sql`
    SELECT c.*, p.name AS place_name, p.address AS place_address
    FROM place_claims c JOIN places p ON p.id = c.place_id
    WHERE c.status = 'pending' ORDER BY c.created_at`;
  return rows.map((c) => ({
    id: c.id,
    createdAt: c.created_at,
    placeId: c.place_id,
    placeName: c.place_name,
    placeAddress: c.place_address,
    contactName: c.contact_name,
    contact: c.contact,
    publishes: [
      `phone ${c.phone ?? '-'}`,
      `website ${c.website ?? '-'}`,
      `hours ${c.hours ? 'yes' : '-'}`,
      `24 h ${c.open24h === null ? '-' : c.open24h ? 'yes' : 'no'}`,
      `emergencies ${c.accepts_emergencies === null ? '-' : c.accepts_emergencies ? 'yes' : 'no'}`,
    ].join(' · '),
  }));
}

/**
 * Publishes a pending claim's details as owner-verified and forgets the contact. Vet answers (24
 * hours, emergencies) go to vet_details with source 'owner', replacing any name hint.
 */
export async function approveClaim(sql: Sql, id: number): Promise<number | null> {
  return sql.begin(async (tx) => {
    const [claim] = await tx`
      SELECT * FROM place_claims WHERE id = ${id} AND status = 'pending' FOR UPDATE`;
    if (!claim) return null;
    await tx`
      UPDATE places SET
        phone = COALESCE(${claim.phone}, phone),
        phone_source = CASE WHEN ${claim.phone}::text IS NOT NULL THEN 'owner' ELSE phone_source END,
        website = COALESCE(${claim.website}, website),
        website_source = CASE WHEN ${claim.website}::text IS NOT NULL THEN 'owner' ELSE website_source END,
        hours = COALESCE(${claim.hours}::jsonb, hours),
        hours_source = CASE WHEN ${claim.hours}::jsonb IS NOT NULL THEN 'owner' ELSE hours_source END,
        owner_verified_at = now()
      WHERE id = ${claim.place_id}`;
    if (claim.open24h !== null || claim.accepts_emergencies !== null) {
      await tx`
        INSERT INTO vet_details (place_id, open24h, open24h_source, accepts_emergencies)
        VALUES (${claim.place_id}, ${claim.open24h},
                ${claim.open24h === null ? null : 'owner'}, ${claim.accepts_emergencies})
        ON CONFLICT (place_id) DO UPDATE SET
          open24h = COALESCE(EXCLUDED.open24h, vet_details.open24h),
          open24h_source = COALESCE(EXCLUDED.open24h_source, vet_details.open24h_source),
          accepts_emergencies = COALESCE(EXCLUDED.accepts_emergencies, vet_details.accepts_emergencies)`;
    }
    await tx`
      UPDATE place_claims SET status = 'approved', decided_at = now(), ${tx.unsafe(FORGET_CONTACT)}
      WHERE id = ${id}`;
    return claim.place_id as number;
  });
}

export async function rejectClaim(sql: Sql, id: number): Promise<boolean> {
  const rows = await sql`
    UPDATE place_claims SET status = 'rejected', decided_at = now(), ${sql.unsafe(FORGET_CONTACT)}
    WHERE id = ${id} AND status = 'pending' RETURNING id`;
  return rows.length > 0;
}

export type ReportedPlace = {
  id: number;
  name: string | null;
  address: string;
  city: string;
  status: string;
  reports: string;
};

/** Places with reports, hidden ones first: the review queue. */
export async function listReportedPlaces(sql: Sql): Promise<ReportedPlace[]> {
  const rows = await sql`
    SELECT p.id, p.name, p.address, p.city, p.hidden_reason,
           string_agg(r.reason || ' ×' || r.reporters, ', ' ORDER BY r.reason) AS reports
    FROM places p
    JOIN (SELECT place_id, reason, count(DISTINCT client_id)::int AS reporters, max(created_at) AS last
          FROM place_reports GROUP BY place_id, reason) r ON r.place_id = p.id
    GROUP BY p.id
    ORDER BY (p.hidden_reason LIKE 'reported_%') DESC NULLS LAST, max(r.last) DESC
    LIMIT 100`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    status: r.hidden_reason?.startsWith('reported_')
      ? 'HIDDEN, needs review'
      : r.hidden_reason?.startsWith('confirmed_')
        ? r.hidden_reason.replace('_', ' ')
        : 'listed',
    reports: r.reports,
  }));
}

/** A wrong report: shows the place again and clears its reports. */
export async function restorePlace(sql: Sql, id: number): Promise<boolean> {
  const rows = await sql`
    UPDATE places SET hidden_at = NULL, hidden_reason = NULL WHERE id = ${id} RETURNING id`;
  await sql`DELETE FROM place_reports WHERE place_id = ${id}`;
  return rows.length > 0;
}

/**
 * A true report: keeps the place hidden for good (re-imports leave hidden places hidden), as
 * closed or as linked to animal cruelty.
 */
export async function confirmReport(
  sql: Sql,
  id: number,
  reason: 'closed' | 'cruelty',
): Promise<boolean> {
  const rows = await sql`
    UPDATE places SET hidden_at = COALESCE(hidden_at, now()), hidden_reason = ${`confirmed_${reason}`}
    WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
