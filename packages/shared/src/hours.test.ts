import { describe, expect, it } from 'vitest';

import { type PlaceHours, isOpenAt, localTime, placeHoursSchema } from './hours';

const weekday = { open: '09:00', close: '20:00' };
const hours: PlaceHours = {
  '0': null,
  '1': weekday,
  '2': weekday,
  '3': weekday,
  '4': weekday,
  '5': { open: '20:00', close: '02:00' }, // Friday night shift, into Saturday
  '6': { open: '00:00', close: '24:00' }, // all day Saturday
};
// Mexico City is UTC-6 all year: 2026-10-05 is a Monday.
const at = (iso: string) => new Date(iso);

describe('isOpenAt', () => {
  it('is open during the day, closed before opening and at closing time', () => {
    expect(isOpenAt(hours, null, at('2026-10-05T15:00:00Z'))).toBe(true); // Mon 09:00
    expect(isOpenAt(hours, null, at('2026-10-05T14:59:00Z'))).toBe(false); // Mon 08:59
    expect(isOpenAt(hours, null, at('2026-10-06T02:00:00Z'))).toBe(false); // Mon 20:00
  });

  it('handles hours that run past midnight', () => {
    expect(isOpenAt(hours, null, at('2026-10-10T03:00:00Z'))).toBe(true); // Fri 21:00
    expect(isOpenAt(hours, null, at('2026-10-09T15:00:00Z'))).toBe(false); // Fri 09:00
    // Sat 01:00 is still Friday's shift; Sat is open all day anyway.
    expect(isOpenAt(hours, null, at('2026-10-10T07:00:00Z'))).toBe(true);
    // Sun 01:00: Saturday's 24 hours ended at midnight and Sunday is closed.
    expect(isOpenAt(hours, null, at('2026-10-11T07:00:00Z'))).toBe(false);
  });

  it('is unknown without hours, except for an owner-confirmed 24-hour place', () => {
    expect(isOpenAt(null, null, at('2026-10-05T15:00:00Z'))).toBeNull();
    expect(isOpenAt(null, { value: true, source: 'name' }, at('2026-10-05T15:00:00Z'))).toBeNull();
    expect(isOpenAt(null, { value: true, source: 'owner' }, at('2026-10-05T09:00:00Z'))).toBe(true);
  });
});

describe('localTime', () => {
  it('reads the weekday and minutes in Mexico City', () => {
    // Sun 01:00 UTC is still Saturday 19:00 in Mexico City.
    expect(localTime(at('2026-10-04T01:00:00Z'))).toEqual({ day: '6', minutes: 19 * 60 });
  });
});

describe('placeHoursSchema', () => {
  it('accepts 24:00 and rejects malformed times', () => {
    expect(placeHoursSchema.safeParse(hours).success).toBe(true);
    expect(
      placeHoursSchema.safeParse({ ...hours, '1': { open: '9:00', close: '20:00' } }).success,
    ).toBe(false);
    expect(
      placeHoursSchema.safeParse({ ...hours, '1': { open: '24:30', close: '20:00' } }).success,
    ).toBe(false);
  });
});
