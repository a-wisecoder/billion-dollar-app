import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultSettings, type Subscription } from '../../cashflow/domain/subscription';
import {
  SAMPLE_BANK_STATEMENT,
  compute12MonthForecast,
  computeCostPerUseMinorUnits,
  computeFiveYearCompoundValue,
  computeLeakAudit,
  generateActionScript,
  parseStatementText,
} from './auditEngine';

const FIXED_TODAY = '2026-11-20';

function makeSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub_test',
    name: 'Test Service',
    amountMinorUnits: 1000,
    currency: 'USD',
    cycle: 'monthly',
    category: 'productivity',
    nextBillingDate: '2026-11-25',
    isFreeTrial: false,
    isSimulatedPaused: false,
    isArchived: false,
    usageFrequency: 'weekly',
    notes: '',
    ...overrides,
  };
}

test('computeFiveYearCompoundValue compounds monthly savings at 7% APR', () => {
  assert.equal(computeFiveYearCompoundValue(0), 0);
  assert.equal(computeFiveYearCompoundValue(-500), 0);
  // $100/mo for 60 months at 7% APR is ~$7,159.29 (715929 cents)
  const fv = computeFiveYearCompoundValue(10000);
  assert.ok(fv > 710000 && fv < 720000, `Expected ~$7,159, got ${fv}`);
});

test('computeCostPerUseMinorUnits returns null for unused and exact minor units for daily/weekly', () => {
  const settings = createDefaultSettings();
  const dailySub = makeSub({ amountMinorUnits: 2400, usageFrequency: 'daily' });
  const unusedSub = makeSub({ amountMinorUnits: 1799, usageFrequency: 'unused' });

  assert.equal(computeCostPerUseMinorUnits(dailySub, settings), 100);
  assert.equal(computeCostPerUseMinorUnits(unusedSub, settings), null);
});

test('computeLeakAudit detects price hikes, unused bills, overlaps, and 14-day buffer', () => {
  const settings = createDefaultSettings();
  const subs: Subscription[] = [
    makeSub({
      id: 's1',
      name: 'Fiber Internet',
      amountMinorUnits: 4500,
      previousAmountMinorUnits: 4000,
      category: 'utilities',
      usageFrequency: 'daily',
      nextBillingDate: '2026-11-25',
    }),
    makeSub({
      id: 's2',
      name: 'Cinema 4K',
      amountMinorUnits: 1800,
      previousAmountMinorUnits: 1500,
      category: 'streaming',
      usageFrequency: 'unused',
      nextBillingDate: '2026-11-28',
    }),
    makeSub({
      id: 's3',
      name: 'Music HiFi',
      amountMinorUnits: 1000,
      category: 'streaming',
      usageFrequency: 'daily',
      nextBillingDate: '2026-12-15',
    }),
  ];

  const report = computeLeakAudit(subs, settings, FIXED_TODAY);

  assert.equal(report.priceHikes.length, 2);
  // $5/mo hike + $3/mo hike = $8/mo * 12 = $96/yr (9600 cents)
  assert.equal(report.annualPriceHikeCreepMinorUnits, 9600);
  assert.equal(report.lowValueSubscriptions.length, 1);
  assert.equal(report.lowValueSubscriptions[0].id, 's2');
  // Reclaimable = unused full annual ($18*12 = $216) + kept hike creep ($5*12 = $60) = $276 (27600 cents)
  assert.equal(report.totalReclaimableAnnualMinorUnits, 27600);
  assert.ok(report.fiveYearInvestedValueMinorUnits > 27600 * 5);
  // Overlap: 2 streaming bills
  assert.equal(report.overlapGroups.length, 1);
  assert.equal(report.overlapGroups[0].category, 'streaming');
  // 14-day checking buffer: s1 ($45) + s2 ($18) = $63 (6300 cents); s3 is 25 days away
  assert.equal(report.next14DaysCount, 2);
  assert.equal(report.next14DaysDueMinorUnits, 6300);
});

test('parseStatementText extracts merchants, amounts, categories, and detects price hikes against existing bills', () => {
  const existing: Subscription[] = [
    makeSub({ id: 'ex_1', name: 'ChatGPT Plus', amountMinorUnits: 1800, currency: 'USD' }),
  ];

  const parsed = parseStatementText(SAMPLE_BANK_STATEMENT, existing, FIXED_TODAY);
  assert.equal(parsed.length, 6);

  const spotify = parsed.find((p) => p.name.toLowerCase().includes('spotify'));
  assert.ok(spotify);
  assert.equal(spotify.amountMinorUnits, 1199);
  assert.equal(spotify.category, 'streaming');

  const chatgpt = parsed.find((p) => p.name.toLowerCase().includes('chatgpt'));
  assert.ok(chatgpt);
  assert.equal(chatgpt.matchedExistingId, 'ex_1');
  assert.equal(chatgpt.detectedPriceHikeMinorUnits, 200);
});

test('compute12MonthForecast projects 12 rolling months and flags annual spike month', () => {
  const settings = createDefaultSettings();
  const subs: Subscription[] = [
    makeSub({
      id: 'm1',
      amountMinorUnits: 1000,
      cycle: 'monthly',
      nextBillingDate: '2026-11-22',
    }),
    makeSub({
      id: 'y1',
      amountMinorUnits: 24000,
      cycle: 'yearly',
      nextBillingDate: '2027-03-10',
    }),
  ];

  const bars = compute12MonthForecast(subs, settings, FIXED_TODAY);
  assert.equal(bars.length, 12);
  const march = bars.find((b) => b.year === 2027 && b.month === 3);
  assert.ok(march);
  assert.equal(march.isSpike, true);
  assert.equal(march.totalBaseMinorUnits, 25000);
});

test('generateActionScript produces tailored cancel and negotiate templates', () => {
  const sub = makeSub({
    name: 'Cloud Pro',
    amountMinorUnits: 2499,
    currency: 'USD',
    cycle: 'monthly',
    nextBillingDate: '2026-12-01',
  });

  const cancel = generateActionScript(sub, 'cancel');
  assert.match(cancel.subject, /Cancellation Request — Cloud Pro/);
  assert.match(cancel.body, /\$24\.99\/mo/);

  const negotiate = generateActionScript(sub, 'negotiate');
  assert.match(negotiate.subject, /Loyalty Discount Request — Cloud Pro/);
  assert.match(negotiate.body, /\$24\.99/);
});
