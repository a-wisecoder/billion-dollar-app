export type CurrencyCode =
  | 'USD'
  | 'PKR'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'INR'
  | 'SAR'
  | 'QAR'
  | 'CAD'
  | 'AUD'
  | 'SGD'
  | 'MYR'
  | 'BDT'
  | 'TRY'
  | 'NGN'
  | 'ZAR';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type SubscriptionCategory =
  | 'aiAndCloud'
  | 'streaming'
  | 'music'
  | 'productivity'
  | 'gaming'
  | 'news'
  | 'education'
  | 'health'
  | 'phoneInternet'
  | 'utilities'
  | 'shopping'
  | 'food'
  | 'finance'
  | 'other';

export type UsageFrequency = 'daily' | 'weekly' | 'rarely' | 'unused';

export interface Subscription {
  readonly id: string;
  readonly name: string;
  /** Optional catalog identifier for matching logos, cancel links, and statement imports. */
  readonly catalogId?: string;
  /** Exact price in minor units (e.g., $19.99 -> 1999). Never floating point. */
  readonly amountMinorUnits: number;
  /** Optional prior billed amount to automatically surface price hikes. */
  readonly previousAmountMinorUnits?: number;
  readonly currency: CurrencyCode;
  readonly cycle: BillingCycle;
  readonly category: SubscriptionCategory;
  /** Canonical local date string YYYY-MM-DD */
  readonly nextBillingDate: string;
  /** Original anchor day of the month (1-31) to prevent month-end drift after short months. */
  readonly billingDay?: number;
  /** Optional canonical local date string YYYY-MM-DD when the subscription began. */
  readonly startDate?: string;
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
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    defaultRatePerUsd: 84.0,
    defaultMonthlyCeilingMinorUnits: 1680000,
    defaultMonthlyIncomeMinorUnits: 15000000,
  },
  SAR: {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: 'SAR ',
    defaultRatePerUsd: 3.75,
    defaultMonthlyCeilingMinorUnits: 75000,
    defaultMonthlyIncomeMinorUnits: 1500000,
  },
  QAR: {
    code: 'QAR',
    name: 'Qatari Riyal',
    symbol: 'QAR ',
    defaultRatePerUsd: 3.64,
    defaultMonthlyCeilingMinorUnits: 73000,
    defaultMonthlyIncomeMinorUnits: 1500000,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    defaultRatePerUsd: 1.39,
    defaultMonthlyCeilingMinorUnits: 28000,
    defaultMonthlyIncomeMinorUnits: 550000,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    defaultRatePerUsd: 1.53,
    defaultMonthlyCeilingMinorUnits: 30000,
    defaultMonthlyIncomeMinorUnits: 600000,
  },
  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    defaultRatePerUsd: 1.34,
    defaultMonthlyCeilingMinorUnits: 27000,
    defaultMonthlyIncomeMinorUnits: 550000,
  },
  MYR: {
    code: 'MYR',
    name: 'Malaysian Ringgit',
    symbol: 'RM ',
    defaultRatePerUsd: 4.45,
    defaultMonthlyCeilingMinorUnits: 89000,
    defaultMonthlyIncomeMinorUnits: 900000,
  },
  BDT: {
    code: 'BDT',
    name: 'Bangladeshi Taka',
    symbol: '৳',
    defaultRatePerUsd: 119.5,
    defaultMonthlyCeilingMinorUnits: 2400000,
    defaultMonthlyIncomeMinorUnits: 12000000,
  },
  TRY: {
    code: 'TRY',
    name: 'Turkish Lira',
    symbol: '₺',
    defaultRatePerUsd: 34.5,
    defaultMonthlyCeilingMinorUnits: 690000,
    defaultMonthlyIncomeMinorUnits: 6000000,
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    defaultRatePerUsd: 1650.0,
    defaultMonthlyCeilingMinorUnits: 33000000,
    defaultMonthlyIncomeMinorUnits: 100000000,
  },
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R ',
    defaultRatePerUsd: 18.1,
    defaultMonthlyCeilingMinorUnits: 360000,
    defaultMonthlyIncomeMinorUnits: 3500000,
  },
};

export const CURRENCY_CODES: readonly CurrencyCode[] = [
  'USD',
  'PKR',
  'EUR',
  'GBP',
  'AED',
  'INR',
  'SAR',
  'QAR',
  'CAD',
  'AUD',
  'SGD',
  'MYR',
  'BDT',
  'TRY',
  'NGN',
  'ZAR',
];

export const ZERO_DECIMAL_DISPLAY_CURRENCIES: ReadonlySet<CurrencyCode> = new Set([
  'PKR',
  'INR',
  'BDT',
  'NGN',
]);

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

