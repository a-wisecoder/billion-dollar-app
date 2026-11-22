import {
  BILLING_CYCLE_LIST,
  CATEGORY_LIST,
  CURRENCY_CODES,
  USAGE_FREQUENCY_LIST,
  createDefaultSettings,
  type BillingCycle,
  type CurrencyCode,
  type Subscription,
  type SubscriptionCategory,
  type UsageFrequency,
  type VaultSettings,
} from '../../features/cashflow/domain/subscription';
import { parseIsoDate } from './dateMath';

export interface VaultBackupPayload {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly settings: VaultSettings;
  readonly subscriptions: readonly Subscription[];
}

export type BackupParseResult =
  | { readonly ok: true; readonly data: VaultBackupPayload }
  | { readonly ok: false; readonly error: string };

export interface SubscriptionsExportPayload {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly count: number;
  readonly subscriptions: readonly Subscription[];
}

export function exportSubscriptionsJson(
  subscriptions: readonly Subscription[],
): string {
  const payload: SubscriptionsExportPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    count: subscriptions.length,
    subscriptions,
  };
  return JSON.stringify(payload, null, 2);
}

export function exportVaultBackup(
  subscriptions: readonly Subscription[],
  settings: VaultSettings,
): string {
  const payload: VaultBackupPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings,
    subscriptions,
  };
  return JSON.stringify(payload, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCY_CODES as readonly string[]).includes(value);
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && (BILLING_CYCLE_LIST as readonly string[]).includes(value);
}

function isCategory(value: unknown): value is SubscriptionCategory {
  return typeof value === 'string' && (CATEGORY_LIST as readonly string[]).includes(value);
}

function isUsageFrequency(value: unknown): value is UsageFrequency {
  return typeof value === 'string' && (USAGE_FREQUENCY_LIST as readonly string[]).includes(value);
}

