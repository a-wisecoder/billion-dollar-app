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

  const status =
    budgetUsageRatio > 0.95
      ? { label: 'Over ceiling', color: '#C64545' }
      : budgetUsageRatio > 0.75
        ? { label: 'Approaching ceiling', color: '#B86A14' }
        : { label: 'Healthy runway', color: '#1E7E5F' };

  const remainingMinorUnits = monthlyCeilingMinorUnits - activeMonthlyBaseMinorUnits;
  const incomeSharePct =
    monthlyIncomeMinorUnits && monthlyIncomeMinorUnits > 0
      ? ((activeMonthlyBaseMinorUnits / monthlyIncomeMinorUnits) * 100).toFixed(1)
      : null;

  return (
    <section
      className="rounded-2xl vault-surface p-5"
      aria-label="Monthly runway ceiling"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#17211E]">
            Monthly Runway Ceiling
          </h2>
          <p className="mt-1 text-xs text-[#5B6662]">
            <span style={{ color: status.color }} className="font-semibold">
              {status.label}
            </span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">
              {remainingMinorUnits >= 0
                ? `${formatMinorUnits(remainingMinorUnits, baseCurrency, { showDecimals: false })} left`
                : `${formatMinorUnits(Math.abs(remainingMinorUnits), baseCurrency, { showDecimals: false })} over`}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onEditCeiling}
          aria-label="Edit monthly runway ceiling"
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E6B58]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
          <span>Adjust</span>
        </button>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2 font-mono tabular-nums text-xs">
        <span className="text-[#17211E] font-semibold">
          {formatMinorUnits(activeMonthlyBaseMinorUnits, baseCurrency, {
            showDecimals: baseCurrency !== 'PKR',
          })}
          <span className="text-[#5B6662] font-normal">
            {' '}
            / {formatMinorUnits(monthlyCeilingMinorUnits, baseCurrency, { showDecimals: false })}
          </span>
        </span>
        <span style={{ color: status.color }} className="font-semibold">
          {pct}%
        </span>
      </div>

      <div
        className="mt-2 h-2 w-full rounded-full bg-[#EEF1EC] overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.min(150, pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Monthly runway utilization"
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300 ease-out"
          style={{
            width: `${clampedPct}%`,
            backgroundColor: status.color,
          }}
        />
      </div>

      {incomeSharePct !== null && (
        <p className="mt-3 pt-3 border-t border-[#EEF1EC] text-xs text-[#5B6662] flex items-center justify-between gap-2">
          <span>Share of take-home income</span>
          <span className="font-mono tabular-nums font-semibold text-[#17211E]">
            {incomeSharePct}% of{' '}
            {formatMinorUnits(monthlyIncomeMinorUnits!, baseCurrency, { showDecimals: false })}
          </span>
        </p>
      )}
    </section>
  );
};
