import { describe, expect, it } from 'vitest';

import { EMPTY_HOURS, buildHours, normalizeTime } from './claim-hours';

describe('claim hours', () => {
  it('normalizes typed times', () => {
    expect(normalizeTime('8:00')).toBe('08:00');
    expect(normalizeTime('1930')).toBe('19:30');
    expect(normalizeTime(' 08:00 ')).toBe('08:00');
  });

  it('turns the three rows into a week, Sunday first', () => {
    const hours = buildHours({
      weekdays: { closed: false, open: '8:00', close: '19:00' },
      saturday: { closed: false, open: '9:00', close: '14:00' },
      sunday: { closed: true, open: '', close: '' },
    });
    expect(hours).toEqual({
      '0': null,
      '1': { open: '08:00', close: '19:00' },
      '2': { open: '08:00', close: '19:00' },
      '3': { open: '08:00', close: '19:00' },
      '4': { open: '08:00', close: '19:00' },
      '5': { open: '08:00', close: '19:00' },
      '6': { open: '09:00', close: '14:00' },
    });
  });

  it('keeps overnight hours as written (they run past midnight)', () => {
    expect(
      buildHours({
        weekdays: { closed: false, open: '20:00', close: '2:00' },
        saturday: { closed: true, open: '', close: '' },
        sunday: { closed: true, open: '', close: '' },
      })?.['1'],
    ).toEqual({ open: '20:00', close: '02:00' });
  });

  it('omits hours when nothing was filled in', () => {
    expect(buildHours(EMPTY_HOURS)).toBeUndefined();
  });
});
