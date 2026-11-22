import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Pencil, Sparkles } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
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
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';
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
  const showDecimals = settings.baseCurrency !== 'PKR';

  return (
    <div className="space-y-6" data-testid="calendar-view">
      {/* Header + Month Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-text-primary">
            Calendar
          </h1>
          <p className="mt-1 text-[15px] sm:text-sm text-text-secondary">
            See when renewals land and spot expensive months ahead.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={jumpToToday}
            className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded-xl bg-card border border-border hover:border-brand text-[13px] font-semibold text-text-primary transition-colors cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl bg-card border border-border p-0.5">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
              className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] rounded-lg text-text-secondary hover:text-text-primary hover:bg-subtle flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span
              className="px-2.5 text-[15px] sm:text-sm font-bold text-text-primary whitespace-nowrap min-w-[136px] text-center"
              data-testid="calendar-month-label"
            >
              {formatMonthYear(viewYear, viewMonth)}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
              className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] rounded-lg text-text-secondary hover:text-text-primary hover:bg-subtle flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive 12-Month Renewal Forecast */}
      <section
        className="rounded-2xl app-surface p-5"
        aria-label="12-month renewal forecast"
        data-testid="forecast-12m-chart"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-text" aria-hidden="true" />
            <h2 className="text-[15px] font-bold text-text-primary">Next 12 months</h2>
          </div>
          <p className="text-[13px] text-text-secondary">
            {spikeCount > 0 ? (
              <span>
                <span className="font-semibold text-amber-text">
                  {spikeCount} heavier {spikeCount === 1 ? 'month' : 'months'}
                </span>{' '}
                · Tap a bar to inspect
              </span>
            ) : (
              'Steady monthly total · Tap a bar to jump'
            )}
          </p>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end h-[148px] pt-2">
          {forecast.map((bar) => {
            const isSelectedMonth = bar.year === viewYear && bar.month === viewMonth;
            const heightPct =
              bar.totalBaseMinorUnits > 0
                ? Math.max(14, Math.round((bar.totalBaseMinorUnits / maxForecastMinor) * 100))
                : 6;

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
                  className={`tabular-nums text-xs font-semibold truncate max-w-full transition-colors ${
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
                  <div
                    className={`w-full max-w-[28px] rounded-t-lg transition-all duration-200 group-hover:opacity-90 ${
                      isSelectedMonth
                        ? 'bg-brand'
                        : bar.isSpike
                          ? 'bg-amber'
                          : 'bg-border'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isSelectedMonth ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {bar.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Heavy-Week Cluster Alert */}
      {timeline.heavyWeekCluster && (
        <div
          role="status"
          data-testid="heavy-week-alert"
          className="rounded-2xl bg-amber-soft border border-amber-border px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-card border border-amber-border flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[15px] sm:text-sm font-bold text-amber-text">
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
          className="lg:col-span-7 rounded-2xl app-surface p-4 sm:p-5"
          aria-label={`Calendar for ${formatMonthYear(viewYear, viewMonth)}`}
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
            <div>
              <p className="text-[13px] text-text-secondary">Month total</p>
              <p className="mt-0.5 tabular-nums text-xl font-bold text-text-primary">
                {formatMinorUnits(timeline.totalMonthBaseMinorUnits, settings.baseCurrency, {
                  showDecimals,
                })}
              </p>
            </div>
            <p className="text-[13px] text-text-secondary tabular-nums">
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
                ? 'bg-brand text-white border-brand'
                : isToday
                  ? 'bg-card border-2 border-brand text-text-primary'
                  : hasCharges
                    ? 'bg-subtle border border-border hover:border-brand text-text-primary'
                    : 'bg-transparent border border-transparent hover:bg-subtle text-text-secondary';

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
                  className={`h-14 sm:h-16 rounded-xl px-1 py-1.5 flex flex-col items-center justify-between transition-colors cursor-pointer min-w-0 ${cellStyle} ${
                    isPast && hasCharges && !isSelected ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    className={`tabular-nums text-xs font-semibold leading-none ${
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
                      className={`tabular-nums text-xs font-semibold leading-tight truncate max-w-full ${
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
            className="mt-4 pt-3.5 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary"
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
          className="lg:col-span-5 rounded-2xl app-surface p-5"
          aria-label="Selected day payments"
          data-testid="day-inspector"
        >
          <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-border">
            <div>
              <p className="text-[13px] text-text-secondary">Selected day</p>
              <h2 className="mt-0.5 text-lg font-bold text-text-primary">
                {selectedDay ? formatShortDate(selectedDay.dateIso) : 'Pick a day'}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-text-secondary">Day total</p>
              <p className="mt-0.5 tabular-nums text-base font-bold text-text-primary">
                {formatMinorUnits(
                  selectedDay?.totalBaseMinorUnits ?? 0,
                  settings.baseCurrency,
                  { showDecimals },
                )}
              </p>
            </div>
          </div>

          {!selectedDay || selectedDay.charges.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[15px] font-bold text-text-primary">No charges on this day</p>
              <p className="mt-1 text-[13px] text-text-secondary">
                Tap any day with an amount to inspect its renewals.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {selectedDay.charges.map((charge) => {
                const sub = charge.subscription;
                const visual = getCategoryVisual(sub.category);
                const initialLetter = sub.name.trim().charAt(0).toUpperCase() || '?';
                return (
                  <li
                    key={`${sub.id}-${charge.dateIso}`}
                    className="rounded-xl bg-subtle border border-border p-3.5 flex items-center gap-3"
                  >
                    <div
                      aria-hidden="true"
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[15px] font-bold"
                      style={{
                        backgroundColor: `${visual.color}1F`,
                        color: visual.color,
                      }}
                    >
                      {initialLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-text-primary truncate">
                        {sub.name}
                      </p>
                      <p className="text-[13px] text-text-secondary">
                        {visual.label} · {BILLING_CYCLES[sub.cycle].label}
                        {sub.isFreeTrial ? ' · Free trial' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="tabular-nums text-[15px] font-bold text-text-primary">
                        {formatMinorUnits(charge.baseAmountMinorUnits, settings.baseCurrency, {
                          showDecimals,
                        })}
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
