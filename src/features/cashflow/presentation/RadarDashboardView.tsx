import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { Button, MoneyFigure, SegmentedControl } from '../../../core/ui/primitives';
import { formatShortDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { LeakAuditReport } from '../../audit/domain/auditEngine';
import type { ComingUpReminder } from '../../reminders/domain/reminderEngine';
import type { CashflowSummary } from '../domain/cashflowEngine';
import {
  BILLING_CYCLES,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type SubscriptionCategory,
  type UsageFrequency,
  type VaultSettings,
} from '../domain/subscription';
import { groupSubscriptionsByDueWindow } from '../domain/subscriptionGrouping';
import { InteractiveBurnDial } from './InteractiveBurnDial';
import { RunwayCeilingCard } from './RunwayCeilingCard';
import { SubscriptionDetailSheet } from './SubscriptionDetailSheet';
import { SubscriptionRow } from './SubscriptionRow';
import { WhatIfSavingsBanner } from './WhatIfSavingsBanner';

interface RadarDashboardViewProps {
  readonly summary: CashflowSummary;
  readonly audit: LeakAuditReport;
  readonly settings: VaultSettings;
  readonly todayIso: string;
  readonly comingUpReminders: readonly ComingUpReminder[];
  readonly selectedCategory: SubscriptionCategory | null;
  readonly showAnnual: boolean;
  readonly searchQuery: string;
  readonly readOnlyIds: ReadonlySet<string>;
  readonly onSelectCategory: (category: SubscriptionCategory | null) => void;
  readonly onToggleAnnual: (annual: boolean) => void;
  readonly onSearchChange: (q: string) => void;
  readonly onToggleSimulate: (id: string) => void;
  readonly onUpdateUsage: (id: string, usage: UsageFrequency) => void;
  readonly onOpenCancelKit: (id: string) => void;
  readonly onExportSingleIcs: (id: string) => void;
  readonly onResetSimulations: () => void;
  readonly onCommitSimulations: () => void;
  readonly onRestoreArchived: (id: string) => void;
  readonly onAddClick: () => void;
  readonly onEditClick: (id: string) => void;
  readonly onOpenUpgrade: () => void;
  readonly onDeleteClick: (id: string) => void;
  readonly onEditCeilingClick: () => void;
  readonly onOpenAuditTab: () => void;
  readonly onExpiredTrialCancelled: (id: string) => void;
  readonly onExpiredTrialPaid: (id: string) => void;
}

export const RadarDashboardView: React.FC<RadarDashboardViewProps> = ({
  summary,
  audit,
  settings,
  todayIso,
  comingUpReminders,
  selectedCategory,
  showAnnual,
  searchQuery,
  readOnlyIds,
  onSelectCategory,
  onToggleAnnual,
  onSearchChange,
  onToggleSimulate,
  onUpdateUsage,
  onOpenCancelKit,
  onExportSingleIcs,
  onResetSimulations,
  onCommitSimulations,
  onRestoreArchived,
  onAddClick,
  onEditClick,
  onOpenUpgrade,
  onDeleteClick,
  onEditCeilingClick,
  onOpenAuditTab,
  onExpiredTrialCancelled,
  onExpiredTrialPaid,
}) => {
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastOpenedIdRef = useRef<string | null>(null);

  const selectedVisual = selectedCategory ? getCategoryVisual(selectedCategory) : null;
  const baseCurrency = settings.baseCurrency;
  const showDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(baseCurrency);
  const flaggedCount = audit.uniqueFlaggedCount;

  const filteredVisibleItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return summary.visibleItems;
    return summary.visibleItems.filter(
      (item) =>
        item.subscription.name.toLowerCase().includes(normalizedQuery) ||
        item.subscription.notes.toLowerCase().includes(normalizedQuery),
    );
  }, [summary.visibleItems, searchQuery]);

  const dueGroups = useMemo(
    () => groupSubscriptionsByDueWindow(filteredVisibleItems, todayIso),
    [filteredVisibleItems, todayIso],
  );

  const selectedItem = useMemo(
    () =>
      selectedSubId
        ? (summary.activeItems.find((i) => i.subscription.id === selectedSubId) ?? null)
        : null,
    [selectedSubId, summary.activeItems],
  );

  const handleRegisterRowRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) {
      rowRefs.current.set(id, el);
    } else {
      rowRefs.current.delete(id);
    }
  }, []);

  const handleOpenDetail = useCallback((id: string) => {
    lastOpenedIdRef.current = id;
    setSelectedSubId(id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    const returnId = lastOpenedIdRef.current;
    setSelectedSubId(null);
    if (returnId) {
      window.requestAnimationFrame(() => {
        rowRefs.current.get(returnId)?.focus();
      });
    }
  }, []);

  const formatted14Days = formatMinorUnits(audit.next14DaysDueMinorUnits, baseCurrency, {
    showDecimals,
  });
  const formattedMonthlyAvg = formatMinorUnits(summary.activeMonthlyBaseMinorUnits, baseCurrency, {
    showDecimals,
  });
  const formattedAnnual = formatMinorUnits(summary.activeAnnualBaseMinorUnits, baseCurrency, {
    showDecimals: false,
  });
  const formattedReclaimable = formatMinorUnits(
    audit.totalReclaimableAnnualMinorUnits,
    baseCurrency,
    { showDecimals: false },
  );

  return (
    <div className="space-y-6">
      {/* Expired Free Trial Decision Banners */}
      {summary.expiredTrials.length > 0 && (
        <section aria-label="Ended free trials" className="space-y-2.5">
          {summary.expiredTrials.map(({ subscription: trial }) => (
            <div
              key={trial.id}
              role="status"
              data-testid={`expired-trial-banner-${trial.id}`}
              className="rounded-2xl bg-amber-soft border border-amber-border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-card border border-amber-border flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber" aria-hidden="true" />
                </div>
                <p className="text-[15px] sm:text-sm font-semibold text-text-primary">
                  {trial.name} trial ended on {formatShortDate(trial.nextBillingDate)}. Did you cancel it?
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onExpiredTrialCancelled(trial.id)}
                >
                  Yes, cancelled
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onExpiredTrialPaid(trial.id)}
                >
                  No, it&apos;s now paid
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Coming up in-app reminder strip */}
      {settings.notificationsEnabled && comingUpReminders.length > 0 && (
        <section
          aria-label="Coming up renewals"
          data-testid="coming-up-strip"
          className="rounded-2xl bg-amber-soft border border-amber-border p-4 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber shrink-0" aria-hidden="true" />
              <h2 className="text-[14px] font-bold text-text-primary">Coming up</h2>
            </div>
            <span className="font-mono text-xs font-semibold text-amber-text tabular-nums">
              {comingUpReminders.length}{' '}
              {comingUpReminders.length === 1 ? 'renewal' : 'renewals'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {comingUpReminders.map((reminder) => (
              <button
                key={reminder.subscription.id}
                type="button"
                data-testid={`coming-up-item-${reminder.subscription.id}`}
                onClick={() => handleOpenDetail(reminder.subscription.id)}
                className="min-h-[40px] max-w-full px-3 py-1.5 rounded-xl bg-card border border-amber-border hover:border-brand text-left flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span
                  title={reminder.title}
                  className="text-[13px] font-semibold text-text-primary truncate min-w-0"
                >
                  {reminder.title}
                </span>
                <span
                  title={reminder.formattedAmount}
                  className="font-mono text-[13px] font-bold text-amber-text tabular-nums shrink-0"
                >
                  {reminder.formattedAmount}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Executive Workspace Header & Spring Period Toggle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] sm:text-[32px] leading-[1.15] font-bold tracking-[-0.03em] text-text-primary">
            Your subscriptions
          </h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            Track upcoming renewals, spot price hikes, and simulate cuts in real time.
          </p>
        </div>

        <SegmentedControl
          value={showAnnual ? 'annual' : 'monthly'}
          onChange={(val) => onToggleAnnual(val === 'annual')}
          ariaLabel="Billing period display"
          layoutId="home-period-toggle"
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'annual', label: 'Yearly' },
          ]}
        />
      </div>

      {/* Unified Mercury-Style 4-Metric Hairline Strip */}
      <section
        aria-label="Key spending metrics"
        className="rounded-2xl app-surface overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 sm:divide-x divide-border"
      >
        <div className="p-4 sm:p-5 min-w-0 border-r border-border lg:border-r-0">
          <p className="text-[12px] font-semibold text-text-secondary">Due in 14 days</p>
          <MoneyFigure
            value={formatted14Days}
            data-testid="kpi-14day-buffer"
            className="mt-2 block text-[19px] sm:text-[24px] font-bold text-text-primary truncate"
          />
          <p className="mt-1.5 text-[12px] text-text-secondary tabular-nums">
            {audit.next14DaysCount} {audit.next14DaysCount === 1 ? 'upcoming bill' : 'upcoming bills'}
          </p>
        </div>

        <div className="p-4 sm:p-5 min-w-0">
          <p className="text-[12px] font-semibold text-text-secondary">Monthly average</p>
          <MoneyFigure
            value={formattedMonthlyAvg}
            className="mt-2 block text-[19px] sm:text-[24px] font-bold text-text-primary truncate"
          />
          <p className="mt-1.5 text-[12px] text-text-secondary truncate">
            All cycles normalized
          </p>
        </div>

        <div className="p-4 sm:p-5 min-w-0 border-r border-border lg:border-r-0">
          <p className="text-[12px] font-semibold text-text-secondary">Annual projection</p>
          <MoneyFigure
            value={formattedAnnual}
            className="mt-2 block text-[19px] sm:text-[24px] font-bold text-text-primary truncate"
          />
          <p className="mt-1.5 text-[12px] text-text-secondary tabular-nums">
            {summary.activeTrialCount > 0
              ? `${summary.activeTrialCount} free ${summary.activeTrialCount === 1 ? 'trial' : 'trials'} active`
              : `${summary.activeItems.length} active ${summary.activeItems.length === 1 ? 'plan' : 'plans'}`}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAuditTab}
          data-testid="kpi-savings-found"
          className="text-left p-4 sm:p-5 min-w-0 bg-brand-soft/65 hover:bg-brand-soft transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-brand-text">Savings found</p>
            <ArrowUpRight
              className="w-4 h-4 text-brand-text transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0"
              aria-hidden="true"
            />
          </div>
          <MoneyFigure
            value={formattedReclaimable}
            suffix="/yr"
            title={`${formattedReclaimable}/yr`}
            className="mt-2 block text-[19px] sm:text-[24px] font-bold text-brand-text truncate"
            suffixClassName="text-brand-text/80"
          />
          <p className="mt-1.5 text-[12px] text-text-secondary truncate">
            {flaggedCount > 0
              ? `${flaggedCount} ${flaggedCount === 1 ? 'opportunity' : 'opportunities'} in Insights`
              : 'No leaks flagged'}
          </p>
        </button>
      </section>

      {/* What-If Savings Banner */}
      <WhatIfSavingsBanner
        annualSavingsBaseMinorUnits={summary.simulatedAnnualSavingsBaseMinorUnits}
        simulatedCount={summary.simulatedCount}
        baseCurrency={baseCurrency}
        onReset={onResetSimulations}
        onCommitArchive={onCommitSimulations}
      />

      {/* Primary 2-Column Executive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5/12): Sticky Burn Ring + Category Ledger + Budget Runway */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-5">
          <div className="rounded-2xl app-surface p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-[16px] font-bold tracking-tight text-text-primary">
                Spend breakdown
              </h2>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="text-xs font-semibold text-brand-text hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>

            <InteractiveBurnDial
              segments={summary.dialSegments}
              selectedCategory={selectedCategory}
              totalBaseMinorUnits={summary.displayedTotalBaseMinorUnits}
              baseCurrency={baseCurrency}
              showAnnual={showAnnual}
              onSelectCategory={onSelectCategory}
              onTogglePeriod={() => onToggleAnnual(!showAnnual)}
              onAddFirst={onAddClick}
            />

            <div className="mt-5 pt-4 border-t border-border/80 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs font-medium text-text-secondary">Active</p>
                <p className="mt-1 font-mono tabular-nums text-[15px] font-bold text-text-primary">
                  {summary.activeItems.length - summary.simulatedCount}
                </p>
              </div>
              <div className="border-x border-border/80">
                <p className="text-xs font-medium text-text-secondary">Due &le; 3d</p>
                <p
                  className={`mt-1 font-mono tabular-nums text-[15px] font-bold ${
                    summary.dueSoonCount > 0 ? 'text-amber-text' : 'text-text-primary'
                  }`}
                >
                  {summary.dueSoonCount}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-secondary">Price hikes</p>
                <p
                  className={`mt-1 font-mono tabular-nums text-[15px] font-bold ${
                    audit.priceHikes.length > 0 ? 'text-amber-text' : 'text-text-primary'
                  }`}
                >
                  {audit.priceHikes.length}
                </p>
              </div>
            </div>
          </div>

          <RunwayCeilingCard
            activeMonthlyBaseMinorUnits={summary.activeMonthlyBaseMinorUnits}
            monthlyCeilingMinorUnits={settings.monthlyCeilingMinorUnits}
            monthlyIncomeMinorUnits={settings.monthlyIncomeMinorUnits}
            budgetUsageRatio={summary.budgetUsageRatio}
            baseCurrency={baseCurrency}
            onEditCeiling={onEditCeilingClick}
          />
        </div>

        {/* Right Column (7/12): Search + Grouped Subscription Ledger */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="font-display text-[17px] font-bold tracking-tight text-text-primary truncate">
                {selectedVisual ? selectedVisual.label : 'Upcoming renewals'}
              </h2>
              <span className="font-mono text-xs font-semibold text-text-secondary tabular-nums">
                {filteredVisibleItems.length}
              </span>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="text-[13px] font-semibold text-brand-text hover:underline transition-colors cursor-pointer whitespace-nowrap"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search subscriptions..."
                aria-label="Search subscriptions"
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border hover:border-border-strong text-[15px] sm:text-sm text-text-primary placeholder:text-text-secondary focus:border-brand shadow-[0_1px_2px_rgba(15,26,23,0.03)] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {filteredVisibleItems.length === 0 ? (
            <div
              data-testid="empty-subscriptions-state"
              className="rounded-2xl app-surface p-8 sm:p-10 text-center"
            >
              <p className="font-display text-[18px] font-bold text-text-primary">
                {searchQuery || selectedCategory
                  ? 'No matching subscriptions'
                  : 'Your subscription ledger is clear'}
              </p>
              <p className="mt-1.5 text-[14px] text-text-secondary max-w-sm mx-auto">
                {searchQuery || selectedCategory
                  ? 'Try clearing your category filter or search query.'
                  : 'Add your first subscription manually or paste a bank statement in Insights.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {(searchQuery || selectedCategory) && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      onSearchChange('');
                      onSelectCategory(null);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
                <Button variant="primary" size="md" onClick={onAddClick}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add subscription</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5" data-testid="subscription-list">
              {dueGroups.map((group) => (
                <section key={group.id} aria-label={group.label} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[13px] font-semibold text-text-secondary">
                      {group.label}
                    </h3>
                    <span className="font-mono text-xs font-medium text-text-secondary tabular-nums">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="rounded-2xl app-surface divide-y divide-border/80 overflow-hidden">
                    {group.items.map((item) => (
                      <SubscriptionRow
                        key={item.subscription.id}
                        item={item}
                        settings={settings}
                        showAnnual={showAnnual}
                        isReadOnly={readOnlyIds.has(item.subscription.id)}
                        onSelect={handleOpenDetail}
                        onToggleSimulate={onToggleSimulate}
                        onRegisterRowRef={handleRegisterRowRef}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Cancelled / Archived Section */}
          {summary.archivedItems.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                aria-expanded={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                className="min-h-[44px] flex items-center gap-2 text-[13px] font-semibold text-text-secondary hover:text-text-primary py-2 cursor-pointer"
              >
                {showArchived ? (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Cancelled ({summary.archivedItems.length})</span>
              </button>

              {showArchived && (
                <div className="mt-2 rounded-2xl app-surface divide-y divide-border/80 overflow-hidden">
                  {summary.archivedItems.map((item) => (
                    <div
                      key={item.subscription.id}
                      className="px-4 py-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          title={item.subscription.name}
                          className="text-[15px] font-medium text-text-secondary line-through truncate"
                        >
                          {item.subscription.name}
                        </p>
                        <p className="font-mono text-[13px] text-text-secondary tabular-nums">
                          {formatMinorUnits(
                            item.subscription.amountMinorUnits,
                            item.subscription.currency,
                            {
                              showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(
                                item.subscription.currency,
                              ),
                            },
                          )}
                          {BILLING_CYCLES[item.subscription.cycle].shortSuffix}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onRestoreArchived(item.subscription.id)}
                        aria-label={`Restore ${item.subscription.name}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-brand-text" aria-hidden="true" />
                        <span>Restore</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subscription Detail Sheet */}
      <SubscriptionDetailSheet
        item={selectedItem}
        settings={settings}
        isReadOnly={selectedItem ? readOnlyIds.has(selectedItem.subscription.id) : false}
        onClose={handleCloseDetail}
        onUpdateUsage={onUpdateUsage}
        onToggleSimulate={onToggleSimulate}
        onOpenCancelKit={onOpenCancelKit}
        onExportSingleIcs={onExportSingleIcs}
        onEdit={onEditClick}
        onOpenUpgrade={onOpenUpgrade}
        onDelete={onDeleteClick}
      />
    </div>
  );
};
