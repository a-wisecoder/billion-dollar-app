import assert from 'node:assert/strict';
import test from 'node:test';
import type { Subscription } from '../../cashflow/domain/subscription';
import { normalizeMerchantText, parseStatementImport } from './statementImport';

function makeSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub_1',
    name: 'Test Service',
    amountMinorUnits: 1000,
    currency: 'USD',
    cycle: 'monthly',
    category: 'other',
    nextBillingDate: '2026-11-25',
    billingDay: 25,
    isFreeTrial: false,
    isSimulatedPaused: false,
    isArchived: false,
    notes: '',
    ...overrides,
  };
}

test('Fixture (a): 3-month CSV extracts exactly Netflix, Spotify, ChatGPT, and Gym while filtering groceries, fuel, ATM, and salary', () => {
  const csv = [
    'Date,Description,Debit,Credit',
    '2026-09-05,NETFLIX.COM LOS GATOS CA,15.49,',
    '2026-09-10,PAYPAL *SPOTIFY USA,11.99,',
    '2026-09-12,WHOLE FOODS GROCERY MART,84.20,',
    '2026-09-14,SHELL PETROL STATION,45.00,',
    '2026-09-18,OPENAI *CHATGPT SUBSCR,20.00,',
    '2026-09-20,ATM CASH WITHDRAWAL,100.00,',
    '2026-09-22,IRONWORKS GYM,38.00,',
    '2026-09-30,EMPLOYER SALARY DEPOSIT,,4500.00',
    '2026-10-05,NETFLIX.COM LOS GATOS CA,15.49,',
    '2026-10-10,PAYPAL *SPOTIFY USA,11.99,',
    '2026-10-12,CARREFOUR GROCERY,92.10,',
    '2026-10-15,PSO FUEL STATION,38.50,',
    '2026-10-18,OPENAI *CHATGPT SUBSCR,20.00,',
    '2026-10-22,IRONWORKS GYM,38.00,',
    '2026-10-30,EMPLOYER SALARY DEPOSIT,,4500.00',
    '2026-11-05,NETFLIX.COM LOS GATOS CA,17.99,',
    '2026-11-10,PAYPAL *SPOTIFY USA,11.99,',
    '2026-11-18,OPENAI *CHATGPT SUBSCR,20.00,',
    '2026-11-22,IRONWORKS GYM,38.00,',
  ].join('\n');

  const result = parseStatementImport(csv, [], {
    todayIso: '2026-11-21',
    defaultCurrency: 'USD',
  });

  assert.equal(result.subscriptions.length, 4);
  assert.equal(result.oneOffCharges.length, 0);

  const byName = new Map(result.subscriptions.map((s) => [s.name, s]));

  const netflix = byName.get('Netflix');
  assert.ok(netflix);
  assert.equal(netflix.cycle, 'monthly');
  assert.equal(netflix.confidence, 'high');
  assert.equal(netflix.amountMinorUnits, 1799);
  assert.equal(netflix.previousAmountMinorUnits, 1549);
  assert.equal(netflix.startDate, '2026-09-05');
  assert.equal(netflix.lastChargeDate, '2026-11-05');
  assert.equal(netflix.nextBillingDate, '2026-12-05');
  assert.equal(netflix.billingDay, 5);

  const spotify = byName.get('Spotify');
  assert.ok(spotify);
  assert.equal(spotify.cycle, 'monthly');
  assert.equal(spotify.category, 'music');
  assert.equal(spotify.confidence, 'high');
  assert.equal(spotify.amountMinorUnits, 1199);
  assert.equal(spotify.startDate, '2026-09-10');
  assert.equal(spotify.nextBillingDate, '2026-12-10');

  const chatgpt = byName.get('ChatGPT Plus');
  assert.ok(chatgpt);
  assert.equal(chatgpt.cycle, 'monthly');
  assert.equal(chatgpt.category, 'aiAndCloud');
  assert.equal(chatgpt.confidence, 'high');
  assert.equal(chatgpt.amountMinorUnits, 2000);
  assert.equal(chatgpt.startDate, '2026-09-18');
  assert.equal(chatgpt.nextBillingDate, '2026-12-18');

  const gym = byName.get('Ironworks Gym');
  assert.ok(gym);
  assert.equal(gym.cycle, 'monthly');
  assert.equal(gym.category, 'health');
  assert.equal(gym.confidence, 'high');
  assert.equal(gym.amountMinorUnits, 3800);
  assert.equal(gym.startDate, '2026-09-22');
  assert.equal(gym.nextBillingDate, '2026-12-22');
});

test('Fixture (b): Pakistani card SMS text extracts ChatGPT Plus in PKR with exact date and next renewal', () => {
  const sms =
    'PKR 5,850.00 charged on card ending 1234 at OPENAI *CHATGPT SUBSCR on 18-11-2026';

  const result = parseStatementImport(sms, [], {
    todayIso: '2026-11-21',
    defaultCurrency: 'PKR',
    preferredDateOrder: 'DMY',
  });

  assert.equal(result.subscriptions.length, 1);
  const sub = result.subscriptions[0];
  assert.equal(sub.name, 'ChatGPT Plus');
  assert.equal(sub.catalogId, 'chatgpt-plus');
  assert.equal(sub.amountMinorUnits, 585000);
  assert.equal(sub.currency, 'PKR');
  assert.equal(sub.cycle, 'monthly');
  assert.equal(sub.confidence, 'likely');
  assert.equal(sub.lastChargeDate, '2026-11-18');
  assert.equal(sub.nextBillingDate, '2026-12-18');
  assert.equal(sub.billingDay, 18);
  assert.equal(sub.startDate, '2026-11-18');
  assert.equal(sub.dateEstimated, false);
});

