import { convertMinorUnits } from '../../../core/utils/currencyConverter';
import {
  daysUntilRenewal,
  formatMonthYear,
  formatShortDate,
  getTodayIso,
  parseIsoDate,
  projectBillingDatesInMonth,
} from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import {
  BILLING_CYCLES,
  CATEGORIES,
  USAGE_FREQUENCY_META,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  getAnnualMinorUnits,
  getEffectiveExchangeRates,
  getMonthlyMinorUnits,
  type Subscription,
  type SubscriptionCategory,
  type VaultSettings,
} from '../../cashflow/domain/subscription';

export interface PriceHikeItem {
  readonly subscription: Subscription;
  readonly deltaMonthlyBaseMinorUnits: number;
  readonly deltaAnnualBaseMinorUnits: number;
  readonly percentIncrease: number;
}

export interface CategoryOverlapGroup {
  readonly category: SubscriptionCategory;
  readonly label: string;
  readonly count: number;
  readonly monthlyTotalBaseMinorUnits: number;
  readonly items: readonly Subscription[];
}

export interface LeakAuditReport {
  readonly priceHikes: readonly PriceHikeItem[];
  readonly annualPriceHikeCreepMinorUnits: number;
  readonly lowValueSubscriptions: readonly Subscription[];
  readonly annualLowValueSavingsMinorUnits: number;
  readonly uniqueFlaggedCount: number;
  readonly overlapGroups: readonly CategoryOverlapGroup[];
  readonly totalReclaimableAnnualMinorUnits: number;
  /** Future value if reclaimable monthly cash is invested at 7% APR compounded monthly for 5 years */
  readonly fiveYearInvestedValueMinorUnits: number;
  /** Exact cash due in the next 14 days (safe checking buffer) */
  readonly next14DaysDueMinorUnits: number;
  readonly next14DaysCount: number;
}

