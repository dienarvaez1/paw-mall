import { describe, expect, it } from 'vitest';

import { parseHoursSpecification, parseOpeningHours } from './opening-hours.ts';

const allDay = { open: '00:00', close: '24:00' };

describe('parseOpeningHours', () => {
  it('reads days and one range per day; days not named are closed', () => {
    expect(parseOpeningHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00')).toEqual({
      '0': null,
      '1': { open: '09:00', close: '18:00' },
      '2': { open: '09:00', close: '18:00' },
      '3': { open: '09:00', close: '18:00' },
      '4': { open: '09:00', close: '18:00' },
      '5': { open: '09:00', close: '18:00' },
      '6': { open: '10:00', close: '14:00' },
    });
  });

  it('reads 24/7, day lists, wrapping ranges, "off" and bare times', () => {
    expect(parseOpeningHours('24/7')?.['3']).toEqual(allDay);
    const week = parseOpeningHours('Mo,We,Fr 8:00-20:00; Sa-Mo 10:00-02:00; Tu off');
    expect(week).toMatchObject({
      '0': { open: '10:00', close: '02:00' },
      '1': { open: '10:00', close: '02:00' },
      '2': null,
      '3': { open: '08:00', close: '20:00' },
      '6': { open: '10:00', close: '02:00' },
    });
    expect(parseOpeningHours('10:00-20:00')?.['0']).toEqual({ open: '10:00', close: '20:00' });
    expect(parseOpeningHours(['Mo-Fr 09:00-17:00', 'Sa 09:00-13:00'])?.['6']).toEqual({
      open: '09:00',
      close: '13:00',
    });
  });

  it('returns null for what it does not read', () => {
    expect(parseOpeningHours('Mo-Fr 09:00-14:00,16:00-20:00')).toBeNull();
    expect(parseOpeningHours('Mo-Fr 09:00-18:00; PH off')).toBeNull();
    expect(parseOpeningHours('sunrise-sunset')).toBeNull();
    expect(parseOpeningHours('Jan-Mar Mo 09:00-12:00')).toBeNull();
    expect(parseOpeningHours('')).toBeNull();
  });
});

describe('parseHoursSpecification', () => {
  it('reads schema.org specifications', () => {
    const week = parseHoursSpecification([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['https://schema.org/Monday', 'Tuesday'],
        opens: '09:00:00',
        closes: '19:00',
      },
      { dayOfWeek: 'Sunday', opens: '00:00', closes: '23:59' },
    ]);
    expect(week).toMatchObject({
      '0': { open: '00:00', close: '23:59' },
      '1': { open: '09:00', close: '19:00' },
      '2': { open: '09:00', close: '19:00' },
      '3': null,
    });
  });

  it('returns null for split shifts, seasons and bad values', () => {
    const shift = (opens: string, closes: string) => ({ dayOfWeek: 'Monday', opens, closes });
    expect(parseHoursSpecification([shift('09:00', '14:00'), shift('16:00', '20:00')])).toBeNull();
    expect(
      parseHoursSpecification([{ ...shift('09:00', '14:00'), validFrom: '2026-12-01' }]),
    ).toBeNull();
    expect(
      parseHoursSpecification([{ dayOfWeek: 'Funday', opens: '09:00', closes: '10:00' }]),
    ).toBeNull();
    expect(parseHoursSpecification([])).toBeNull();
  });
});
