import { describe, expect, it } from 'vitest';

import { placeClaimSchema, placeReportSchema } from './trust';

const contact = { contactName: 'Ana López', contact: 'ana@example.com', consent: true as const };

describe('placeReportSchema', () => {
  it('accepts a reason and a random id, and nothing else', () => {
    const clientId = 'a1b2c3d4e5f6a7b8c9d0';
    expect(placeReportSchema.parse({ reason: 'cruelty', clientId })).toEqual({
      reason: 'cruelty',
      clientId,
    });
    // No location or personal data can ride along.
    expect(placeReportSchema.safeParse({ reason: 'closed', clientId, lat: 19.4 }).success).toBe(
      false,
    );
    expect(placeReportSchema.safeParse({ reason: 'spam', clientId }).success).toBe(false);
  });
});

describe('placeClaimSchema', () => {
  it('needs something to publish and the consent', () => {
    expect(placeClaimSchema.safeParse(contact).success).toBe(false);
    expect(placeClaimSchema.safeParse({ ...contact, open24h: true }).success).toBe(true);
    expect(
      placeClaimSchema.safeParse({ ...contact, consent: false, phone: '55 1234 5678' }).success,
    ).toBe(false);
  });

  it('accepts overnight hours and rejects SAT fields', () => {
    const night = { open: '20:00', close: '02:00' };
    const hours = {
      '0': null,
      '1': night,
      '2': night,
      '3': night,
      '4': night,
      '5': night,
      '6': null,
    };
    expect(placeClaimSchema.safeParse({ ...contact, hours }).success).toBe(true);
    expect(
      placeClaimSchema.safeParse({ ...contact, phone: '55 1234 5678', rfc: 'XAXX010101000' })
        .success,
    ).toBe(false);
  });
});
