import { describe, expect, it, vi } from 'vitest';

import {
  formatClockTime,
  formatDate,
  formatDistance,
  formatMonthYear,
  formatWeekday,
  intlLocale,
} from './format';

describe('format', () => {
  it('builds Mexican locale tags', () => {
    expect(intlLocale('es')).toBe('es-MX');
    expect(intlLocale('en')).toBe('en-MX');
  });

  it('formats dates in the active language', () => {
    const date = new Date(2026, 9, 3);
    expect(formatDate(date, 'es')).toBe('3 de octubre de 2026');
    expect(formatDate(date, 'en')).toBe('October 3, 2026');
  });
});

describe('more formatting', () => {
  it('formats distances in km or miles', () => {
    expect(formatDistance(0.4, 'es')).toBe('0.4 km');
    expect(formatDistance(12.25, 'en')).toBe('12 km');
    expect(formatDistance(16.09344, 'en', 'mi')).toBe('10 mi');
    expect(formatDistance(1.609344, 'es', 'mi')).toBe('1 mi');
  });

  it('formats weekdays and clock times by language', () => {
    expect(formatWeekday('1', 'es')).toBe('lunes');
    expect(formatWeekday('0', 'en')).toBe('Sunday');
    expect(formatClockTime('20:00', 'en')).toMatch(/^8:00\sPM$/);
  });
});

describe('radius labels in miles', () => {
  it('shows each mile choice as a whole number of miles', () => {
    for (const miles of [3, 5, 10, 15, 25, 50]) {
      expect(formatDistance(miles * 1.609344, 'en', 'mi')).toBe(`${miles} mi`);
    }
  });
});

describe('formatDistance on iOS', () => {
  it("never uses Intl's unit style, which iOS converts to the region's metric units", () => {
    const spy = vi.spyOn(Intl, 'NumberFormat');
    formatDistance(4.828032, 'en', 'mi');
    formatDistance(5, 'es', 'km');
    for (const [, options] of spy.mock.calls) {
      expect(options?.style).not.toBe('unit');
    }
    spy.mockRestore();
  });
});

describe('formatMonthYear', () => {
  it('shows the month and year in the active language', () => {
    expect(formatMonthYear('2026-05-20', 'es')).toBe('mayo de 2026');
    expect(formatMonthYear('2026-05-20', 'en')).toBe('May 2026');
  });
});
