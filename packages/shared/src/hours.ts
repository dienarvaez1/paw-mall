import { z } from 'zod';

/** Opening hours are written in Mexico City time (UTC-6 all year). */
export const PLACE_TIME_ZONE = 'America/Mexico_City';

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/);

/**
 * One day's hours. A close at or before the open runs past midnight ("20:00"–"02:00");
 * "00:00"–"24:00" (or "00:00"–"00:00") is open all day. Null: closed that day.
 */
const dayHoursSchema = z.object({ open: clock, close: clock }).nullable();

/** Hours by weekday, "0" = Sunday … "6" = Saturday. */
export const placeHoursSchema = z.object({
  '0': dayHoursSchema,
  '1': dayHoursSchema,
  '2': dayHoursSchema,
  '3': dayHoursSchema,
  '4': dayHoursSchema,
  '5': dayHoursSchema,
  '6': dayHoursSchema,
});
export type PlaceHours = z.infer<typeof placeHoursSchema>;
export type Weekday = keyof PlaceHours;

/** Monday-first order for showing a week. */
export const WEEK_ORDER: Weekday[] = ['1', '2', '3', '4', '5', '6', '0'];

/** Weekday and minutes since midnight in Mexico City. */
export function localTime(now: Date): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PLACE_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = String(Math.max(weekdays.indexOf(get('weekday')), 0)) as Weekday;
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Whether a place is open at `now`: true or false when its hours are confirmed (an owner's
 * 24-hour answer or its weekly hours), null when they're unknown. The SQL twin is
 * place_open_now() (API migration 0006); keep them in step.
 */
export function isOpenAt(
  hours: PlaceHours | null,
  open24h: { value: boolean; source: 'name' | 'owner' } | null,
  now: Date,
): boolean | null {
  if (open24h?.source === 'owner' && open24h.value) return true;
  if (!hours) return null;
  const { day, minutes } = localTime(now);
  const today = hours[day];
  if (today) {
    const [open, close] = [toMinutes(today.open), toMinutes(today.close)];
    if (close > open ? minutes >= open && minutes < close : minutes >= open) return true;
  }
  // Yesterday's hours may run past midnight into today.
  const yesterday = hours[String((Number(day) + 6) % 7) as Weekday];
  if (yesterday) {
    const [open, close] = [toMinutes(yesterday.open), toMinutes(yesterday.close)];
    if (close <= open && minutes < close) return true;
  }
  return false;
}
