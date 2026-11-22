import React from 'react';
import { Archive, RotateCcw, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAnimatedNumber } from '../../../core/hooks/useAnimatedNumber';
import { Button, MoneyFigure } from '../../../core/ui/primitives';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { ZERO_DECIMAL_DISPLAY_CURRENCIES, type CurrencyCode } from '../domain/subscription';

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

  const formattedSavings = formatMinorUnits(animatedSavings, baseCurrency, {
    showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(baseCurrency),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
      data-testid="what-if-savings-banner"
      className="rounded-2xl bg-brand-soft border border-brand-border px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-[0_2px_10px_rgba(15,107,84,0.08)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-card border border-brand-border flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-brand-text" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] sm:text-sm font-bold text-brand-text">
            You&apos;d save{' '}
            <MoneyFigure
              value={`+${formattedSavings}`}
              suffix="/yr"
              className="text-brand-text font-bold"
              suffixClassName="text-brand-text/80"
            />
          </p>
          <p className="text-[13px] text-text-secondary">
            Testing cancellation on {simulatedCount}{' '}
            {simulatedCount === 1 ? 'subscription' : 'subscriptions'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="secondary" size="sm" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
          <span>Reset</span>
        </Button>
        <Button variant="primary" size="sm" onClick={onCommitArchive}>
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Mark as cancelled</span>
        </Button>
      </div>
    </motion.div>
  );
};
