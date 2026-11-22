import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getComingUpReminders,
  markNotifiedForDate,
  selectUnnotifiedReminders,
  type ReminderStorageLike,
} from './reminderEngine';
import type { Subscription } from '../../cashflow/domain/subscription';

function createMemoryStorage(): ReminderStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function makeSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub_1',
    name: 'Netflix',
    amountMinorUnits: 1549,
    currency: 'USD',
    cycle: 'monthly',
    category: 'streaming',
    nextBillingDate: '2026-11-21',
    isFreeTrial: false,
    isSimulatedPaused: false,
    isArchived: false,
    notes: '',
    ...overrides,
  };
}

describe('reminderEngine', () => {
  it('selects active subscriptions within leadDays and free trials within 3 days', () => {
    const subs: Subscription[] = [
      makeSub({ id: 'due_1d', name: 'Spotify', nextBillingDate: '2026-11-21' }),
      makeSub({ id: 'due_2d', name: 'iCloud+', nextBillingDate: '2026-11-22' }),
      makeSub({ id: 'trial_3d', name: 'Cursor Pro', nextBillingDate: '2026-11-23', isFreeTrial: true }),
      makeSub({ id: 'trial_4d', name: 'Too Far Trial', nextBillingDate: '2026-11-24', isFreeTrial: true }),
      makeSub({ id: 'archived', name: 'Archived', nextBillingDate: '2026-11-20', isArchived: true }),
      makeSub({ id: 'paused', name: 'Paused', nextBillingDate: '2026-11-20', isSimulatedPaused: true }),
    ];

    const reminders = getComingUpReminders(subs, { reminderLeadDays: 1 }, '2026-11-20');
    assert.deepEqual(
      reminders.map((r) => r.subscription.id),
      ['due_1d', 'trial_3d'],
    );
    assert.equal(reminders[0].title, 'Spotify renews tomorrow');
    assert.equal(reminders[1].title, 'Cursor Pro trial ends in 3 days');
  });

  it('deduplicates browser notifications to at most once per subscription per day', () => {
    const storage = createMemoryStorage();
    const subs = [
      makeSub({ id: 's1', name: 'Netflix', nextBillingDate: '2026-11-21' }),
      makeSub({ id: 's2', name: 'Spotify', nextBillingDate: '2026-11-20' }),
    ];
    const reminders = getComingUpReminders(subs, { reminderLeadDays: 2 }, '2026-11-20');

    const firstPass = selectUnnotifiedReminders(reminders, '2026-11-20', storage);
    assert.equal(firstPass.length, 2);

    markNotifiedForDate(
      firstPass.map((r) => r.subscription.id),
      '2026-11-20',
      storage,
    );

    const secondPassSameDay = selectUnnotifiedReminders(reminders, '2026-11-20', storage);
    assert.equal(secondPassSameDay.length, 0);

    // Next calendar day resets deduplication
    const nextDayReminders = getComingUpReminders(subs, { reminderLeadDays: 2 }, '2026-11-21');
    const nextDayPass = selectUnnotifiedReminders(nextDayReminders, '2026-11-21', storage);
    assert.deepEqual(
      nextDayPass.map((r) => r.subscription.id),
      ['s1'],
    );
  });
});
