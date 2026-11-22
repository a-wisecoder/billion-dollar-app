import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { CurrencyCode } from '../domain/subscription';

interface RunwayCeilingCardProps {
  readonly activeMonthlyBaseMinorUnits: number;
  readonly monthlyCeilingMinorUnits: number;
  readonly monthlyIncomeMinorUnits?: number;
  readonly budgetUsageRatio: number;
  readonly baseCurrency: CurrencyCode;
  readonly onEditCeiling: () => void;
}

export const RunwayCeilingCard: React.FC<RunwayCeilingCardProps> = ({
  activeMonthlyBaseMinorUnits,
  monthlyCeilingMinorUnits,
  monthlyIncomeMinorUnits,
  budgetUsageRatio,
  baseCurrency,
  onEditCeiling,
}) => {
  const pct = Math.round(budgetUsageRatio * 100);
  const clampedPct = Math.min(100, Math.max(0, budgetUsageRatio * 100));

  const isOverBudget =
    monthlyCeilingMinorUnits > 0 && activeMonthlyBaseMinorUnits > monthlyCeilingMinorUnits;
  const isCloseToLimit =
    !isOverBudget &&
    monthlyCeilingMinorUnits > 0 &&
    activeMonthlyBaseMinorUnits * 100 >= monthlyCeilingMinorUnits * 85;

  const status = isOverBudget
    ? { label: 'Over budget', textClass: 'text-red-text', barClass: 'bg-red' }
    : isCloseToLimit
      ? { label: 'Close to limit', textClass: 'text-amber-text', barClass: 'bg-amber' }
      : { label: 'On track', textClass: 'text-brand-text', barClass: 'bg-brand' };

  const remainingMinorUnits = monthlyCeilingMinorUnits - activeMonthlyBaseMinorUnits;
  const incomeSharePct =
    monthlyIncomeMinorUnits && monthlyIncomeMinorUnits > 0
      ? ((activeMonthlyBaseMinorUnits / monthlyIncomeMinorUnits) * 100).toFixed(1)
      : null;

  return (
    <section className="rounded-2xl app-surface p-5" aria-label="Monthly budget">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-text-primary">Monthly budget</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            <span className={`font-semibold ${status.textClass}`}>{status.label}</span>
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">
              {remainingMinorUnits >= 0
                ? `${formatMinorUnits(remainingMinorUnits, baseCurrency, { showDecimals: false })} left`
                : `${formatMinorUnits(Math.abs(remainingMinorUnits), baseCurrency, { showDecimals: false })} over`}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onEditCeiling}
          aria-label="Edit monthly budget"
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-subtle border border-border hover:border-brand text-[13px] font-semibold text-text-primary flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
          <span>Adjust</span>
        </button>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2 tabular-nums text-[13px]">
        <span className="text-text-primary font-semibold">
          {formatMinorUnits(activeMonthlyBaseMinorUnits, baseCurrency, {
            showDecimals: baseCurrency !== 'PKR',
          })}
          <span className="text-text-secondary font-normal">
            {' '}
            / {formatMinorUnits(monthlyCeilingMinorUnits, baseCurrency, { showDecimals: false })}
          </span>
        </span>
        <span className={`font-semibold ${status.textClass}`}>{pct}%</span>
      </div>

      <div
        className="mt-2 h-2 w-full rounded-full bg-subtle overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.min(150, pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Monthly budget usage"
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${status.barClass}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      {incomeSharePct !== null && (
        <p className="mt-3 pt-3 border-t border-border text-[13px] text-text-secondary flex items-center justify-between gap-2">
          <span>Share of take-home income</span>
          <span className="tabular-nums font-semibold text-text-primary">
            {incomeSharePct}% of{' '}
            {formatMinorUnits(monthlyIncomeMinorUnits!, baseCurrency, { showDecimals: false })}
          </span>
        </p>
      )}
    </section>
  );
};
