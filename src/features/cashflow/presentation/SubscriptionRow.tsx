import React, { forwardRef, useRef, useState } from 'react';
import { formatShortDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import type { ComputedSubscription } from '../domain/cashflowEngine';
import {
  BILLING_CYCLES,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type VaultSettings,
} from '../domain/subscription';

interface SubscriptionRowProps {
  readonly item: ComputedSubscription;
  readonly settings: VaultSettings;
  readonly showAnnual: boolean;
  readonly isReadOnly?: boolean;
  readonly onSelect: (id: string) => void;
  readonly onToggleSimulate: (id: string) => void;
}

export const SubscriptionRow = forwardRef<HTMLButtonElement, SubscriptionRowProps>(
  ({ item, settings, showAnnual, isReadOnly = false, onSelect, onToggleSimulate }, ref) => {
    const { subscription: sub, daysUntilRenewal, baseMonthlyMinorUnits, baseAnnualMinorUnits } = item;
    const baseCurrency = settings.baseCurrency;
    const isPaused = sub.isSimulatedPaused;
    const isDueSoon = !isPaused && daysUntilRenewal >= 0 && daysUntilRenewal <= 3;

    const hasPriceHike =
      typeof sub.previousAmountMinorUnits === 'number' &&
      sub.previousAmountMinorUnits > 0 &&
      sub.amountMinorUnits > sub.previousAmountMinorUnits;
    const priceHikeDelta = hasPriceHike ? sub.amountMinorUnits - sub.previousAmountMinorUnits! : 0;

    // Touch swipe-right for "What if I cancel?" on mobile
    const startXRef = useRef<number | null>(null);
    const startYRef = useRef<number | null>(null);
    const didSwipeRef = useRef(false);
    const swipeOffsetRef = useRef(0);
    const [swipeOffset, setSwipeOffset] = useState(0);

    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
      startXRef.current = e.touches[0]?.clientX ?? null;
      startYRef.current = e.touches[0]?.clientY ?? null;
      didSwipeRef.current = false;
      swipeOffsetRef.current = 0;
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
      if (startXRef.current === null || startYRef.current === null) return;
      const dx = (e.touches[0]?.clientX ?? startXRef.current) - startXRef.current;
      const dy = Math.abs((e.touches[0]?.clientY ?? startYRef.current) - startYRef.current);
      if (dx > 12 && dx > dy * 1.2) {
        didSwipeRef.current = true;
        const clamped = Math.min(88, dx * 0.65);
        swipeOffsetRef.current = clamped;
        setSwipeOffset(clamped);
      }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
      const endX = e.changedTouches[0]?.clientX;
      const finalOffset =
        startXRef.current !== null && typeof endX === 'number'
          ? Math.max(swipeOffsetRef.current, Math.min(88, (endX - startXRef.current) * 0.65))
          : swipeOffsetRef.current;

      if (finalOffset >= 52) {
        onToggleSimulate(sub.id);
      }
      if (didSwipeRef.current) {
        window.setTimeout(() => {
          didSwipeRef.current = false;
        }, 120);
      }
      startXRef.current = null;
      startYRef.current = null;
      swipeOffsetRef.current = 0;
      setSwipeOffset(0);
    };

    const handleClick = () => {
      if (didSwipeRef.current) {
        didSwipeRef.current = false;
        return;
      }
      onSelect(sub.id);
    };

    const cycleMeta = BILLING_CYCLES[sub.cycle];
    const showBaseDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(baseCurrency);
    const showOwnDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency);
    const cardMarkup = settings.cardMarkupPercent ?? 0;
    const formattedMarkup = Number.isInteger(cardMarkup) ? String(cardMarkup) : cardMarkup.toFixed(1);

    const primaryAmount = showAnnual
      ? formatMinorUnits(baseAnnualMinorUnits, baseCurrency, {
          showDecimals: showBaseDecimals,
        })
      : formatMinorUnits(sub.amountMinorUnits, sub.currency, {
          showDecimals: showOwnDecimals,
        });
    const primarySuffix = showAnnual ? '/yr' : cycleMeta.shortSuffix;
    const showConverted = !showAnnual && sub.currency !== baseCurrency;
    const convertedMonthly = formatMinorUnits(baseMonthlyMinorUnits, baseCurrency, {
      showDecimals: showBaseDecimals,
    });

    let subtitleText: string;
    let subtitleToneClass = 'text-text-secondary';

    if (isPaused) {
      subtitleText = 'Paused in what-if view';
      subtitleToneClass = 'text-brand-text font-medium';
    } else if (sub.isFreeTrial) {
      subtitleText =
        daysUntilRenewal < 0
          ? 'Trial ended'
          : daysUntilRenewal === 0
            ? 'Trial ends today'
            : `Trial ends in ${daysUntilRenewal}d`;
      subtitleToneClass = 'text-amber-text font-medium';
    } else {
      subtitleText = `Renews ${formatShortDate(sub.nextBillingDate)} · ${cycleMeta.label}`;
      if (isDueSoon) {
        subtitleToneClass = 'text-amber-text font-medium';
      }
    }

    return (
      <div className="relative overflow-hidden first:rounded-t-2xl last:rounded-b-2xl">
        {/* Swipe-right reveal backdrop */}
        {swipeOffset > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-brand-soft flex items-center pl-4 text-xs font-semibold text-brand-text"
          >
            {isPaused ? 'Restore' : 'What if I cancel?'}
          </div>
        )}

        <button
          ref={ref}
          type="button"
          data-testid={`subscription-row-${sub.id}`}
          data-simulated-paused={isPaused ? 'true' : 'false'}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
          }}
          className={`relative w-full min-h-[68px] px-4 py-3 flex items-center gap-3.5 text-left transition-[transform,background-color,opacity] duration-150 ease-out cursor-pointer hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${
            isPaused ? 'bg-brand-soft/45 opacity-80' : 'bg-card'
          }`}
        >
          <ServiceAvatar
            name={sub.name}
            category={sub.category}
            catalogId={sub.catalogId}
            size="md"
          />

          {/* Name + single renewal line */}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className={`text-[15px] font-semibold text-text-primary truncate ${
                  isPaused ? 'line-through decoration-brand' : ''
                }`}
              >
                {sub.name}
              </span>
              {hasPriceHike && !isPaused && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-soft text-amber-text text-xs font-semibold tabular-nums whitespace-nowrap shrink-0">
                  +{formatMinorUnits(priceHikeDelta, sub.currency, { showDecimals: showOwnDecimals })}
                </span>
              )}
              {isReadOnly && (
                <span
                  data-testid={`subscription-readonly-badge-${sub.id}`}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-subtle border border-border text-text-secondary text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Read-only
                </span>
              )}
            </span>
            <span className={`mt-0.5 block text-[13px] truncate tabular-nums ${subtitleToneClass}`}>
              {subtitleText}
            </span>
          </span>

          {/* Amount + cycle */}
          <span className="text-right shrink-0">
            <span
              className={`block text-[15px] font-bold tabular-nums whitespace-nowrap ${
                isPaused ? 'text-brand-text' : 'text-text-primary'
              }`}
            >
              {primaryAmount}
              <span className="text-[13px] font-medium text-text-secondary">
                {isPaused ? ' saved' : primarySuffix}
              </span>
            </span>
            {showConverted && (
              <span className="mt-0.5 block text-xs text-text-secondary tabular-nums whitespace-nowrap">
                ≈ {convertedMonthly}
                {cardMarkup > 0 ? ` incl. ${formattedMarkup}% card markup` : '/mo'}
              </span>
            )}
          </span>
        </button>
      </div>
    );
  },
);

SubscriptionRow.displayName = 'SubscriptionRow';