test('Fixture (c): US CSV with MM/DD dates auto-switches date order and parses dates accurately', () => {
  const usCsv = [
    'Transaction Date;Merchant;Amount',
    '09/25/2026;"CLAUDE.AI SAN FRANCISCO CA";-20.00',
    '10/25/2026;"CLAUDE.AI SAN FRANCISCO CA";-20.00',
    '10/05/2026;"NOTION LABS INC";-10.00',
    '11/05/2026;"NOTION LABS INC";-10.00',
    '10/15/2026;"EMPLOYER DIRECT DEPOSIT";3200.00',
  ].join('\n');

  // Even if preferredDateOrder starts as DMY, 09/25 proves MDY and auto-switches!
  const result = parseStatementImport(usCsv, [], {
    todayIso: '2026-11-21',
    defaultCurrency: 'USD',
    preferredDateOrder: 'DMY',
  });

  assert.equal(result.detectedDateOrder, 'MDY');
  assert.equal(result.dateOrderAutoSwitched, true);
  assert.equal(result.subscriptions.length, 2);

  const claude = result.subscriptions.find((s) => s.catalogId === 'claude-pro');
  assert.ok(claude);
  assert.equal(claude.amountMinorUnits, 2000);
  assert.equal(claude.cycle, 'monthly');
  assert.equal(claude.confidence, 'high');
  assert.equal(claude.startDate, '2026-09-25');
  assert.equal(claude.lastChargeDate, '2026-10-25');
  assert.equal(claude.nextBillingDate, '2026-11-25');
  assert.equal(claude.billingDay, 25);

  const notion = result.subscriptions.find((s) => s.catalogId === 'notion');
  assert.ok(notion);
  assert.equal(notion.amountMinorUnits, 1000);
  assert.equal(notion.cycle, 'monthly');
  assert.equal(notion.confidence, 'high');
  assert.equal(notion.startDate, '2026-10-05');
  assert.equal(notion.lastChargeDate, '2026-11-05');
  assert.equal(notion.nextBillingDate, '2026-12-05');
  assert.equal(notion.billingDay, 5);
});

test('Statement Import V2 supports all date formats, one-off grouping, variable bill filtering, and exact-only existing matches', () => {
  const existing: Subscription[] = [
    makeSub({
      id: 'ex_chatgpt',
      name: 'ChatGPT Plus',
      catalogId: 'chatgpt-plus',
      amountMinorUnits: 1800,
      currency: 'USD',
    }),
    makeSub({
      id: 'ex_cloud',
      name: 'Cloud',
      amountMinorUnits: 500,
      currency: 'USD',
    }),
  ];

  const lines = [
    '18/11/2026 NETFLIX.COM PKR 1,100.00',
    '14-Nov-2026 NOTION PLUS $10.00',
    '03-Nov-26 ICLOUD+ $2.99',
    'Nov 19, 2026 OPENAI *CHATGPT $20.00',
    '2026-11-12 LOCAL BOOKSHOP $24.50',
    '2026-09-10 CITY ELECTRIC BILL $45.00',
    '2026-10-10 CITY ELECTRIC BILL $98.00',
    '2026-11-10 CITY ELECTRIC BILL $62.00',
    'IBFT TRANSFER TO ALI PKR 15,000.00',
    'RAAST PAYMENT TO AHMED PKR 8,500.00',
  ].join('\n');

  const result = parseStatementImport(lines, existing, {
    todayIso: '2026-11-21',
    defaultCurrency: 'USD',
    preferredDateOrder: 'DMY',
  });

  // 4 catalog matches (Netflix, Notion, iCloud+, ChatGPT Plus); Electric bill skipped (variable >15%); IBFT & RAAST skipped
  assert.equal(result.subscriptions.length, 4);
  // Local Bookshop is single unknown -> collapsed oneOffCharges, category 'other'
  assert.equal(result.oneOffCharges.length, 1);
  assert.equal(result.oneOffCharges[0].name, 'Local Bookshop');
  assert.equal(result.oneOffCharges[0].category, 'other');

  const chatgpt = result.subscriptions.find((s) => s.catalogId === 'chatgpt-plus');
  assert.ok(chatgpt);
  assert.equal(chatgpt.matchedExistingId, 'ex_chatgpt');
  assert.equal(chatgpt.detectedPriceHikeMinorUnits, 200);

  // iCloud+ must NOT loosely match existing subscription named "Cloud"
  const icloud = result.subscriptions.find((s) => s.catalogId === 'icloud-plus');
  assert.ok(icloud);
  assert.equal(icloud.matchedExistingId, null);
  assert.equal(icloud.nextBillingDate, '2026-12-03');

  const notion = result.subscriptions.find((s) => s.catalogId === 'notion');
  assert.ok(notion);
  assert.equal(notion.nextBillingDate, '2026-12-14');

  // Verify merchant normalization strips processor prefixes and noise
  assert.equal(normalizeMerchantText('SQ *BLUE BOTTLE POS PURCHASE US').displayName, 'Blue Bottle');
});
