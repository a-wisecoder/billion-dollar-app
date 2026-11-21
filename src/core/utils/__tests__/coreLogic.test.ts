import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMinorUnits,
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../moneyFormatter';
import { convertMinorUnits } from '../currencyConverter';
import {
  advanceOverdueBillingDate,
  daysUntilRenewal,
  projectBillingDatesInMonth,
} from '../dateMath';
import {
  exportSubscriptionsJson,
  exportVaultBackup,
  parseVaultBackup,
} from '../backupService';
import {
  createDefaultSettings,
  getAnnualMinorUnits,
  getMonthlyMinorUnits,
  type Subscription,
} from '../../../features/cashflow/domain/subscription';
import { computeCashflowSummary } from '../../../features/cashflow/domain/cashflowEngine';
import { computeMonthTimeline } from '../../../features/timeline/domain/timelineEngine';

test('parseDecimalToMinorUnits converts decimal strings strictly without float drift', () => {
  assert.equal(parseDecimalToMinorUnits('19.99'), 1999);
  assert.equal(parseDecimalToMinorUnits('0.10'), 10);
  assert.equal(parseDecimalToMinorUnits('0.20'), 20);
  assert.equal(parseDecimalToMinorUnits('1,250.5'), 125050);
  assert.equal(parseDecimalToMinorUnits('20'), 2000);
  assert.equal(parseDecimalToMinorUnits('0'), null);
  assert.equal(parseDecimalToMinorUnits('-5.00'), null);
  assert.equal(parseDecimalToMinorUnits('19.999'), null);
  assert.equal(parseDecimalToMinorUnits(''), null);
  assert.equal(minorUnitsToInputString(1999), '19.99');
  assert.equal(minorUnitsToInputString(2000), '20');
});

test('formatMinorUnits formats thousands separators and currencies accurately', () => {
  assert.equal(formatMinorUnits(1499, 'USD'), '$14.99');
  assert.equal(formatMinorUnits(1234567, 'USD'), '$12,345.67');
  assert.equal(formatMinorUnits(20000, 'USD', { showDecimals: false }), '$200');
  assert.equal(formatMinorUnits(556000, 'PKR', { showDecimals: false }), 'Rs 5,560');
  assert.equal(formatMinorUnits(-500, 'EUR'), '-€5.00');
});

test('convertMinorUnits normalizes multi-currency amounts accurately', () => {
  const settings = createDefaultSettings();
  // $20.00 -> PKR at 278.5 = Rs 5,570.00 (557000 minor units)
  assert.equal(
    convertMinorUnits(2000, 'USD', 'PKR', settings.exchangeRatesPerUsd),
    557000,
  );
  // Same currency returns exact integer
  assert.equal(
    convertMinorUnits(1599, 'EUR', 'EUR', settings.exchangeRatesPerUsd),
    1599,
  );
});

test('billing math normalizes weekly, monthly, quarterly, and yearly minor units', () => {
  assert.equal(getMonthlyMinorUnits(1000, 'monthly'), 1000);
  assert.equal(getAnnualMinorUnits(1000, 'monthly'), 12000);
  assert.equal(getMonthlyMinorUnits(12000, 'yearly'), 1000);
  assert.equal(getAnnualMinorUnits(3000, 'quarterly'), 12000);
  assert.equal(getMonthlyMinorUnits(3000, 'quarterly'), 1000);
  assert.equal(getAnnualMinorUnits(1000, 'weekly'), 52000);
});

test('date math advances overdue dates and handles short month clamping', () => {
  assert.equal(daysUntilRenewal('2026-11-25', '2026-11-20'), 5);
  assert.equal(daysUntilRenewal('2026-11-20', '2026-11-20'), 0);

  // Jan 31 monthly advances to Feb 28 then Mar 31
  assert.equal(
    advanceOverdueBillingDate('2026-01-31', 'monthly', '2026-02-15'),
    '2026-02-28',
  );
  assert.equal(
    advanceOverdueBillingDate('2026-01-31', 'monthly', '2026-03-01'),
    '2026-03-31',
  );
  // Weekly advancement
  assert.equal(
    advanceOverdueBillingDate('2026-11-01', 'weekly', '2026-11-20'),
    '2026-11-22',
  );
});

test('projectBillingDatesInMonth projects weekly, monthly, quarterly, and yearly charges', () => {
  assert.deepEqual(
    projectBillingDatesInMonth('2026-11-02', 'weekly', 2026, 11),
    ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'],
  );
  assert.deepEqual(
    projectBillingDatesInMonth('2026-01-31', 'monthly', 2026, 2),
    ['2026-02-28'],
  );
  assert.deepEqual(
    projectBillingDatesInMonth('2026-11-15', 'quarterly', 2027, 2),
    ['2027-02-15'],
  );
  assert.deepEqual(
    projectBillingDatesInMonth('2026-11-15', 'quarterly', 2026, 12),
    [],
  );
  assert.deepEqual(
    projectBillingDatesInMonth('2026-11-15', 'yearly', 2027, 11),
    ['2027-11-15'],
  );
});

