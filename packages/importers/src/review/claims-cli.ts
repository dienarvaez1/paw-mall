// Reviews owners' claims.
//
//   pnpm places:claims                 list pending claims
//   pnpm places:claims --approve 12    publish the details, mark the place "Verificado por el dueño"
//   pnpm places:claims --reject 12     decline the claim
//
// Approving or rejecting deletes the claim's contact details. (No SAT check yet: deferred.)
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { approveClaim, listPendingClaims, rejectClaim } from './review.ts';

const { values: args } = parseArgs({
  options: { approve: { type: 'string' }, reject: { type: 'string' } },
});
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  if (args.approve) {
    const placeId = await approveClaim(sql, Number(args.approve));
    console.log(
      placeId
        ? `Approved claim ${args.approve}: place ${placeId} updated and marked owner-verified.`
        : `No pending claim ${args.approve}.`,
    );
  } else if (args.reject) {
    const done = await rejectClaim(sql, Number(args.reject));
    console.log(done ? `Rejected claim ${args.reject}.` : `No pending claim ${args.reject}.`);
  } else {
    const claims = await listPendingClaims(sql);
    if (claims.length === 0) console.log('No pending claims.');
    for (const c of claims) {
      console.log(
        [
          `Claim ${c.id} · ${c.createdAt.toISOString().slice(0, 10)} · place ${c.placeId}: ${c.placeName ?? 'sin nombre'}`,
          `  ${c.placeAddress}`,
          `  Contact: ${c.contactName} <${c.contact}>`,
          `  Publishes: ${c.publishes}`,
        ].join('\n'),
      );
    }
  }
} finally {
  await sql.end();
}
