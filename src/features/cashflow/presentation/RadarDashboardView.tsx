import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
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

  const dueGroups = useMemo(
    () => groupSubscriptionsByDueWindow(summary.visibleItems, todayIso),
    [summary.visibleItems, todayIso],
  );

  const selectedItem = useMemo(
    () =>
      selectedSubId
        ? (summary.activeItems.find((i) => i.subscription.id === selectedSubId) ?? null)
        : null,
    [selectedSubId, summary.activeItems],
  );

  const handleOpenDetail = (id: string) => {
    lastOpenedIdRef.current = id;
    setSelectedSubId(id);
  };

  const handleCloseDetail = () => {
    const returnId = lastOpenedIdRef.current;
    setSelectedSubId(null);
    if (returnId) {
      window.requestAnimationFrame(() => {
        rowRefs.current.get(returnId)?.focus();
      });
    }
  };

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
                <button
                  type="button"
                  onClick={() => onExpiredTrialCancelled(trial.id)}
                  className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-card border border-amber-border hover:border-brand text-[13px] font-semibold text-text-primary transition-colors cursor-pointer"
                >
                  Yes, cancelled
                </button>
                <button
                  type="button"
                  onClick={() => onExpiredTrialPaid(trial.id)}
                  className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-[13px] font-semibold text-white transition-colors cursor-pointer"
                >
                  No, it&apos;s now paid
                </button>
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
            <span className="text-xs font-semibold text-amber-text tabular-nums">
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
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-card border border-amber-border hover:border-brand text-left flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-[13px] font-semibold text-text-primary">
                  {reminder.title}
                </span>
                <span className="text-[13px] font-bold text-amber-text tabular-nums">
                  {reminder.formattedAmount}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Workspace Header & Period Toggle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-text-primary">
            Your subscriptions
          </h1>
          <p className="mt-1 text-[15px] sm:text-sm text-text-secondary">
            See what renews next and what you can cancel.
          </p>
        </div>

        <div
          className="inline-flex items-center p-1 rounded-xl bg-subtle border border-border"
          role="group"
          aria-label="Billing period display"
        >
          <button
            type="button"
            aria-pressed={!showAnnual}
            onClick={() => onToggleAnnual(false)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              !showAnnual
                ? 'bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={showAnnual}
            onClick={() => onToggleAnnual(true)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              showAnnual
                ? 'bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {/* Live 4-KPI Strip (2x2 at 360px, 4-col on desktop) */}
      <section
        aria-label="Key spending metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <div className="rounded-2xl app-surface p-4">
          <p className="text-[13px] font-medium text-text-secondary">Due in the next 14 days</p>
          <p
            className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-text-primary"
            data-testid="kpi-14day-buffer"
          >
            {formatMinorUnits(audit.next14DaysDueMinorUnits, baseCurrency, { showDecimals })}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary tabular-nums">
            {audit.next14DaysCount} {audit.next14DaysCount === 1 ? 'payment' : 'payments'}
          </p>
        </div>

        <div className="rounded-2xl app-surface p-4">
          <p className="text-[13px] font-medium text-text-secondary">Monthly average</p>
          <p className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-text-primary">
            {formatMinorUnits(summary.activeMonthlyBaseMinorUnits, baseCurrency, { showDecimals })}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            Yearly and quarterly bills spread per month
          </p>
        </div>

        <div className="rounded-2xl app-surface p-4">
          <p className="text-[13px] font-medium text-text-secondary">Per year</p>
          <p className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-text-primary">
            {formatMinorUnits(summary.activeAnnualBaseMinorUnits, baseCurrency, {
              showDecimals: false,
            })}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {summary.activeTrialCount > 0
              ? `${summary.activeTrialCount} free ${summary.activeTrialCount === 1 ? 'trial' : 'trials'} active`
              : `${summary.activeItems.length} active total`}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAuditTab}
          data-testid="kpi-savings-found"
          className="text-left rounded-2xl bg-brand-soft hover:brightness-[0.98] border border-brand-border p-4 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-brand-text">Savings found</p>
            <ArrowRight
              className="w-4 h-4 text-brand-text transition-transform group-hover:translate-x-0.5 shrink-0"
              aria-hidden="true"
            />
          </div>
          <p className="mt-1.5 tabular-nums text-xl sm:text-2xl font-bold text-brand-text">
            {formatMinorUnits(audit.totalReclaimableAnnualMinorUnits, baseCurrency, {
              showDecimals: false,
            })}
            <span className="text-[13px] font-semibold">/yr</span>
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {flaggedCount > 0
              ? `${flaggedCount} ${flaggedCount === 1 ? 'item' : 'items'} in Insights`
              : 'All subscriptions look good'}
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

      {/* Primary 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5/12): Sticky Spending Chart + Monthly Budget */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-5">
          <div className="rounded-2xl app-surface p-6">
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

            <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[13px] text-text-secondary">Active</p>
                <p className="mt-1 tabular-nums text-base font-bold text-text-primary">
                  {summary.activeItems.length - summary.simulatedCount}
                </p>
              </div>
              <div className="border-x border-border">
                <p className="text-[13px] text-text-secondary">Due &le; 3d</p>
                <p
                  className={`mt-1 tabular-nums text-base font-bold ${
                    summary.dueSoonCount > 0 ? 'text-amber-text' : 'text-text-primary'
                  }`}
                >
                  {summary.dueSoonCount}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-text-secondary">Price hikes</p>
                <p
                  className={`mt-1 tabular-nums text-base font-bold ${
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

        {/* Right Column (7/12): Search + Grouped Subscription Rows */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-text-primary">
                {selectedVisual
                  ? `${selectedVisual.label} (${summary.visibleItems.length})`
                  : `Upcoming renewals (${summary.visibleItems.length})`}
              </h2>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="text-[13px] font-semibold text-brand-text hover:underline transition-colors cursor-pointer"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search subscriptions..."
                aria-label="Search subscriptions"
                className="w-full h-11 pl-9 pr-10 rounded-xl bg-card border border-border text-[15px] sm:text-sm text-text-primary placeholder:text-text-secondary focus:border-brand"
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

          {summary.visibleItems.length === 0 ? (
            <div className="rounded-2xl app-surface p-8 text-center">
              <p className="text-[15px] font-bold text-text-primary">
                {searchQuery || selectedCategory
                  ? 'No matching subscriptions'
                  : 'No subscriptions added yet'}
              </p>
              <p className="mt-1 text-[13px] text-text-secondary">
                {searchQuery || selectedCategory
                  ? 'Try clearing your filter or search.'
                  : 'Add one manually or import a bank statement in Insights.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2.5">
                {(searchQuery || selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      onSelectCategory(null);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-subtle border border-border text-[13px] font-semibold text-text-primary cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAddClick}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-[13px] font-semibold text-white cursor-pointer"
                >
                  Add subscription
                </button>
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
                    <span className="text-[13px] text-text-secondary tabular-nums">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="rounded-2xl app-surface divide-y divide-border overflow-hidden">
                    {group.items.map((item) => (
                      <SubscriptionRow
                        key={item.subscription.id}
                        ref={(el) => {
                          if (el) {
                            rowRefs.current.set(item.subscription.id, el);
                          } else {
                            rowRefs.current.delete(item.subscription.id);
                          }
                        }}
                        item={item}
                        settings={settings}
                        showAnnual={showAnnual}
                        isReadOnly={readOnlyIds.has(item.subscription.id)}
                        onSelect={handleOpenDetail}
                        onToggleSimulate={onToggleSimulate}
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
                <div className="mt-2 rounded-2xl app-surface divide-y divide-border overflow-hidden">
                  {summary.archivedItems.map((item) => (
                    <div
                      key={item.subscription.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-text-secondary line-through truncate">
                          {item.subscription.name}
                        </p>
                        <p className="text-[13px] text-text-secondary tabular-nums">
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
                      <button
                        type="button"
                        onClick={() => onRestoreArchived(item.subscription.id)}
                        aria-label={`Restore ${item.subscription.name}`}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-subtle border border-border hover:border-brand text-[13px] font-semibold text-text-primary flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-brand-text" aria-hidden="true" />
                        <span>Restore</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subscription Detail Sheet (Bottom Sheet on mobile, Right Panel on desktop) */}
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
