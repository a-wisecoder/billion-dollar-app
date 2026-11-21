import { convertMinorUnits } from '../../../core/utils/currencyConverter';
import {
  addDaysIso,
  daysUntilRenewal,
  formatMonthYear,
  formatShortDate,
  getTodayIso,
  parseIsoDate,
  projectBillingDatesInMonth,
} from '../../../core/utils/dateMath';
import { formatMinorUnits, parseDecimalToMinorUnits } from '../../../core/utils/moneyFormatter';
import {
  BILLING_CYCLES,
  CATEGORIES,
  USAGE_FREQUENCY_META,
  getAnnualMinorUnits,
  getMonthlyMinorUnits,
  type BillingCycle,
  type CurrencyCode,
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

export interface ParsedStatementCandidate {
  readonly tempId: string;
  readonly rawLine: string;
  readonly name: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly cycle: BillingCycle;
  readonly category: SubscriptionCategory;
  readonly nextBillingDate: string;
  readonly matchedExistingId: string | null;
  readonly detectedPriceHikeMinorUnits: number;
}

export const SAMPLE_BANK_STATEMENT = `2026-11-18 | SPOTIFY USA PREMIUM | $11.99
2026-11-19 | CHATGPT PLUS OPENAI | $20.00
2026-11-20 | ICLOUD+ 2TB STORAGE | $9.99
2026-11-21 | YOUTUBE PREMIUM FAMILY | $22.99
2026-11-22 | NOTION PLUS WORKSPACE | $10.00
2026-11-24 | EQUINOX FITNESS CLUB | $85.00`;

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
  const monthlyBase = convertMinorUnits(
    monthlyOwn,
    sub.currency,
    settings.baseCurrency,
    settings.exchangeRatesPerUsd,
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
      settings.exchangeRatesPerUsd,
    );
    const annualBase = convertMinorUnits(
      annualOwn,
      sub.currency,
      settings.baseCurrency,
      settings.exchangeRatesPerUsd,
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
        settings.exchangeRatesPerUsd,
      );
      const prevAnnualBase = convertMinorUnits(
        prevAnnualOwn,
        sub.currency,
        settings.baseCurrency,
        settings.exchangeRatesPerUsd,
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
        settings.exchangeRatesPerUsd,
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
          convertMinorUnits(m, sub.currency, settings.baseCurrency, settings.exchangeRatesPerUsd)
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

  return {
    priceHikes,
    annualPriceHikeCreepMinorUnits,
    lowValueSubscriptions,
    annualLowValueSavingsMinorUnits,
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
      const dates = projectBillingDatesInMonth(sub.nextBillingDate, sub.cycle, year, month);
      for (const dateIso of dates) {
        const baseAmt = convertMinorUnits(
          sub.amountMinorUnits,
          sub.currency,
          settings.baseCurrency,
          settings.exchangeRatesPerUsd,
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

function inferCategoryFromMerchant(name: string): SubscriptionCategory {
  const lower = name.toLowerCase();
  if (
    /spotify|netflix|hulu|disney|youtube|hbo|cinema|apple tv|music|audible|prime video/.test(
      lower,
    )
  ) {
    return 'streaming';
  }
  if (/chatgpt|openai|claude|anthropic|aws|icloud|cloud|vercel|github|cursor|gpu|dropbox/.test(lower)) {
    return 'aiAndCloud';
  }
  if (/gym|equinox|fitness|peloton|strava|whoop|health|club|yoga|planet fitness/.test(lower)) {
    return 'health';
  }
  if (/fiber|internet|att|verizon|t-mobile|electric|water|utility|broadband|comcast|xfinity/.test(lower)) {
    return 'utilities';
  }
  return 'productivity';
}

function detectCurrency(line: string): CurrencyCode {
  if (/€|\bEUR\b/i.test(line)) return 'EUR';
  if (/£|\bGBP\b/i.test(line)) return 'GBP';
  if (/\bPKR\b|\bRs\.?\s?\d/i.test(line)) return 'PKR';
  if (/\bAED\b/i.test(line)) return 'AED';
  return 'USD';
}

const BRAND_CASING: Record<string, string> = {
  chatgpt: 'ChatGPT',
  openai: 'OpenAI',
  icloud: 'iCloud',
  'icloud+': 'iCloud+',
  youtube: 'YouTube',
  github: 'GitHub',
  aws: 'AWS',
  usa: 'USA',
  '2tb': '2TB',
  '1tb': '1TB',
  '4k': '4K',
  ai: 'AI',
  pro: 'Pro',
};

function cleanMerchantName(raw: string): string {
  return raw
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/(?:USD|EUR|GBP|PKR|AED|Rs\.?)/gi, ' ')
    .replace(/[$€£]\s*[\d,]+(?:\.\d{1,2})?/g, ' ')
    .replace(/\b[\d,]+\.\d{2}\b/g, ' ')
    .replace(/[|,\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (BRAND_CASING[lower]) return BRAND_CASING[lower];
      return word.length <= 3 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Deterministic Smart Bank Statement / Card SMS / CSV parser.
 * Extracts recurring merchant charges locally with zero cloud uploads.
 */
export function parseStatementText(
  rawText: string,
  existingSubscriptions: readonly Subscription[],
  todayIso: string = getTodayIso(),
): ParsedStatementCandidate[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4);

  const results: ParsedStatementCandidate[] = [];

  lines.forEach((line, index) => {
    const amountMatch =
      line.match(/(?:[$€£]|USD|EUR|GBP|PKR|AED|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i) ??
      line.match(/\b([\d,]+\.\d{2})\b/);

    if (!amountMatch) return;
    const amountMinorUnits = parseDecimalToMinorUnits(amountMatch[1]);
    if (amountMinorUnits === null || amountMinorUnits <= 0) return;

    const currency = detectCurrency(line);
    const cleanedName = cleanMerchantName(line);
    if (!cleanedName || cleanedName.length < 2) return;

    const lowerClean = cleanedName.toLowerCase();
    const matched = existingSubscriptions.find((sub) => {
      const subLower = sub.name.toLowerCase();
      return subLower.includes(lowerClean) || lowerClean.includes(subLower);
    });

    const detectedHike =
      matched && matched.currency === currency && amountMinorUnits > matched.amountMinorUnits
        ? amountMinorUnits - matched.amountMinorUnits
        : 0;

    const isAnnualHint = /\b(annual|yearly|\/yr)\b/i.test(line);
    const cycle: BillingCycle = isAnnualHint ? 'yearly' : 'monthly';

    results.push({
      tempId: `import_${index}_${cleanedName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      rawLine: line,
      name: cleanedName,
      amountMinorUnits,
      currency,
      cycle,
      category: inferCategoryFromMerchant(cleanedName),
      nextBillingDate: addDaysIso(todayIso, 14 + (index % 15)),
      matchedExistingId: matched?.id ?? null,
      detectedPriceHikeMinorUnits: detectedHike,
    });
  });

  return results;
}

/** Generates a tailored, copy-ready Cancellation or Retention-Discount Negotiation message. */
export function generateActionScript(
  sub: Subscription,
  mode: 'cancel' | 'negotiate',
): { readonly subject: string; readonly body: string } {
  const priceStr = formatMinorUnits(sub.amountMinorUnits, sub.currency, {
    showDecimals: sub.currency !== 'PKR',
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
