import type { CurrencyCode } from '../../features/cashflow/domain/subscription';

/**
 * Converts integer minor units from one currency to another using USD-anchored
 * exchange rates, optionally applying a foreign-currency card markup percentage (0–10%)
 * when `from !== to`. Returns exact integer minor units.
 */
export function convertMinorUnits(
  amountMinorUnits: number,
  from: CurrencyCode,
  to: CurrencyCode,
  ratesPerUsd: Record<CurrencyCode, number>,
  cardMarkupPercent: number = 0,
): number {
  const safeAmount = Math.trunc(amountMinorUnits);
  if (from === to || safeAmount === 0) return safeAmount;

  const fromRate = ratesPerUsd[from];
  const toRate = ratesPerUsd[to];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) {
    return safeAmount;
  }

  const clampedMarkup =
    Number.isFinite(cardMarkupPercent) && cardMarkupPercent > 0
      ? Math.min(10, cardMarkupPercent)
      : 0;
  const markupBps = Math.round(clampedMarkup * 100); // e.g., 3.5% -> 350 bps

  return Math.round((safeAmount * toRate * (10_000 + markupBps)) / (fromRate * 10_000));
}
