import { convertMinorUnits } from '../../../core/utils/currencyConverter';
import { daysUntilRenewal, getTodayIso } from '../../../core/utils/dateMath';
import {
  getAnnualMinorUnits,
  getMonthlyMinorUnits,
  type Subscription,
  type SubscriptionCategory,
  type VaultSettings,
} from './subscription';

export interface DialSegment {
  readonly category: SubscriptionCategory;
  readonly amountBaseMinorUnits: number;
  readonly fraction: number;
  readonly count: number;
}

export interface ComputedSubscription {
  readonly subscription: Subscription;
  readonly baseMonthlyMinorUnits: number;
  readonly baseAnnualMinorUnits: number;
  readonly baseCycleMinorUnits: number;
  readonly daysUntilRenewal: number;
}

export interface CashflowSummary {
  readonly activeItems: readonly ComputedSubscription[];
  readonly archivedItems: readonly ComputedSubscription[];
  readonly visibleItems: readonly ComputedSubscription[];
  readonly dialSegments: readonly DialSegment[];
  readonly activeMonthlyBaseMinorUnits: number;
  readonly activeAnnualBaseMinorUnits: number;
  readonly displayedTotalBaseMinorUnits: number;
  readonly simulatedAnnualSavingsBaseMinorUnits: number;
  readonly simulatedCount: number;
  readonly activeTrialCount: number;
  readonly dueSoonCount: number;
  readonly budgetUsageRatio: number;
}

export function computeSubscriptionMetrics(
  sub: Subscription,
  settings: VaultSettings,
  todayIso: string = getTodayIso(),
): ComputedSubscription {
  const ownMonthly = getMonthlyMinorUnits(sub.amountMinorUnits, sub.cycle);
  const ownAnnual = getAnnualMinorUnits(sub.amountMinorUnits, sub.cycle);

  const baseMonthlyMinorUnits = convertMinorUnits(
    ownMonthly,
    sub.currency,
    settings.baseCurrency,
    settings.exchangeRatesPerUsd,
  );
  const baseAnnualMinorUnits = convertMinorUnits(
    ownAnnual,
    sub.currency,
    settings.baseCurrency,
    settings.exchangeRatesPerUsd,
  );
  const baseCycleMinorUnits = convertMinorUnits(
    sub.amountMinorUnits,
    sub.currency,
    settings.baseCurrency,
    settings.exchangeRatesPerUsd,
  );

  return {
    subscription: sub,
    baseMonthlyMinorUnits,
    baseAnnualMinorUnits,
    baseCycleMinorUnits,
    daysUntilRenewal: daysUntilRenewal(sub.nextBillingDate, todayIso),
  };
}

export function computeCashflowSummary(
  items: readonly Subscription[],
  settings: VaultSettings,
  options: {
    readonly selectedCategory: SubscriptionCategory | null;
    readonly showAnnual: boolean;
    readonly searchQuery: string;
    readonly todayIso?: string;
  },
): CashflowSummary {
  const todayIso = options.todayIso ?? getTodayIso();
  const computed = items.map((sub) => computeSubscriptionMetrics(sub, settings, todayIso));

  const activeItems = computed.filter((c) => !c.subscription.isArchived);
  const archivedItems = computed.filter((c) => c.subscription.isArchived);

  let activeMonthlyBaseMinorUnits = 0;
  let activeAnnualBaseMinorUnits = 0;
  let simulatedAnnualSavingsBaseMinorUnits = 0;
  let simulatedCount = 0;
  let activeTrialCount = 0;
  let dueSoonCount = 0;

  const categoryTotals = new Map<SubscriptionCategory, { amount: number; count: number }>();

  for (const item of activeItems) {
    const sub = item.subscription;
    if (sub.isSimulatedPaused) {
      simulatedCount += 1;
      simulatedAnnualSavingsBaseMinorUnits += item.baseAnnualMinorUnits;
      continue;
    }

    activeMonthlyBaseMinorUnits += item.baseMonthlyMinorUnits;
    activeAnnualBaseMinorUnits += item.baseAnnualMinorUnits;
    if (sub.isFreeTrial) activeTrialCount += 1;
    if (item.daysUntilRenewal <= 3) dueSoonCount += 1;

    const displayedForDial = options.showAnnual
      ? item.baseAnnualMinorUnits
      : item.baseMonthlyMinorUnits;
    const prev = categoryTotals.get(sub.category) ?? { amount: 0, count: 0 };
    categoryTotals.set(sub.category, {
      amount: prev.amount + displayedForDial,
      count: prev.count + 1,
    });
  }

  const displayedTotalBaseMinorUnits = options.showAnnual
    ? activeAnnualBaseMinorUnits
    : activeMonthlyBaseMinorUnits;

  const dialSegments: DialSegment[] =
    displayedTotalBaseMinorUnits <= 0
      ? []
      : Array.from(categoryTotals.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([category, info]) => ({
            category,
            amountBaseMinorUnits: info.amount,
            fraction: info.amount / displayedTotalBaseMinorUnits,
            count: info.count,
          }));

  const normalizedQuery = options.searchQuery.trim().toLowerCase();
  const visibleItems = activeItems
    .filter((item) => {
      if (options.selectedCategory && item.subscription.category !== options.selectedCategory) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        item.subscription.name.toLowerCase().includes(normalizedQuery) ||
        item.subscription.notes.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      if (a.daysUntilRenewal !== b.daysUntilRenewal) {
        return a.daysUntilRenewal - b.daysUntilRenewal;
      }
      return a.subscription.name.localeCompare(b.subscription.name);
    });

  const budgetUsageRatio =
    settings.monthlyCeilingMinorUnits <= 0
      ? 0
      : Math.min(1.5, activeMonthlyBaseMinorUnits / settings.monthlyCeilingMinorUnits);

  return {
    activeItems,
    archivedItems,
    visibleItems,
    dialSegments,
    activeMonthlyBaseMinorUnits,
    activeAnnualBaseMinorUnits,
    displayedTotalBaseMinorUnits,
    simulatedAnnualSavingsBaseMinorUnits,
    simulatedCount,
    activeTrialCount,
    dueSoonCount,
    budgetUsageRatio,
  };
}
