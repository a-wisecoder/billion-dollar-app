export type CurrencyCode = 'USD' | 'PKR' | 'EUR' | 'GBP' | 'AED';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type SubscriptionCategory =
  | 'aiAndCloud'
  | 'streaming'
  | 'productivity'
  | 'utilities'
  | 'health';

export type UsageFrequency = 'daily' | 'weekly' | 'rarely' | 'unused';

export interface Subscription {
  readonly id: string;
  readonly name: string;
  /** Exact price in minor units (e.g., $19.99 -> 1999). Never floating point. */
  readonly amountMinorUnits: number;
  /** Optional prior billed amount to automatically surface price hikes. */
  readonly previousAmountMinorUnits?: number;
  readonly currency: CurrencyCode;
  readonly cycle: BillingCycle;
  readonly category: SubscriptionCategory;
  /** Canonical local date string YYYY-MM-DD */
  readonly nextBillingDate: string;
  readonly isFreeTrial: boolean;
  readonly isSimulatedPaused: boolean;
  readonly isArchived: boolean;
  readonly usageFrequency?: UsageFrequency;
  readonly cancelUrl?: string;
  readonly notes: string;
}

export const USAGE_FREQUENCY_META: Record<
  UsageFrequency,
  { readonly label: string; readonly monthlyUses: number; readonly tone: string }
> = {
  daily: { label: 'Daily', monthlyUses: 24, tone: '#1E7E5F' },
  weekly: { label: 'Weekly', monthlyUses: 6, tone: '#2A8C94' },
  rarely: { label: 'Rarely', monthlyUses: 1.5, tone: '#B86A14' },
  unused: { label: 'Unused', monthlyUses: 0, tone: '#C64545' },
};

export const USAGE_FREQUENCY_LIST: readonly UsageFrequency[] = [
  'daily',
  'weekly',
  'rarely',
  'unused',
];

export interface CurrencyMeta {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  readonly defaultRatePerUsd: number;
  readonly defaultMonthlyCeilingMinorUnits: number;
  readonly defaultMonthlyIncomeMinorUnits: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    defaultRatePerUsd: 1,
    defaultMonthlyCeilingMinorUnits: 20000,
    defaultMonthlyIncomeMinorUnits: 450000,
  },
  PKR: {
    code: 'PKR',
    name: 'Pakistani Rupee',
    symbol: 'Rs ',
    defaultRatePerUsd: 278.5,
    defaultMonthlyCeilingMinorUnits: 5500000,
    defaultMonthlyIncomeMinorUnits: 35000000,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    defaultRatePerUsd: 0.92,
    defaultMonthlyCeilingMinorUnits: 18500,
    defaultMonthlyIncomeMinorUnits: 410000,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    defaultRatePerUsd: 0.79,
    defaultMonthlyCeilingMinorUnits: 16000,
    defaultMonthlyIncomeMinorUnits: 360000,
  },
  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'AED ',
    defaultRatePerUsd: 3.6725,
    defaultMonthlyCeilingMinorUnits: 73500,
    defaultMonthlyIncomeMinorUnits: 1650000,
  },
};

export const CURRENCY_CODES: readonly CurrencyCode[] = [
  'USD',
  'PKR',
  'EUR',
  'GBP',
  'AED',
];

export interface BillingCycleMeta {
  readonly id: BillingCycle;
  readonly label: string;
  readonly shortSuffix: string;
}

export const BILLING_CYCLES: Record<BillingCycle, BillingCycleMeta> = {
  weekly: { id: 'weekly', label: 'Weekly', shortSuffix: '/wk' },
  monthly: { id: 'monthly', label: 'Monthly', shortSuffix: '/mo' },
  quarterly: { id: 'quarterly', label: 'Quarterly', shortSuffix: '/qtr' },
  yearly: { id: 'yearly', label: 'Yearly', shortSuffix: '/yr' },
};

export const BILLING_CYCLE_LIST: readonly BillingCycle[] = [
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
];

export interface CategoryMeta {
  readonly id: SubscriptionCategory;
  readonly label: string;
  readonly color: string;
}

export const CATEGORIES: Record<SubscriptionCategory, CategoryMeta> = {
  aiAndCloud: { id: 'aiAndCloud', label: 'AI & Cloud', color: '#4E6EF2' },
  streaming: { id: 'streaming', label: 'Media', color: '#D15C77' },
  productivity: { id: 'productivity', label: 'Productivity', color: '#2A8C94' },
  utilities: { id: 'utilities', label: 'Utilities', color: '#C97E24' },
  health: { id: 'health', label: 'Health', color: '#2D8A68' },
};

export const CATEGORY_LIST: readonly SubscriptionCategory[] = [
  'aiAndCloud',
  'streaming',
  'productivity',
  'utilities',
  'health',
];

export interface VaultSettings {
  readonly baseCurrency: CurrencyCode;
  /** Exchange rates relative to 1 USD (e.g. PKR: 278.5 means 1 USD = 278.5 PKR) */
  readonly exchangeRatesPerUsd: Record<CurrencyCode, number>;
  /** Monthly runway ceiling stored in minor units of baseCurrency */
  readonly monthlyCeilingMinorUnits: number;
  /** Optional monthly take-home income in minor units of baseCurrency for income-share tracking */
  readonly monthlyIncomeMinorUnits?: number;
  readonly notificationsEnabled: boolean;
  readonly reminderLeadDays: 1 | 2 | 3;
}

export function createDefaultSettings(): VaultSettings {
  return {
    baseCurrency: 'USD',
    exchangeRatesPerUsd: {
      USD: CURRENCIES.USD.defaultRatePerUsd,
      PKR: CURRENCIES.PKR.defaultRatePerUsd,
      EUR: CURRENCIES.EUR.defaultRatePerUsd,
      GBP: CURRENCIES.GBP.defaultRatePerUsd,
      AED: CURRENCIES.AED.defaultRatePerUsd,
    },
    monthlyCeilingMinorUnits: CURRENCIES.USD.defaultMonthlyCeilingMinorUnits,
    monthlyIncomeMinorUnits: CURRENCIES.USD.defaultMonthlyIncomeMinorUnits,
    notificationsEnabled: true,
    reminderLeadDays: 2,
  };
}

/** Normalized monthly cost in minor units of the subscription's own currency. */
export function getMonthlyMinorUnits(
  amountMinorUnits: number,
  cycle: BillingCycle,
): number {
  switch (cycle) {
    case 'weekly':
      return Math.round((amountMinorUnits * 52) / 12);
    case 'monthly':
      return amountMinorUnits;
    case 'quarterly':
      return Math.round(amountMinorUnits / 3);
    case 'yearly':
      return Math.round(amountMinorUnits / 12);
  }
}

/** Normalized annual cost in minor units of the subscription's own currency. */
export function getAnnualMinorUnits(
  amountMinorUnits: number,
  cycle: BillingCycle,
): number {
  switch (cycle) {
    case 'weekly':
      return amountMinorUnits * 52;
    case 'monthly':
      return amountMinorUnits * 12;
    case 'quarterly':
      return amountMinorUnits * 4;
    case 'yearly':
      return amountMinorUnits;
  }
}