test('cashflowEngine computes burn segments and What-If annual savings accurately', () => {
  const settings = createDefaultSettings();
  const subs: Subscription[] = [
    {
      id: '1',
      name: 'Claude Pro',
      amountMinorUnits: 2000,
      currency: 'USD',
      cycle: 'monthly',
      category: 'aiAndCloud',
      nextBillingDate: '2026-11-22',
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: '2',
      name: 'Netflix',
      amountMinorUnits: 1500,
      currency: 'USD',
      cycle: 'monthly',
      category: 'streaming',
      nextBillingDate: '2026-11-28',
      isFreeTrial: false,
      isSimulatedPaused: true,
      isArchived: false,
      notes: '',
    },
  ];

  const summary = computeCashflowSummary(subs, settings, {
    selectedCategory: null,
    showAnnual: false,
    searchQuery: '',
    todayIso: '2026-11-20',
  });

  assert.equal(summary.activeMonthlyBaseMinorUnits, 2000);
  assert.equal(summary.simulatedAnnualSavingsBaseMinorUnits, 18000);
  assert.equal(summary.simulatedCount, 1);
  assert.equal(summary.dialSegments.length, 1);
  assert.equal(summary.dialSegments[0].category, 'aiAndCloud');
  assert.equal(summary.dialSegments[0].fraction, 1);
});

test('timelineEngine detects Heavy-Week Cluster when > 40% spend falls in 7 days', () => {
  const settings = createDefaultSettings();
  const subs: Subscription[] = [
    {
      id: 'a',
      name: 'Fiber',
      amountMinorUnits: 5000,
      currency: 'USD',
      cycle: 'monthly',
      category: 'utilities',
      nextBillingDate: '2026-11-18',
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: 'b',
      name: 'Gym',
      amountMinorUnits: 4000,
      currency: 'USD',
      cycle: 'monthly',
      category: 'health',
      nextBillingDate: '2026-11-21',
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: 'c',
      name: 'Music',
      amountMinorUnits: 1000,
      currency: 'USD',
      cycle: 'monthly',
      category: 'streaming',
      nextBillingDate: '2026-11-04',
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
  ];

  const timeline = computeMonthTimeline(subs, settings, 2026, 11);
  assert.equal(timeline.totalMonthBaseMinorUnits, 10000);
  assert.ok(timeline.heavyWeekCluster !== null);
  assert.equal(timeline.heavyWeekCluster.chargeCount, 2);
  assert.equal(timeline.heavyWeekCluster.totalBaseMinorUnits, 9000);
});

test('backupService exports and round-trips valid backups and rejects malformed JSON', () => {
  const settings = createDefaultSettings();
  const subs: Subscription[] = [
    {
      id: 'sub_test',
      name: 'Cloud VPS',
      amountMinorUnits: 2499,
      currency: 'USD',
      cycle: 'monthly',
      category: 'aiAndCloud',
      nextBillingDate: '2026-12-01',
      isFreeTrial: true,
      isSimulatedPaused: false,
      isArchived: false,
      notes: 'Staging box',
    },
  ];

  const json = exportVaultBackup(subs, settings);
  const parsed = parseVaultBackup(json);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.subscriptions.length, 1);
    assert.equal(parsed.data.subscriptions[0].amountMinorUnits, 2499);
    assert.equal(parsed.data.subscriptions[0].isFreeTrial, true);
  }

  const subsOnlyJson = exportSubscriptionsJson(subs);
  const rawObj = JSON.parse(subsOnlyJson) as {
    schemaVersion: number;
    count: number;
    subscriptions: Subscription[];
  };
  assert.equal(rawObj.schemaVersion, 1);
  assert.equal(rawObj.count, 1);
  assert.equal(rawObj.subscriptions[0].name, 'Cloud VPS');
  const parsedSubsOnly = parseVaultBackup(subsOnlyJson);
  assert.equal(parsedSubsOnly.ok, true);

  const badJson = parseVaultBackup('{ broken json');
  assert.equal(badJson.ok, false);

  const floatAmount = parseVaultBackup(
    JSON.stringify({
      schemaVersion: 1,
      subscriptions: [
        {
          id: 'bad_1',
          name: 'Bad',
          amountMinorUnits: 19.99,
          currency: 'USD',
          cycle: 'monthly',
          category: 'aiAndCloud',
          nextBillingDate: '2026-12-01',
        },
      ],
    }),
  );
  assert.equal(floatAmount.ok, false);
});
