import { describe, expect, it } from 'vitest';

import { parseCsv, parseCsvRecords } from './csv.ts';

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
}

describe('parseCsv', () => {
  it('handles quoted, empty and unquoted fields', async () => {
    expect(await collect(parseCsv(['"a","b,c",,3']))).toEqual([['a', 'b,c', '', '3']]);
  });

  it('handles escaped quotes and line breaks inside quotes', async () => {
    expect(await collect(parseCsv(['"say ""hi""","line one', 'line two",x']))).toEqual([
      ['say "hi"', 'line one\nline two', 'x'],
    ]);
  });
});

describe('parseCsvRecords', () => {
  it('keys rows by the header and skips blank lines', async () => {
    expect(await collect(parseCsvRecords(['"id","name"', '"1","Ana"', '']))).toEqual([
      { id: '1', name: 'Ana' },
    ]);
  });
});
