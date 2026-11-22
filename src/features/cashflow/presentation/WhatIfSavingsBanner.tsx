import React from 'react';
import { Archive, RotateCcw, Sparkles } from 'lucide-react';
import { useAnimatedNumber } from '../../../core/hooks/useAnimatedNumber';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { CurrencyCode } from '../domain/subscription';

interface WhatIfSavingsBannerProps {
  readonly annualSavingsBaseMinorUnits: number;
  readonly simulatedCount: number;
  readonly baseCurrency: CurrencyCode;
  readonly onReset: () => void;
  readonly onCommitArchive: () => void;
}

export const WhatIfSavingsBanner: React.FC<WhatIfSavingsBannerProps> = ({
  annualSavingsBaseMinorUnits,
  simulatedCount,
  baseCurrency,
  onReset,
  onCommitArchive,
}) => {
  const animatedSavings = useAnimatedNumber(annualSavingsBaseMinorUnits);

  if (simulatedCount === 0 || annualSavingsBaseMinorUnits <= 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="what-if-savings-banner"
      className="rounded-2xl bg-brand-soft border border-brand-border px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-card border border-brand-border flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-brand-text" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] sm:text-sm font-bold text-brand-text tabular-nums">
            You&apos;d save +
            {formatMinorUnits(animatedSavings, baseCurrency, {
              showDecimals: baseCurrency !== 'PKR',
            })}
            /yr
          </p>
          <p className="text-[13px] text-text-secondary">
            Testing cancellation on {simulatedCount}{' '}
            {simulatedCount === 1 ? 'subscription' : 'subscriptions'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onReset}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-card border border-brand-border hover:border-brand text-[13px] font-semibold text-text-primary flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
          <span>Reset</span>
        </button>
        <button
          type="button"
          onClick={onCommitArchive}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-[13px] font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Mark as cancelled</span>
        </button>
      </div>
    </div>
  );
};
