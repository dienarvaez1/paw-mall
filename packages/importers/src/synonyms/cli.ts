// Loads the search synonyms (data/search-synonyms.json) into search_synonyms, replacing the old
// ones. Safe to re-run; takes effect on the next search.
//
//   pnpm search:synonyms
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';

import { databaseUrl } from '../db-url.ts';
import { saveSynonyms, synonymsFileSchema } from './synonyms.ts';

const file = join(import.meta.dirname, '../../data/search-synonyms.json');
const { groups } = synonymsFileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
try {
  const words = await saveSynonyms(sql, groups);
  console.log(`Search synonyms: ${groups.length} groups, ${words} words.`);
} finally {
  await sql.end();
}
