import { advanceOverdueBillingDate, getTodayIso, parseIsoDate } from '../../../core/utils/dateMath';
import { detectCurrencyFromLocale } from '../../onboarding/domain/localeCurrency';
import {
  CURRENCIES,
  createDefaultSettings,
  type Subscription,
  type VaultSettings,
} from '../domain/subscription';

const SUBSCRIPTIONS_KEY = 'vaultflow_subscriptions_v1';
const SETTINGS_KEY = 'vaultflow_settings_v1';
const INITIALIZED_KEY = 'vaultflow_initialized_v1';

export interface StoredVaultState {
  readonly subscriptions: Subscription[];
  readonly settings: VaultSettings;
}

function resolveBillingDay(sub: Subscription): number {
  if (
    typeof sub.billingDay === 'number' &&
    Number.isInteger(sub.billingDay) &&
    sub.billingDay >= 1 &&
    sub.billingDay <= 31
  ) {
    return sub.billingDay;
  }
  return parseIsoDate(sub.nextBillingDate)?.day ?? 1;
}

/**
 * Backfills billingDay on legacy records and advances overdue nextBillingDate
 * entries forward by their BillingCycle on load (unless archived, simulated-paused,
 * or free trial) using billingDay as the month-end anchor.
 */
export function normalizeOverdueSubscriptions(
  items: readonly Subscription[],
  todayIso: string = getTodayIso(),
): Subscription[] {
  return items.map((sub) => {
    const billingDay = resolveBillingDay(sub);
    if (sub.isArchived || sub.isSimulatedPaused || sub.isFreeTrial) {
      return sub.billingDay === billingDay ? sub : { ...sub, billingDay };
    }
    const advanced = advanceOverdueBillingDate(
      sub.nextBillingDate,
      sub.cycle,
      todayIso,
      billingDay,
    );
    if (advanced === sub.nextBillingDate && sub.billingDay === billingDay) return sub;
    return { ...sub, billingDay, nextBillingDate: advanced };
  });
}

function createFreshSettingsForLocale(): VaultSettings {
  const defaults = createDefaultSettings();
  const baseCurrency = detectCurrencyFromLocale();
  const meta = CURRENCIES[baseCurrency];
  return {
    ...defaults,
    baseCurrency,
    monthlyCeilingMinorUnits: meta.defaultMonthlyCeilingMinorUnits,
    monthlyIncomeMinorUnits: meta.defaultMonthlyIncomeMinorUnits,
    isDemo: false,
    onboardingDone: false,
  };
}

export function loadVaultState(todayIso: string = getTodayIso()): StoredVaultState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      subscriptions: [],
      settings: createFreshSettingsForLocale(),
    };
  }

  const defaults = createFreshSettingsForLocale();
  let parsedSettings: Partial<VaultSettings> | null = null;
  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      parsedSettings = JSON.parse(rawSettings) as Partial<VaultSettings>;
    }
  } catch {
    parsedSettings = null;
  }

  let subscriptions: Subscription[] = [];
  try {
    const rawSubs = window.localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (rawSubs) {
      const parsed = JSON.parse(rawSubs);
      if (Array.isArray(parsed)) {
        subscriptions = normalizeOverdueSubscriptions(parsed as Subscription[], todayIso);
      }
    }
  } catch {
    subscriptions = [];
  }

  const hasInitialized = window.localStorage.getItem(INITIALIZED_KEY) === '1';

  const settings: VaultSettings = parsedSettings
    ? {
        ...defaults,
        ...parsedSettings,
        isDemo: typeof parsedSettings.isDemo === 'boolean' ? parsedSettings.isDemo : false,
        onboardingDone:
          typeof parsedSettings.onboardingDone === 'boolean'
            ? parsedSettings.onboardingDone
            : subscriptions.length > 0 || hasInitialized,
        cardMarkupPercent:
          typeof parsedSettings.cardMarkupPercent === 'number' &&
          Number.isFinite(parsedSettings.cardMarkupPercent) &&
          parsedSettings.cardMarkupPercent >= 0 &&
          parsedSettings.cardMarkupPercent <= 10
            ? parsedSettings.cardMarkupPercent
            : 0,
        customExchangeRates: {
          ...(parsedSettings.customExchangeRates ?? {}),
        },
        exchangeRatesPerUsd: {
          ...defaults.exchangeRatesPerUsd,
          ...(parsedSettings.exchangeRatesPerUsd ?? {}),
        },
      }
    : {
        ...defaults,
        onboardingDone: subscriptions.length > 0,
      };

  return { subscriptions, settings };
}

export function saveSubscriptions(items: readonly Subscription[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(items));
    window.localStorage.setItem(INITIALIZED_KEY, '1');
  } catch {
    // Storage quota or restricted browsing context — keep in-memory state working.
  }
}

export function saveSettings(settings: VaultSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors gracefully.
  }
}
