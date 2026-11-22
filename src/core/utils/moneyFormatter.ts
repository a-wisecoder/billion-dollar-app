import { CURRENCIES, type CurrencyCode } from '../../features/cashflow/domain/subscription';

export interface FormatMoneyOptions {
  readonly showDecimals?: boolean;
  readonly compactWhole?: boolean;
}

const symbolCache = new Map<CurrencyCode, string>();
const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/**
 * Resolves currency display symbol via Intl.NumberFormat while keeping familiar
 * short prefixes (like "Rs " for PKR) and readable spacing after letter codes.
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  const cached = symbolCache.get(currency);
  if (cached) return cached;

  // Preserve familiar local prefix for PKR and currencies where Intl prints bare ISO code without space
  if (currency === 'PKR') {
    symbolCache.set(currency, 'Rs ');
    return 'Rs ';
  }

  let resolved = CURRENCIES[currency]?.symbol ?? `${currency} `;
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const currencyPart = parts.find((p) => p.type === 'currency')?.value;
    if (currencyPart) {
      // Distinguish non-US dollar codes when narrowSymbol collapses them to bare "$"
      if (currencyPart === '$' && currency !== 'USD') {
        resolved = CURRENCIES[currency].symbol;
      } else if (/^[A-Za-z.]+$/.test(currencyPart)) {
        resolved = `${currencyPart} `;
      } else {
        resolved = currencyPart;
      }
    }
  } catch {
    resolved = CURRENCIES[currency]?.symbol ?? `${currency} `;
  }

  symbolCache.set(currency, resolved);
  return resolved;
}

function formatWholeInteger(whole: number): string {
  return integerFormatter.format(whole);
}

/**
 * Formats integer minor units (e.g., 1499 -> "$14.99") using Intl.NumberFormat
 * for symbols and grouping separators while keeping strict integer minor-unit math.
 */
export function formatMinorUnits(
  minorUnits: number,
  currency: CurrencyCode = 'USD',
  options: FormatMoneyOptions = {},
): string {
  const safeInt = Math.trunc(minorUnits);
  const isNegative = safeInt < 0;
  const abs = Math.abs(safeInt);
  const symbol = getCurrencySymbol(currency);

  if (options.showDecimals === false) {
    const roundedWhole = Math.floor((abs + 50) / 100);
    const sign = isNegative && roundedWhole > 0 ? '-' : '';
    const wholeStr = formatWholeInteger(roundedWhole);
    return `${sign}${symbol}${wholeStr}`;
  }

  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const sign = isNegative ? '-' : '';
  const wholeStr = formatWholeInteger(whole);

  if (options.compactWhole === true && fraction === 0) {
    return `${sign}${symbol}${wholeStr}`;
  }

  const fracStr = String(fraction).padStart(2, '0');
  return `${sign}${symbol}${wholeStr}.${fracStr}`;
}

/**
 * Parses a human decimal string (e.g. "19.99", "20", "1,250.5") strictly into
 * integer minor units without floating-point precision drift.
 * Returns null for empty, negative, zero, or malformed strings.
 */
export function parseDecimalToMinorUnits(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return null;
  if (!/^\d+(?:\.\d{0,2})?$/.test(cleaned)) return null;

  const [wholePart, fracPart = ''] = cleaned.split('.');
  const whole = Number.parseInt(wholePart, 10);
  if (!Number.isSafeInteger(whole)) return null;

  const paddedFrac = fracPart.padEnd(2, '0');
  const frac = Number.parseInt(paddedFrac, 10);
  const total = whole * 100 + frac;

  if (!Number.isSafeInteger(total) || total <= 0) return null;
  return total;
}

/** Formats integer minor units into an editable input string (e.g. 1999 -> "19.99"). */
export function minorUnitsToInputString(minorUnits: number): string {
  const abs = Math.abs(Math.trunc(minorUnits));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0')}`;
}

/**
 * Formats integer minor units into a compact label for tight cells (e.g. "$38", "Rs 5.8k").
 * Uses integer half-up rounding with no floating-point currency accumulation.
 */
export function formatCompactMinorUnits(
  minorUnits: number,
  currency: CurrencyCode = 'USD',
): string {
  const safeInt = Math.trunc(minorUnits);
  const isNegative = safeInt < 0;
  const abs = Math.abs(safeInt);
  const symbol = getCurrencySymbol(currency);
  const roundedWhole = Math.floor((abs + 50) / 100);
  const sign = isNegative && roundedWhole > 0 ? '-' : '';

  if (roundedWhole >= 1_000_000) {
    const tenthsMillions = Math.floor((roundedWhole + 50_000) / 100_000);
    const major = Math.floor(tenthsMillions / 10);
    const decimal = tenthsMillions % 10;
    return `${sign}${symbol}${decimal === 0 ? String(major) : `${major}.${decimal}`}M`;
  }

  if (roundedWhole >= 1_000) {
    const tenthsThousands = Math.floor((roundedWhole + 50) / 100);
    const major = Math.floor(tenthsThousands / 10);
    const decimal = tenthsThousands % 10;
    return `${sign}${symbol}${decimal === 0 ? String(major) : `${major}.${decimal}`}k`;
  }

  return `${sign}${symbol}${roundedWhole}`;
}
