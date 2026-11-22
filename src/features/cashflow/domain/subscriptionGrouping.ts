import {
  advanceOverdueBillingDate,
  daysUntilRenewal,
  formatMonthYear,
  getTodayIso,
  parseIsoDate,
  stepBillingDate,
} from '../../../core/utils/dateMath';
import type { ComputedSubscription } from './cashflowEngine';
import type { Subscription } from './subscription';

export type DueWindowGroupId = 'next7Days' | 'laterThisMonth' | 'later';

export interface SubscriptionDueGroup {
  readonly id: DueWindowGroupId;
  readonly label: string;
  readonly items: readonly ComputedSubscription[];
}

export interface PaidSinceStartSummary {
  readonly totalOwnMinorUnits: number;
  readonly chargeCount: number;
  readonly startMonthYear: string;
}

/**
 * Groups visible subscriptions into "Next 7 days", "Later this month", and "Later".
 * Only non-empty groups are returned, preserving the existing sort order inside each group.
 */
export function groupSubscriptionsByDueWindow(
  items: readonly ComputedSubscription[],
  todayIso: string = getTodayIso(),
): SubscriptionDueGroup[] {
  const today = parseIsoDate(todayIso);
  const next7Days: ComputedSubscription[] = [];
  const laterThisMonth: ComputedSubscription[] = [];
  const later: ComputedSubscription[] = [];

  for (const item of items) {
    if (item.daysUntilRenewal <= 7) {
      next7Days.push(item);
      continue;
    }

    const due = parseIsoDate(item.subscription.nextBillingDate);
    if (today && due && due.year === today.year && due.month === today.month) {
      laterThisMonth.push(item);
    } else {
      later.push(item);
    }
  }

  const groups: SubscriptionDueGroup[] = [];
  if (next7Days.length > 0) {
    groups.push({ id: 'next7Days', label: 'Next 7 days', items: next7Days });
  }
  if (laterThisMonth.length > 0) {
    groups.push({ id: 'laterThisMonth', label: 'Later this month', items: laterThisMonth });
  }
  if (later.length > 0) {
    groups.push({ id: 'later', label: 'Later', items: later });
  }
  return groups;
}

/**
 * Returns the next N upcoming charge dates (YYYY-MM-DD) for a subscription,
 * preserving its anchor billingDay across short months and never before startDate.
 */
export function getNextChargeDates(
  sub: Subscription,
  count: number = 3,
  todayIso: string = getTodayIso(),
): string[] {
  if (count <= 0) return [];
  const parsed = parseIsoDate(sub.nextBillingDate);
  const anchorDay = sub.billingDay ?? parsed?.day;
  const floorIso =
    sub.startDate && parseIsoDate(sub.startDate) && daysUntilRenewal(sub.startDate, todayIso) > 0
      ? sub.startDate
      : todayIso;
  const first = advanceOverdueBillingDate(sub.nextBillingDate, sub.cycle, floorIso, anchorDay);
  const dates: string[] = [first];
  let cursor = first;
  for (let i = 1; i < count; i++) {
    cursor = stepBillingDate(cursor, sub.cycle, anchorDay);
    dates.push(cursor);
  }
  return dates;
}

/**
 * Estimates total paid in the subscription's own currency minor units from startDate
 * through todayIso (inclusive) by stepping billing occurrences from startDate.
 */
export function computePaidSinceStart(
  sub: Subscription,
  todayIso: string = getTodayIso(),
): PaidSinceStartSummary | null {
  if (!sub.startDate) return null;
  const parsedStart = parseIsoDate(sub.startDate);
  if (!parsedStart) return null;

  const anchorDay = sub.billingDay ?? parsedStart.day;
  let cursor = sub.startDate;
  let chargeCount = 0;
  let guard = 0;

  while (daysUntilRenewal(cursor, todayIso) <= 0 && guard < 2000) {
    chargeCount += 1;
    cursor = stepBillingDate(cursor, sub.cycle, anchorDay);
    guard += 1;
  }

  return {
    totalOwnMinorUnits: chargeCount * sub.amountMinorUnits,
    chargeCount,
    startMonthYear: formatMonthYear(parsedStart.year, parsedStart.month),
  };
}
