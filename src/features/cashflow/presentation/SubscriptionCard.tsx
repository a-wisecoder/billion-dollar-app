import React, { useRef, useState } from 'react';
import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { formatShortDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { ComputedSubscription } from '../domain/cashflowEngine';
import { BILLING_CYCLES, type CurrencyCode } from '../domain/subscription';

interface SubscriptionCardProps {
  readonly item: ComputedSubscription;
  readonly baseCurrency: CurrencyCode;
  readonly showAnnual: boolean;
  readonly onToggleSimulate: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  item,
  baseCurrency,
  showAnnual,
  onToggleSimulate,
  onEdit,
  onDelete,
}) => {
  const { subscription: sub, daysUntilRenewal, baseMonthlyMinorUnits, baseAnnualMinorUnits } = item;
  const visual = getCategoryVisual(sub.category);
  const Icon = visual.Icon;
  const isPaused = sub.isSimulatedPaused;
  const isDueSoon = !isPaused && daysUntilRenewal <= 3;

  // Touch/pointer swipe-right-to-simulate with spring-back
  const startXRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    startXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (startXRef.current === null) return;
    const dx = (e.touches[0]?.clientX ?? startXRef.current) - startXRef.current;
    if (dx > 0) {
      setSwipeOffset(Math.min(84, dx * 0.65));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset >= 52) {
      onToggleSimulate(sub.id);
    }
    startXRef.current = null;
    setSwipeOffset(0);
  };

  const cycleMeta = BILLING_CYCLES[sub.cycle];
  const primaryAmount = showAnnual
    ? formatMinorUnits(baseAnnualMinorUnits, baseCurrency, {
        showDecimals: baseCurrency !== 'PKR',
      })
    : formatMinorUnits(sub.amountMinorUnits, sub.currency, {
        showDecimals: sub.currency !== 'PKR',
      });
  const primarySuffix = showAnnual ? '/yr' : cycleMeta.shortSuffix;

  const showConvertedSubtitle = !showAnnual && sub.currency !== baseCurrency;
  const convertedMonthlyText = formatMinorUnits(baseMonthlyMinorUnits, baseCurrency, {
    showDecimals: baseCurrency !== 'PKR',
  });

  const renewalLabel = isPaused
    ? 'Paused in What-If'
    : sub.isFreeTrial
      ? daysUntilRenewal <= 0
        ? 'Trial ends today'
        : `Trial ends in ${daysUntilRenewal}d`
      : daysUntilRenewal <= 0
        ? 'Due today'
        : `Due in ${daysUntilRenewal}d`;

  const renewalColorClass = isPaused
    ? 'text-[#10B981]'
    : sub.isFreeTrial || isDueSoon
      ? 'text-[#F59E0B]'
      : 'text-[#94A3B8]';

  const borderClass = isPaused
    ? 'border-[#10B981]/45'
    : sub.isFreeTrial
      ? 'border-[#F59E0B]/45'
      : isDueSoon
        ? 'border-[#F59E0B]/30'
        : 'border-[#232D42] hover:border-[#334155]';

  return (
    <article
      data-testid={`subscription-card-${sub.id}`}
      data-simulated-paused={isPaused ? 'true' : 'false'}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
      }}
      className={`rounded-2xl bg-[#111623] border ${borderClass} p-4 transition-[transform,opacity,border-color] duration-200 ease-out ${
        isPaused ? 'opacity-65' : 'opacity-100'
      }`}
    >
      <div className="flex items-center gap-3.5">
        {/* Category Icon Container */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${visual.color}1F` }}
        >
          <Icon className="w-5 h-5" style={{ color: visual.color }} aria-hidden="true" />
        </div>

        {/* Name & Clean Unboxed Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3
              className={`text-[15px] font-semibold text-[#F8FAFC] truncate ${
                isPaused ? 'line-through decoration-[#10B981]' : ''
              }`}
            >
              {sub.name}
            </h3>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span className={`font-semibold font-mono tabular-nums ${renewalColorClass}`}>
              {renewalLabel}
            </span>
            <span className="text-[#475569]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#94A3B8]">{cycleMeta.label}</span>
            <span className="text-[#475569]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#94A3B8]">{formatShortDate(sub.nextBillingDate)}</span>
            {showConvertedSubtitle && (
              <>
                <span className="text-[#475569]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[#94A3B8] font-mono tabular-nums">
                  ≈ {convertedMonthlyText}/mo
                </span>
              </>
            )}
          </div>
        </div>

        {/* Tabular Price Readout */}
        <div className="text-right shrink-0">
          <div
            className={`font-mono tabular-nums text-[15px] font-bold ${
              isPaused ? 'text-[#10B981]' : 'text-[#F8FAFC]'
            }`}
          >
            {primaryAmount}
          </div>
          <div
            className={`text-[11px] font-medium ${
              isPaused ? 'text-[#10B981]' : 'text-[#94A3B8]'
            }`}
          >
            {isPaused ? 'saved' : primarySuffix}
          </div>
        </div>
      </div>

      {/* Tactile Action Strip */}
      <div className="mt-3 pt-2.5 border-t border-[#232D42]/70 flex items-center justify-between gap-2">
        <span className="text-xs text-[#94A3B8] truncate">
          {sub.notes ? sub.notes : visual.label}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggleSimulate(sub.id)}
            aria-label={
              isPaused
                ? `Resume ${sub.name} in simulation`
                : `Simulate pause for ${sub.name}`
            }
            aria-pressed={isPaused}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6366F1] ${
              isPaused
                ? 'bg-[#10B981]/16 border-[#10B981]/45 text-[#10B981] hover:bg-[#10B981]/24'
                : 'bg-[#1A2234] border-[#232D42] text-[#F8FAFC] hover:border-[#6366F1]'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Simulate</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onEdit(sub.id)}
            aria-label={`Edit ${sub.name}`}
            className="min-h-[36px] min-w-[36px] rounded-lg bg-[#1A2234] border border-[#232D42] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#6366F1] flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6366F1]"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(sub.id)}
            aria-label={`Delete ${sub.name}`}
            className="min-h-[36px] min-w-[36px] rounded-lg bg-[#1A2234] border border-[#232D42] text-[#94A3B8] hover:text-[#EF4444] hover:border-[#EF4444]/60 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#EF4444]"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
};
