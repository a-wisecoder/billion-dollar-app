import { daysUntilRenewal, getTodayIso } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import {
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';

export const NOTIFIED_REMINDERS_STORAGE_KEY = 'vaultflow_notified_reminders_v1';
export const TRIAL_REMINDER_WINDOW_DAYS = 3;

export interface ComingUpReminder {
  readonly subscription: Subscription;
  readonly daysUntil: number;
  readonly isTrialEnding: boolean;
  readonly formattedAmount: string;
  readonly title: string;
  readonly body: string;
}

export interface ReminderStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): ReminderStorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

/**
 * Returns active (non-archived, non-paused) subscriptions due within leadDays
 * plus free trials ending within 3 days.
 */
export function getComingUpReminders(
  subscriptions: readonly Subscription[],
  settings: Pick<VaultSettings, 'reminderLeadDays'>,
  todayIso: string = getTodayIso(),
): ComingUpReminder[] {
  const leadDays = settings.reminderLeadDays ?? 2;
  const reminders: ComingUpReminder[] = [];

  for (const sub of subscriptions) {
    if (sub.isArchived || sub.isSimulatedPaused) continue;
    const days = daysUntilRenewal(sub.nextBillingDate, todayIso);
    if (days < 0) continue;

    const windowDays = sub.isFreeTrial
      ? Math.max(leadDays, TRIAL_REMINDER_WINDOW_DAYS)
      : leadDays;

    if (days > windowDays) continue;

    const formattedAmount = formatMinorUnits(sub.amountMinorUnits, sub.currency, {
      showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
    });

    const timingLabel =
      days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

    const title = sub.isFreeTrial
      ? `${sub.name} trial ends ${timingLabel}`
      : `${sub.name} renews ${timingLabel}`;

    const body = sub.isFreeTrial
      ? `Cancel before renewal or pay ${formattedAmount}.`
      : `${formattedAmount} scheduled on ${sub.nextBillingDate}.`;

    reminders.push({
      subscription: sub,
      daysUntil: days,
      isTrialEnding: sub.isFreeTrial,
      formattedAmount,
      title,
      body,
    });
  }

  reminders.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    if (a.isTrialEnding !== b.isTrialEnding) return a.isTrialEnding ? -1 : 1;
    return a.subscription.name.localeCompare(b.subscription.name);
  });

  return reminders;
}

/**
 * Reads the set of subscription IDs already shown as browser notifications on `todayIso`.
 */
export function getNotifiedIdsForDate(
  todayIso: string,
  storage: ReminderStorageLike | null = getDefaultStorage(),
): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(NOTIFIED_REMINDERS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date?: unknown; ids?: unknown };
    if (parsed.date !== todayIso || !Array.isArray(parsed.ids)) {
      return new Set();
    }
    return new Set(parsed.ids.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Persists shown subscription notification IDs for `todayIso` so each subscription
 * triggers at most one system notification per day.
 */
export function markNotifiedForDate(
  subscriptionIds: readonly string[],
  todayIso: string,
  storage: ReminderStorageLike | null = getDefaultStorage(),
): void {
  if (!storage || subscriptionIds.length === 0) return;
  const existing = getNotifiedIdsForDate(todayIso, storage);
  for (const id of subscriptionIds) {
    existing.add(id);
  }
  try {
    storage.setItem(
      NOTIFIED_REMINDERS_STORAGE_KEY,
      JSON.stringify({ date: todayIso, ids: Array.from(existing) }),
    );
  } catch {
    // Ignore storage quota errors gracefully
  }
}

/**
 * Filters coming-up reminders down to those not yet notified today.
 */
export function selectUnnotifiedReminders(
  reminders: readonly ComingUpReminder[],
  todayIso: string,
  storage: ReminderStorageLike | null = getDefaultStorage(),
): ComingUpReminder[] {
  const alreadyNotified = getNotifiedIdsForDate(todayIso, storage);
  return reminders.filter((item) => !alreadyNotified.has(item.subscription.id));
}
