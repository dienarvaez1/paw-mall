import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('accepts a healthy response with PostGIS', () => {
    const body = { status: 'ok', version: '0.1.0', database: { status: 'ok', postgis: '3.5.2' } };
    expect(healthResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts an unavailable database', () => {
    const body = { status: 'ok', version: '0.1.0', database: { status: 'unavailable' } };
    expect(healthResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects an unknown status', () => {
    const body = { status: 'down', version: '0.1.0', database: { status: 'unavailable' } };
    expect(healthResponseSchema.safeParse(body).success).toBe(false);
  });
});
