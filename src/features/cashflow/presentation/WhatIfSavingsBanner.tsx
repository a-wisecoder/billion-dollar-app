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
      className="rounded-2xl bg-[#E6F2EE] border border-[#B9DDD0] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#C6E2D8] flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-[#1E6B58]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#155243] font-mono tabular-nums">
            What-If Savings Unlocked: +
            {formatMinorUnits(animatedSavings, baseCurrency, {
              showDecimals: baseCurrency !== 'PKR',
            })}
            /yr
          </p>
          <p className="text-xs text-[#386559]">
            Simulating pause on {simulatedCount}{' '}
            {simulatedCount === 1 ? 'subscription' : 'subscriptions'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onReset}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-[#C6E2D8] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E6B58]"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
          <span>Reset</span>
        </button>
        <button
          type="button"
          onClick={onCommitArchive}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#1E6B58] hover:bg-[#175747] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E6B58]"
        >
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Commit Pause</span>
        </button>
      </div>
    </div>
  );
};
