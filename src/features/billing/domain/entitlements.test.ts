import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Subscription } from '../../cashflow/domain/subscription';
import {
  FREE_MAX_ACTIVE_SUBSCRIPTIONS,
  LICENSE_OFFLINE_GRACE_MS,
  LICENSE_REVALIDATE_INTERVAL_MS,
  PLAN_LIMITS,
  can,
  evaluateLicense,
  getReadOnlySubscriptionIds,
  isSubscriptionReadOnly,
  maskLicenseKey,
  remaining,
  type LicenseRecord,
} from './entitlements';

function makeSub(id: string, isArchived = false): Subscription {
  return {
    id,
    name: `Service ${id}`,
    amountMinorUnits: 999,
    currency: 'USD',
    cycle: 'monthly',
    category: 'other',
    nextBillingDate: '2026-12-01',
    billingDay: 1,
    isFreeTrial: false,
    isSimulatedPaused: false,
    isArchived,
    notes: '',
  };
}

describe('entitlements: plan limits, can() and remaining()', () => {
  it('enforces Free limits (8 active, preview import, no CSV, no custom rates/markup)', () => {
    assert.equal(PLAN_LIMITS.free.maxActiveSubscriptions, 8);
    assert.equal(PLAN_LIMITS.free.statementImport, 'preview');
    assert.equal(PLAN_LIMITS.free.csvExport, false);
    assert.equal(PLAN_LIMITS.free.customRatesAndMarkup, false);

    const state7 = { plan: 'free' as const, activeSubscriptionCount: 7, isDemo: false };
    assert.equal(can('addSubscription', state7), true);
    assert.equal(remaining('addSubscription', state7), 1);
    assert.equal(can('statementImport', state7), false);
    assert.equal(can('csvExport', state7), false);
    assert.equal(can('customRatesAndMarkup', state7), false);

    const state8 = { plan: 'free' as const, activeSubscriptionCount: 8, isDemo: false };
    assert.equal(can('addSubscription', state8), false);
    assert.equal(remaining('addSubscription', state8), 0);
  });

  it('never counts sample data (isDemo) toward the Free 8-subscription limit', () => {
    const demoState = { plan: 'free' as const, activeSubscriptionCount: 12, isDemo: true };
    assert.equal(can('addSubscription', demoState), true);
    assert.equal(remaining('addSubscription', demoState), FREE_MAX_ACTIVE_SUBSCRIPTIONS);
    assert.equal(can('csvExport', demoState), false);
  });

  it('unlocks every feature with no limits on Pro', () => {
    const proState = { plan: 'pro' as const, activeSubscriptionCount: 42, isDemo: false };
    assert.equal(can('addSubscription', proState), true);
    assert.equal(can('statementImport', proState), true);
    assert.equal(can('csvExport', proState), true);
    assert.equal(can('customRatesAndMarkup', proState), true);
    assert.equal(remaining('addSubscription', proState), Number.POSITIVE_INFINITY);
  });
});

describe('entitlements: read-only fallback beyond 8 active subscriptions', () => {
  it('keeps first 8 added active subscriptions editable on Free and marks #9+ read-only', () => {
    const subs = [
      makeSub('s1'),
      makeSub('s2'),
      makeSub('archived-1', true),
      makeSub('s3'),
      makeSub('s4'),
      makeSub('s5'),
      makeSub('s6'),
      makeSub('s7'),
      makeSub('s8'),
      makeSub('s9'),
      makeSub('s10'),
    ];

    const freeReadOnly = getReadOnlySubscriptionIds(subs, { plan: 'free', isDemo: false });
    assert.equal(freeReadOnly.size, 2);
    assert.equal(freeReadOnly.has('s8'), false);
    assert.equal(freeReadOnly.has('archived-1'), false);
    assert.equal(freeReadOnly.has('s9'), true);
    assert.equal(freeReadOnly.has('s10'), true);
    assert.equal(isSubscriptionReadOnly('s9', subs, { plan: 'free', isDemo: false }), true);
    assert.equal(isSubscriptionReadOnly('s1', subs, { plan: 'free', isDemo: false }), false);

    // Pro and demo modes never mark subscriptions read-only
    assert.equal(getReadOnlySubscriptionIds(subs, { plan: 'pro', isDemo: false }).size, 0);
    assert.equal(getReadOnlySubscriptionIds(subs, { plan: 'free', isDemo: true }).size, 0);
  });
});

