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
  readonly storageAvailable: boolean;
}

export interface StorageSaveResult {
  readonly ok: boolean;
  readonly reason?: 'blocked' | 'quota';
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
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
  const storage = getSafeLocalStorage();
  if (!storage) {
    return {
      subscriptions: [],
      settings: createFreshSettingsForLocale(),
      storageAvailable: false,
    };
  }

  const defaults = createFreshSettingsForLocale();
  let storageAvailable = true;
  let parsedSettings: Partial<VaultSettings> | null = null;
  try {
    const rawSettings = storage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      parsedSettings = JSON.parse(rawSettings) as Partial<VaultSettings>;
    }
  } catch {
    parsedSettings = null;
  }

  let subscriptions: Subscription[] = [];
  try {
    const rawSubs = storage.getItem(SUBSCRIPTIONS_KEY);
    if (rawSubs) {
      const parsed = JSON.parse(rawSubs);
      if (Array.isArray(parsed)) {
        subscriptions = normalizeOverdueSubscriptions(parsed as Subscription[], todayIso);
      }
    }
  } catch {
    subscriptions = [];
  }

  let hasInitialized = false;
  try {
    hasInitialized = storage.getItem(INITIALIZED_KEY) === '1';
  } catch {
    storageAvailable = false;
  }

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

  return { subscriptions, settings, storageAvailable };
}

export function saveSubscriptions(items: readonly Subscription[]): StorageSaveResult {
  const storage = getSafeLocalStorage();
  if (!storage) return { ok: false, reason: 'blocked' };
  try {
    storage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(items));
    storage.setItem(INITIALIZED_KEY, '1');
    return { ok: true };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const isQuota =
      name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
    return { ok: false, reason: isQuota ? 'quota' : 'blocked' };
  }
}

export function saveSettings(settings: VaultSettings): StorageSaveResult {
  const storage = getSafeLocalStorage();
  if (!storage) return { ok: false, reason: 'blocked' };
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return { ok: true };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const isQuota =
      name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
    return { ok: false, reason: isQuota ? 'quota' : 'blocked' };
  }
}
