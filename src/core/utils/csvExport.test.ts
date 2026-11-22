import test from 'node:test';
import assert from 'node:assert/strict';
import type { Subscription } from '../../features/cashflow/domain/subscription';
import { exportSubscriptionsCsv } from './csvExport';

test('exportSubscriptionsCsv includes UTF-8 BOM, required columns, currency symbols and escapes commas/quotes', () => {
  const subs: Subscription[] = [
    {
      id: 'sub_1',
      name: 'Netflix, "4K" Plan',
      amountMinorUnits: 110000,
      currency: 'PKR',
      cycle: 'monthly',
      category: 'streaming',
      nextBillingDate: '2026-12-01',
      billingDay: 1,
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: 'sub_2',
      name: 'European Cloud',
      amountMinorUnits: 1499,
      currency: 'EUR',
      cycle: 'yearly',
      category: 'aiAndCloud',
      nextBillingDate: '2027-01-15',
      billingDay: 15,
      isFreeTrial: true,
      isSimulatedPaused: false,
      isArchived: false,
      notes: '',
    },
    {
      id: 'sub_3',
      name: 'Old Gym',
      amountMinorUnits: 3500,
      currency: 'USD',
      cycle: 'monthly',
      category: 'health',
      nextBillingDate: '2026-11-25',
      billingDay: 25,
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: true,
      notes: '',
    },
  ];

  const csv = exportSubscriptionsCsv(subs);

  assert.equal(csv.charCodeAt(0), 0xfeff, 'Must start with UTF-8 BOM for Excel');
  const lines = csv.slice(1).trimEnd().split('\r\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[0], 'Name,Amount,Currency,Cycle,Next Date,Category,Status');
  assert.equal(
    lines[1],
    '"Netflix, ""4K"" Plan","Rs 1,100",PKR,Monthly,2026-12-01,Media,Active',
  );
  assert.equal(
    lines[2],
    'European Cloud,€14.99,EUR,Yearly,2027-01-15,AI & Cloud,Free trial',
  );
  assert.equal(
    lines[3],
    'Old Gym,$35.00,USD,Monthly,2026-11-25,Health,Cancelled',
  );
});
