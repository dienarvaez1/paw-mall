import type postgres from 'postgres';

import { CHAIN_HOMEPAGES, type PageFindings, pageNamesPlace } from './page.ts';

const hostOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, '');

/**
 * Stores what a working homepage says for the place using that website: its hours (source
 * 'website'; never over owner hours) and, for a pet-friendly venue with no policy or an earlier
 * website one, a policy taking dogs (size unknown) credited to the site. Findings the page no
 * longer has are removed. The page must speak for that one place: its host belongs to no other
 * place (a chain's site, "sucursales pet friendly", speaks for none in particular), it isn't a
 * hotel group's homepage, and it names the place. Returns how many places got hours and a policy.
 */
export async function saveFindings(
  sql: postgres.Sql,
  website: string,
  pageFindings: PageFindings,
): Promise<{ hours: number; petFriendly: number }> {
  const host = hostOf(website);
  const owners = await sql<{ id: number; name: string | null }[]>`
    SELECT id, name FROM places
    WHERE website IS NOT NULL
      AND lower(regexp_replace(substring(website from '^[a-zA-Z]+://([^/:?#]+)'), '^www\\.', ''))
          = ${host}`;
  const speaksForIt =
    owners.length === 1 &&
    !CHAIN_HOMEPAGES.has(host) &&
    pageNamesPlace(pageFindings.text, owners[0]!.name);
  const findings = speaksForIt ? pageFindings : { hours: null, petFriendly: false };

  const hours = findings.hours
    ? await sql`
        UPDATE places SET hours = ${sql.json(findings.hours)}, hours_source = 'website'
        WHERE website = ${website} AND owner_verified_at IS NULL
          AND hours_source IS DISTINCT FROM 'owner'`
    : await sql`
        UPDATE places SET hours = NULL, hours_source = NULL
        WHERE website = ${website} AND hours_source = 'website'`;

  const venues = sql`
    SELECT p.id FROM places p
    WHERE p.website = ${website}
      AND EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                  WHERE pc.place_id = p.id AND c."group" = 'pet_friendly')`;
  if (!findings.petFriendly) {
    await sql`DELETE FROM pet_policies WHERE source = 'website' AND place_id IN (${venues})`;
    return { hours: findings.hours ? hours.count : 0, petFriendly: 0 };
  }
  const policies = await sql`
    INSERT INTO pet_policies (place_id, dogs, source, source_name, source_url, last_confirmed_on)
    SELECT id, true, 'website', ${host}, ${website},
           (now() AT TIME ZONE 'America/Mexico_City')::date
    FROM (${venues}) v
    ON CONFLICT (place_id) DO UPDATE SET
      source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url,
      last_confirmed_on = EXCLUDED.last_confirmed_on
    WHERE pet_policies.source = 'website'`;
  return { hours: findings.hours ? hours.count : 0, petFriendly: policies.count };
}
