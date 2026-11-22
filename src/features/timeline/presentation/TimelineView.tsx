import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Pencil, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { Button, MoneyFigure } from '../../../core/ui/primitives';
import {
  formatMonthName,
  formatMonthYear,
  formatShortDate,
  getTodayIso,
  parseIsoDate,
} from '../../../core/utils/dateMath';
import { formatCompactMinorUnits, formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { compute12MonthForecast } from '../../audit/domain/auditEngine';
import {
  BILLING_CYCLES,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import { computeMonthTimeline } from '../domain/timelineEngine';

interface TimelineViewProps {
  readonly subscriptions: readonly Subscription[];
  readonly settings: VaultSettings;
  readonly readOnlyIds: ReadonlySet<string>;
  readonly onEditSubscription: (id: string) => void;
  readonly onOpenUpgrade: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const TimelineView: React.FC<TimelineViewProps> = ({
  subscriptions,
  settings,
  readOnlyIds,
  onEditSubscription,
  onOpenUpgrade,
}) => {
  const todayIso = getTodayIso();
  const parsedToday = parseIsoDate(todayIso) ?? { year: 2026, month: 11, day: 20 };

  const [viewYear, setViewYear] = useState(parsedToday.year);
  const [viewMonth, setViewMonth] = useState(parsedToday.month);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);

  const forecast = useMemo(
    () => compute12MonthForecast(subscriptions, settings, todayIso),
    [subscriptions, settings, todayIso],
  );

  const maxForecastMinor = useMemo(
    () => Math.max(1, ...forecast.map((m) => m.totalBaseMinorUnits)),
    [forecast],
  );

  const avgForecastMinor = useMemo(() => {
    if (forecast.length === 0) return 0;
    const sum = forecast.reduce((acc, m) => acc + m.totalBaseMinorUnits, 0);
    return Math.round(sum / forecast.length);
  }, [forecast]);

  const spikeCount = useMemo(
    () => forecast.filter((m) => m.isSpike).length,
    [forecast],
  );

  const timeline = useMemo(
    () => computeMonthTimeline(subscriptions, settings, viewYear, viewMonth),
    [subscriptions, settings, viewYear, viewMonth],
  );

  const selectedDay = useMemo(() => {
    if (selectedDateIso) {
      const exact = timeline.days.find((d) => d.dateIso === selectedDateIso);
      if (exact) return exact;
    }
    const upcomingWithCharge = timeline.days.find(
      (d) => d.dateIso >= todayIso && d.charges.length > 0,
    );
    if (upcomingWithCharge) return upcomingWithCharge;
    const firstWithCharge = timeline.days.find((d) => d.charges.length > 0);
    return firstWithCharge ?? timeline.days[0];
  }, [timeline.days, selectedDateIso, todayIso]);

  const navigateMonth = (delta: number) => {
    const totalMonths = viewYear * 12 + (viewMonth - 1) + delta;
    const nextYear = Math.floor(totalMonths / 12);
    const nextMonth = ((totalMonths % 12) + 12) % 12 + 1;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
    setSelectedDateIso(null);
  };

  const jumpToMonth = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
    setSelectedDateIso(null);
  };

  const jumpToToday = () => {
    setViewYear(parsedToday.year);
    setViewMonth(parsedToday.month);
    setSelectedDateIso(todayIso);
  };

  const leadingBlanks = Array.from({ length: timeline.firstWeekdayOffset });
  const showDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(settings.baseCurrency);
  const hasActiveSubscriptions = subscriptions.some((s) => !s.isArchived);
  const avgLineBottomPct =
    avgForecastMinor > 0
      ? Math.min(92, Math.max(12, Math.round((avgForecastMinor / maxForecastMinor) * 100)))
      : 0;

  return (
    <div className="space-y-6" data-testid="calendar-view">
      {/* Header + Month Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.025em] text-text-primary leading-tight">
            Calendar
          </h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            See when renewals land and spot expensive months ahead.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={jumpToToday}>
            Today
          </Button>

          <div className="flex items-center rounded-xl bg-card border border-border p-0.5 shadow-[0_1px_2px_rgba(15,26,23,0.04)]">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] rounded-lg text-text-secondary hover:text-text-primary hover:bg-subtle flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span
              className="px-2.5 text-[14px] font-bold tracking-[-0.01em] text-text-primary whitespace-nowrap min-w-[132px] text-center"
              data-testid="calendar-month-label"
            >
              {formatMonthYear(viewYear, viewMonth)}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] rounded-lg text-text-secondary hover:text-text-primary hover:bg-subtle flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {!hasActiveSubscriptions && (
        <div
          role="status"
          data-testid="calendar-empty-banner"
          className="rounded-2xl app-surface p-6 text-center space-y-1.5"
        >
          <p className="font-display text-base font-bold text-text-primary">
            No renewals scheduled yet
          </p>
          <p className="text-[13px] text-text-secondary max-w-md mx-auto">
            Add your first subscription on Home or import a bank statement to populate this 12-month
            calendar.
          </p>
        </div>
      )}

      {/* Interactive 12-Month Renewal Forecast */}
      <section
        className="rounded-2xl app-surface p-5 sm:p-6"
        aria-label="12-month renewal forecast"
        data-testid="forecast-12m-chart"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-text" aria-hidden="true" />
            <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
              Next 12 months
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-secondary">
            {avgForecastMinor > 0 && (
              <span className="font-mono tabular-nums text-xs">
                Avg {formatCompactMinorUnits(avgForecastMinor, settings.baseCurrency)}/mo
              </span>
            )}
            <span>
              {spikeCount > 0 ? (
                <>
                  <span className="font-semibold text-amber-text">
                    ▲ {spikeCount} heavier {spikeCount === 1 ? 'month' : 'months'}
                  </span>{' '}
                  · Tap any bar
                </>
              ) : (
                'Steady monthly total · Tap a bar to jump'
              )}
            </span>
          </div>
        </div>

        {/* Chart Area with subtle reference gridlines & average baseline */}
        <div className="relative">
          {/* Desktop horizontal gridlines + average reference line */}
          <div
            className="hidden sm:block pointer-events-none absolute inset-x-0 top-6 bottom-6"
            aria-hidden="true"
          >
            <div className="absolute inset-x-0 top-0 border-t border-border/50" />
            <div className="absolute inset-x-0 top-1/2 border-t border-border/45" />
            <div className="absolute inset-x-0 bottom-0 border-t border-border/80" />
            {avgForecastMinor > 0 && (
              <div
                className="absolute inset-x-0 border-t border-dashed border-brand/45 transition-all duration-300"
                style={{ bottom: `${avgLineBottomPct}%` }}
              />
            )}
          </div>

          <div className="relative z-10 grid grid-cols-6 sm:grid-cols-12 gap-2 items-end h-[236px] sm:h-[164px] pt-1">
            {forecast.map((bar, index) => {
              const isSelectedMonth = bar.year === viewYear && bar.month === viewMonth;
              const heightPct =
                bar.totalBaseMinorUnits > 0
                  ? Math.max(12, Math.round((bar.totalBaseMinorUnits / maxForecastMinor) * 100))
                  : 4;

              return (
                <button
                  key={`${bar.year}-${bar.month}`}
                  type="button"
                  onClick={() => jumpToMonth(bar.year, bar.month)}
                  aria-label={`${bar.fullLabel}: ${formatMinorUnits(bar.totalBaseMinorUnits, settings.baseCurrency, { showDecimals: false })}${bar.isSpike ? ' (heavier month)' : ''}`}
                  aria-pressed={isSelectedMonth}
                  data-testid={`forecast-bar-${bar.year}-${bar.month}`}
                  className="flex flex-col items-center justify-end h-full gap-1.5 group cursor-pointer rounded-lg min-w-0"
                >
                  <span
                    title={formatMinorUnits(bar.totalBaseMinorUnits, settings.baseCurrency, {
                      showDecimals: false,
                    })}
                    className={`font-mono tabular-nums text-xs font-semibold truncate max-w-full transition-colors ${
                      isSelectedMonth
                        ? 'text-brand-text'
                        : bar.isSpike
                          ? 'text-amber-text'
                          : 'text-text-secondary group-hover:text-text-primary'
                    }`}
                  >
                    {formatCompactMinorUnits(bar.totalBaseMinorUnits, settings.baseCurrency)}
                  </span>
                  <div className="w-full flex-1 flex items-end justify-center px-0.5">
                    <motion.div
                      initial={{ height: '6%' }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{
                        duration: 0.42,
                        delay: index * 0.018,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`w-full max-w-[30px] rounded-t-lg transition-colors duration-150 ${
                        isSelectedMonth
                          ? 'bg-brand shadow-[0_0_0_2px_var(--vf-card),0_0_0_4px_var(--vf-brand)]'
                          : bar.isSpike
                            ? 'bg-amber/85 group-hover:bg-amber border-t-2 border-amber-text'
                            : 'bg-border-strong/75 group-hover:bg-brand/55'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      isSelectedMonth
                        ? 'text-text-primary underline decoration-2 decoration-brand underline-offset-4'
                        : 'text-text-secondary group-hover:text-text-primary'
                    }`}
                  >
                    {bar.shortLabel}
                    {bar.isSpike ? ' ▲' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Heavy-Week Cluster Alert */}
      {timeline.heavyWeekCluster && (
        <div
          role="status"
          data-testid="heavy-week-alert"
          className="rounded-2xl bg-amber-soft/85 border border-amber-border px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-card border border-amber-border flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-amber-text">
                Busy week: {timeline.heavyWeekCluster.chargeCount} bills due{' '}
                {formatShortDate(timeline.heavyWeekCluster.startDateIso)} –{' '}
                {formatShortDate(timeline.heavyWeekCluster.endDateIso)}
              </p>
              <p className="text-[13px] text-text-secondary tabular-nums">
                {formatMinorUnits(
                  timeline.heavyWeekCluster.totalBaseMinorUnits,
                  settings.baseCurrency,
                  { showDecimals },
                )}{' '}
                of{' '}
                {formatMinorUnits(
                  timeline.totalMonthBaseMinorUnits,
                  settings.baseCurrency,
                  { showDecimals },
                )}{' '}
                charged in {formatMonthName(viewYear, viewMonth)} (
                {Math.round(timeline.heavyWeekCluster.shareOfMonth * 100)}%) falls between{' '}
                {formatShortDate(timeline.heavyWeekCluster.startDateIso)} and{' '}
                {formatShortDate(timeline.heavyWeekCluster.endDateIso)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid + Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          className="lg:col-span-7 rounded-2xl app-surface p-4 sm:p-6"
          aria-label={`Calendar for ${formatMonthYear(viewYear, viewMonth)}`}
        >
          <div className="flex items-baseline justify-between pb-4 mb-4 border-b border-border">
            <div>
              <p className="text-xs font-medium text-text-secondary">Month total</p>
              <p className="mt-1">
                <MoneyFigure
                  value={formatMinorUnits(
                    timeline.totalMonthBaseMinorUnits,
                    settings.baseCurrency,
                    { showDecimals },
                  )}
                  className="text-2xl font-bold text-text-primary"
                />
              </p>
            </div>
            <p className="text-[13px] font-medium text-text-secondary tabular-nums">
              {timeline.totalChargesCount}{' '}
              {timeline.totalChargesCount === 1 ? 'payment' : 'payments'}
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-text-secondary py-1"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {leadingBlanks.map((_, idx) => (
              <div key={`blank-${idx}`} className="h-14 sm:h-16" aria-hidden="true" />
            ))}

            {timeline.days.map((cell) => {
              const isSelected = selectedDay?.dateIso === cell.dateIso;
              const isToday = cell.dateIso === todayIso;
              const isPast = cell.dateIso < todayIso;
              const hasCharges = cell.charges.length > 0;
              const compactAmount = hasCharges
                ? formatCompactMinorUnits(cell.totalBaseMinorUnits, settings.baseCurrency)
                : null;

              const cellStyle = isSelected
                ? 'bg-brand text-white border-brand shadow-[0_2px_10px_-2px_rgba(15,107,84,0.4)]'
                : isToday
                  ? 'bg-card border-2 border-brand text-text-primary'
                  : hasCharges
                    ? 'bg-subtle/85 border border-border hover:border-brand/70 text-text-primary'
                    : 'bg-transparent border border-transparent hover:bg-subtle/60 text-text-secondary';

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => setSelectedDateIso(cell.dateIso)}
                  aria-label={`${formatShortDate(cell.dateIso)}: ${cell.charges.length} ${
                    cell.charges.length === 1 ? 'payment' : 'payments'
                  }${compactAmount ? `, ${compactAmount}` : ''}`}
                  aria-pressed={isSelected}
                  data-date={cell.dateIso}
                  data-past={isPast ? 'true' : 'false'}
                  className={`h-14 sm:h-16 rounded-xl px-1 py-1.5 flex flex-col items-center justify-between transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer min-w-0 ${cellStyle} ${
                    isPast && hasCharges && !isSelected ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold leading-none ${
                      isSelected
                        ? 'text-white'
                        : isToday
                          ? 'text-brand-text font-bold'
                          : hasCharges
                            ? 'text-text-primary'
                            : 'text-text-secondary'
                    }`}
                  >
                    {cell.dayOfMonth}
                  </span>

                  {compactAmount ? (
                    <span
                      className={`font-mono tabular-nums text-xs font-semibold leading-tight truncate max-w-full ${
                        isSelected ? 'text-white' : 'text-brand-text'
                      }`}
                    >
                      {compactAmount}
                    </span>
                  ) : (
                    <span className="h-3" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div
            className="mt-5 pt-3.5 border-t border-border flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary"
            data-testid="calendar-legend"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-md border-2 border-brand bg-card inline-block"
                aria-hidden="true"
              />
              <span>Today</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-md bg-brand inline-block"
                aria-hidden="true"
              />
              <span>Selected</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-md bg-subtle border border-border inline-block"
                aria-hidden="true"
              />
              <span>Upcoming charge</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-md bg-subtle border border-border opacity-50 inline-block"
                aria-hidden="true"
              />
              <span>Past charge</span>
            </span>
          </div>
        </section>

        {/* Day Inspector Panel */}
        <aside
          className="lg:col-span-5 rounded-2xl app-surface overflow-hidden lg:sticky lg:top-20"
          aria-label="Selected day payments"
          data-testid="day-inspector"
        >
          <div className="px-5 py-4 border-b border-border flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-text-secondary">Selected day</p>
              <h2 className="mt-0.5 font-display text-lg font-bold tracking-[-0.015em] text-text-primary">
                {selectedDay ? formatShortDate(selectedDay.dateIso) : 'Pick a day'}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-text-secondary">Day total</p>
              <p className="mt-0.5">
                <MoneyFigure
                  value={formatMinorUnits(
                    selectedDay?.totalBaseMinorUnits ?? 0,
                    settings.baseCurrency,
                    { showDecimals },
                  )}
                  className="text-base font-bold text-text-primary"
                />
              </p>
            </div>
          </div>

          {!selectedDay || selectedDay.charges.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-display text-[15px] font-bold text-text-primary">
                No charges on this day
              </p>
              <p className="mt-1 text-[13px] text-text-secondary">
                Tap any day with an amount to inspect its renewals.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/80">
              {selectedDay.charges.map((charge) => {
                const sub = charge.subscription;
                const visual = getCategoryVisual(sub.category);
                const formattedCharge = formatMinorUnits(
                  charge.baseAmountMinorUnits,
                  settings.baseCurrency,
                  { showDecimals },
                );
                return (
                  <li
                    key={`${sub.id}-${charge.dateIso}`}
                    className="px-5 py-3.5 flex items-center gap-3.5 hover:bg-subtle/45 transition-colors"
                  >
                    <ServiceAvatar
                      name={sub.name}
                      category={sub.category}
                      catalogId={sub.catalogId}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        title={sub.name}
                        className="text-[14px] font-semibold text-text-primary truncate"
                      >
                        {sub.name}
                      </p>
                      <p className="text-[13px] text-text-secondary truncate">
                        {visual.label} · {BILLING_CYCLES[sub.cycle].label}
                        {sub.isFreeTrial ? ' · Free trial' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0 max-w-[44%] min-w-0">
                      <p className="truncate">
                        <MoneyFigure
                          value={formattedCharge}
                          className="text-[14px] font-bold text-text-primary"
                        />
                      </p>
                      {readOnlyIds.has(sub.id) ? (
                        <button
                          type="button"
                          onClick={onOpenUpgrade}
                          aria-label={`Upgrade to edit ${sub.name}`}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-text hover:underline cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Upgrade to edit</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditSubscription(sub.id)}
                          aria-label={`Edit ${sub.name}`}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-text hover:underline cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
};