describe('entitlements: license state transitions', () => {
  const baseTime = Date.parse('2026-11-21T12:00:00.000Z');

  it('resolves Free when no license is stored', () => {
    const res = evaluateLicense(null, baseTime, true);
    assert.equal(res.plan, 'free');
    assert.equal(res.reason, 'none');
    assert.equal(res.needsRevalidation, false);
  });

  it('keeps Pro active online within 7 days without triggering re-validation', () => {
    const record: LicenseRecord = {
      key: 'KEY-1234-ABCD',
      plan: 'pro',
      expiresAt: null,
      lastValidatedAt: new Date(baseTime - 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res = evaluateLicense(record, baseTime, true);
    assert.equal(res.plan, 'pro');
    assert.equal(res.reason, 'active');
    assert.equal(res.needsRevalidation, false);
  });

  it('flags re-validation when online and lastValidatedAt is older than 7 days', () => {
    const record: LicenseRecord = {
      key: 'KEY-1234-ABCD',
      plan: 'pro',
      expiresAt: null,
      lastValidatedAt: new Date(baseTime - LICENSE_REVALIDATE_INTERVAL_MS - 60_000).toISOString(),
    };
    const res = evaluateLicense(record, baseTime, true);
    assert.equal(res.plan, 'pro');
    assert.equal(res.needsRevalidation, true);
  });

  it('keeps Pro active during 14-day offline grace window', () => {
    const record: LicenseRecord = {
      key: 'KEY-1234-ABCD',
      plan: 'pro',
      expiresAt: null,
      lastValidatedAt: new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res = evaluateLicense(record, baseTime, false);
    assert.equal(res.plan, 'pro');
    assert.equal(res.reason, 'offline_grace');
    assert.equal(res.needsRevalidation, false);
    assert.equal(res.daysRemainingInGrace, 4);
  });

  it('drops to Free when offline and lastValidatedAt is older than 14 days (e.g. 20 days)', () => {
    const record: LicenseRecord = {
      key: 'KEY-1234-ABCD',
      plan: 'pro',
      expiresAt: null,
      lastValidatedAt: new Date(baseTime - 20 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res = evaluateLicense(record, baseTime, false);
    assert.equal(res.plan, 'free');
    assert.equal(res.reason, 'offline_grace_exceeded');
    assert.equal(res.daysRemainingInGrace, 0);
  });

  it('drops to Free immediately when expiresAt has passed, even within offline grace', () => {
    const record: LicenseRecord = {
      key: 'KEY-1234-ABCD',
      plan: 'pro',
      expiresAt: new Date(baseTime - 1000).toISOString(),
      lastValidatedAt: new Date(baseTime - 1000).toISOString(),
    };
    const res = evaluateLicense(record, baseTime, false);
    assert.equal(res.plan, 'free');
    assert.equal(res.reason, 'expired');
  });

  it('keeps Pro active when expiresAt is in the future and within grace', () => {
    const record: LicenseRecord = {
      key: 'KEY-1234-ABCD',
      plan: 'pro',
      expiresAt: new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastValidatedAt: new Date(baseTime - LICENSE_OFFLINE_GRACE_MS + 60_000).toISOString(),
    };
    const res = evaluateLicense(record, baseTime, false);
    assert.equal(res.plan, 'pro');
    assert.equal(res.reason, 'offline_grace');
  });

  it('masks license keys safely for Settings display', () => {
    assert.equal(maskLicenseKey('POLAR-1234-5678-WXYZ'), 'POLA••••WXYZ');
    assert.equal(maskLicenseKey('SHORT'), 'SH••••');
    assert.equal(maskLicenseKey(''), '');
  });
});
