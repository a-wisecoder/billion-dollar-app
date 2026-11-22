import {
  BILLING_CYCLES,
  CATEGORIES,
  type Subscription,
} from '../../features/cashflow/domain/subscription';
import { formatMinorUnits } from './moneyFormatter';

const UTF8_BOM = '\uFEFF';

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getSubscriptionStatus(sub: Subscription): string {
  if (sub.isArchived) return 'Cancelled';
  if (sub.isFreeTrial) return 'Free trial';
  return 'Active';
}

/**
 * Generates an Excel-compatible UTF-8 CSV (with BOM) with one row per subscription.
 * Columns: Name, Amount, Currency, Cycle, Next Date, Category, Status.
 */
export function exportSubscriptionsCsv(subscriptions: readonly Subscription[]): string {
  const header = ['Name', 'Amount', 'Currency', 'Cycle', 'Next Date', 'Category', 'Status'];
  const rows: string[] = [header.map(escapeCsvCell).join(',')];

  for (const sub of subscriptions) {
    const amount = formatMinorUnits(sub.amountMinorUnits, sub.currency, {
      showDecimals: sub.currency !== 'PKR',
    });
    const row = [
      sub.name,
      amount,
      sub.currency,
      BILLING_CYCLES[sub.cycle].label,
      sub.nextBillingDate,
      CATEGORIES[sub.category].label,
      getSubscriptionStatus(sub),
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  }

  return `${UTF8_BOM}${rows.join('\r\n')}\r\n`;
}
