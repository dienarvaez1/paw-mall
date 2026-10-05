// Reviews user reports (closed, animal cruelty).
//
//   pnpm places:reports                         list reported places, hidden ones first
//   pnpm places:reports --restore 123           wrong report: show the place again, clear reports
//   pnpm places:reports --confirm 123 --reason closed|cruelty
//                                               true report: keep it hidden for good
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { confirmReport, listReportedPlaces, restorePlace } from './review.ts';

const { values: args } = parseArgs({
  options: {
    restore: { type: 'string' },
    confirm: { type: 'string' },
    reason: { type: 'string' },
  },
});
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  if (args.restore) {
    const done = await restorePlace(sql, Number(args.restore));
    console.log(done ? `Restored place ${args.restore}.` : `No place ${args.restore}.`);
  } else if (args.confirm) {
    if (args.reason !== 'closed' && args.reason !== 'cruelty') {
      throw new Error('Add --reason closed or --reason cruelty');
    }
    const done = await confirmReport(sql, Number(args.confirm), args.reason);
    console.log(
      done
        ? `Place ${args.confirm} hidden for good (${args.reason}).`
        : `No place ${args.confirm}.`,
    );
  } else {
    const rows = await listReportedPlaces(sql);
    if (rows.length === 0) console.log('No reported places.');
    for (const r of rows) {
      console.log(
        `${String(r.id).padStart(7)}  ${r.status.padEnd(20)} ${r.reports.padEnd(22)} ` +
          `${r.name ?? 'sin nombre'} — ${r.address}, ${r.city}`,
      );
    }
  }
} finally {
  await sql.end();
}
