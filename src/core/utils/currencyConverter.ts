import type { CurrencyCode } from '../../features/cashflow/domain/subscription';

/**
 * Converts integer minor units from one currency to another using USD-anchored
 * offline exchange rates, returning exact integer minor units.
 */
export function convertMinorUnits(
  amountMinorUnits: number,
  from: CurrencyCode,
  to: CurrencyCode,
  ratesPerUsd: Record<CurrencyCode, number>,
): number {
  const safeAmount = Math.trunc(amountMinorUnits);
  if (from === to || safeAmount === 0) return safeAmount;

  const fromRate = ratesPerUsd[from];
  const toRate = ratesPerUsd[to];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) {
    return safeAmount;
  }

  return Math.round((safeAmount * toRate) / fromRate);
}
