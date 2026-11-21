import type { BillingCycle } from '../../features/cashflow/domain/subscription';

export interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1..12
  readonly day: number; // 1..31
}

export function toIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12) return null;
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

export function getTodayIso(now: Date = new Date()): string {
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toUtcDayNumber(iso: string): number {
  const parsed = parseIsoDate(iso);
  if (!parsed) return 0;
  return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86_400_000);
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const dt = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + deltaDays));
  return toIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addMonthsIso(iso: string, deltaMonths: number, anchorDay?: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const totalMonths = parsed.year * 12 + (parsed.month - 1) + deltaMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12 + 12) % 12 + 1;
  const desiredDay = anchorDay ?? parsed.day;
  const clampedDay = Math.min(desiredDay, daysInMonth(targetYear, targetMonth));
  return toIsoDate(targetYear, targetMonth, clampedDay);
}

/** Exact calendar-day difference (due - today), avoiding hour-of-day off-by-one bugs. */
export function daysUntilRenewal(nextBillingIso: string, todayIso: string = getTodayIso()): number {
  return toUtcDayNumber(nextBillingIso) - toUtcDayNumber(todayIso);
}

export function stepBillingDate(iso: string, cycle: BillingCycle, anchorDay?: number): string {
  switch (cycle) {
    case 'weekly':
      return addDaysIso(iso, 7);
    case 'monthly':
      return addMonthsIso(iso, 1, anchorDay);
    case 'quarterly':
      return addMonthsIso(iso, 3, anchorDay);
    case 'yearly':
      return addMonthsIso(iso, 12, anchorDay);
  }
}

/**
 * Advances a past billing date forward by its BillingCycle until it lands on or
 * after todayIso. Preserves the original anchor day across short months.
 */
export function advanceOverdueBillingDate(
  nextBillingIso: string,
  cycle: BillingCycle,
  todayIso: string = getTodayIso(),
): string {
  const parsed = parseIsoDate(nextBillingIso);
  if (!parsed) return todayIso;

  let cursor = nextBillingIso;
  let guard = 0;
  while (daysUntilRenewal(cursor, todayIso) < 0 && guard < 1000) {
    cursor = stepBillingDate(cursor, cycle, parsed.day);
    guard += 1;
  }
  return cursor;
}

/**
 * Projects all billing dates for a subscription falling inside the given calendar
 * month (month is 1..12). Supports looking backward and forward across months.
 */
export function projectBillingDatesInMonth(
  anchorBillingIso: string,
  cycle: BillingCycle,
  year: number,
  month: number,
): string[] {
  const anchor = parseIsoDate(anchorBillingIso);
  if (!anchor) return [];

  const monthStartIso = toIsoDate(year, month, 1);
  const monthEndIso = toIsoDate(year, month, daysInMonth(year, month));
  const startDayNum = toUtcDayNumber(monthStartIso);
  const endDayNum = toUtcDayNumber(monthEndIso);

  if (cycle === 'weekly') {
    const anchorDayNum = toUtcDayNumber(anchorBillingIso);
    const offset = ((anchorDayNum - startDayNum) % 7 + 7) % 7;
    const results: string[] = [];
    let day = 1 + offset;
    const maxDay = daysInMonth(year, month);
    while (day <= maxDay) {
      results.push(toIsoDate(year, month, day));
      day += 7;
    }
    return results;
  }

  const targetMonthIndex = year * 12 + (month - 1);
  const anchorMonthIndex = anchor.year * 12 + (anchor.month - 1);
  const monthDiff = targetMonthIndex - anchorMonthIndex;

  if (cycle === 'monthly') {
    const day = Math.min(anchor.day, daysInMonth(year, month));
    const iso = toIsoDate(year, month, day);
    const num = toUtcDayNumber(iso);
    return num >= startDayNum && num <= endDayNum ? [iso] : [];
  }

  if (cycle === 'quarterly') {
    if (((monthDiff % 3) + 3) % 3 !== 0) return [];
    const day = Math.min(anchor.day, daysInMonth(year, month));
    return [toIsoDate(year, month, day)];
  }

  // yearly
  if (((monthDiff % 12) + 12) % 12 !== 0) return [];
  const day = Math.min(anchor.day, daysInMonth(year, month));
  return [toIsoDate(year, month, day)];
}

export function formatShortDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatMonthYear(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
