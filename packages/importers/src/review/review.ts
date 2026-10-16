// The owner's review of claims and reports (command-line until an admin page exists; see
// docs/DEPLOYMENT.md, "Pending owner reviews").
import type { PetPolicyInput } from '@pet-helper/shared';
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
      `pet policy ${c.pet_policy ? describePolicy(c.pet_policy as PetPolicyInput) : '-'}`,
    ].join(' · '),
  }));
}

/** The date in Mexico City, "2026-10-10". */
export function mexicoCityDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
}

/** A one-line summary of a pet policy for the review commands. */
export function describePolicy(policy: PetPolicyInput): string {
  const yesNo = (value: boolean | null) => (value === null ? '?' : value ? 'yes' : 'no');
  return [
    `dogs ${yesNo(policy.dogs)}`,
    `cats ${yesNo(policy.cats)}`,
    `other ${yesNo(policy.otherPets)}`,
    `size ${policy.maxDogSize ?? '?'}${policy.maxWeightKg ? ` (${policy.maxWeightKg} kg)` : ''}`,
    `areas ${policy.areas.join('/') || '?'}`,
  ].join(', ');
}

/**
 * Publishes a pending claim's details as owner-verified and forgets the contact. Vet answers (24
 * hours, emergencies) go to vet_details with source 'owner', replacing any name hint. A pet
 * policy replaces any curated one (owner policies win) and starts with no shopper answers.
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
    const policy = claim.pet_policy as PetPolicyInput | null;
    if (policy) {
      const row = {
        place_id: claim.place_id,
        dogs: policy.dogs,
        cats: policy.cats,
        other_pets: policy.otherPets,
        max_dog_size: policy.maxDogSize,
        max_weight_kg: policy.maxWeightKg,
        max_pets: policy.maxPets,
        fee: policy.fee ? tx.json(policy.fee) : null,
        areas: policy.areas,
        rules: policy.rules,
        source: 'owner',
        source_name: null,
        source_url: null,
        last_confirmed_on: mexicoCityDate(new Date()),
      };
      await tx`
        INSERT INTO pet_policies ${tx(row)} ON CONFLICT (place_id) DO UPDATE SET
          dogs = EXCLUDED.dogs, cats = EXCLUDED.cats, other_pets = EXCLUDED.other_pets,
          max_dog_size = EXCLUDED.max_dog_size, max_weight_kg = EXCLUDED.max_weight_kg,
          max_pets = EXCLUDED.max_pets, fee = EXCLUDED.fee, areas = EXCLUDED.areas,
          rules = EXCLUDED.rules, source = 'owner', source_name = NULL, source_url = NULL,
          last_confirmed_on = EXCLUDED.last_confirmed_on, review_since = NULL`;
      await tx`DELETE FROM policy_answers WHERE place_id = ${claim.place_id}`;
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

export type PolicyUnderReview = {
  placeId: number;
  name: string | null;
  address: string;
  source: string;
  policy: string;
  answers: string;
  underReviewSince: Date | null;
};

/** Pet policies with recent disputes, those under review first: the review queue. */
export async function listDisputedPolicies(sql: Sql): Promise<PolicyUnderReview[]> {
  const rows = await sql`
    SELECT pp.*, p.name, p.address,
           count(*) FILTER (WHERE a.answer = 'confirm')::int AS confirms,
           count(*) FILTER (WHERE a.answer = 'dispute')::int AS disputes
    FROM pet_policies pp
    JOIN places p ON p.id = pp.place_id
    JOIN policy_answers a ON a.place_id = pp.place_id
    GROUP BY pp.place_id, p.id
    HAVING count(*) FILTER (WHERE a.answer = 'dispute') > 0
    ORDER BY pp.review_since IS NULL, pp.review_since
    LIMIT 100`;
  return rows.map((r) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.address,
    source: r.source_name ? `${r.source} (${r.source_name})` : r.source,
    policy: describePolicy({
      dogs: r.dogs,
      cats: r.cats,
      otherPets: r.other_pets,
      maxDogSize: r.max_dog_size,
      maxWeightKg: r.max_weight_kg,
      maxPets: r.max_pets,
      fee: r.fee,
      areas: r.areas,
      rules: r.rules,
    }),
    answers: `confirmed ×${r.confirms}, disputed ×${r.disputes}`,
    underReviewSince: r.review_since,
  }));
}

/** The policy still holds: back in the filters, its answers cleared. */
export async function keepPolicy(sql: Sql, placeId: number): Promise<boolean> {
  const rows = await sql`
    UPDATE pet_policies SET review_since = NULL WHERE place_id = ${placeId} RETURNING place_id`;
  await sql`DELETE FROM policy_answers WHERE place_id = ${placeId}`;
  return rows.length > 0;
}

/**
 * The policy is wrong: removes it (the place stays listed). A curated policy comes back on the
 * next `pnpm places:curated` unless its entry is fixed or removed from the data file.
 */
export async function removePolicy(sql: Sql, placeId: number): Promise<boolean> {
  const rows = await sql`DELETE FROM pet_policies WHERE place_id = ${placeId} RETURNING place_id`;
  await sql`DELETE FROM policy_answers WHERE place_id = ${placeId}`;
  return rows.length > 0;
}
