import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CalendarPlus, Lock, Mail, Pencil, Sparkles, Trash2, TrendingUp, X } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { formatShortDate, getTodayIso, parseIsoDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { computeCostPerUseMinorUnits } from '../../audit/domain/auditEngine';
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import type { ComputedSubscription } from '../domain/cashflowEngine';
import {
  BILLING_CYCLES,
  USAGE_FREQUENCY_LIST,
  USAGE_FREQUENCY_META,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type UsageFrequency,
  type VaultSettings,
} from '../domain/subscription';
import { computePaidSinceStart, getNextChargeDates } from '../domain/subscriptionGrouping';

interface SubscriptionDetailSheetProps {
  readonly item: ComputedSubscription | null;
  readonly settings: VaultSettings;
  readonly isReadOnly?: boolean;
  readonly onClose: () => void;
  readonly onUpdateUsage: (id: string, usage: UsageFrequency) => void;
  readonly onToggleSimulate: (id: string) => void;
  readonly onOpenCancelKit: (id: string) => void;
  readonly onExportSingleIcs: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onOpenUpgrade: () => void;
  readonly onDelete: (id: string) => void;
}

export const SubscriptionDetailSheet: React.FC<SubscriptionDetailSheetProps> = ({
  item,
  settings,
  isReadOnly = false,
  onClose,
  onUpdateUsage,
  onToggleSimulate,
  onOpenCancelKit,
  onExportSingleIcs,
  onEdit,
  onOpenUpgrade,
  onDelete,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const dragYRef = useRef<number>(0);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!item) return;
    dragYRef.current = 0;
    setDragY(0);
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [item, onClose]);

  const todayIso = getTodayIso();
  const nextThreeDates = useMemo(() => {
    if (!item) return [];
    return getNextChargeDates(item.subscription, 3, todayIso);
  }, [item, todayIso]);

  const paidSinceStart = useMemo(() => {
    if (!item) return null;
    return computePaidSinceStart(item.subscription, todayIso);
  }, [item, todayIso]);

  if (!item) return null;

  const { subscription: sub, baseAnnualMinorUnits, baseMonthlyMinorUnits } = item;
  const baseCurrency = settings.baseCurrency;
  const showBaseDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(baseCurrency);
  const showOwnDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency);
  const cardMarkup = settings.cardMarkupPercent ?? 0;
  const formattedMarkup = Number.isInteger(cardMarkup) ? String(cardMarkup) : cardMarkup.toFixed(1);
  const visual = getCategoryVisual(sub.category);
  const cycleMeta = BILLING_CYCLES[sub.cycle];
  const currentUsage: UsageFrequency = sub.usageFrequency ?? 'weekly';
  const costPerUseMinor = computeCostPerUseMinorUnits(sub, settings);
  const isPaused = sub.isSimulatedPaused;

  const hasPriceHistory =
    typeof sub.previousAmountMinorUnits === 'number' && sub.previousAmountMinorUnits > 0;
  const priceDiff = hasPriceHistory ? sub.amountMinorUnits - sub.previousAmountMinorUnits! : 0;

  const todayYear = parseIsoDate(todayIso)?.year;

  const formatChargeDate = (iso: string) => {
    const parsed = parseIsoDate(iso);
    const base = formatShortDate(iso);
    if (parsed && todayYear && parsed.year !== todayYear) {
      return `${base}, ${parsed.year}`;
    }
    return base;
  };

  // Mobile swipe-down to dismiss on the sheet handle/header
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    startYRef.current = e.touches[0]?.clientY ?? null;
    dragYRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    const dy = (e.touches[0]?.clientY ?? startYRef.current) - startYRef.current;
    if (dy > 0) {
      const clamped = Math.min(220, dy);
      dragYRef.current = clamped;
      setDragY(clamped);
    } else {
      dragYRef.current = 0;
      setDragY(0);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const endY = e.changedTouches[0]?.clientY;
    const finalDy =
      startYRef.current !== null && typeof endY === 'number'
        ? Math.max(dragYRef.current, endY - startYRef.current)
        : dragYRef.current;

    dragYRef.current = 0;
    setDragY(0);
    startYRef.current = null;

    if (finalDy >= 70) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-[var(--vf-backdrop)] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-sheet-title"
      data-testid="subscription-detail-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        }}
        className="w-full md:max-w-md max-h-[88vh] md:max-h-none md:h-full bg-card border-t md:border-t-0 md:border-l border-border rounded-t-2xl md:rounded-none shadow-2xl flex flex-col transition-transform duration-150 ease-out"
      >
        {/* Mobile drag handle & header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          data-testid="detail-sheet-drag-handle"
          className="px-5 pt-3 pb-4 border-b border-border shrink-0 touch-none"
        >
          <div
            className="w-10 h-1.5 rounded-full bg-border mx-auto mb-3.5 md:hidden"
            aria-hidden="true"
          />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ServiceAvatar
                name={sub.name}
                category={sub.category}
                catalogId={sub.catalogId}
                size="lg"
              />
              <div className="min-w-0">
                <h2
                  id="detail-sheet-title"
                  className="text-lg font-bold text-text-primary truncate"
                >
                  {sub.name}
                </h2>
                <p className="text-[13px] text-text-secondary">
                  {visual.label} · {cycleMeta.label}
                  {sub.isFreeTrial ? ' · Free trial' : ''}
                </p>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close subscription details"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-subtle border border-border text-text-secondary hover:text-text-primary flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable details body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {isReadOnly && (
            <div
              role="status"
              data-testid="detail-readonly-banner"
              className="rounded-xl bg-amber-soft border border-amber-border px-3.5 py-2.5 flex items-start gap-2.5 text-[13px] text-amber-text"
            >
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Read-only on the Free plan (first 8 active subscriptions stay editable). Your data
                is safe and still included in all totals.
              </p>
            </div>
          )}

          {/* Amount summary */}
          <section className="pb-4 border-b border-border space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-text-secondary">Price</p>
                <p className="mt-1 text-2xl font-extrabold text-text-primary tabular-nums">
                  {formatMinorUnits(sub.amountMinorUnits, sub.currency, {
                    showDecimals: showOwnDecimals,
                  })}
                  <span className="text-[15px] font-semibold text-text-secondary">
                    {cycleMeta.shortSuffix}
                  </span>
                </p>
                {sub.currency !== baseCurrency && (
                  <p className="mt-0.5 text-[13px] text-text-secondary tabular-nums">
                    ≈{' '}
                    {formatMinorUnits(baseMonthlyMinorUnits, baseCurrency, {
                      showDecimals: showBaseDecimals,
                    })}
                    /mo
                    {cardMarkup > 0
                      ? ` incl. ${formattedMarkup}% card markup`
                      : ` in ${baseCurrency}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[13px] font-medium text-text-secondary">Per year</p>
                <p className="mt-1 text-base font-bold text-text-primary tabular-nums">
                  {formatMinorUnits(baseAnnualMinorUnits, baseCurrency, {
                    showDecimals: false,
                  })}
                </p>
              </div>
            </div>
            {paidSinceStart && (
              <p
                data-testid="detail-paid-since-start"
                className="text-[13px] font-medium text-text-secondary tabular-nums"
              >
                Paid ≈{' '}
                <span className="font-semibold text-text-primary">
                  {formatMinorUnits(paidSinceStart.totalOwnMinorUnits, sub.currency, {
                    showDecimals: showOwnDecimals,
                  })}
                </span>{' '}
                since {paidSinceStart.startMonthYear}
              </p>
            )}
          </section>

          {/* Next 3 charge dates */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-secondary" aria-hidden="true" />
              <h3 className="text-[13px] font-semibold text-text-primary">Next 3 charge dates</h3>
            </div>
            <ol className="grid grid-cols-3 gap-2" data-testid="next-3-charges">
              {nextThreeDates.map((dateIso, idx) => (
                <li
                  key={dateIso}
                  className={`rounded-xl border px-3 py-2.5 text-center ${
                    idx === 0
                      ? 'bg-brand-soft border-brand-border'
                      : 'bg-subtle border-border'
                  }`}
                >
                  <span className="block text-xs text-text-secondary">
                    {idx === 0 ? 'Next' : `#${idx + 1}`}
                  </span>
                  <span className="mt-0.5 block text-[13px] font-semibold text-text-primary tabular-nums">
                    {formatChargeDate(dateIso)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Cost per use + How often do you use it? */}
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-text-primary">
                How often do you use it?
              </h3>
              <span
                className={`text-[13px] font-semibold tabular-nums ${
                  costPerUseMinor === null
                    ? 'text-amber-text'
                    : currentUsage === 'rarely'
                      ? 'text-amber-text'
                      : 'text-text-secondary'
                }`}
                data-testid="detail-cost-per-use"
              >
                {costPerUseMinor === null
                  ? 'Unused'
                  : `${formatMinorUnits(costPerUseMinor, baseCurrency, { showDecimals: showBaseDecimals })} / use`}
              </span>
            </div>
            <div
              className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-subtle border border-border"
              role="group"
              aria-label={`How often do you use ${sub.name}?`}
            >
              {USAGE_FREQUENCY_LIST.map((freq) => {
                const selected = currentUsage === freq;
                return (
                  <button
                    key={freq}
                    type="button"
                    disabled={isReadOnly}
                    aria-pressed={selected}
                    onClick={() => onUpdateUsage(sub.id, freq)}
                    className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      selected
                        ? 'bg-card text-text-primary shadow-xs'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {USAGE_FREQUENCY_META[freq].label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* What if I cancel? toggle */}
          <section className="rounded-xl bg-brand-soft border border-brand-border p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-text-primary">What if I cancel?</p>
              <p className="text-[13px] text-text-secondary tabular-nums">
                {isPaused
                  ? `Saving ${formatMinorUnits(baseAnnualMinorUnits, baseCurrency, { showDecimals: false })}/yr in preview`
                  : `Saves ${formatMinorUnits(baseAnnualMinorUnits, baseCurrency, { showDecimals: false })}/yr`}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPaused}
              aria-label={`What if I cancel ${sub.name}?`}
              data-testid="detail-what-if-toggle"
              onClick={() => onToggleSimulate(sub.id)}
              className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                isPaused ? 'bg-brand' : 'bg-border'
              }`}
            >
              <span
                className={`block w-6 h-6 rounded-full bg-card shadow-xs transition-transform ${
                  isPaused ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </section>

          {/* Price history */}
          {hasPriceHistory && (
            <section className="rounded-xl bg-subtle border border-border p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <TrendingUp className="w-4 h-4 text-amber shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-[13px] font-semibold text-text-primary">Price history</h3>
                  <p className="text-[13px] text-text-secondary tabular-nums">
                    {formatMinorUnits(sub.previousAmountMinorUnits!, sub.currency, {
                      showDecimals: showOwnDecimals,
                    })}{' '}
                    &rarr;{' '}
                    <span className="font-semibold text-text-primary">
                      {formatMinorUnits(sub.amountMinorUnits, sub.currency, {
                        showDecimals: showOwnDecimals,
                      })}
                    </span>
                  </p>
                </div>
              </div>
              {priceDiff > 0 && (
                <span className="px-2 py-1 rounded-lg bg-amber-soft text-amber-text text-xs font-semibold tabular-nums shrink-0">
                  +{formatMinorUnits(priceDiff, sub.currency, { showDecimals: showOwnDecimals })}
                </span>
              )}
            </section>
          )}

          {/* Notes */}
          <section className="space-y-1">
            <h3 className="text-[13px] font-semibold text-text-primary">Notes</h3>
            <p className="text-[15px] text-text-secondary leading-relaxed">
              {sub.notes ? sub.notes : 'No notes added yet.'}
            </p>
          </section>

          {/* Add to calendar & How to cancel helpers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              data-testid="detail-add-to-calendar"
              onClick={() => onExportSingleIcs(sub.id)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-subtle border border-border hover:border-brand text-[14px] font-semibold text-text-primary flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
              <span>Add to calendar</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCancelKit(sub.id)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-subtle border border-border hover:border-brand text-[14px] font-semibold text-text-primary flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
              <span>How to cancel</span>
            </button>
          </div>
        </div>

        {/* Bottom action bar: Edit (or Upgrade to edit) & Delete (Delete is the ONLY red element) */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-3 shrink-0 bg-card">
          {isReadOnly ? (
            <button
              type="button"
              data-testid="upgrade-to-edit-button"
              onClick={() => {
                onClose();
                onOpenUpgrade();
              }}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Upgrade to edit</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(sub.id);
              }}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
              <span>Edit</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(sub.id);
            }}
            data-testid="detail-delete-button"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-soft border border-red-border hover:border-red text-[15px] font-semibold text-red-text flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
