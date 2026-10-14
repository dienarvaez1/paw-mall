import { KM_PER_MILE, type Locale, REGION } from '@paw-mall/shared';

/** BCP 47 tag for `Intl`, for example `es-MX`. */
export function intlLocale(language: Locale): string {
  return `${language}-${REGION}`;
}

export function formatCount(count: number, language: Locale): string {
  return new Intl.NumberFormat(intlLocale(language)).format(count);
}

export function formatDate(date: Date, language: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(language), { dateStyle: 'long' }).format(date);
}

/** An ISO date ("2026-10-05") in the long local format ("5 de octubre de 2026"). */
export function formatLongDate(isoDate: string, language: Locale): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return formatDate(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1), language);
}

const DISTANCE_SYMBOLS = { km: 'km', mi: 'mi' } as const;

/**
 * A distance given in km, shown in the user's unit. Only the number goes through Intl: on iOS,
 * Hermes formats `style: 'unit'` with Apple's measurement formatter, which converts to the region's
 * preferred system (3 mi became "4.828km" for es-MX/en-MX) and ignores the rounding options.
 */
export function formatDistance(km: number, language: Locale, unit: 'km' | 'mi' = 'km'): string {
  const value = unit === 'mi' ? km / KM_PER_MILE : km;
  const number = new Intl.NumberFormat(intlLocale(language), {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
  return `${number} ${DISTANCE_SYMBOLS[unit]}`;
}

/** "08:00" as a localized clock time (8:00 a.m. / 8:00 AM). */
export function formatClockTime(time: string, language: Locale): string {
  const [hours = '0', minutes = '0'] = time.split(':');
  const date = new Date(Date.UTC(2026, 0, 1, Number(hours), Number(minutes)));
  return new Intl.DateTimeFormat(intlLocale(language), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

/** Weekday name for a "0" (Sunday) … "6" key. */
export function formatWeekday(day: string, language: Locale): string {
  // 2026-01-04 was a Sunday.
  const date = new Date(Date.UTC(2026, 0, 4 + Number(day), 12));
  return new Intl.DateTimeFormat(intlLocale(language), { weekday: 'long', timeZone: 'UTC' }).format(
    date,
  );
}

/** An ISO date ("2026-05-20") as month and year: "mayo de 2026" / "May 2026". */
export function formatMonthYear(isoDate: string, language: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** An ISO date ("2026-10-10") in the medium local format: "10 oct 2026" / "Oct 10, 2026". */
export function formatShortDate(isoDate: string, language: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** A weight in kg ("22.7 kg"); only the number goes through Intl, as in formatDistance. */
export function formatWeightKg(kg: number, language: Locale): string {
  const number = new Intl.NumberFormat(intlLocale(language), { maximumFractionDigits: 1 }).format(
    kg,
  );
  return `${number} kg`;
}

/** An amount of money in its currency ("$350.00", "USD 100.00"), whole amounts without cents. */
export function formatMoney(amount: number, currency: string, language: Locale): string {
  return new Intl.NumberFormat(intlLocale(language), {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
