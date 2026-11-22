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
import { normalizeOverdueSubscriptions } from '../../../features/cashflow/data/localStorageRepository';
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

test('formatMinorUnits rounds half-up when decimals are hidden', () => {
  assert.equal(formatMinorUnits(181788, 'USD', { showDecimals: false }), '$1,818');
  assert.equal(formatMinorUnits(4851, 'USD', { showDecimals: false }), '$49');
  assert.equal(formatMinorUnits(21588, 'USD', { showDecimals: false }), '$216');
  assert.equal(formatMinorUnits(149, 'USD', { showDecimals: false }), '$1');
  assert.equal(formatMinorUnits(150, 'USD', { showDecimals: false }), '$2');
  assert.equal(formatMinorUnits(-4851, 'USD', { showDecimals: false }), '-$49');
  assert.equal(formatMinorUnits(-49, 'USD', { showDecimals: false }), '$0');
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

test('billingDay prevents month-end drift across short months on reload and projection', () => {
  let subs: Subscription[] = [
    {
      id: 'sub_31',
      name: 'Month-End Plan',
      amountMinorUnits: 1500,
      currency: 'USD',
      cycle: 'monthly',
      category: 'productivity',
      nextBillingDate: '2027-01-31',
      billingDay: 31,
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
  ];

  // Open on 2027-02-01, save result -> 2027-02-28 (billingDay stays 31)
  subs = normalizeOverdueSubscriptions(subs, '2027-02-01');
  assert.equal(subs[0].nextBillingDate, '2027-02-28');
  assert.equal(subs[0].billingDay, 31);

  // Open on 2027-03-01, save result -> 2027-03-31 (no drift to 28!)
  subs = normalizeOverdueSubscriptions(subs, '2027-03-01');
  assert.equal(subs[0].nextBillingDate, '2027-03-31');
  assert.equal(subs[0].billingDay, 31);

  // Open on 2027-04-01, save result -> 2027-04-30
  subs = normalizeOverdueSubscriptions(subs, '2027-04-01');
  assert.equal(subs[0].nextBillingDate, '2027-04-30');
  assert.equal(subs[0].billingDay, 31);

  // December projection for billingDay 31 even when stored date is Nov 30 -> 2026-12-31
  assert.deepEqual(
    projectBillingDatesInMonth('2026-11-30', 'monthly', 2026, 12, 31),
    ['2026-12-31'],
  );

  // Calendar timeline projection across Nov, Dec, and Feb preserves billingDay 31
  const settings = createDefaultSettings();
  const anchoredSub: Subscription = {
    ...subs[0],
    nextBillingDate: '2026-11-30',
    billingDay: 31,
  };
  const nov = computeMonthTimeline([anchoredSub], settings, 2026, 11);
  const dec = computeMonthTimeline([anchoredSub], settings, 2026, 12);
  const feb = computeMonthTimeline([anchoredSub], settings, 2027, 2);
  assert.deepEqual(
    nov.days.filter((d) => d.charges.length > 0).map((d) => d.dateIso),
    ['2026-11-30'],
  );
  assert.deepEqual(
    dec.days.filter((d) => d.charges.length > 0).map((d) => d.dateIso),
    ['2026-12-31'],
  );
  assert.deepEqual(
    feb.days.filter((d) => d.charges.length > 0).map((d) => d.dateIso),
    ['2027-02-28'],
  );

  // Legacy data without billingDay backfills billingDay from stored nextBillingDate
  const legacy = normalizeOverdueSubscriptions(
    [
      {
        id: 'legacy_1',
        name: 'Legacy Plan',
        amountMinorUnits: 1000,
        currency: 'USD',
        cycle: 'monthly',
        category: 'utilities',
        nextBillingDate: '2027-05-19',
        isFreeTrial: false,
        isSimulatedPaused: false,
        isArchived: false,
        notes: '',
      },
    ],
    '2027-05-01',
  );
  assert.equal(legacy[0].billingDay, 19);
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

test('cashflowEngine excludes expired free trials from dueSoonCount and surfaces them in expiredTrials', () => {
  const settings = createDefaultSettings();
  const subs: Subscription[] = [
    {
      id: 'trial_expired',
      name: 'Old Trial',
      amountMinorUnits: 2000,
      currency: 'USD',
      cycle: 'monthly',
      category: 'aiAndCloud',
      nextBillingDate: '2026-11-15',
      billingDay: 15,
      isFreeTrial: true,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: 'trial_due_soon',
      name: 'Active Trial',
      amountMinorUnits: 1200,
      currency: 'USD',
      cycle: 'monthly',
      category: 'streaming',
      nextBillingDate: '2026-11-22',
      billingDay: 22,
      isFreeTrial: true,
      isSimulatedPaused: false,
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

  assert.equal(summary.dueSoonCount, 1);
  assert.equal(summary.expiredTrials.length, 1);
  assert.equal(summary.expiredTrials[0].subscription.id, 'trial_expired');
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

  // Backwards compatibility: accepts backup without billingDay, startDate, isDemo or onboardingDone
  const legacyBackup = parseVaultBackup(
    JSON.stringify({
      schemaVersion: 1,
      unknownRootField: 'should-be-ignored',
      settings: {
        baseCurrency: 'USD',
        monthlyCeilingMinorUnits: 20000,
        notificationsEnabled: true,
        reminderLeadDays: 2,
        unknownSettingField: 999,
      },
      subscriptions: [
        {
          id: 'legacy_sub',
          name: 'Legacy Bill',
          amountMinorUnits: 1200,
          currency: 'USD',
          cycle: 'monthly',
          category: 'utilities',
          nextBillingDate: '2026-11-30',
          unknownSubField: 'drop-me',
        },
      ],
    }),
  );
  assert.equal(legacyBackup.ok, true);
  if (legacyBackup.ok) {
    assert.equal(legacyBackup.data.subscriptions[0].billingDay, 30);
    assert.equal(legacyBackup.data.subscriptions[0].startDate, undefined);
    assert.equal(legacyBackup.data.settings.isDemo, false);
    assert.equal(legacyBackup.data.settings.onboardingDone, true);
    assert.equal('unknownRootField' in (legacyBackup.data as unknown as Record<string, unknown>), false);
    assert.equal('unknownSettingField' in (legacyBackup.data.settings as unknown as Record<string, unknown>), false);
    assert.equal('unknownSubField' in (legacyBackup.data.subscriptions[0] as unknown as Record<string, unknown>), false);
  }
});

test('backupService rejects files over 1 MB and round-trips every Subscription & VaultSettings field', () => {
  const oversized = JSON.stringify({
    schemaVersion: 1,
    subscriptions: [],
    pad: 'x'.repeat(1024 * 1024 + 64),
  });
  const oversizedResult = parseVaultBackup(oversized);
  assert.equal(oversizedResult.ok, false);
  if (!oversizedResult.ok) {
    assert.match(oversizedResult.error, /1 MB/i);
  }

  const fullSettings = {
    ...createDefaultSettings(),
    baseCurrency: 'PKR' as const,
    customExchangeRates: { PKR: 281.25, EUR: 0.94 },
    cardMarkupPercent: 3.5,
    monthlyCeilingMinorUnits: 12500000,
    monthlyIncomeMinorUnits: 50000000,
    notificationsEnabled: false,
    reminderLeadDays: 3 as const,
    isDemo: false,
    onboardingDone: true,
    calendarExportedAt: '2026-11-20T10:00:00.000Z',
    calendarExportDirty: true,
  };
  const fullSub: Subscription = {
    id: 'sub_full_roundtrip',
    name: 'Microsoft 365 Business Premium Annual Subscription',
    catalogId: 'microsoft-365',
    amountMinorUnits: 125000000,
    previousAmountMinorUnits: 110000000,
    currency: 'PKR',
    cycle: 'yearly',
    category: 'productivity',
    nextBillingDate: '2027-01-31',
    billingDay: 31,
    startDate: '2025-01-31',
    isFreeTrial: false,
    isSimulatedPaused: true,
    isArchived: false,
    usageFrequency: 'daily',
    cancelUrl: 'https://account.microsoft.com/services',
    notes: 'Annual business license',
  };

  const exported = exportVaultBackup([fullSub], fullSettings);
  const reimported = parseVaultBackup(exported);
  assert.equal(reimported.ok, true);
  if (reimported.ok) {
    assert.deepEqual(reimported.data.subscriptions[0], fullSub);
    assert.deepEqual(reimported.data.settings, fullSettings);
  }
});

test('date math edge dates: 2026-01-31, 2026-02-28, 2028-02-29, 2026-12-31, 12 months of 31st, trials, and weekly month-end crossings', () => {
  // 12 consecutive months for a monthly subscription anchored to day 31
  const expected12Months = [
    [2026, 1, '2026-01-31'],
    [2026, 2, '2026-02-28'],
    [2026, 3, '2026-03-31'],
    [2026, 4, '2026-04-30'],
    [2026, 5, '2026-05-31'],
    [2026, 6, '2026-06-30'],
    [2026, 7, '2026-07-31'],
    [2026, 8, '2026-08-31'],
    [2026, 9, '2026-09-30'],
    [2026, 10, '2026-10-31'],
    [2026, 11, '2026-11-30'],
    [2026, 12, '2026-12-31'],
  ] as const;

  for (const [year, month, expectedIso] of expected12Months) {
    assert.deepEqual(
      projectBillingDatesInMonth('2026-01-31', 'monthly', year, month, 31),
      [expectedIso],
    );
  }

  // Leap year Feb 29, 2028
  assert.deepEqual(
    projectBillingDatesInMonth('2026-01-31', 'monthly', 2028, 2, 31),
    ['2028-02-29'],
  );

  // Advancing overdue billing dates with today = 2026-01-31, 2026-02-28, 2028-02-29, 2026-12-31
  assert.equal(advanceOverdueBillingDate('2026-01-31', 'monthly', '2026-01-31', 31), '2026-01-31');
  assert.equal(advanceOverdueBillingDate('2026-01-31', 'monthly', '2026-02-28', 31), '2026-02-28');
  assert.equal(advanceOverdueBillingDate('2028-01-31', 'monthly', '2028-02-29', 31), '2028-02-29');
  assert.equal(advanceOverdueBillingDate('2026-11-30', 'monthly', '2026-12-31', 31), '2026-12-31');
  assert.equal(advanceOverdueBillingDate('2026-12-31', 'yearly', '2027-01-01', 31), '2027-12-31');

  // Weekly bills crossing month ends, leap Feb 29, and year end
  assert.equal(advanceOverdueBillingDate('2026-01-29', 'weekly', '2026-01-31'), '2026-02-05');
  assert.equal(advanceOverdueBillingDate('2026-02-26', 'weekly', '2026-02-28'), '2026-03-05');
  assert.equal(advanceOverdueBillingDate('2028-02-24', 'weekly', '2028-02-29'), '2028-03-02');
  assert.equal(advanceOverdueBillingDate('2026-12-28', 'weekly', '2026-12-31'), '2027-01-04');

  // Trials do not auto-advance when overdue on edge dates
  const trialSub: Subscription = {
    id: 'trial_edge',
    name: 'Edge Trial',
    amountMinorUnits: 1999,
    currency: 'USD',
    cycle: 'monthly',
    category: 'aiAndCloud',
    nextBillingDate: '2026-02-28',
    billingDay: 28,
    isFreeTrial: true,
    isSimulatedPaused: false,
    isArchived: false,
    notes: '',
  };
  const normalized = normalizeOverdueSubscriptions([trialSub], '2028-02-29');
  assert.equal(normalized[0].nextBillingDate, '2026-02-28');
});

test('all multi-currency sums in cashflowEngine and timelineEngine remain exact safe integers', () => {
  const settings = {
    ...createDefaultSettings(),
    baseCurrency: 'PKR' as const,
    cardMarkupPercent: 3.5,
  };
  const subs: Subscription[] = [
    {
      id: 'm1',
      name: 'USD Sub',
      amountMinorUnits: 1999,
      currency: 'USD',
      cycle: 'monthly',
      category: 'aiAndCloud',
      nextBillingDate: '2026-11-25',
      billingDay: 25,
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: 'm2',
      name: 'PKR Enterprise Sub',
      amountMinorUnits: 125000000,
      currency: 'PKR',
      cycle: 'yearly',
      category: 'productivity',
      nextBillingDate: '2026-11-28',
      billingDay: 28,
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: 'm3',
      name: 'GBP Weekly Sub',
      amountMinorUnits: 499,
      currency: 'GBP',
      cycle: 'weekly',
      category: 'news',
      nextBillingDate: '2026-11-22',
      billingDay: 22,
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
  assert.ok(Number.isSafeInteger(summary.activeMonthlyBaseMinorUnits));
  assert.ok(Number.isSafeInteger(summary.activeAnnualBaseMinorUnits));
  assert.ok(Number.isSafeInteger(summary.displayedTotalBaseMinorUnits));
  assert.ok(Number.isSafeInteger(summary.simulatedAnnualSavingsBaseMinorUnits));

  const timeline = computeMonthTimeline(subs, settings, 2026, 11);
  assert.ok(Number.isSafeInteger(timeline.totalMonthBaseMinorUnits));
  for (const day of timeline.days) {
    assert.ok(Number.isSafeInteger(day.totalBaseMinorUnits));
  }
});
