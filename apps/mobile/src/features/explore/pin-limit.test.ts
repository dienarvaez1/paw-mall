import { describe, expect, it } from 'vitest';

import { nextPinLimit } from './pin-limit';

describe('nextPinLimit', () => {
  it('steps 50 → 100 → 150 → 200 → 300 and back to 50', () => {
    expect([50, 100, 150, 200, 300].map(nextPinLimit)).toEqual([100, 150, 200, 300, 50]);
  });

  it('goes to the default from anything else', () => {
    expect(nextPinLimit(120)).toBe(200);
  });
});
