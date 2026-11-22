import {
  CURRENCY_CODES,
  createDefaultExchangeRates,
  type CurrencyCode,
} from '../../features/cashflow/domain/subscription';

export const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';
export const EXCHANGE_RATE_ATTRIBUTION_URL = 'https://www.exchangerate-api.com';
export const EXCHANGE_RATE_STORAGE_KEY = 'vaultflow_exchange_rates_v1';
export const EXCHANGE_RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedExchangeRates {
  readonly rates: Record<CurrencyCode, number>;
  /** ISO-8601 UTC timestamp when rates were fetched */
  readonly fetchedAt: string;
}

export interface ExchangeRatesResolution {
  readonly rates: Record<CurrencyCode, number>;
  readonly fetchedAt: string | null;
  readonly source: 'live' | 'cache' | 'default';
  readonly didFetch: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SyncExchangeRatesOptions {
  readonly fetchImpl?: typeof fetch;
  readonly storage?: StorageLike | null;
  readonly nowMs?: number;
  readonly isOnline?: boolean;
  readonly forceRefresh?: boolean;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates that a rates map contains a finite positive number for every supported currency.
 * Returns a clean Record<CurrencyCode, number> or null if any required currency is invalid.
 */
export function validateRatesRecord(
  rawRates: unknown,
): Record<CurrencyCode, number> | null {
  if (!isRecord(rawRates)) return null;

  const validated = {} as Record<CurrencyCode, number>;
  for (const code of CURRENCY_CODES) {
    const val = rawRates[code];
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
      return null;
    }
    validated[code] = code === 'USD' ? 1 : val;
  }
  return validated;
}

export function loadCachedExchangeRates(
  storage: StorageLike | null = getDefaultStorage(),
): CachedExchangeRates | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(EXCHANGE_RATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== 'string') return null;
    const fetchedMs = Date.parse(parsed.fetchedAt);
    if (!Number.isFinite(fetchedMs)) return null;
    const rates = validateRatesRecord(parsed.rates);
    if (!rates) return null;
    return { rates, fetchedAt: parsed.fetchedAt };
  } catch {
    return null;
  }
}

export function saveCachedExchangeRates(
  payload: CachedExchangeRates,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(EXCHANGE_RATE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function isRatesCacheFresh(
  cached: CachedExchangeRates | null,
  nowMs: number = Date.now(),
): boolean {
  if (!cached) return false;
  const fetchedMs = Date.parse(cached.fetchedAt);
  if (!Number.isFinite(fetchedMs)) return false;
  const ageMs = nowMs - fetchedMs;
  return ageMs >= 0 && ageMs < EXCHANGE_RATE_CACHE_TTL_MS;
}

/**
 * Fetches live USD-anchored exchange rates at most once every 24 hours when online.
 * Validates `result === "success"` and that every rate is a finite positive number.
 * On failure or when offline, preserves the last good cached rates (or built-in defaults).
 */
export async function syncExchangeRates(
  options: SyncExchangeRatesOptions = {},
): Promise<ExchangeRatesResolution> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const nowMs = options.nowMs ?? Date.now();
  const isOnline =
    options.isOnline ??
    (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true);
  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);

  const cached = loadCachedExchangeRates(storage);
  const fallbackRates = cached?.rates ?? createDefaultExchangeRates();
  const fallbackSource: 'cache' | 'default' = cached ? 'cache' : 'default';

  if (!options.forceRefresh && isRatesCacheFresh(cached, nowMs)) {
    return {
      rates: cached!.rates,
      fetchedAt: cached!.fetchedAt,
      source: 'cache',
      didFetch: false,
    };
  }

  if (!isOnline || !fetchImpl) {
    return {
      rates: fallbackRates,
      fetchedAt: cached?.fetchedAt ?? null,
      source: fallbackSource,
      didFetch: false,
    };
  }

  try {
    const response = await fetchImpl(EXCHANGE_RATE_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return {
        rates: fallbackRates,
        fetchedAt: cached?.fetchedAt ?? null,
        source: fallbackSource,
        didFetch: true,
      };
    }

    const body: unknown = await response.json();
    if (!isRecord(body) || body.result !== 'success') {
      return {
        rates: fallbackRates,
        fetchedAt: cached?.fetchedAt ?? null,
        source: fallbackSource,
        didFetch: true,
      };
    }

    // Validate that every numeric rate returned by the API is positive and our supported set is complete
    if (!isRecord(body.rates)) {
      return {
        rates: fallbackRates,
        fetchedAt: cached?.fetchedAt ?? null,
        source: fallbackSource,
        didFetch: true,
      };
    }
    for (const val of Object.values(body.rates)) {
      if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
        return {
          rates: fallbackRates,
          fetchedAt: cached?.fetchedAt ?? null,
          source: fallbackSource,
          didFetch: true,
        };
      }
    }

    const validatedRates = validateRatesRecord(body.rates);
    if (!validatedRates) {
      return {
        rates: fallbackRates,
        fetchedAt: cached?.fetchedAt ?? null,
        source: fallbackSource,
        didFetch: true,
      };
    }

    const fetchedAt = new Date(nowMs).toISOString();
    saveCachedExchangeRates({ rates: validatedRates, fetchedAt }, storage);

    return {
      rates: validatedRates,
      fetchedAt,
      source: 'live',
      didFetch: true,
    };
  } catch {
    return {
      rates: fallbackRates,
      fetchedAt: cached?.fetchedAt ?? null,
      source: fallbackSource,
      didFetch: true,
    };
  }
}

/** Formats a fetchedAt ISO timestamp into a concise local date string (e.g., "Nov 21, 2026"). */
export function formatRatesDate(fetchedAt: string | null): string | null {
  if (!fetchedAt) return null;
  const ms = Date.parse(fetchedAt);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms));
}
