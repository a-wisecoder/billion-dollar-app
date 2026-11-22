import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { Button, MoneyFigure } from '../../../core/ui/primitives';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { ZERO_DECIMAL_DISPLAY_CURRENCIES, type CurrencyCode } from '../domain/subscription';

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
  const showDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(baseCurrency);

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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-bold tracking-tight text-text-primary">
            Monthly budget
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            <span className={`font-semibold ${status.textClass}`}>{status.label}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums text-text-primary font-semibold">
              {formatMinorUnits(Math.abs(remainingMinorUnits), baseCurrency, { showDecimals: false })}
            </span>{' '}
            <span>{remainingMinorUnits >= 0 ? 'left' : 'over'}</span>
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onEditCeiling}
          aria-label="Edit monthly budget"
          data-testid="edit-budget-button"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
          <span>Adjust</span>
        </Button>
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="min-w-0 truncate">
          <MoneyFigure
            value={formatMinorUnits(activeMonthlyBaseMinorUnits, baseCurrency, { showDecimals })}
            className="text-[15px] font-bold text-text-primary"
          />
          <span className="font-mono tabular-nums text-text-secondary font-medium ml-1.5">
            / {formatMinorUnits(monthlyCeilingMinorUnits, baseCurrency, { showDecimals: false })}
          </span>
        </span>
        <span className={`font-mono tabular-nums text-[13px] font-bold shrink-0 ${status.textClass}`}>
          {pct}%
        </span>
      </div>

      {/* Precision Runway Bar with 85% threshold notch */}
      <div
        className="relative mt-2.5 h-2.5 w-full rounded-full bg-subtle overflow-hidden ring-1 ring-inset ring-border/70"
        role="progressbar"
        aria-valuenow={Math.min(150, pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Monthly budget usage"
      >
        <motion.div
          initial={false}
          animate={{ width: `${clampedPct}%` }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${status.barClass}`}
        />
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-[85%] w-[1.5px] bg-card/90"
        />
      </div>

      {incomeSharePct !== null && (
        <p className="mt-4 pt-3.5 border-t border-border/80 text-[13px] text-text-secondary flex items-center justify-between gap-2">
          <span>Share of take-home income</span>
          <span className="font-mono tabular-nums font-semibold text-text-primary">
            {incomeSharePct}% of{' '}
            {formatMinorUnits(monthlyIncomeMinorUnits!, baseCurrency, { showDecimals: false })}
          </span>
        </p>
      )}
    </section>
  );
};
