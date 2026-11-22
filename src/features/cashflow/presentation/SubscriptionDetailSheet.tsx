import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  Lock,
  Mail,
  Pencil,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDialogA11y } from '../../../core/hooks/useDialogA11y';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { Button, MoneyFigure, ToggleSwitch } from '../../../core/ui/primitives';
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const dragYRef = useRef<number>(0);
  const [dragY, setDragY] = useState(0);

  useDialogA11y({
    isOpen: Boolean(item),
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
    restoreFocus: false,
  });

  useEffect(() => {
    if (!item) return;
    dragYRef.current = 0;
    setDragY(0);
  }, [item]);

  const todayIso = getTodayIso();
  const nextThreeDates = useMemo(() => {
    if (!item) return [];
    return getNextChargeDates(item.subscription, 3, todayIso);
  }, [item, todayIso]);

  const paidSinceStart = useMemo(() => {
    if (!item) return null;
    return computePaidSinceStart(item.subscription, todayIso);
  }, [item, todayIso]);

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

  const todayYear = parseIsoDate(todayIso)?.year;
  const formatChargeDate = (iso: string) => {
    const parsed = parseIsoDate(iso);
    const base = formatShortDate(iso);
    if (parsed && todayYear && parsed.year !== todayYear) {
      return `${base}, ${parsed.year}`;
    }
    return base;
  };

  return (
    <AnimatePresence>
      {item && (() => {
        const { subscription: sub, baseAnnualMinorUnits, baseMonthlyMinorUnits } = item;
        const baseCurrency = settings.baseCurrency;
        const showBaseDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(baseCurrency);
        const showOwnDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency);
        const cardMarkup = settings.cardMarkupPercent ?? 0;
        const formattedMarkup = Number.isInteger(cardMarkup)
          ? String(cardMarkup)
          : cardMarkup.toFixed(1);
        const visual = getCategoryVisual(sub.category);
        const cycleMeta = BILLING_CYCLES[sub.cycle];
        const currentUsage: UsageFrequency = sub.usageFrequency ?? 'weekly';
        const costPerUseMinor = computeCostPerUseMinorUnits(sub, settings);
        const isPaused = sub.isSimulatedPaused;

        const hasPriceHistory =
          typeof sub.previousAmountMinorUnits === 'number' && sub.previousAmountMinorUnits > 0;
        const priceDiff = hasPriceHistory ? sub.amountMinorUnits - sub.previousAmountMinorUnits! : 0;

        const formattedOwnPrice = formatMinorUnits(sub.amountMinorUnits, sub.currency, {
          showDecimals: showOwnDecimals,
        });
        const formattedAnnual = formatMinorUnits(baseAnnualMinorUnits, baseCurrency, {
          showDecimals: false,
        });

        return (
          <motion.div
            key="detail-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-[var(--vf-backdrop)] backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-sheet-title"
            data-testid="subscription-detail-sheet"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <motion.div
              ref={dialogRef}
              tabIndex={-1}
              initial={{ opacity: 0, x: 24, y: 12 }}
              animate={{ opacity: 1, x: 0, y: dragY }}
              exit={{ opacity: 0, x: 24, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full md:max-w-[448px] max-h-[88vh] md:max-h-none md:h-full bg-card border-t md:border-t-0 md:border-l border-border rounded-t-2xl md:rounded-none shadow-2xl flex flex-col"
            >
              {/* Mobile drag handle & header */}
              <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                data-testid="detail-sheet-drag-handle"
                className="px-5 pt-3.5 pb-4 border-b border-border shrink-0 touch-none"
              >
                <div
                  className="w-10 h-1 rounded-full bg-border-strong mx-auto mb-3.5 md:hidden"
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ServiceAvatar
                      name={sub.name}
                      category={sub.category}
                      catalogId={sub.catalogId}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <h2
                        id="detail-sheet-title"
                        title={sub.name}
                        className="font-display text-lg font-bold tracking-[-0.015em] text-text-primary truncate"
                      >
                        {sub.name}
                      </h2>
                      <p className="text-[13px] text-text-secondary truncate">
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
                    className="min-h-[40px] min-w-[40px] rounded-xl bg-subtle/80 border border-border text-text-secondary hover:text-text-primary hover:border-border-strong flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Scrollable details body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {isReadOnly && (
                  <div
                    role="status"
                    data-testid="detail-readonly-banner"
                    className="rounded-xl bg-amber-soft/90 border border-amber-border px-3.5 py-2.5 flex items-start gap-2.5 text-[13px] text-amber-text"
                  >
                    <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="leading-relaxed">
                      Read-only on the Free plan (first 8 active subscriptions stay editable). Your
                      data is safe and still included in all totals.
                    </p>
                  </div>
                )}

                {/* Amount summary */}
                <section className="pb-4 border-b border-border space-y-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-secondary">Price</p>
                      <p className="mt-1 truncate">
                        <MoneyFigure
                          value={formattedOwnPrice}
                          suffix={cycleMeta.shortSuffix}
                          className="text-2xl font-bold text-text-primary"
                        />
                      </p>
                      {sub.currency !== baseCurrency && (
                        <p className="mt-0.5 text-[13px] text-text-secondary font-mono tabular-nums truncate">
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
                    <div className="text-right shrink-0 max-w-[44%]">
                      <p className="text-xs font-medium text-text-secondary">Per year</p>
                      <p className="mt-1 truncate">
                        <MoneyFigure
                          value={formattedAnnual}
                          className="text-base font-bold text-text-primary"
                        />
                      </p>
                    </div>
                  </div>
                  {paidSinceStart && (
                    <p
                      data-testid="detail-paid-since-start"
                      className="text-[13px] text-text-secondary tabular-nums"
                    >
                      Paid ≈{' '}
                      <span className="font-mono font-semibold text-text-primary">
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
                    <h3 className="text-[13px] font-semibold text-text-primary">
                      Next 3 charge dates
                    </h3>
                  </div>
                  <ol
                    className="grid grid-cols-3 rounded-xl border border-border overflow-hidden divide-x divide-border"
                    data-testid="next-3-charges"
                  >
                    {nextThreeDates.map((dateIso, idx) => (
                      <li
                        key={dateIso}
                        className={`px-3 py-2.5 text-center ${
                          idx === 0 ? 'bg-brand-soft/65' : 'bg-subtle/40'
                        }`}
                      >
                        <span
                          className={`block text-xs font-medium ${
                            idx === 0 ? 'text-brand-text' : 'text-text-secondary'
                          }`}
                        >
                          {idx === 0 ? 'Next' : `#${idx + 1}`}
                        </span>
                        <span className="mt-0.5 block text-[13px] font-semibold text-text-primary font-mono tabular-nums">
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
                      className={`text-[13px] font-mono font-semibold tabular-nums ${
                        costPerUseMinor === null || currentUsage === 'rarely'
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
                    className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-subtle/90 border border-border"
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
                          className={`relative z-10 min-h-[38px] rounded-[9px] text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            selected
                              ? 'text-text-primary'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {selected && (
                            <motion.span
                              layoutId="detail-usage-indicator"
                              transition={{
                                type: 'spring',
                                stiffness: 520,
                                damping: 38,
                                mass: 0.7,
                              }}
                              className="absolute inset-0 -z-10 rounded-[9px] bg-card border border-border/80 shadow-[0_1px_3px_rgba(15,26,23,0.08)]"
                            />
                          )}
                          {USAGE_FREQUENCY_META[freq].label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* What if I cancel? toggle */}
                <section className="rounded-xl bg-brand-soft/80 border border-brand-border p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-text-primary">What if I cancel?</p>
                    <p className="text-[13px] text-text-secondary tabular-nums">
                      {isPaused
                        ? `Saving ${formattedAnnual}/yr in preview`
                        : `Saves ${formattedAnnual}/yr`}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={isPaused}
                    onCheckedChange={() => onToggleSimulate(sub.id)}
                    ariaLabel={`What if I cancel ${sub.name}?`}
                    data-testid="detail-what-if-toggle"
                  />
                </section>

                {/* Price history (zero-pill unboxed figure) */}
                {hasPriceHistory && (
                  <section className="py-3.5 border-y border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TrendingUp className="w-4 h-4 text-amber shrink-0" aria-hidden="true" />
                      <div>
                        <h3 className="text-[13px] font-semibold text-text-primary">
                          Price history
                        </h3>
                        <p className="text-[13px] text-text-secondary font-mono tabular-nums">
                          {formatMinorUnits(sub.previousAmountMinorUnits!, sub.currency, {
                            showDecimals: showOwnDecimals,
                          })}{' '}
                          &rarr;{' '}
                          <span className="font-semibold text-text-primary">
                            {formattedOwnPrice}
                          </span>
                        </p>
                      </div>
                    </div>
                    {priceDiff > 0 && (
                      <span className="text-[13px] font-mono font-bold text-amber-text tabular-nums shrink-0">
                        +
                        {formatMinorUnits(priceDiff, sub.currency, {
                          showDecimals: showOwnDecimals,
                        })}
                      </span>
                    )}
                  </section>
                )}

                {/* Notes */}
                <section className="space-y-1">
                  <h3 className="text-[13px] font-semibold text-text-primary">Notes</h3>
                  <p className="text-[14px] text-text-secondary leading-relaxed">
                    {sub.notes ? sub.notes : 'No notes added yet.'}
                  </p>
                </section>

                {/* Add to calendar & How to cancel helpers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Button
                    variant="secondary"
                    size="md"
                    data-testid="detail-add-to-calendar"
                    onClick={() => onExportSingleIcs(sub.id)}
                    className="w-full"
                  >
                    <CalendarPlus className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
                    <span>Add to calendar</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => onOpenCancelKit(sub.id)}
                    className="w-full"
                  >
                    <Mail className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
                    <span>How to cancel</span>
                  </Button>
                </div>
              </div>

              {/* Bottom action bar: Edit (or Upgrade to edit) & Delete */}
              <div className="px-5 py-4 border-t border-border flex items-center gap-3 shrink-0 bg-card">
                {isReadOnly ? (
                  <Button
                    variant="primary"
                    size="md"
                    data-testid="upgrade-to-edit-button"
                    onClick={() => {
                      onClose();
                      onOpenUpgrade();
                    }}
                    className="flex-1"
                  >
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    <span>Upgrade to edit</span>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      onClose();
                      onEdit(sub.id);
                    }}
                    className="flex-1"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    <span>Edit</span>
                  </Button>
                )}
                <Button
                  variant="dangerSoft"
                  size="md"
                  onClick={() => {
                    onClose();
                    onDelete(sub.id);
                  }}
                  data-testid="detail-delete-button"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Delete</span>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
};
