import React, { useRef, useState } from 'react';
import { Mail, Pause, Pencil, Play, Trash2, TrendingUp } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { formatShortDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { computeCostPerUseMinorUnits } from '../../audit/domain/auditEngine';
import type { ComputedSubscription } from '../domain/cashflowEngine';
import {
  BILLING_CYCLES,
  USAGE_FREQUENCY_LIST,
  USAGE_FREQUENCY_META,
  type UsageFrequency,
  type VaultSettings,
} from '../domain/subscription';

interface SubscriptionCardProps {
  readonly item: ComputedSubscription;
  readonly settings: VaultSettings;
  readonly showAnnual: boolean;
  readonly onToggleSimulate: (id: string) => void;
  readonly onUpdateUsage: (id: string, usage: UsageFrequency) => void;
  readonly onOpenCancelKit: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  item,
  settings,
  showAnnual,
  onToggleSimulate,
  onUpdateUsage,
  onOpenCancelKit,
  onEdit,
  onDelete,
}) => {
  const { subscription: sub, daysUntilRenewal, baseMonthlyMinorUnits, baseAnnualMinorUnits } = item;
  const baseCurrency = settings.baseCurrency;
  const visual = getCategoryVisual(sub.category);
  const Icon = visual.Icon;
  const isPaused = sub.isSimulatedPaused;
  const isDueSoon = !isPaused && daysUntilRenewal <= 3;

  const currentUsage: UsageFrequency = sub.usageFrequency ?? 'weekly';
  const costPerUseMinor = computeCostPerUseMinorUnits(sub, settings);

  const hasPriceHike =
    typeof sub.previousAmountMinorUnits === 'number' &&
    sub.previousAmountMinorUnits > 0 &&
    sub.amountMinorUnits > sub.previousAmountMinorUnits;
  const priceHikeDelta = hasPriceHike ? sub.amountMinorUnits - sub.previousAmountMinorUnits! : 0;

  // Touch swipe-right-to-simulate with spring-back
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
    ? 'text-[#1E7E5F]'
    : sub.isFreeTrial || isDueSoon
      ? 'text-[#B86A14]'
      : 'text-[#5B6662]';

  const cardBorderClass = isPaused
    ? 'border-[#B9DDD0] bg-[#FAFDFB]'
    : sub.isFreeTrial
      ? 'border-[#E9CFA8]'
      : currentUsage === 'unused'
        ? 'border-[#EBCACA]'
        : 'border-[#E4E7E1] hover:border-[#CFD6CC]';

  return (
    <article
      data-testid={`subscription-card-${sub.id}`}
      data-simulated-paused={isPaused ? 'true' : 'false'}
      data-usage={currentUsage}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
      }}
      className={`rounded-2xl bg-white border ${cardBorderClass} shadow-[0_1px_2px_rgba(23,33,30,0.03),0_8px_22px_-16px_rgba(23,33,30,0.08)] p-4 transition-[transform,opacity,border-color] duration-200 ease-out ${
        isPaused ? 'opacity-75' : 'opacity-100'
      }`}
    >
      {/* Top Row: Category Emblem, Bill Details, Tabular Price */}
      <div className="flex items-start gap-3.5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${visual.color}16` }}
        >
          <Icon className="w-5 h-5" style={{ color: visual.color }} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <h3
              className={`text-[15px] font-bold text-[#17211E] truncate ${
                isPaused ? 'line-through decoration-[#1E7E5F]' : ''
              }`}
            >
              {sub.name}
            </h3>
            {hasPriceHike && !isPaused && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B86A14] font-mono tabular-nums">
                <TrendingUp className="w-3 h-3" aria-hidden="true" />
                +{formatMinorUnits(priceHikeDelta, sub.currency, { showDecimals: sub.currency !== 'PKR' })} hike
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span className={`font-semibold font-mono tabular-nums ${renewalColorClass}`}>
              {renewalLabel}
            </span>
            <span className="text-[#C8D0C6]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#5B6662]">{cycleMeta.label}</span>
            <span className="text-[#C8D0C6]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#5B6662]">{formatShortDate(sub.nextBillingDate)}</span>
            {showConvertedSubtitle && (
              <>
                <span className="text-[#C8D0C6]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[#5B6662] font-mono tabular-nums">
                  ≈ {convertedMonthlyText}/mo
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div
            className={`font-mono tabular-nums text-[15px] font-bold ${
              isPaused ? 'text-[#1E7E5F]' : 'text-[#17211E]'
            }`}
          >
            {primaryAmount}
          </div>
          <div
            className={`text-[11px] font-medium ${
              isPaused ? 'text-[#1E7E5F]' : 'text-[#85918C]'
            }`}
          >
            {isPaused ? 'saved' : primarySuffix}
          </div>
        </div>
      </div>

      {/* Live Usage & Cost-Per-Use Strip */}
      <div className="mt-3 pt-3 border-t border-[#EEF1EC] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-[#F5F6F3] border border-[#E4E7E1]"
            role="group"
            aria-label={`Usage frequency for ${sub.name}`}
          >
            {USAGE_FREQUENCY_LIST.map((freq) => {
              const selected = currentUsage === freq;
              const meta = USAGE_FREQUENCY_META[freq];
              return (
                <button
                  key={freq}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onUpdateUsage(sub.id, freq)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-white text-[#17211E] shadow-xs'
                      : 'text-[#6D7974] hover:text-[#17211E]'
                  }`}
                  style={selected ? { color: meta.tone } : undefined}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <span
            className={`text-xs font-mono tabular-nums truncate ${
              costPerUseMinor === null
                ? 'font-semibold text-[#C64545]'
                : currentUsage === 'rarely'
                  ? 'font-semibold text-[#B86A14]'
                  : 'text-[#5B6662]'
            }`}
            data-testid={`cost-per-use-${sub.id}`}
          >
            {costPerUseMinor === null
              ? `Unused · ${convertedMonthlyText}/mo leak`
              : `${formatMinorUnits(costPerUseMinor, baseCurrency, { showDecimals: baseCurrency !== 'PKR' })} / use`}
          </span>
        </div>

        {/* Tactile Actions */}
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
            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E6B58] ${
              isPaused
                ? 'bg-[#E6F2EE] border-[#B9DDD0] text-[#155243] hover:bg-[#D8ECE5]'
                : 'bg-[#F5F6F3] border-[#E4E7E1] text-[#17211E] hover:border-[#1E6B58]'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
                <span>Simulate</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenCancelKit(sub.id)}
            aria-label={`Open cancel or negotiate script for ${sub.name}`}
            title="Cancel / Negotiate Script"
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#F5F6F3] border border-[#E4E7E1] text-[#5B6662] hover:text-[#1E6B58] hover:border-[#1E6B58] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Script</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(sub.id)}
            aria-label={`Edit ${sub.name}`}
            className="min-h-[34px] min-w-[34px] rounded-lg bg-[#F5F6F3] border border-[#E4E7E1] text-[#5B6662] hover:text-[#17211E] hover:border-[#CFD6CC] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(sub.id)}
            aria-label={`Delete ${sub.name}`}
            className="min-h-[34px] min-w-[34px] rounded-lg bg-[#F5F6F3] border border-[#E4E7E1] text-[#5B6662] hover:text-[#C64545] hover:border-[#EBCACA] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
};
