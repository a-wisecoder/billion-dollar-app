import {
  BILLING_CYCLE_LIST,
  CATEGORY_LIST,
  CURRENCY_CODES,
  createDefaultSettings,
  type BillingCycle,
  type CurrencyCode,
  type Subscription,
  type SubscriptionCategory,
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
    if (typeof item.nextBillingDate !== 'string' || !parseIsoDate(item.nextBillingDate)) {
      return {
        ok: false,
        error: `Subscription "${item.name}" has an invalid nextBillingDate (expected YYYY-MM-DD).`,
      };
    }

    subscriptions.push({
      id: item.id.trim(),
      name: item.name.trim(),
      amountMinorUnits: item.amountMinorUnits,
      currency: item.currency,
      cycle: item.cycle,
      category: item.category,
      nextBillingDate: item.nextBillingDate,
      isFreeTrial: Boolean(item.isFreeTrial),
      isSimulatedPaused: Boolean(item.isSimulatedPaused),
      isArchived: Boolean(item.isArchived),
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

    const lead =
      s.reminderLeadDays === 1 || s.reminderLeadDays === 2 || s.reminderLeadDays === 3
        ? s.reminderLeadDays
        : defaults.reminderLeadDays;

    settings = {
      baseCurrency,
      exchangeRatesPerUsd: rates,
      monthlyCeilingMinorUnits: ceiling,
      notificationsEnabled:
        typeof s.notificationsEnabled === 'boolean'
          ? s.notificationsEnabled
          : defaults.notificationsEnabled,
      reminderLeadDays: lead,
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