export function parseVaultBackup(rawJson: string): BackupParseResult {
  const trimmed = rawJson.trim();
  if (!trimmed) {
    return { ok: false, error: 'Backup JSON cannot be empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax. Please paste a valid VaultFlow backup.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Backup root must be a JSON object.' };
  }

  if (parsed.schemaVersion !== 1) {
    return {
      ok: false,
      error: `Unsupported backup schemaVersion (${String(parsed.schemaVersion)}). Expected 1.`,
    };
  }

  if (!Array.isArray(parsed.subscriptions)) {
    return { ok: false, error: 'Backup is missing a valid "subscriptions" array.' };
  }

  const subscriptions: Subscription[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < parsed.subscriptions.length; i++) {
    const item = parsed.subscriptions[i];
    if (!isRecord(item)) {
      return { ok: false, error: `Subscription at index ${i} must be an object.` };
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      return { ok: false, error: `Subscription at index ${i} is missing a valid id.` };
    }
    if (seenIds.has(item.id)) {
      return { ok: false, error: `Duplicate subscription id "${item.id}" in backup.` };
    }
    seenIds.add(item.id);

    if (typeof item.name !== 'string' || !item.name.trim()) {
      return { ok: false, error: `Subscription "${item.id}" is missing a valid name.` };
    }
    if (
      typeof item.amountMinorUnits !== 'number' ||
      !Number.isInteger(item.amountMinorUnits) ||
      item.amountMinorUnits <= 0
    ) {
      return {
        ok: false,
        error: `Subscription "${item.name}" has an invalid amountMinorUnits (must be a positive integer).`,
      };
    }
    if (!isCurrencyCode(item.currency)) {
      return { ok: false, error: `Subscription "${item.name}" has an unsupported currency.` };
    }
    if (!isBillingCycle(item.cycle)) {
      return { ok: false, error: `Subscription "${item.name}" has an invalid billing cycle.` };
    }
    if (!isCategory(item.category)) {
      return { ok: false, error: `Subscription "${item.name}" has an invalid category.` };
    }
    const parsedNextBilling =
      typeof item.nextBillingDate === 'string' ? parseIsoDate(item.nextBillingDate) : null;
    if (typeof item.nextBillingDate !== 'string' || !parsedNextBilling) {
      return {
        ok: false,
        error: `Subscription "${item.name}" has an invalid nextBillingDate (expected YYYY-MM-DD).`,
      };
    }

    const billingDay =
      typeof item.billingDay === 'number' &&
      Number.isInteger(item.billingDay) &&
      item.billingDay >= 1 &&
      item.billingDay <= 31
        ? item.billingDay
        : parsedNextBilling.day;

    const startDate =
      typeof item.startDate === 'string' && parseIsoDate(item.startDate)
        ? item.startDate.trim()
        : undefined;

    const catalogId =
      typeof item.catalogId === 'string' && item.catalogId.trim()
        ? item.catalogId.trim()
        : undefined;

    const previousAmountMinorUnits =
      typeof item.previousAmountMinorUnits === 'number' &&
      Number.isInteger(item.previousAmountMinorUnits) &&
      item.previousAmountMinorUnits > 0
        ? item.previousAmountMinorUnits
        : undefined;

    const usageFrequency = isUsageFrequency(item.usageFrequency) ? item.usageFrequency : undefined;
    const cancelUrl =
      typeof item.cancelUrl === 'string' && /^https?:\/\//i.test(item.cancelUrl.trim())
        ? item.cancelUrl.trim()
        : undefined;

    subscriptions.push({
      id: item.id.trim(),
      name: item.name.trim(),
      ...(catalogId !== undefined ? { catalogId } : {}),
      amountMinorUnits: item.amountMinorUnits,
      ...(previousAmountMinorUnits !== undefined ? { previousAmountMinorUnits } : {}),
      currency: item.currency,
      cycle: item.cycle,
      category: item.category,
      nextBillingDate: item.nextBillingDate,
      billingDay,
      ...(startDate !== undefined ? { startDate } : {}),
      isFreeTrial: Boolean(item.isFreeTrial),
      isSimulatedPaused: Boolean(item.isSimulatedPaused),
      isArchived: Boolean(item.isArchived),
      ...(usageFrequency !== undefined ? { usageFrequency } : {}),
      ...(cancelUrl !== undefined ? { cancelUrl } : {}),
      notes: typeof item.notes === 'string' ? item.notes.trim() : '',
    });
  }

  const defaults = createDefaultSettings();
  let settings: VaultSettings = defaults;

  if (isRecord(parsed.settings)) {
    const s = parsed.settings;
    const baseCurrency = isCurrencyCode(s.baseCurrency) ? s.baseCurrency : defaults.baseCurrency;
    const rates = { ...defaults.exchangeRatesPerUsd };
    if (isRecord(s.exchangeRatesPerUsd)) {
      for (const code of CURRENCY_CODES) {
        const val = s.exchangeRatesPerUsd[code];
        if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          rates[code] = val;
        }
      }
    }
    const ceiling =
      typeof s.monthlyCeilingMinorUnits === 'number' &&
      Number.isInteger(s.monthlyCeilingMinorUnits) &&
      s.monthlyCeilingMinorUnits > 0
        ? s.monthlyCeilingMinorUnits
        : defaults.monthlyCeilingMinorUnits;

    const monthlyIncomeMinorUnits =
      typeof s.monthlyIncomeMinorUnits === 'number' &&
      Number.isInteger(s.monthlyIncomeMinorUnits) &&
      s.monthlyIncomeMinorUnits > 0
        ? s.monthlyIncomeMinorUnits
        : defaults.monthlyIncomeMinorUnits;

    const lead =
      s.reminderLeadDays === 1 || s.reminderLeadDays === 2 || s.reminderLeadDays === 3
        ? s.reminderLeadDays
        : defaults.reminderLeadDays;

    const customRates: Partial<Record<CurrencyCode, number>> = {};
    if (isRecord(s.customExchangeRates)) {
      for (const code of CURRENCY_CODES) {
        if (code === 'USD') continue;
        const val = s.customExchangeRates[code];
        if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          customRates[code] = val;
        }
      }
    }

    const cardMarkupPercent =
      typeof s.cardMarkupPercent === 'number' &&
      Number.isFinite(s.cardMarkupPercent) &&
      s.cardMarkupPercent >= 0 &&
      s.cardMarkupPercent <= 10
        ? Math.round(s.cardMarkupPercent * 100) / 100
        : 0;

    const calendarExportedAt =
      typeof s.calendarExportedAt === 'string' && Number.isFinite(Date.parse(s.calendarExportedAt))
        ? s.calendarExportedAt
        : undefined;

    settings = {
      baseCurrency,
      exchangeRatesPerUsd: rates,
      customExchangeRates: customRates,
      cardMarkupPercent,
      monthlyCeilingMinorUnits: ceiling,
      monthlyIncomeMinorUnits,
      notificationsEnabled:
        typeof s.notificationsEnabled === 'boolean'
          ? s.notificationsEnabled
          : defaults.notificationsEnabled,
      reminderLeadDays: lead,
      isDemo: typeof s.isDemo === 'boolean' ? s.isDemo : false,
      onboardingDone:
        typeof s.onboardingDone === 'boolean'
          ? s.onboardingDone
          : subscriptions.length > 0,
      ...(calendarExportedAt ? { calendarExportedAt } : {}),
      ...(typeof s.calendarExportDirty === 'boolean'
        ? { calendarExportDirty: s.calendarExportDirty }
        : {}),
    };
  }

  return {
    ok: true,
    data: {
      schemaVersion: 1,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      settings,
      subscriptions,
    },
  };
}
