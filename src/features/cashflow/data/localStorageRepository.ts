import { advanceOverdueBillingDate, getTodayIso } from '../../../core/utils/dateMath';
import { createSeedSubscriptions } from '../domain/presets';
import {
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

/**
 * Advances overdue nextBillingDate entries forward by their BillingCycle on load
 * (unless archived or simulated-paused) so recurring schedules stay accurate over time.
 */
export function normalizeOverdueSubscriptions(
  items: readonly Subscription[],
  todayIso: string = getTodayIso(),
): Subscription[] {
  return items.map((sub) => {
    if (sub.isArchived || sub.isSimulatedPaused || sub.isFreeTrial) {
      return sub;
    }
    const advanced = advanceOverdueBillingDate(sub.nextBillingDate, sub.cycle, todayIso);
    if (advanced === sub.nextBillingDate) return sub;
    return { ...sub, nextBillingDate: advanced };
  });
}

export function loadVaultState(todayIso: string = getTodayIso()): StoredVaultState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      subscriptions: createSeedSubscriptions(todayIso),
      settings: createDefaultSettings(),
    };
  }

  const defaults = createDefaultSettings();
  let settings: VaultSettings = defaults;
  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings) as Partial<VaultSettings>;
      settings = {
        ...defaults,
        ...parsed,
        exchangeRatesPerUsd: {
          ...defaults.exchangeRatesPerUsd,
          ...(parsed.exchangeRatesPerUsd ?? {}),
        },
      };
    }
  } catch {
    settings = defaults;
  }

  const hasInitialized = window.localStorage.getItem(INITIALIZED_KEY) === '1';
  let subscriptions: Subscription[] = [];

  try {
    const rawSubs = window.localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (rawSubs) {
      const parsed = JSON.parse(rawSubs);
      if (Array.isArray(parsed)) {
        subscriptions = normalizeOverdueSubscriptions(parsed as Subscription[], todayIso);
      }
    } else if (!hasInitialized) {
      subscriptions = createSeedSubscriptions(todayIso);
      saveSubscriptions(subscriptions);
      window.localStorage.setItem(INITIALIZED_KEY, '1');
    }
  } catch {
    subscriptions = hasInitialized ? [] : createSeedSubscriptions(todayIso);
  }

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
