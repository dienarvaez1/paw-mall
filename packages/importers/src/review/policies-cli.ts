// Reviews pet policies that shoppers disputed.
//
//   pnpm places:policies               list disputed policies (under review first)
//   pnpm places:policies --keep 12     the policy holds: back in the filters, answers cleared
//   pnpm places:policies --remove 12   the policy is wrong: delete it (the place stays listed)
//
// 12 is the place id. Answers carry only the app's random id; nothing about the phone is kept.
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { keepPolicy, listDisputedPolicies, removePolicy } from './review.ts';

const { values: args } = parseArgs({
  options: { keep: { type: 'string' }, remove: { type: 'string' } },
});
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  if (args.keep) {
    const done = await keepPolicy(sql, Number(args.keep));
    console.log(
      done ? `Kept the policy of place ${args.keep}.` : `No policy for place ${args.keep}.`,
    );
  } else if (args.remove) {
    const done = await removePolicy(sql, Number(args.remove));
    console.log(
      done ? `Removed the policy of place ${args.remove}.` : `No policy for place ${args.remove}.`,
    );
  } else {
    const policies = await listDisputedPolicies(sql);
    if (policies.length === 0) console.log('No disputed pet policies.');
    for (const p of policies) {
      console.log(
        [
          `Place ${p.placeId}: ${p.name ?? 'sin nombre'} · ${
            p.underReviewSince
              ? `UNDER REVIEW since ${p.underReviewSince.toISOString().slice(0, 10)}`
              : 'listed'
          }`,
          `  ${p.address}`,
          `  Source: ${p.source} · ${p.answers}`,
          `  Policy: ${p.policy}`,
        ].join('\n'),
      );
    }
  }
} finally {
  await sql.end();
}
