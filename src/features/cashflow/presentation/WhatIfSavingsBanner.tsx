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
      className="rounded-2xl bg-[#10B981]/12 border border-[#10B981]/40 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#10B981]/18 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#10B981] font-mono tabular-nums">
            What-If Savings Unlocked: +
            {formatMinorUnits(animatedSavings, baseCurrency, {
              showDecimals: baseCurrency !== 'PKR',
            })}
            /yr
          </p>
          <p className="text-xs text-[#94A3B8]">
            Simulating pause on {simulatedCount}{' '}
            {simulatedCount === 1 ? 'subscription' : 'subscriptions'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onReset}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111623] border border-[#232D42] hover:border-[#94A3B8] text-xs font-semibold text-[#F8FAFC] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#10B981]"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset</span>
        </button>
        <button
          type="button"
          onClick={onCommitArchive}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#0EA472] text-xs font-semibold text-[#04140E] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F8FAFC]"
        >
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Commit Pause</span>
        </button>
      </div>
    </div>
  );
};
