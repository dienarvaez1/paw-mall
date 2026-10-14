// A data-integrity report over the visible places (read-only): coordinates outside Mexico,
// probable duplicates, invalid hours, Urgencias places without a phone or with an unconfirmed
// "24 horas", stale sources, websites and pet policies, places without a category, and the
// owner's review queue.
//
//   pnpm places:integrity                 counts with 5 samples per check
//   pnpm places:integrity --samples 20    more samples
//   pnpm places:integrity --json          the whole report as JSON
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { integrityReport } from './integrity.ts';

const { values: args } = parseArgs({
  options: {
    samples: { type: 'string', default: '5' },
    json: { type: 'boolean', default: false },
  },
});
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  const started = Date.now();
  const report = await integrityReport(sql, Number(args.samples));
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const check of report) {
      console.log(`${String(check.count).padStart(8)}  ${check.id} — ${check.description}`);
      for (const s of check.samples) {
        console.log(
          `${''.padStart(10)}${String(s.id).padStart(7)}  ${s.name ?? 'sin nombre'}, ${s.city} — ${s.detail}`,
        );
      }
    }
    console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  }
} finally {
  await sql.end();
}
