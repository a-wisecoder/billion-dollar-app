import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactMinorUnits } from '../../../core/utils/moneyFormatter';
import { computeCashflowSummary } from './cashflowEngine';
import { createDefaultSettings, type Subscription } from './subscription';
import {
  computePaidSinceStart,
  getNextChargeDates,
  groupSubscriptionsByDueWindow,
} from './subscriptionGrouping';

function makeSub(overrides: Partial<Subscription> & Pick<Subscription, 'id' | 'name' | 'nextBillingDate'>): Subscription {
  return {
    amountMinorUnits: 1000,
    currency: 'USD',
    cycle: 'monthly',
    category: 'productivity',
    isFreeTrial: false,
    isSimulatedPaused: false,
    isArchived: false,
    notes: '',
    ...overrides,
  };
}

test('groupSubscriptionsByDueWindow partitions into Next 7 days, Later this month, and Later', () => {
  const settings = createDefaultSettings();
  const subs: Subscription[] = [
    makeSub({ id: 's1', name: 'Due Soon', nextBillingDate: '2026-11-08' }),
    makeSub({ id: 's2', name: 'Mid Month', nextBillingDate: '2026-11-20' }),
    makeSub({ id: 's3', name: 'Next Month', nextBillingDate: '2026-12-05' }),
  ];

  const summary = computeCashflowSummary(subs, settings, {
    selectedCategory: null,
    showAnnual: false,
    searchQuery: '',
    todayIso: '2026-11-05',
  });

  const groups = groupSubscriptionsByDueWindow(summary.visibleItems, '2026-11-05');
  assert.deepEqual(
    groups.map((g) => [g.label, g.items.map((i) => i.subscription.id)]),
    [
      ['Next 7 days', ['s1']],
      ['Later this month', ['s2']],
      ['Later', ['s3']],
    ],
  );
});

test('getNextChargeDates preserves month-end billingDay across 3 charges', () => {
  const sub = makeSub({
    id: 'end_month',
    name: 'Month End',
    nextBillingDate: '2027-01-31',
    billingDay: 31,
  });

  const dates = getNextChargeDates(sub, 3, '2027-02-01');
  assert.deepEqual(dates, ['2027-02-28', '2027-03-31', '2027-04-30']);
});

test('computePaidSinceStart sums charges from startDate through todayIso', () => {
  const sub = makeSub({
    id: 'started',
    name: 'Netflix',
    amountMinorUnits: 1549,
    currency: 'USD',
    cycle: 'monthly',
    nextBillingDate: '2026-12-05',
    billingDay: 5,
    startDate: '2026-09-05',
  });

  const paid = computePaidSinceStart(sub, '2026-11-20');
  assert.deepEqual(paid, {
    totalOwnMinorUnits: 4647, // Sep 5, Oct 5, Nov 5 = 3 charges
    chargeCount: 3,
    startMonthYear: 'September 2026',
  });

  assert.equal(computePaidSinceStart(makeSub({ id: 'no_start', name: 'X', nextBillingDate: '2026-11-20' }), '2026-11-20'), null);
});

test('formatCompactMinorUnits formats tight cell amounts cleanly', () => {
  assert.equal(formatCompactMinorUnits(3800, 'USD'), '$38');
  assert.equal(formatCompactMinorUnits(3849, 'USD'), '$38');
  assert.equal(formatCompactMinorUnits(3850, 'USD'), '$39');
  assert.equal(formatCompactMinorUnits(580000, 'PKR'), 'Rs 5.8k');
  assert.equal(formatCompactMinorUnits(120000, 'USD'), '$1.2k');
  assert.equal(formatCompactMinorUnits(200000, 'EUR'), '€2k');
});
