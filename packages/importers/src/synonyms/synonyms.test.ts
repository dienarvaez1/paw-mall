import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db-url.ts';
import { plainWord, replaceSynonyms, synonymRows, synonymsFileSchema } from './synonyms.ts';

describe('synonymRows', () => {
  it('lists every other word of the group, without accents or case', () => {
    expect(synonymRows([['Taco', 'tacos', 'Taquería']])).toEqual([
      { word: 'taco', alternatives: ['tacos', 'taqueria'] },
      { word: 'tacos', alternatives: ['taco', 'taqueria'] },
      { word: 'taqueria', alternatives: ['taco', 'tacos'] },
    ]);
  });

  it('merges a word in two groups and drops a group of one word', () => {
    const rows = synonymRows([
      ['café', 'coffee'],
      ['cafe', 'cafetería'],
      ['solo', 'Solo'],
    ]);
    expect(rows.find((r) => r.word === 'cafe')?.alternatives).toEqual(['cafeteria', 'coffee']);
    expect(rows.some((r) => r.word === 'solo')).toBe(false);
  });

  it('reads the committed file', () => {
    const file = join(import.meta.dirname, '../../data/search-synonyms.json');
    const { groups } = synonymsFileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    expect(synonymRows(groups).length).toBeGreaterThan(20);
    expect(plainWord(' Jardín  Botánico ')).toBe('jardin botanico');
  });
});

describe('replaceSynonyms and search_word_query', () => {
  // Needs the local database (pnpm db:up && pnpm db:migrate), like the API tests. Everything runs
  // in a transaction that's rolled back, so the API tests (same database, run alongside) never see
  // the table emptied.
  const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  const rollback = new Error('rollback');

  afterAll(() => sql.end());

  it('replaces the table, and a word finds its synonyms by their Spanish stems', async () => {
    await sql
      .begin(async (tx) => {
        await replaceSynonyms(tx, [['old', 'older']]);
        expect(await replaceSynonyms(tx, [['Taquerías', 'tacos']])).toBe(2);
        const [row] = await tx<{ q: string; plain: string | null; stop: string | null }[]>`
          SELECT search_word_query('tacos')::text AS q,
                 search_word_query('perritos')::text AS plain,
                 search_word_query('de')::text AS stop`;
        expect(row!.q).toContain("'taqueri'");
        expect(row!.q).toContain("'tac'");
        expect(row!.plain).toBe("'perrit'");
        expect(row!.stop).toBeNull();
        expect(await tx`SELECT 1 FROM search_synonyms WHERE word = 'old'`).toHaveLength(0);
        throw rollback;
      })
      .catch((error: unknown) => {
        if (error !== rollback) throw error;
      });
  });
});
