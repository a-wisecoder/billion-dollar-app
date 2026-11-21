import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import {
  formatMonthYear,
  formatShortDate,
  getTodayIso,
  parseIsoDate,
} from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
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
  };

  const jumpToToday = () => {
    setViewYear(parsedToday.year);
    setViewMonth(parsedToday.month);
    setSelectedDateIso(todayIso);
  };

  const leadingBlanks = Array.from({ length: timeline.firstWeekdayOffset });

  return (
    <div className="space-y-6" data-testid="timeline-view">
      {/* Header + Month Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F8FAFC]">
            Cashflow Timeline
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Projected recurring renewals and weekly cashflow concentration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={jumpToToday}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111623] border border-[#232D42] hover:border-[#6366F1] text-xs font-semibold text-[#F8FAFC] transition-colors cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl bg-[#111623] border border-[#232D42] p-0.5">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
              className="min-h-[38px] min-w-[38px] rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2234] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span
              className="px-3 text-sm font-bold text-[#F8FAFC] whitespace-nowrap min-w-[144px] text-center"
              data-testid="timeline-month-label"
            >
              {formatMonthYear(viewYear, viewMonth)}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
              className="min-h-[38px] min-w-[38px] rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2234] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Heavy-Week Cluster Alert */}
      {timeline.heavyWeekCluster && (
        <div
          role="status"
          data-testid="heavy-week-alert"
          className="rounded-2xl bg-[#F59E0B]/12 border border-[#F59E0B]/40 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/18 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F59E0B]">
                Heavy Cashflow Cluster:{' '}
                {timeline.heavyWeekCluster.chargeCount} bills due{' '}
                {formatShortDate(timeline.heavyWeekCluster.startDateIso)} –{' '}
                {formatShortDate(timeline.heavyWeekCluster.endDateIso)}
              </p>
              <p className="text-xs text-[#94A3B8] font-mono tabular-nums">
                {Math.round(timeline.heavyWeekCluster.shareOfMonth * 100)}% of monthly outflow (
                {formatMinorUnits(
                  timeline.heavyWeekCluster.totalBaseMinorUnits,
                  settings.baseCurrency,
                  { showDecimals: settings.baseCurrency !== 'PKR' },
                )}
                ) lands in one 7-day window
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid + Day Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Calendar Grid */}
        <section
          className="lg:col-span-7 rounded-2xl bg-[#111623] border border-[#232D42] p-4 sm:p-5"
          aria-label={`Calendar for ${formatMonthYear(viewYear, viewMonth)}`}
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#232D42]">
            <div>
              <p className="text-xs text-[#94A3B8]">Projected Month Total</p>
              <p className="mt-0.5 font-mono tabular-nums text-xl font-bold text-[#F8FAFC]">
                {formatMinorUnits(timeline.totalMonthBaseMinorUnits, settings.baseCurrency, {
                  showDecimals: settings.baseCurrency !== 'PKR',
                })}
              </p>
            </div>
            <p className="text-xs text-[#94A3B8] font-mono tabular-nums">
              {timeline.totalChargesCount}{' '}
              {timeline.totalChargesCount === 1 ? 'charge' : 'charges'}
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[11px] font-semibold text-[#64748B] py-1"
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
                  className={`h-14 sm:h-16 rounded-xl p-1.5 flex flex-col items-center justify-between border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6366F1] ${
                    isSelected
                      ? 'bg-[#6366F1]/20 border-[#6366F1]'
                      : isToday
                        ? 'bg-[#1A2234] border-[#6366F1]/50'
                        : hasCharges
                          ? 'bg-[#161D2E] border-[#232D42] hover:border-[#475569]'
                          : 'bg-[#0B101B]/60 border-transparent hover:border-[#232D42]'
                  }`}
                  style={
                    !isSelected && hasCharges && cell.intensity > 0
                      ? {
                          boxShadow: `inset 0 0 18px rgba(99, 102, 241, ${(
                            0.08 +
                            cell.intensity * 0.14
                          ).toFixed(2)})`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold ${
                      isSelected
                        ? 'text-white'
                        : isToday
                          ? 'text-[#818CF8]'
                          : hasCharges
                            ? 'text-[#F8FAFC]'
                            : 'text-[#64748B]'
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
                      <span className="text-[9px] font-mono text-[#94A3B8]">+{extraCount}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Day Inspector Panel */}
        <aside
          className="lg:col-span-5 rounded-2xl bg-[#111623] border border-[#232D42] p-5"
          aria-label="Selected day charges"
          data-testid="day-inspector"
        >
          <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-[#232D42]">
            <div>
              <p className="text-xs text-[#94A3B8]">Day Inspector</p>
              <h2 className="mt-0.5 text-lg font-bold text-[#F8FAFC]">
                {selectedDay ? formatShortDate(selectedDay.dateIso) : 'Select a day'}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#94A3B8]">Daily Outflow</p>
              <p className="mt-0.5 font-mono tabular-nums text-base font-bold text-[#F8FAFC]">
                {formatMinorUnits(
                  selectedDay?.totalBaseMinorUnits ?? 0,
                  settings.baseCurrency,
                  { showDecimals: settings.baseCurrency !== 'PKR' },
                )}
              </p>
            </div>
          </div>

          {!selectedDay || selectedDay.charges.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-[#F8FAFC]">No charges scheduled</p>
              <p className="mt-1 text-xs text-[#94A3B8]">
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
                    className="rounded-xl bg-[#0B101B] border border-[#232D42] p-3.5 flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${visual.color}1F` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: visual.color }} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#F8FAFC] truncate">{sub.name}</p>
                      <p className="text-xs text-[#94A3B8]">
                        {visual.label} · {BILLING_CYCLES[sub.cycle].label}
                        {sub.isFreeTrial ? ' · Free trial' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono tabular-nums text-sm font-bold text-[#F8FAFC]">
                        {formatMinorUnits(charge.baseAmountMinorUnits, settings.baseCurrency, {
                          showDecimals: settings.baseCurrency !== 'PKR',
                        })}
                      </p>
                      <button
                        type="button"
                        onClick={() => onEditSubscription(sub.id)}
                        aria-label={`Edit ${sub.name}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#6366F1] hover:text-[#818CF8] cursor-pointer"
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