/** All category colours are distinct and achieve at least 4:1 contrast on white (#FFFFFF). */
export const CATEGORIES: Record<SubscriptionCategory, CategoryMeta> = {
  aiAndCloud: { id: 'aiAndCloud', label: 'AI & Cloud', color: '#3B5BDB' },
  streaming: { id: 'streaming', label: 'Media', color: '#C2255C' },
  music: { id: 'music', label: 'Music', color: '#7048E8' },
  productivity: { id: 'productivity', label: 'Productivity', color: '#0B7285' },
  gaming: { id: 'gaming', label: 'Gaming', color: '#5F3DC4' },
  news: { id: 'news', label: 'News', color: '#495057' },
  education: { id: 'education', label: 'Learning', color: '#1971C2' },
  health: { id: 'health', label: 'Health', color: '#1E7E5F' },
  phoneInternet: { id: 'phoneInternet', label: 'Phone & Internet', color: '#B86A14' },
  utilities: { id: 'utilities', label: 'Utilities', color: '#8F5A12' },
  shopping: { id: 'shopping', label: 'Shopping', color: '#B54708' },
  food: { id: 'food', label: 'Food Delivery', color: '#C44536' },
  finance: { id: 'finance', label: 'Finance', color: '#2B6CB0' },
  other: { id: 'other', label: 'Other', color: '#5B6662' },
};

export const CATEGORY_LIST: readonly SubscriptionCategory[] = [
  'streaming',
  'music',
  'aiAndCloud',
  'productivity',
  'gaming',
  'phoneInternet',
  'health',
  'education',
  'news',
  'shopping',
  'food',
  'finance',
  'utilities',
  'other',
];

export interface VaultSettings {
  readonly baseCurrency: CurrencyCode;
  /** Exchange rates relative to 1 USD (e.g. PKR: 278.5 means 1 USD = 278.5 PKR) */
  readonly exchangeRatesPerUsd: Record<CurrencyCode, number>;
  /** Optional per-currency manual rate overrides ("Use my own rate", works offline) */
  readonly customExchangeRates?: Partial<Record<CurrencyCode, number>>;
  /** Foreign-currency card markup percentage (0..10, default 0) applied when sub currency != baseCurrency */
  readonly cardMarkupPercent?: number;
  /** Monthly budget stored in minor units of baseCurrency */
  readonly monthlyCeilingMinorUnits: number;
  /** Optional monthly take-home income in minor units of baseCurrency for income-share tracking */
  readonly monthlyIncomeMinorUnits?: number;
  readonly notificationsEnabled: boolean;
  readonly reminderLeadDays: 1 | 2 | 3;
  readonly isDemo?: boolean;
  readonly onboardingDone?: boolean;
  /** Timestamp of the last .ics calendar export (ISO string) */
  readonly calendarExportedAt?: string;
  /** Set true when subscriptions change after a previous calendar export */
  readonly calendarExportDirty?: boolean;
}

export function createDefaultExchangeRates(): Record<CurrencyCode, number> {
  const rates = {} as Record<CurrencyCode, number>;
  for (const code of CURRENCY_CODES) {
    rates[code] = CURRENCIES[code].defaultRatePerUsd;
  }
  return rates;
}

export function getEffectiveExchangeRates(
  settings: Pick<VaultSettings, 'exchangeRatesPerUsd' | 'customExchangeRates'>,
): Record<CurrencyCode, number> {
  const effective = { ...createDefaultExchangeRates(), ...settings.exchangeRatesPerUsd };
  if (settings.customExchangeRates) {
    for (const code of CURRENCY_CODES) {
      if (code === 'USD') continue;
      const custom = settings.customExchangeRates[code];
      if (typeof custom === 'number' && Number.isFinite(custom) && custom > 0) {
        effective[code] = custom;
      }
    }
  }
  effective.USD = 1;
  return effective;
}

export function createDefaultSettings(): VaultSettings {
  return {
    baseCurrency: 'USD',
    exchangeRatesPerUsd: createDefaultExchangeRates(),
    customExchangeRates: {},
    cardMarkupPercent: 0,
    monthlyCeilingMinorUnits: CURRENCIES.USD.defaultMonthlyCeilingMinorUnits,
    monthlyIncomeMinorUnits: CURRENCIES.USD.defaultMonthlyIncomeMinorUnits,
    notificationsEnabled: true,
    reminderLeadDays: 2,
    isDemo: false,
    onboardingDone: false,
  };
}

/**
 * Normalizes a subscription's minor units to an approximate monthly minor-unit integer.
 * Pure integer arithmetic rounded to the nearest minor unit.
 */
export function getMonthlyMinorUnits(amountMinorUnits: number, cycle: BillingCycle): number {
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

/** Normalizes a subscription's minor units to an annual minor-unit integer. */
export function getAnnualMinorUnits(amountMinorUnits: number, cycle: BillingCycle): number {
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
