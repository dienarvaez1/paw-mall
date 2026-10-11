// Applies chain-wide pet policies (data/pet-friendly-chains.json) to matching DENUE branches.
// Run after `pnpm places:import` and `pnpm places:curated`. Safe to re-run.
//
//   pnpm places:chains [--file data/pet-friendly-chains.json]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { applyChains, chainsFileSchema } from './chains.ts';

const { values: args } = parseArgs({
  options: {
    file: {
      type: 'string',
      default: join(import.meta.dirname, '../../data/pet-friendly-chains.json'),
    },
  },
});
const { chains } = chainsFileSchema.parse(JSON.parse(readFileSync(args.file, 'utf8')));
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
try {
  const { branches, removed } = await applyChains(sql, chains);
  for (const [name, count] of Object.entries(branches)) console.log(`${name}: ${count} branches`);
  console.log(`Removed ${removed} chain policies from places that no longer match.`);
} finally {
  await sql.end();
}
