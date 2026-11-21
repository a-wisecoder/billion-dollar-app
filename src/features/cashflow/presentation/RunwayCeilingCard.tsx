import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { CurrencyCode } from '../domain/subscription';

interface RunwayCeilingCardProps {
  readonly activeMonthlyBaseMinorUnits: number;
  readonly monthlyCeilingMinorUnits: number;
  readonly budgetUsageRatio: number;
  readonly baseCurrency: CurrencyCode;
  readonly onEditCeiling: () => void;
}

export const RunwayCeilingCard: React.FC<RunwayCeilingCardProps> = ({
  activeMonthlyBaseMinorUnits,
  monthlyCeilingMinorUnits,
  budgetUsageRatio,
  baseCurrency,
  onEditCeiling,
}) => {
  const pct = Math.round(budgetUsageRatio * 100);
  const clampedPct = Math.min(100, Math.max(0, budgetUsageRatio * 100));

  const status =
    budgetUsageRatio > 0.95
      ? { label: 'Over ceiling', color: '#EF4444' }
      : budgetUsageRatio > 0.75
        ? { label: 'Approaching ceiling', color: '#F59E0B' }
        : { label: 'Healthy runway', color: '#10B981' };

  const remainingMinorUnits = monthlyCeilingMinorUnits - activeMonthlyBaseMinorUnits;

  return (
    <section
      className="rounded-2xl bg-[#111623] border border-[#232D42] p-5"
      aria-label="Monthly runway ceiling"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#F8FAFC]">
            Monthly Runway Ceiling
          </h2>
          <p className="mt-1 text-xs text-[#94A3B8]">
            <span style={{ color: status.color }} className="font-semibold">
              {status.label}
            </span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">
              {remainingMinorUnits >= 0
                ? `${formatMinorUnits(remainingMinorUnits, baseCurrency, { showDecimals: false })} remaining`
                : `${formatMinorUnits(Math.abs(remainingMinorUnits), baseCurrency, { showDecimals: false })} over`}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onEditCeiling}
          aria-label="Edit monthly runway ceiling"
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-xs font-medium text-[#F8FAFC] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6366F1]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#94A3B8]" aria-hidden="true" />
          <span>Edit</span>
        </button>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2 font-mono tabular-nums text-xs">
        <span className="text-[#F8FAFC] font-semibold">
          {formatMinorUnits(activeMonthlyBaseMinorUnits, baseCurrency, {
            showDecimals: baseCurrency !== 'PKR',
          })}
          <span className="text-[#94A3B8] font-normal">
            {' '}
            / {formatMinorUnits(monthlyCeilingMinorUnits, baseCurrency, { showDecimals: false })}
          </span>
        </span>
        <span style={{ color: status.color }} className="font-semibold">
          {pct}%
        </span>
      </div>

      <div
        className="mt-2 h-2 w-full rounded-full bg-[#1A2234] overflow-hidden"
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
    </section>
  );
};
