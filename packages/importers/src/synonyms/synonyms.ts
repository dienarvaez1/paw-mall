// Search synonyms (Phase 20): groups of words that mean the same in a business's name, from
// data/search-synonyms.json, stored as one row per word with the others as its alternatives
// (search_synonyms, read by search_word_query() in migration 0014).
import type postgres from 'postgres';
import { z } from 'zod';

export const synonymsFileSchema = z.object({
  groups: z.array(z.array(z.string().trim().min(1)).min(2)),
});

/** Lower case, without accents ("Taquería" → "taqueria"), as place_search_text() stores names. */
export function plainWord(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Each word's alternatives: every other word of its groups. A word in two groups gets both; a
 * word never lists itself.
 */
export function synonymRows(groups: string[][]): { word: string; alternatives: string[] }[] {
  const byWord = new Map<string, Set<string>>();
  for (const group of groups) {
    const words = [...new Set(group.map(plainWord))];
    for (const word of words) {
      const alternatives = byWord.get(word) ?? new Set<string>();
      for (const other of words) if (other !== word) alternatives.add(other);
      byWord.set(word, alternatives);
    }
  }
  return [...byWord]
    .map(([word, alternatives]) => ({ word, alternatives: [...alternatives].sort() }))
    .filter((row) => row.alternatives.length > 0)
    .sort((a, b) => a.word.localeCompare(b.word));
}

/** Replaces every synonym with the groups' words, within the caller's transaction. */
export async function replaceSynonyms(tx: postgres.TransactionSql, groups: string[][]) {
  const rows = synonymRows(groups);
  await tx`DELETE FROM search_synonyms`;
  for (const row of rows) {
    await tx`INSERT INTO search_synonyms (word, alternatives)
             VALUES (${row.word}, ${tx.array(row.alternatives)})`;
  }
  return rows.length;
}

/** Replaces every synonym with the file's, in one transaction. Returns how many words. */
export function saveSynonyms(sql: postgres.Sql, groups: string[][]): Promise<number> {
  return sql.begin((tx) => replaceSynonyms(tx, groups)) as Promise<number>;
}
