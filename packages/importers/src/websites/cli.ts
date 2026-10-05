// Checks places' websites and hides dead ones from the app (the data is kept).
//
//   pnpm places:check-websites [--concurrency 6]
//
// Each distinct website is visited once. Owner-verified websites are never checked or hidden.
// Run after a DENUE import and about monthly: a site that works again is shown on the next run.
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { type WebsiteCheck, checkWebsite, nextState } from './check.ts';

const { values: args } = parseArgs({
  options: {
    concurrency: { type: 'string', default: '6' },
  },
});

const sql = postgres(databaseUrl(), { max: 2, onnotice: () => {} });

try {
  const sites = await sql<{ website: string; failures: number }[]>`
    SELECT website, max(website_failures)::int AS failures
    FROM places
    WHERE website IS NOT NULL AND owner_verified_at IS NULL
    GROUP BY website
    ORDER BY website`;
  console.log(`Checking ${sites.length} websites…`);

  const totals: Record<WebsiteCheck, number> = { ok: 0, blocked: 0, unreachable: 0, dead: 0 };
  let next = 0;
  async function worker() {
    while (next < sites.length) {
      const site = sites[next++];
      if (!site) break;
      const { status, failures } = nextState(await checkWebsite(site.website), site.failures);
      totals[status]++;
      await sql`
        UPDATE places SET website_status = ${status}, website_failures = ${failures},
                          website_checked_at = now()
        WHERE website = ${site.website} AND owner_verified_at IS NULL`;
    }
  }
  await Promise.all(Array.from({ length: Number(args.concurrency) }, worker));

  console.log(
    `Done: ${totals.ok} working, ${totals.blocked} blocking checks (shown), ` +
      `${totals.unreachable} unreachable (shown until they fail again), ${totals.dead} dead (hidden).`,
  );
} finally {
  await sql.end();
}
