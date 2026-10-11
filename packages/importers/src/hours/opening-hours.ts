// Weekly hours from two free sources, as PlaceHours (packages/shared): OpenStreetMap's
// opening_hours tag (also schema.org's openingHours text, which uses the same day codes) and
// schema.org's openingHoursSpecification. Only the common, unambiguous forms are read; anything
// else (split shifts, holidays, months, "sunrise", comments) returns null rather than a guess,
// since these hours drive "Abierto ahora".
import type { PlaceHours } from '@paw-mall/shared';

type Weekday = keyof PlaceHours;
type DayHours = PlaceHours[Weekday];

const DAY_CODES: Record<string, Weekday> = {
  su: '0',
  mo: '1',
  tu: '2',
  we: '3',
  th: '4',
  fr: '5',
  sa: '6',
};
/** Monday-first, as opening_hours ranges run ("Mo-Fr", "Sa-Su"). */
const ORDER: Weekday[] = ['1', '2', '3', '4', '5', '6', '0'];
const CLOCK = /^([01]?\d|2[0-4]):([0-5]\d)$/;

function closedWeek(): PlaceHours {
  return { '0': null, '1': null, '2': null, '3': null, '4': null, '5': null, '6': null };
}

function clock(value: string): string | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours === 24 && match[2] !== '00') return null;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

/** "Mo-Fr,Su" → its weekdays; null for anything else. */
function days(selector: string): Weekday[] | null {
  const out: Weekday[] = [];
  for (const part of selector.split(',')) {
    const [from, to] = part.trim().toLowerCase().split('-');
    const start = DAY_CODES[from ?? ''];
    if (!start) return null;
    if (to === undefined) {
      out.push(start);
      continue;
    }
    const end = DAY_CODES[to];
    if (!end) return null;
    let i = ORDER.indexOf(start);
    for (;;) {
      out.push(ORDER[i]!);
      if (ORDER[i] === end) break;
      i = (i + 1) % 7;
    }
  }
  return out;
}

/** "09:00-18:00" → one range; null for split shifts ("09:00-14:00,16:00-20:00") or odd times. */
function range(value: string): DayHours | undefined {
  const text = value.trim().toLowerCase();
  if (text === 'off' || text === 'closed') return null;
  if (text.includes(',')) return undefined;
  const [open, close] = text.split('-').map((part) => clock(part));
  if (!open || !close) return undefined;
  return { open, close };
}

/**
 * OpenStreetMap opening_hours (or schema.org openingHours text): "Mo-Fr 09:00-18:00; Sa
 * 10:00-14:00", "24/7", "Mo-Su 08:00-22:00". Days not named are closed. Null when the value uses
 * anything beyond days and one time range per day.
 */
export function parseOpeningHours(value: string | readonly string[]): PlaceHours | null {
  const rules = (typeof value === 'string' ? value.split(';') : value.flatMap((v) => v.split(';')))
    .map((rule) => rule.trim())
    .filter(Boolean);
  if (rules.length === 0) return null;
  if (rules.length === 1 && rules[0] === '24/7') {
    const week = closedWeek();
    for (const day of ORDER) week[day] = { open: '00:00', close: '24:00' };
    return week;
  }
  const week = closedWeek();
  for (const rule of rules) {
    const match = /^([A-Za-z,\- ]+?)\s+(\S.*)$/.exec(rule);
    // A rule without days ("10:00-20:00") means every day.
    const selected = match ? days(match[1]!.replace(/\s/g, '')) : ORDER;
    const hours = range(match ? match[2]! : rule);
    if (!selected || hours === undefined) return null;
    for (const day of selected) week[day] = hours;
  }
  return week;
}

const SCHEMA_DAYS: Record<string, Weekday> = {
  sunday: '0',
  monday: '1',
  tuesday: '2',
  wednesday: '3',
  thursday: '4',
  friday: '5',
  saturday: '6',
};

type Specification = { dayOfWeek?: unknown; opens?: unknown; closes?: unknown };

/**
 * schema.org openingHoursSpecification: [{ dayOfWeek: "Monday" | "https://schema.org/Monday" |
 * [...], opens: "09:00", closes: "18:00" }]. Null on split shifts (two ranges on one day), seasonal
 * entries (validFrom) or unreadable values.
 */
export function parseHoursSpecification(specs: unknown): PlaceHours | null {
  const list = (Array.isArray(specs) ? specs : [specs]) as (Specification & {
    validFrom?: unknown;
  })[];
  if (list.length === 0) return null;
  const week = closedWeek();
  const seen = new Set<Weekday>();
  for (const spec of list) {
    if (!spec || typeof spec !== 'object' || spec.validFrom) return null;
    const names = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek];
    const open = typeof spec.opens === 'string' ? clock(spec.opens.slice(0, 5)) : null;
    const close = typeof spec.closes === 'string' ? clock(spec.closes.slice(0, 5)) : null;
    if (!open || !close) return null;
    for (const name of names) {
      const day = SCHEMA_DAYS[String(name).split('/').pop()?.toLowerCase() ?? ''];
      if (!day || seen.has(day)) return null;
      seen.add(day);
      week[day] = { open, close };
    }
  }
  return week;
}
