import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import {
  formatMonthYear,
  formatShortDate,
  getTodayIso,
  parseIsoDate,
} from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
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
  readonly onEditSubscription: (id: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const TimelineView: React.FC<TimelineViewProps> = ({
  subscriptions,
  settings,
  onEditSubscription,
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
    <div className="space-y-6" data-testid="timeline-view">
      {/* Header + Month Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#17211E]">
            Cashflow Timeline
          </h1>
          <p className="mt-1 text-sm text-[#5B6662]">
            Spot annual renewal spikes 12 months ahead and inspect daily billing clusters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={jumpToToday}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] transition-colors cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl bg-white border border-[#E4E7E1] p-0.5">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
              className="min-h-[36px] min-w-[36px] rounded-lg text-[#5B6662] hover:text-[#17211E] hover:bg-[#F5F6F3] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span
              className="px-3 text-sm font-bold text-[#17211E] whitespace-nowrap min-w-[144px] text-center"
              data-testid="timeline-month-label"
            >
              {formatMonthYear(viewYear, viewMonth)}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
              className="min-h-[36px] min-w-[36px] rounded-lg text-[#5B6662] hover:text-[#17211E] hover:bg-[#F5F6F3] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive 12-Month Renewal Spike Forecast */}
      <section
        className="rounded-2xl vault-surface p-5"
        aria-label="12-month renewal forecast"
        data-testid="forecast-12m-chart"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#1E6B58]" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#17211E]">
              12-Month Cashflow Forecast
            </h2>
          </div>
          <p className="text-xs text-[#5B6662]">
            {spikeCount > 0 ? (
              <span>
                <span className="font-semibold text-[#B86A14]">{spikeCount} spike {spikeCount === 1 ? 'month' : 'months'}</span>{' '}
                detected · Click any bar to inspect
              </span>
            ) : (
              'Steady monthly outflow · Click any bar to jump'
            )}
          </p>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end h-[136px] pt-4">
          {forecast.map((bar) => {
            const isSelectedMonth = bar.year === viewYear && bar.month === viewMonth;
            const heightPct =
              bar.totalBaseMinorUnits > 0
                ? Math.max(14, Math.round((bar.totalBaseMinorUnits / maxForecastMinor) * 100))
                : 6;
            const barColor = isSelectedMonth
              ? '#1E6B58'
              : bar.isSpike
                ? '#C97E24'
                : '#C9D6D0';

            return (
              <button
                key={`${bar.year}-${bar.month}`}
                type="button"
                onClick={() => jumpToMonth(bar.year, bar.month)}
                aria-label={`${bar.fullLabel}: ${formatMinorUnits(bar.totalBaseMinorUnits, settings.baseCurrency, { showDecimals: false })}${bar.isSpike ? ' (renewal spike)' : ''}`}
                aria-pressed={isSelectedMonth}
                data-testid={`forecast-bar-${bar.year}-${bar.month}`}
                className="flex flex-col items-center justify-end h-full gap-1.5 group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E6B58] rounded-lg"
              >
                <span
                  className={`font-mono tabular-nums text-[10px] font-semibold transition-colors ${
                    isSelectedMonth
                      ? 'text-[#1E6B58]'
                      : bar.isSpike
                        ? 'text-[#B86A14]'
                        : 'text-[#85918C] group-hover:text-[#17211E]'
                  }`}
                >
                  {formatMinorUnits(bar.totalBaseMinorUnits, settings.baseCurrency, {
                    showDecimals: false,
                  })}
                </span>
                <div className="w-full flex-1 flex items-end justify-center px-0.5">
                  <div
                    className="w-full max-w-[30px] rounded-t-lg transition-all duration-200 group-hover:opacity-90"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    isSelectedMonth ? 'text-[#17211E]' : 'text-[#5B6662]'
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
          className="rounded-2xl bg-[#FDF7ED] border border-[#EED7B4] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#EED7B4] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#B86A14]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#8A4F0B]">
                Heavy Cashflow Cluster:{' '}
                {timeline.heavyWeekCluster.chargeCount} bills due{' '}
                {formatShortDate(timeline.heavyWeekCluster.startDateIso)} –{' '}
                {formatShortDate(timeline.heavyWeekCluster.endDateIso)}
              </p>
              <p className="text-xs text-[#6E5333] font-mono tabular-nums">
                {Math.round(timeline.heavyWeekCluster.shareOfMonth * 100)}% of monthly outflow (
                {formatMinorUnits(
                  timeline.heavyWeekCluster.totalBaseMinorUnits,
                  settings.baseCurrency,
                  { showDecimals },
                )}
                ) lands in one 7-day window
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid + Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          className="lg:col-span-7 rounded-2xl vault-surface p-4 sm:p-5"
          aria-label={`Calendar for ${formatMonthYear(viewYear, viewMonth)}`}
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#EEF1EC]">
            <div>
              <p className="text-xs text-[#5B6662]">Projected Month Total</p>
              <p className="mt-0.5 font-mono tabular-nums text-xl font-bold text-[#17211E]">
                {formatMinorUnits(timeline.totalMonthBaseMinorUnits, settings.baseCurrency, {
                  showDecimals,
                })}
              </p>
            </div>
            <p className="text-xs text-[#5B6662] font-mono tabular-nums">
              {timeline.totalChargesCount}{' '}
              {timeline.totalChargesCount === 1 ? 'charge' : 'charges'}
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[11px] font-semibold text-[#85918C] py-1"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {leadingBlanks.map((_, idx) => (
              <div key={`blank-${idx}`} className="h-14 sm:h-16" aria-hidden="true" />
            ))}

            {timeline.days.map((cell) => {
              const isSelected = selectedDay?.dateIso === cell.dateIso;
              const isToday = cell.dateIso === todayIso;
              const hasCharges = cell.charges.length > 0;
              const visibleDots = cell.charges.slice(0, 3);
              const extraCount = cell.charges.length - visibleDots.length;

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => setSelectedDateIso(cell.dateIso)}
                  aria-label={`${formatShortDate(cell.dateIso)}: ${cell.charges.length} ${
                    cell.charges.length === 1 ? 'bill' : 'bills'
                  }`}
                  aria-pressed={isSelected}
                  className={`h-14 sm:h-16 rounded-xl p-1.5 flex flex-col items-center justify-between border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E6B58] ${
                    isSelected
                      ? 'bg-[#E6F2EE] border-[#1E6B58]'
                      : isToday
                        ? 'bg-[#F5F6F3] border-[#1E6B58]/50'
                        : hasCharges
                          ? 'bg-[#FAFBF9] border-[#E4E7E1] hover:border-[#B9C5BC]'
                          : 'bg-transparent border-transparent hover:bg-[#F5F6F3]'
                  }`}
                >
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold ${
                      isSelected
                        ? 'text-[#155243]'
                        : isToday
                          ? 'text-[#1E6B58]'
                          : hasCharges
                            ? 'text-[#17211E]'
                            : 'text-[#85918C]'
                    }`}
                  >
                    {cell.dayOfMonth}
                  </span>

                  <div className="flex items-center justify-center gap-1 min-h-[12px]">
                    {visibleDots.map((charge) => (
                      <span
                        key={`${charge.subscription.id}-${cell.dateIso}`}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: getCategoryVisual(charge.subscription.category).color,
                        }}
                        aria-hidden="true"
                      />
                    ))}
                    {extraCount > 0 && (
                      <span className="text-[9px] font-mono text-[#5B6662]">+{extraCount}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Day Inspector Panel */}
        <aside
          className="lg:col-span-5 rounded-2xl vault-surface p-5"
          aria-label="Selected day charges"
          data-testid="day-inspector"
        >
          <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-[#EEF1EC]">
            <div>
              <p className="text-xs text-[#5B6662]">Day Inspector</p>
              <h2 className="mt-0.5 text-lg font-bold text-[#17211E]">
                {selectedDay ? formatShortDate(selectedDay.dateIso) : 'Select a day'}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#5B6662]">Daily Outflow</p>
              <p className="mt-0.5 font-mono tabular-nums text-base font-bold text-[#17211E]">
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
              <p className="text-sm font-bold text-[#17211E]">No charges scheduled</p>
              <p className="mt-1 text-xs text-[#5B6662]">
                Select any highlighted day on the calendar to inspect its recurring bills.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {selectedDay.charges.map((charge) => {
                const sub = charge.subscription;
                const visual = getCategoryVisual(sub.category);
                const Icon = visual.Icon;
                return (
                  <li
                    key={`${sub.id}-${charge.dateIso}`}
                    className="rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] p-3.5 flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${visual.color}16` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: visual.color }} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#17211E] truncate">{sub.name}</p>
                      <p className="text-xs text-[#5B6662]">
                        {visual.label} · {BILLING_CYCLES[sub.cycle].label}
                        {sub.isFreeTrial ? ' · Free trial' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono tabular-nums text-sm font-bold text-[#17211E]">
                        {formatMinorUnits(charge.baseAmountMinorUnits, settings.baseCurrency, {
                          showDecimals,
                        })}
                      </p>
                      <button
                        type="button"
                        onClick={() => onEditSubscription(sub.id)}
                        aria-label={`Edit ${sub.name}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E6B58] hover:text-[#155243] cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
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
