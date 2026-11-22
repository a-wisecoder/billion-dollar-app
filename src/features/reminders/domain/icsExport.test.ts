import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIcs,
  buildRrule,
  escapeIcsText,
  foldIcsLine,
  triggerForLeadDays,
} from './icsExport';
import {
  createDefaultSettings,
  type Subscription,
} from '../../cashflow/domain/subscription';

const UTF8_ENCODER = new TextEncoder();

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_test_1',
    name: 'Netflix',
    amountMinorUnits: 1549,
    currency: 'USD',
    cycle: 'monthly',
    category: 'streaming',
    nextBillingDate: '2026-11-30',
    billingDay: 30,
    isFreeTrial: false,
    isSimulatedPaused: false,
    isArchived: false,
    notes: '',
    ...overrides,
  };
}

function unfoldIcs(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n');
}

describe('icsExport', () => {
  it('computes VALARM trigger math for 1, 2, and 3 lead days at 09:00 local time', () => {
    assert.equal(triggerForLeadDays(1), '-PT15H');
    assert.equal(triggerForLeadDays(2), '-PT39H');
    assert.equal(triggerForLeadDays(3), '-PT63H');
  });

  it('builds monthly on 31st RRULE with BYMONTHDAY=28,29,30,31;BYSETPOS=-1', () => {
    const sub = makeSub({
      id: 'sub_31',
      name: 'Cloud Pro',
      cycle: 'monthly',
      nextBillingDate: '2026-11-30',
      billingDay: 31,
    });
    assert.equal(buildRrule(sub), 'FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');

    const ics = buildIcs([sub], { ...createDefaultSettings(), reminderLeadDays: 2 }, '2026-11-20T10:00:00Z');
    const lines = unfoldIcs(ics);
    assert.ok(lines.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1'));
    assert.ok(lines.includes('DTSTART;VALUE=DATE:20261130'));
    assert.ok(lines.includes('DTEND;VALUE=DATE:20261201'));
    assert.ok(lines.includes('UID:sub_31@vaultflow'));
    assert.ok(lines.includes('TRIGGER:-PT39H'));
  });

  it('builds quarterly RRULE (standard and month-end day 30)', () => {
    const standard = makeSub({
      cycle: 'quarterly',
      nextBillingDate: '2026-12-15',
      billingDay: 15,
    });
    assert.equal(buildRrule(standard), 'FREQ=MONTHLY;INTERVAL=3');

    const monthEnd = makeSub({
      cycle: 'quarterly',
      nextBillingDate: '2026-11-30',
      billingDay: 30,
    });
    assert.equal(buildRrule(monthEnd), 'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=28,29,30;BYSETPOS=-1');
  });

  it('builds yearly RRULE on Feb 29 with BYMONTH=2 and BYMONTHDAY=28,29;BYSETPOS=-1', () => {
    const leapSub = makeSub({
      id: 'sub_leap',
      name: 'Domain Renewal',
      cycle: 'yearly',
      nextBillingDate: '2027-02-28',
      billingDay: 29,
    });
    assert.equal(buildRrule(leapSub), 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1');

    const regularYearly = makeSub({
      cycle: 'yearly',
      nextBillingDate: '2027-05-12',
      billingDay: 12,
    });
    assert.equal(buildRrule(regularYearly), 'FREQ=YEARLY;BYMONTH=5');
  });

  it('omits RRULE for free trials, uses trial summary, and adds a second alarm the day before', () => {
    const trialSub = makeSub({
      id: 'sub_trial',
      name: 'Cursor Pro',
      amountMinorUnits: 2000,
      currency: 'USD',
      cycle: 'monthly',
      nextBillingDate: '2026-11-28',
      billingDay: 28,
      isFreeTrial: true,
      cancelUrl: 'https://cursor.com/settings',
    });

    assert.equal(buildRrule(trialSub), null);

    const ics = buildIcs([trialSub], { ...createDefaultSettings(), reminderLeadDays: 3 }, '2026-11-20T12:00:00Z');
    const lines = unfoldIcs(ics);

    assert.ok(!lines.some((l) => l.startsWith('RRULE:')));
    assert.ok(lines.includes('SUMMARY:Cursor Pro free trial ends — cancel or pay $20.00'));
    const triggers = lines.filter((l) => l.startsWith('TRIGGER:'));
    assert.deepEqual(triggers, ['TRIGGER:-PT63H', 'TRIGGER:-PT15H']);
    assert.ok(lines.some((l) => l.includes('https://cursor.com/settings')));
  });

  it('excludes archived subscriptions and sets required VCALENDAR headers with CRLF endings', () => {
    const active = makeSub({ id: 'a1', name: 'Spotify', nextBillingDate: '2026-12-05', billingDay: 5 });
    const archived = makeSub({ id: 'a2', name: 'Old App', isArchived: true });

    const ics = buildIcs([active, archived], createDefaultSettings(), '2026-11-20T08:30:00Z');
    assert.ok(ics.endsWith('\r\n'));
    assert.ok(!ics.replace(/\r\n/g, '').includes('\n'), 'must only use CRLF line endings');

    const lines = unfoldIcs(ics);
    assert.ok(lines.includes('BEGIN:VCALENDAR'));
    assert.ok(lines.includes('VERSION:2.0'));
    assert.ok(lines.includes('PRODID:-//VaultFlow//EN'));
    assert.ok(lines.includes('CALSCALE:GREGORIAN'));
    assert.ok(lines.includes('X-WR-CALNAME:Subscription renewals'));
    assert.ok(lines.includes('UID:a1@vaultflow'));
    assert.ok(!lines.includes('UID:a2@vaultflow'));
  });

  it('escapes commas, semicolons, backslashes, and newlines per RFC 5545', () => {
    const escaped = escapeIcsText('Plan A, B; path\\to\\file\nLine 2');
    assert.equal(escaped, 'Plan A\\, B\\; path\\\\to\\\\file\\nLine 2');

    const sub = makeSub({
      name: 'Alpha, Beta; Team\\1',
      notes: 'First line\nSecond, line; done',
    });
    const ics = buildIcs([sub], createDefaultSettings(), '2026-11-20T08:00:00Z');
    const lines = unfoldIcs(ics);
    assert.ok(lines.some((l) => l.startsWith('SUMMARY:Alpha\\, Beta\\; Team\\\\1 renews')));
    assert.ok(lines.some((l) => l.includes('First line\\nSecond\\, line\\; done')));
  });

  it('folds lines longer than 75 UTF-8 octets without splitting multi-byte characters', () => {
    const longText = `DESCRIPTION:${'Renewals — €19.99 · '.repeat(10)}`;
    const folded = foldIcsLine(longText);
    const physicalLines = folded.split('\r\n');
    assert.ok(physicalLines.length > 2);

    for (let i = 0; i < physicalLines.length; i++) {
      const octets = UTF8_ENCODER.encode(physicalLines[i]).length;
      assert.ok(octets <= 75, `line ${i} exceeded 75 octets (${octets}): ${physicalLines[i]}`);
      if (i > 0) {
        assert.ok(physicalLines[i].startsWith(' '), `continuation line ${i} must start with space`);
      }
    }

    // Unfolding recovers the exact original string
    assert.equal(folded.replace(/\r\n /g, ''), longText);
  });
});
