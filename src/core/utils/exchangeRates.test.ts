import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertMinorUnits } from './currencyConverter';
import {
  EXCHANGE_RATE_CACHE_TTL_MS,
  loadCachedExchangeRates,
  saveCachedExchangeRates,
  syncExchangeRates,
  type StorageLike,
} from './exchangeRates';
import {
  CURRENCY_CODES,
  createDefaultExchangeRates,
  createDefaultSettings,
  getEffectiveExchangeRates,
} from '../../features/cashflow/domain/subscription';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

function buildValidRatesPayload(overrides: Partial<Record<string, number>> = {}) {
  const rates: Record<string, number> = { ...createDefaultExchangeRates(), ...overrides };
  return {
    result: 'success',
    base_code: 'USD',
    rates,
  };
}

describe('currencyConverter with card foreign-currency markup', () => {
  it('applies foreign-currency card markup when converting between different currencies', () => {
    const rates = { ...createDefaultExchangeRates(), PKR: 280 };
    // $20.00 -> 5,600 PKR without markup
    assert.equal(convertMinorUnits(2000, 'USD', 'PKR', rates, 0), 560000);
    // $20.00 -> 5,600 * 1.03 = 5,768 PKR with 3% card markup
    assert.equal(convertMinorUnits(2000, 'USD', 'PKR', rates, 3), 576800);
    // Same-currency billing ignores foreign-currency card markup
    assert.equal(convertMinorUnits(2000, 'USD', 'USD', rates, 5), 2000);
  });

  it('prefers offline custom rate override via getEffectiveExchangeRates', () => {
    const settings = {
      ...createDefaultSettings(),
      exchangeRatesPerUsd: { ...createDefaultExchangeRates(), PKR: 278.5 },
      customExchangeRates: { PKR: 290 },
    };
    const effective = getEffectiveExchangeRates(settings);
    assert.equal(effective.PKR, 290);
    assert.equal(effective.USD, 1);
  });
});

describe('syncExchangeRates', () => {
  it('fetches and caches validated rates when no cache exists', async () => {
    const storage = createMemoryStorage();
    let fetchCalls = 0;
    const mockFetch = (async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify(buildValidRatesPayload({ PKR: 281.25, INR: 84.5 })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const nowMs = Date.parse('2026-11-21T10:00:00.000Z');
    const result = await syncExchangeRates({
      fetchImpl: mockFetch,
      storage,
      nowMs,
      isOnline: true,
    });

    assert.equal(fetchCalls, 1);
    assert.equal(result.source, 'live');
    assert.equal(result.didFetch, true);
    assert.equal(result.rates.PKR, 281.25);
    assert.equal(result.rates.INR, 84.5);
    assert.equal(result.fetchedAt, '2026-11-21T10:00:00.000Z');

    const cached = loadCachedExchangeRates(storage);
    assert.ok(cached);
    assert.equal(cached.rates.PKR, 281.25);
    assert.equal(Object.keys(cached.rates).length, CURRENCY_CODES.length);
  });

  it('keeps old cached rates when fetch fails or returns invalid data', async () => {
    const storage = createMemoryStorage();
    const oldRates = { ...createDefaultExchangeRates(), PKR: 277.4 };
    const staleFetchedAt = '2026-11-19T08:00:00.000Z';
    saveCachedExchangeRates({ rates: oldRates, fetchedAt: staleFetchedAt }, storage);

    const failingFetch = (async () => {
      throw new Error('Network offline');
    }) as typeof fetch;

    const nowMs = Date.parse('2026-11-21T10:00:00.000Z');
    const failedResult = await syncExchangeRates({
      fetchImpl: failingFetch,
      storage,
      nowMs,
      isOnline: true,
    });

    assert.equal(failedResult.source, 'cache');
    assert.equal(failedResult.rates.PKR, 277.4);
    assert.equal(failedResult.fetchedAt, staleFetchedAt);

    // Also reject responses with negative or non-finite rates
    const corruptFetch = (async () => {
      return new Response(JSON.stringify(buildValidRatesPayload({ PKR: -5 })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const corruptResult = await syncExchangeRates({
      fetchImpl: corruptFetch,
      storage,
      nowMs,
      isOnline: true,
    });

    assert.equal(corruptResult.source, 'cache');
    assert.equal(corruptResult.rates.PKR, 277.4);
    assert.equal(corruptResult.fetchedAt, staleFetchedAt);
  });

  it('skips network fetch when cache is fresh and refetches once cache is stale (>24h)', async () => {
    const storage = createMemoryStorage();
    const initialMs = Date.parse('2026-11-20T09:00:00.000Z');
    const cachedRates = { ...createDefaultExchangeRates(), PKR: 279.0 };
    saveCachedExchangeRates(
      { rates: cachedRates, fetchedAt: new Date(initialMs).toISOString() },
      storage,
    );

    let fetchCalls = 0;
    const mockFetch = (async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify(buildValidRatesPayload({ PKR: 282.5 })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    // 12 hours later -> fresh cache, no fetch
    const freshResult = await syncExchangeRates({
      fetchImpl: mockFetch,
      storage,
      nowMs: initialMs + 12 * 60 * 60 * 1000,
      isOnline: true,
    });
    assert.equal(fetchCalls, 0);
    assert.equal(freshResult.didFetch, false);
    assert.equal(freshResult.source, 'cache');
    assert.equal(freshResult.rates.PKR, 279.0);

    // 24 hours + 1 minute later -> stale cache triggers refetch
    const staleResult = await syncExchangeRates({
      fetchImpl: mockFetch,
      storage,
      nowMs: initialMs + EXCHANGE_RATE_CACHE_TTL_MS + 60_000,
      isOnline: true,
    });
    assert.equal(fetchCalls, 1);
    assert.equal(staleResult.didFetch, true);
    assert.equal(staleResult.source, 'live');
    assert.equal(staleResult.rates.PKR, 282.5);
  });
});