export interface MonthlyForecastBar {
  readonly year: number;
  readonly month: number;
  readonly shortLabel: string;
  readonly fullLabel: string;
  readonly totalBaseMinorUnits: number;
  readonly chargeCount: number;
  readonly isSpike: boolean;
  readonly charges: readonly {
    readonly subscription: Subscription;
    readonly dateIso: string;
    readonly baseAmountMinorUnits: number;
  }[];
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Computes 5-year future value (in minor units) of investing a monthly minor-unit
 * savings amount at 7% annual return compounded monthly.
 */
export function computeFiveYearCompoundValue(
  monthlySavingsMinorUnits: number,
  annualRate = 0.07,
  months = 60,
): number {
  if (monthlySavingsMinorUnits <= 0) return 0;
  const r = annualRate / 12;
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return Math.round(monthlySavingsMinorUnits * factor);
}

/** Calculates cost per use for a subscription in base currency minor units, or null if unused. */
export function computeCostPerUseMinorUnits(
  sub: Subscription,
  settings: VaultSettings,
): number | null {
  const freq = sub.usageFrequency ?? 'weekly';
  const uses = USAGE_FREQUENCY_META[freq].monthlyUses;
  if (uses <= 0) return null;
  const monthlyOwn = getMonthlyMinorUnits(sub.amountMinorUnits, sub.cycle);
  const rates = getEffectiveExchangeRates(settings);
  const markup = settings.cardMarkupPercent ?? 0;
  const monthlyBase = convertMinorUnits(
    monthlyOwn,
    sub.currency,
    settings.baseCurrency,
    rates,
    markup,
  );
  return Math.round(monthlyBase / uses);
}

/** Runs the full real-world Money Leak Audit (hikes, zombie/unused bills, overlaps, 14-day buffer). */
export function computeLeakAudit(
  subscriptions: readonly Subscription[],
  settings: VaultSettings,
  todayIso: string = getTodayIso(),
): LeakAuditReport {
  const active = subscriptions.filter((s) => !s.isArchived && !s.isSimulatedPaused);
  const rates = getEffectiveExchangeRates(settings);
  const markup = settings.cardMarkupPercent ?? 0;

  const priceHikes: PriceHikeItem[] = [];
  let annualPriceHikeCreepMinorUnits = 0;

  const lowValueSubscriptions: Subscription[] = [];
  let annualLowValueSavingsMinorUnits = 0;

  const categoryBuckets = new Map<SubscriptionCategory, Subscription[]>();

  let next14DaysDueMinorUnits = 0;
  let next14DaysCount = 0;

  for (const sub of active) {
    const monthlyOwn = getMonthlyMinorUnits(sub.amountMinorUnits, sub.cycle);
    const annualOwn = getAnnualMinorUnits(sub.amountMinorUnits, sub.cycle);
    const monthlyBase = convertMinorUnits(
      monthlyOwn,
      sub.currency,
      settings.baseCurrency,
      rates,
      markup,
    );
    const annualBase = convertMinorUnits(
      annualOwn,
      sub.currency,
      settings.baseCurrency,
      rates,
      markup,
    );

    // 1. Price hike detection
    if (
      typeof sub.previousAmountMinorUnits === 'number' &&
      sub.previousAmountMinorUnits > 0 &&
      sub.amountMinorUnits > sub.previousAmountMinorUnits
    ) {
      const prevMonthlyOwn = getMonthlyMinorUnits(sub.previousAmountMinorUnits, sub.cycle);
      const prevAnnualOwn = getAnnualMinorUnits(sub.previousAmountMinorUnits, sub.cycle);
      const prevMonthlyBase = convertMinorUnits(
        prevMonthlyOwn,
        sub.currency,
        settings.baseCurrency,
        rates,
        markup,
      );
      const prevAnnualBase = convertMinorUnits(
        prevAnnualOwn,
        sub.currency,
        settings.baseCurrency,
        rates,
        markup,
      );
      const deltaMonthly = Math.max(0, monthlyBase - prevMonthlyBase);
      const deltaAnnual = Math.max(0, annualBase - prevAnnualBase);
      const pct = Math.round(
        ((sub.amountMinorUnits - sub.previousAmountMinorUnits) / sub.previousAmountMinorUnits) *
          1000,
      ) / 10;

      priceHikes.push({
        subscription: sub,
        deltaMonthlyBaseMinorUnits: deltaMonthly,
        deltaAnnualBaseMinorUnits: deltaAnnual,
        percentIncrease: pct,
      });
      annualPriceHikeCreepMinorUnits += deltaAnnual;
    }

    // 2. Zombie / rarely used bills
    if (sub.usageFrequency === 'unused' || sub.usageFrequency === 'rarely') {
      lowValueSubscriptions.push(sub);
      annualLowValueSavingsMinorUnits += annualBase;
    }

    // 3. Category grouping for overlap checks
    const bucket = categoryBuckets.get(sub.category) ?? [];
    bucket.push(sub);
    categoryBuckets.set(sub.category, bucket);

    // 4. Next 14-day checking buffer
    const days = daysUntilRenewal(sub.nextBillingDate, todayIso);
    if (days >= 0 && days <= 14) {
      const dueAmountBase = convertMinorUnits(
        sub.amountMinorUnits,
        sub.currency,
        settings.baseCurrency,
        rates,
        markup,
      );
      next14DaysDueMinorUnits += dueAmountBase;
      next14DaysCount += 1;
    }
  }

  const overlapGroups: CategoryOverlapGroup[] = [];
  for (const [category, items] of categoryBuckets.entries()) {
    if (items.length >= 2) {
      const monthlyTotal = items.reduce((acc, sub) => {
        const m = getMonthlyMinorUnits(sub.amountMinorUnits, sub.cycle);
        return (
          acc +
          convertMinorUnits(m, sub.currency, settings.baseCurrency, rates, markup)
        );
      }, 0);
      overlapGroups.push({
        category,
        label: CATEGORIES[category].label,
        count: items.length,
        monthlyTotalBaseMinorUnits: monthlyTotal,
        items,
      });
    }
  }
  overlapGroups.sort((a, b) => b.monthlyTotalBaseMinorUnits - a.monthlyTotalBaseMinorUnits);

  // Total reclaimable annual = unused/rarely used full annual + price-hike creep on daily/weekly bills
  const hikeCreepOnKept = priceHikes
    .filter(
      (h) =>
        h.subscription.usageFrequency !== 'unused' &&
        h.subscription.usageFrequency !== 'rarely',
    )
    .reduce((acc, h) => acc + h.deltaAnnualBaseMinorUnits, 0);

  const totalReclaimableAnnualMinorUnits = annualLowValueSavingsMinorUnits + hikeCreepOnKept;
  const fiveYearInvestedValueMinorUnits = computeFiveYearCompoundValue(
    Math.round(totalReclaimableAnnualMinorUnits / 12),
  );

  const uniqueFlaggedIds = new Set<string>([
    ...priceHikes.map((h) => h.subscription.id),
    ...lowValueSubscriptions.map((s) => s.id),
  ]);

  return {
    priceHikes,
    annualPriceHikeCreepMinorUnits,
    lowValueSubscriptions,
    annualLowValueSavingsMinorUnits,
    uniqueFlaggedCount: uniqueFlaggedIds.size,
    overlapGroups,
    totalReclaimableAnnualMinorUnits,
    fiveYearInvestedValueMinorUnits,
    next14DaysDueMinorUnits,
    next14DaysCount,
  };
}

/** Projects 12 rolling months of recurring cash outflow and flags annual/quarterly renewal spikes. */
export function compute12MonthForecast(
  subscriptions: readonly Subscription[],
  settings: VaultSettings,
  todayIso: string = getTodayIso(),
): MonthlyForecastBar[] {
  const parsed = parseIsoDate(todayIso) ?? { year: 2026, month: 11, day: 20 };
  const active = subscriptions.filter((s) => !s.isArchived && !s.isSimulatedPaused);
  const rates = getEffectiveExchangeRates(settings);
  const markup = settings.cardMarkupPercent ?? 0;

  const rawMonths: Omit<MonthlyForecastBar, 'isSpike'>[] = [];

  for (let offset = 0; offset < 12; offset++) {
    const totalM = parsed.year * 12 + (parsed.month - 1) + offset;
    const year = Math.floor(totalM / 12);
    const month = (totalM % 12) + 1;

    const charges: {
      readonly subscription: Subscription;
      readonly dateIso: string;
      readonly baseAmountMinorUnits: number;
    }[] = [];
    let total = 0;

    for (const sub of active) {
      const dates = projectBillingDatesInMonth(
        sub.nextBillingDate,
        sub.cycle,
        year,
        month,
        sub.billingDay,
        sub.startDate,
      );
      for (const dateIso of dates) {
        const baseAmt = convertMinorUnits(
          sub.amountMinorUnits,
          sub.currency,
          settings.baseCurrency,
          rates,
          markup,
        );
        total += baseAmt;
        charges.push({
          subscription: sub,
          dateIso,
          baseAmountMinorUnits: baseAmt,
        });
      }
    }

    charges.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    rawMonths.push({
      year,
      month,
      shortLabel: SHORT_MONTHS[month - 1],
      fullLabel: formatMonthYear(year, month),
      totalBaseMinorUnits: total,
      chargeCount: charges.length,
      charges,
    });
  }

  const avg =
    rawMonths.reduce((acc, m) => acc + m.totalBaseMinorUnits, 0) /
    Math.max(1, rawMonths.length);

  return rawMonths.map((m) => ({
    ...m,
    isSpike: avg > 0 && m.totalBaseMinorUnits > avg * 1.25,
  }));
}

/** Generates a tailored, copy-ready Cancellation or Retention-Discount Negotiation message. */
export function generateActionScript(
  sub: Subscription,
  mode: 'cancel' | 'negotiate',
): { readonly subject: string; readonly body: string } {
  const priceStr = formatMinorUnits(sub.amountMinorUnits, sub.currency, {
    showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
  });
  const cycleStr = BILLING_CYCLES[sub.cycle].label.toLowerCase();
  const renewStr = formatShortDate(sub.nextBillingDate);

  if (mode === 'cancel') {
    return {
      subject: `Cancellation Request — ${sub.name}`,
      body: [
        `Hello ${sub.name} Support Team,`,
        ``,
        `Please cancel my ${cycleStr} subscription (${priceStr}${BILLING_CYCLES[sub.cycle].shortSuffix}) effective prior to the upcoming renewal on ${renewStr}.`,
        ``,
        `Please confirm in writing that auto-renewal has been disabled and no further charges will be billed to my payment method.`,
        ``,
        `Thank you,`,
        `[Your Name / Account Email]`,
      ].join('\n'),
    };
  }

  return {
    subject: `Billing Review & Loyalty Discount Request — ${sub.name}`,
    body: [
      `Hello ${sub.name} Billing Team,`,
      ``,
      `I have been a paying subscriber on the ${priceStr} ${cycleStr} plan and am currently reviewing my recurring expenses ahead of my ${renewStr} renewal.`,
      ``,
      `Before I cancel or downgrade, are there any loyalty promotions, retention discounts, or lower-cost tiers available to help keep my account active?`,
      ``,
      `Appreciate your help,`,
      `[Your Name / Account Email]`,
    ].join('\n'),
  };
}
