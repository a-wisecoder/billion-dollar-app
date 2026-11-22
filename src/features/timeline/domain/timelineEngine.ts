import { convertMinorUnits } from '../../../core/utils/currencyConverter';
import {
  daysInMonth,
  projectBillingDatesInMonth,
  toIsoDate,
} from '../../../core/utils/dateMath';
import {
  getEffectiveExchangeRates,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';

export interface ProjectedCharge {
  readonly dateIso: string;
  readonly subscription: Subscription;
  readonly baseAmountMinorUnits: number;
}

export interface TimelineDayCell {
  readonly dateIso: string;
  readonly dayOfMonth: number;
  readonly charges: readonly ProjectedCharge[];
  readonly totalBaseMinorUnits: number;
  /** 0..1 relative daily intensity compared to peak day in month */
  readonly intensity: number;
}

export interface HeavyWeekCluster {
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly chargeCount: number;
  readonly totalBaseMinorUnits: number;
  readonly shareOfMonth: number;
}

export interface MonthTimelineSummary {
  readonly year: number;
  readonly month: number; // 1..12
  readonly firstWeekdayOffset: number; // 0 = Sunday .. 6 = Saturday
  readonly days: readonly TimelineDayCell[];
  readonly totalMonthBaseMinorUnits: number;
  readonly totalChargesCount: number;
  readonly heavyWeekCluster: HeavyWeekCluster | null;
}

export function computeMonthTimeline(
  subscriptions: readonly Subscription[],
  settings: VaultSettings,
  year: number,
  month: number,
): MonthTimelineSummary {
  const numDays = daysInMonth(year, month);
  const firstWeekdayOffset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const chargesByDay = new Map<number, ProjectedCharge[]>();
  for (let d = 1; d <= numDays; d++) {
    chargesByDay.set(d, []);
  }

  const rates = getEffectiveExchangeRates(settings);
  const markup = settings.cardMarkupPercent ?? 0;

  let totalMonthBaseMinorUnits = 0;
  let totalChargesCount = 0;

  for (const sub of subscriptions) {
    if (sub.isArchived || sub.isSimulatedPaused) continue;
    const dates = projectBillingDatesInMonth(
      sub.nextBillingDate,
      sub.cycle,
      year,
      month,
      sub.billingDay,
      sub.startDate,
    );
    const baseAmountMinorUnits = convertMinorUnits(
      sub.amountMinorUnits,
      sub.currency,
      settings.baseCurrency,
      rates,
      markup,
    );

    for (const dateIso of dates) {
      const dayNum = Number.parseInt(dateIso.slice(8, 10), 10);
      const bucket = chargesByDay.get(dayNum);
      if (!bucket) continue;
      bucket.push({
        dateIso,
        subscription: sub,
        baseAmountMinorUnits,
      });
      totalMonthBaseMinorUnits += baseAmountMinorUnits;
      totalChargesCount += 1;
    }
  }

  let maxDailyTotal = 0;
  for (let d = 1; d <= numDays; d++) {
    const sum = (chargesByDay.get(d) ?? []).reduce(
      (acc, item) => acc + item.baseAmountMinorUnits,
      0,
    );
    if (sum > maxDailyTotal) maxDailyTotal = sum;
  }

  const days: TimelineDayCell[] = [];
  for (let d = 1; d <= numDays; d++) {
    const charges = (chargesByDay.get(d) ?? []).sort(
      (a, b) => b.baseAmountMinorUnits - a.baseAmountMinorUnits,
    );
    const totalBaseMinorUnits = charges.reduce(
      (acc, item) => acc + item.baseAmountMinorUnits,
      0,
    );
    days.push({
      dateIso: toIsoDate(year, month, d),
      dayOfMonth: d,
      charges,
      totalBaseMinorUnits,
      intensity: maxDailyTotal > 0 ? totalBaseMinorUnits / maxDailyTotal : 0,
    });
  }

  // Heavy-Week Cluster Detector: > 40% of monthly spend within a single 7-day window (and >= 2 charges)
  let heavyWeekCluster: HeavyWeekCluster | null = null;
  if (totalMonthBaseMinorUnits > 0 && numDays >= 7) {
    let bestTotal = 0;
    let bestStartIdx = 0;
    let bestCount = 0;

    for (let start = 0; start <= numDays - 7; start++) {
      let windowTotal = 0;
      let windowCount = 0;
      for (let offset = 0; offset < 7; offset++) {
        windowTotal += days[start + offset].totalBaseMinorUnits;
        windowCount += days[start + offset].charges.length;
      }
      if (windowTotal > bestTotal) {
        bestTotal = windowTotal;
        bestStartIdx = start;
        bestCount = windowCount;
      }
    }

    const share = bestTotal / totalMonthBaseMinorUnits;
    if (share > 0.4 && bestCount >= 2) {
      heavyWeekCluster = {
        startDateIso: days[bestStartIdx].dateIso,
        endDateIso: days[bestStartIdx + 6].dateIso,
        chargeCount: bestCount,
        totalBaseMinorUnits: bestTotal,
        shareOfMonth: share,
      };
    }
  }

  return {
    year,
    month,
    firstWeekdayOffset,
    days,
    totalMonthBaseMinorUnits,
    totalChargesCount,
    heavyWeekCluster,
  };
}
