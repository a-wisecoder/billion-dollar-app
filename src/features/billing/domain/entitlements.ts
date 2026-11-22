import type { Subscription } from '../../cashflow/domain/subscription';

export type PlanTier = 'free' | 'pro';

export type EntitlementFeature =
  | 'addSubscription'
  | 'statementImport'
  | 'csvExport'
  | 'customRatesAndMarkup';

export const FREE_MAX_ACTIVE_SUBSCRIPTIONS = 8;

/** Online re-validation cadence: 7 days in milliseconds. */
export const LICENSE_REVALIDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Offline grace window after last successful validation: 14 days in milliseconds. */
export const LICENSE_OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

export const PLAN_LIMITS = {
  free: {
    maxActiveSubscriptions: FREE_MAX_ACTIVE_SUBSCRIPTIONS,
    statementImport: 'preview' as const,
    csvExport: false,
    customRatesAndMarkup: false,
  },
  pro: {
    maxActiveSubscriptions: Number.POSITIVE_INFINITY,
    statementImport: 'full' as const,
    csvExport: true,
    customRatesAndMarkup: true,
  },
} as const;

export interface LicenseRecord {
  readonly key: string;
  readonly plan: 'pro';
  readonly expiresAt: string | null;
  readonly lastValidatedAt: string;
  readonly activationId?: string;
}

export type LicenseStatusReason =
  | 'none'
  | 'active'
  | 'offline_grace'
  | 'expired'
  | 'offline_grace_exceeded'
  | 'invalid_timestamp';

export interface LicenseEvaluation {
  readonly plan: PlanTier;
  readonly reason: LicenseStatusReason;
  readonly needsRevalidation: boolean;
  readonly daysRemainingInGrace: number | null;
}

export interface EntitlementsState {
  readonly plan: PlanTier;
  readonly activeSubscriptionCount: number;
  readonly isDemo?: boolean;
}

/**
 * Resolves the effective plan tier and re-validation / offline-grace status
 * from a persisted license record at the given epoch timestamp.
 */
export function evaluateLicense(
  record: LicenseRecord | null,
  nowMs: number = Date.now(),
  isOnline: boolean = true,
): LicenseEvaluation {
  if (!record || !record.key.trim()) {
    return {
      plan: 'free',
      reason: 'none',
      needsRevalidation: false,
      daysRemainingInGrace: null,
    };
  }

  const lastValidatedMs = Date.parse(record.lastValidatedAt);
  if (!Number.isFinite(lastValidatedMs)) {
    return {
      plan: 'free',
      reason: 'invalid_timestamp',
      needsRevalidation: isOnline,
      daysRemainingInGrace: null,
    };
  }

  if (record.expiresAt !== null) {
    const expiresMs = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
      return {
        plan: 'free',
        reason: 'expired',
        needsRevalidation: false,
        daysRemainingInGrace: 0,
      };
    }
  }

  const elapsedMs = Math.max(0, nowMs - lastValidatedMs);
  const needsRevalidation = isOnline && elapsedMs > LICENSE_REVALIDATE_INTERVAL_MS;

  if (elapsedMs > LICENSE_OFFLINE_GRACE_MS) {
    return {
      plan: 'free',
      reason: 'offline_grace_exceeded',
      needsRevalidation: isOnline,
      daysRemainingInGrace: 0,
    };
  }

  if (!isOnline) {
    const remainingMs = Math.max(0, LICENSE_OFFLINE_GRACE_MS - elapsedMs);
    const daysRemainingInGrace = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    return {
      plan: 'pro',
      reason: 'offline_grace',
      needsRevalidation: false,
      daysRemainingInGrace,
    };
  }

  return {
    plan: 'pro',
    reason: 'active',
    needsRevalidation,
    daysRemainingInGrace: null,
  };
}

/**
 * Returns how many active subscriptions count toward the Free limit.
 * Sample data (`isDemo: true`) never counts toward the limit.
 */
export function getCountedActiveSubscriptions(state: EntitlementsState): number {
  if (state.isDemo) return 0;
  return Math.max(0, Math.floor(state.activeSubscriptionCount));
}

/** Returns whether the user's current plan allows performing the requested feature. */
export function can(feature: EntitlementFeature, state: EntitlementsState): boolean {
  if (state.plan === 'pro') {
    return true;
  }

  switch (feature) {
    case 'addSubscription':
      return getCountedActiveSubscriptions(state) < PLAN_LIMITS.free.maxActiveSubscriptions;
    case 'statementImport':
      return false;
    case 'csvExport':
      return PLAN_LIMITS.free.csvExport;
    case 'customRatesAndMarkup':
      return PLAN_LIMITS.free.customRatesAndMarkup;
  }
}

/**
 * Returns remaining quota for a feature.
 * For `addSubscription`: remaining slots on Free (0..8), `Infinity` on Pro.
 * For boolean Pro features: `Infinity` on Pro, `0` on Free.
 */
export function remaining(feature: EntitlementFeature, state: EntitlementsState): number {
  if (state.plan === 'pro') {
    return Number.POSITIVE_INFINITY;
  }

  if (feature === 'addSubscription') {
    return Math.max(
      0,
      PLAN_LIMITS.free.maxActiveSubscriptions - getCountedActiveSubscriptions(state),
    );
  }

  return 0;
}

/**
 * Returns the set of active subscription IDs that are read-only on Free.
 * The first 8 active subscriptions in saved order stay editable; #9+ stay
 * visible and counted in totals as read-only until upgraded.
 */
export function getReadOnlySubscriptionIds(
  subscriptions: readonly Subscription[],
  state: Pick<EntitlementsState, 'plan' | 'isDemo'>,
): ReadonlySet<string> {
  if (state.plan === 'pro' || state.isDemo) {
    return new Set();
  }

  const readOnly = new Set<string>();
  let activeSeen = 0;
  for (const sub of subscriptions) {
    if (sub.isArchived) continue;
    activeSeen += 1;
    if (activeSeen > FREE_MAX_ACTIVE_SUBSCRIPTIONS) {
      readOnly.add(sub.id);
    }
  }
  return readOnly;
}

export function isSubscriptionReadOnly(
  subscriptionId: string,
  subscriptions: readonly Subscription[],
  state: Pick<EntitlementsState, 'plan' | 'isDemo'>,
): boolean {
  return getReadOnlySubscriptionIds(subscriptions, state).has(subscriptionId);
}

/** Masks the middle of a license key for safe display in Settings. */
export function maskLicenseKey(rawKey: string): string {
  const key = rawKey.trim();
  if (!key) return '';
  if (key.length <= 6) {
    return `${key.slice(0, 2)}••••`;
  }
  const start = key.slice(0, 4);
  const end = key.slice(-4);
  return `${start}••••${end}`;
}
