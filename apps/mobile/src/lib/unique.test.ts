import { describe, expect, it } from 'vitest';

import { uniqueById } from './unique';

describe('uniqueById', () => {
  it('keeps the first appearance of each place', () => {
    expect(uniqueById([{ id: 1 }, { id: 2 }, { id: 1 }, { id: 3 }])).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });
});
