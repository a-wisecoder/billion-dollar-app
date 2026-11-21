import { CURRENCIES, type CurrencyCode } from '../../features/cashflow/domain/subscription';

export interface FormatMoneyOptions {
  readonly showDecimals?: boolean;
  readonly compactWhole?: boolean;
}

function addThousandsSeparators(digits: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    const posFromRight = digits.length - i;
    out += digits[i];
    if (posFromRight > 1 && posFromRight % 3 === 1) {
      out += ',';
    }
  }
  return out;
}

/**
 * Formats integer minor units (e.g., 1499 -> "$14.99") with thousands separators.
 * Never performs floating-point arithmetic on currency values.
 */
export function formatMinorUnits(
  minorUnits: number,
  currency: CurrencyCode = 'USD',
  options: FormatMoneyOptions = {},
): string {
  const safeInt = Math.trunc(minorUnits);
  const isNegative = safeInt < 0;
  const abs = Math.abs(safeInt);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const symbol = CURRENCIES[currency].symbol;
  const sign = isNegative ? '-' : '';
  const wholeStr = addThousandsSeparators(String(whole));

  // For PKR, omit .00 decimals by default when compactWhole is requested or whole is large
  const hideDecimals =
    options.showDecimals === false ||
    (options.compactWhole === true && fraction === 0);

  if (hideDecimals && fraction === 0) {
    return `${sign}${symbol}${wholeStr}`;
  }
  if (options.showDecimals === false) {
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
