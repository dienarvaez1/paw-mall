import type { PlaceHours } from '@paw-mall/shared';

export type DayRange = { closed: boolean; open: string; close: string };
export type HoursForm = { weekdays: DayRange; saturday: DayRange; sunday: DayRange };

export const EMPTY_HOURS: HoursForm = {
  weekdays: { closed: false, open: '', close: '' },
  saturday: { closed: false, open: '', close: '' },
  sunday: { closed: true, open: '', close: '' },
};

/** Normalizes "8:00" or "800" to "08:00"; anything else is returned trimmed for validation. */
export function normalizeTime(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (/^\d{3,4}$/.test(digits)) {
    const padded = digits.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }
  return value.trim();
}

function toDay(range: DayRange): PlaceHours['1'] {
  return range.closed
    ? null
    : { open: normalizeTime(range.open), close: normalizeTime(range.close) };
}

/** The form's three rows as the week the API stores ("0" = Sunday); undefined if nothing filled. */
export function buildHours(form: HoursForm): PlaceHours | undefined {
  const rows = [form.weekdays, form.saturday, form.sunday];
  if (rows.every((row) => row.closed || (!row.open && !row.close))) return undefined;
  const weekday = toDay(form.weekdays);
  return {
    '0': toDay(form.sunday),
    '1': weekday,
    '2': weekday,
    '3': weekday,
    '4': weekday,
    '5': weekday,
    '6': toDay(form.saturday),
  };
}
