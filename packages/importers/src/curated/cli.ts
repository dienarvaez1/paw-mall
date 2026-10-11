// Loads the curated pet-friendly places (data/pet-friendly-cdmx.json) with their pet policies.
//
//   pnpm places:curated [--dry-run] [--file data/pet-friendly-cdmx.json]
//
// Places are saved with source 'curated' (re-running updates them, and removes ones no longer in
// the file). Owner-verified details and owner policies always win: a curated value never replaces
// them. Phones come from Overture Maps (phone_source 'overture'). A curated policy whose content
// changed starts over: its shopper answers are cleared and "last confirmed" is the new check date.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { saveCuratedPlaces } from './save.ts';
import { readCuratedFile } from './curated.ts';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    file: {
      type: 'string',
      default: join(import.meta.dirname, '../../data/pet-friendly-cdmx.json'),
    },
  },
});

const { places, excluded } = readCuratedFile(JSON.parse(readFileSync(args.file, 'utf8')));
const count = (slug: string) => places.filter((p) => p.categories.includes(slug as never)).length;
console.log(
  `${places.length} curated places: ${count('restaurant')} restaurants, ${count('cafe')} cafés, ${count('lodging')} lodging, ${count('museum')} museums, ${count('park')} parks.`,
);
if (excluded.length > 0) console.log(`Left out (cruelty-linked names): ${excluded.join(', ')}`);

if (args['dry-run']) {
  console.log('Dry run: nothing written.');
} else {
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const result = await saveCuratedPlaces(sql, places);
    console.log(
      `Saved ${result.saved} places (${result.policies} curated policies; ${result.ownerKept} owner policies kept); removed ${result.removed} no longer in the file; hid ${result.duplicates} DENUE copies.`,
    );
  } finally {
    await sql.end();
  }
}
