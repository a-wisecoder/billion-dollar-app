import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, RotateCcw, Search, X } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { LeakAuditReport } from '../../audit/domain/auditEngine';
import type { CashflowSummary } from '../domain/cashflowEngine';
import {
  BILLING_CYCLES,
  type SubscriptionCategory,
  type UsageFrequency,
  type VaultSettings,
} from '../domain/subscription';
import { InteractiveBurnDial } from './InteractiveBurnDial';
import { RunwayCeilingCard } from './RunwayCeilingCard';
import { SubscriptionCard } from './SubscriptionCard';
import { WhatIfSavingsBanner } from './WhatIfSavingsBanner';

interface RadarDashboardViewProps {
  readonly summary: CashflowSummary;
  readonly audit: LeakAuditReport;
  readonly settings: VaultSettings;
  readonly selectedCategory: SubscriptionCategory | null;
  readonly showAnnual: boolean;
  readonly searchQuery: string;
  readonly onSelectCategory: (category: SubscriptionCategory | null) => void;
  readonly onToggleAnnual: (annual: boolean) => void;
  readonly onSearchChange: (q: string) => void;
  readonly onToggleSimulate: (id: string) => void;
  readonly onUpdateUsage: (id: string, usage: UsageFrequency) => void;
  readonly onOpenCancelKit: (id: string) => void;
  readonly onResetSimulations: () => void;
  readonly onCommitSimulations: () => void;
  readonly onRestoreArchived: (id: string) => void;
  readonly onAddClick: () => void;
  readonly onEditClick: (id: string) => void;
  readonly onDeleteClick: (id: string) => void;
  readonly onEditCeilingClick: () => void;
  readonly onOpenAuditTab: () => void;
}

export const RadarDashboardView: React.FC<RadarDashboardViewProps> = ({
  summary,
  audit,
  settings,
  selectedCategory,
  showAnnual,
  searchQuery,
  onSelectCategory,
  onToggleAnnual,
  onSearchChange,
  onToggleSimulate,
  onUpdateUsage,
  onOpenCancelKit,
  onResetSimulations,
  onCommitSimulations,
  onRestoreArchived,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onEditCeilingClick,
  onOpenAuditTab,
}) => {
  const [showArchived, setShowArchived] = useState(false);

  const selectedVisual = selectedCategory ? getCategoryVisual(selectedCategory) : null;
  const baseCurrency = settings.baseCurrency;
  const showDecimals = baseCurrency !== 'PKR';

  const incomeSharePct =
    settings.monthlyIncomeMinorUnits && settings.monthlyIncomeMinorUnits > 0
      ? ((summary.activeMonthlyBaseMinorUnits / settings.monthlyIncomeMinorUnits) * 100).toFixed(1)
      : null;

  const leakIssueCount = audit.priceHikes.length + audit.lowValueSubscriptions.length;

  return (
    <div className="space-y-6">
      {/* Editorial Workspace Header & Period Toggle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#17211E]">
            Cashflow Overview
          </h1>
          <p className="mt-1 text-sm text-[#5B6662]">
            Track exact checking buffer, rate usage per bill, and reclaim unused recurring spend.
          </p>
        </div>

        <div
          className="inline-flex items-center p-1 rounded-xl bg-[#EEF1EC] border border-[#E4E7E1]"
          role="group"
          aria-label="Billing period display"
        >
          <button
            type="button"
            aria-pressed={!showAnnual}
            onClick={() => onToggleAnnual(false)}
            className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              !showAnnual
                ? 'bg-white text-[#17211E] shadow-xs'
                : 'text-[#5B6662] hover:text-[#17211E]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={showAnnual}
            onClick={() => onToggleAnnual(true)}
            className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              showAnnual
                ? 'bg-white text-[#17211E] shadow-xs'
                : 'text-[#5B6662] hover:text-[#17211E]'
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      {/* Live 4-KPI Cashflow Strip */}
      <section
        aria-label="Key cashflow metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <div className="rounded-2xl vault-surface p-4">
          <p className="text-xs font-medium text-[#5B6662]">Next 14 Days Due</p>
          <p
            className="mt-1.5 font-mono tabular-nums text-xl sm:text-2xl font-bold text-[#17211E]"
            data-testid="kpi-14day-buffer"
          >
            {formatMinorUnits(audit.next14DaysDueMinorUnits, baseCurrency, { showDecimals })}
          </p>
          <p className="mt-1 text-xs text-[#85918C]">
            {audit.next14DaysCount} {audit.next14DaysCount === 1 ? 'bill' : 'bills'} in checking buffer
          </p>
        </div>

        <div className="rounded-2xl vault-surface p-4">
          <p className="text-xs font-medium text-[#5B6662]">Monthly Burn</p>
          <p className="mt-1.5 font-mono tabular-nums text-xl sm:text-2xl font-bold text-[#17211E]">
            {formatMinorUnits(summary.activeMonthlyBaseMinorUnits, baseCurrency, { showDecimals })}
          </p>
          <p className="mt-1 text-xs text-[#85918C]">
            {incomeSharePct !== null ? `${incomeSharePct}% of take-home pay` : `${summary.activeItems.length} active bills`}
          </p>
        </div>

        <div className="rounded-2xl vault-surface p-4">
          <p className="text-xs font-medium text-[#5B6662]">Annual Run Rate</p>
          <p className="mt-1.5 font-mono tabular-nums text-xl sm:text-2xl font-bold text-[#17211E]">
            {formatMinorUnits(summary.activeAnnualBaseMinorUnits, baseCurrency, { showDecimals: false })}
          </p>
          <p className="mt-1 text-xs text-[#85918C]">
            {summary.activeTrialCount > 0
              ? `${summary.activeTrialCount} active free ${summary.activeTrialCount === 1 ? 'trial' : 'trials'}`
              : 'All recurring commitments'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAuditTab}
          data-testid="kpi-reclaimable-leaks"
          className="text-left rounded-2xl bg-[#E6F2EE]/65 hover:bg-[#E6F2EE] border border-[#C6E2D8] p-4 transition-colors cursor-pointer group focus-visible:outline-2 focus-visible:outline-[#1E6B58]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#155243]">Reclaimable Leaks</p>
            <ArrowRight
              className="w-3.5 h-3.5 text-[#1E6B58] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <p className="mt-1.5 font-mono tabular-nums text-xl sm:text-2xl font-bold text-[#1E6B58]">
            {formatMinorUnits(audit.totalReclaimableAnnualMinorUnits, baseCurrency, {
              showDecimals: false,
            })}
            <span className="text-xs font-semibold text-[#386559]">/yr</span>
          </p>
          <p className="mt-1 text-xs text-[#386559]">
            {leakIssueCount > 0
              ? `${leakIssueCount} ${leakIssueCount === 1 ? 'item' : 'items'} flagged in Audit`
              : 'No leaks flagged right now'}
          </p>
        </button>
      </section>

      {/* What-If Savings Unlocked Banner */}
      <WhatIfSavingsBanner
        annualSavingsBaseMinorUnits={summary.simulatedAnnualSavingsBaseMinorUnits}
        simulatedCount={summary.simulatedCount}
        baseCurrency={baseCurrency}
        onReset={onResetSimulations}
        onCommitArchive={onCommitSimulations}
      />

      {/* Primary 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Burn Dial + Runway Ceiling */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl vault-surface p-6">
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

            <div className="mt-6 pt-5 border-t border-[#EEF1EC] grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-[#5B6662]">Active</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-[#17211E]">
                  {summary.activeItems.length - summary.simulatedCount}
                </p>
              </div>
              <div className="border-x border-[#EEF1EC]">
                <p className="text-xs text-[#5B6662]">Due &le; 3d</p>
                <p
                  className={`mt-1 font-mono tabular-nums text-base font-bold ${
                    summary.dueSoonCount > 0 ? 'text-[#B86A14]' : 'text-[#17211E]'
                  }`}
                >
                  {summary.dueSoonCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#5B6662]">Price Hikes</p>
                <p
                  className={`mt-1 font-mono tabular-nums text-base font-bold ${
                    audit.priceHikes.length > 0 ? 'text-[#B86A14]' : 'text-[#17211E]'
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

        {/* Right Column: Search + Interactive Subscriptions Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-[#17211E]">
                {selectedVisual
                  ? `${selectedVisual.label} (${summary.visibleItems.length})`
                  : `Upcoming Renewals (${summary.visibleItems.length})`}
              </h2>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="text-xs font-semibold text-[#1E6B58] hover:text-[#155243] transition-colors cursor-pointer"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-[#85918C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search bills or notes..."
                aria-label="Search subscriptions"
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-white border border-[#E4E7E1] text-sm text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:border-[#1E6B58]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search query"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#85918C] hover:text-[#17211E] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {summary.visibleItems.length === 0 ? (
            <div className="rounded-2xl vault-surface p-8 text-center">
              <p className="text-sm font-bold text-[#17211E]">
                {searchQuery || selectedCategory
                  ? 'No matching subscriptions found'
                  : 'Your cashflow overview is empty'}
              </p>
              <p className="mt-1 text-xs text-[#5B6662]">
                {searchQuery || selectedCategory
                  ? 'Try clearing your active filter or search term.'
                  : 'Add recurring bills manually or paste a bank statement inside Audit.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {(searchQuery || selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      onSelectCategory(null);
                    }}
                    className="min-h-[38px] px-4 py-2 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] text-xs font-semibold text-[#17211E] cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAddClick}
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-[#1E6B58] hover:bg-[#175747] text-xs font-semibold text-white cursor-pointer"
                >
                  Add First Bill
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="subscription-list">
              {summary.visibleItems.map((item) => (
                <SubscriptionCard
                  key={item.subscription.id}
                  item={item}
                  settings={settings}
                  showAnnual={showAnnual}
                  onToggleSimulate={onToggleSimulate}
                  onUpdateUsage={onUpdateUsage}
                  onOpenCancelKit={onOpenCancelKit}
                  onEdit={onEditClick}
                  onDelete={onDeleteClick}
                />
              ))}
            </div>
          )}

          {/* Archived Section */}
          {summary.archivedItems.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                aria-expanded={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-[#5B6662] hover:text-[#17211E] py-2 cursor-pointer"
              >
                {showArchived ? (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Cancelled / Archived ({summary.archivedItems.length})</span>
              </button>

              {showArchived && (
                <div className="mt-2 space-y-2">
                  {summary.archivedItems.map((item) => (
                    <div
                      key={item.subscription.id}
                      className="rounded-xl bg-[#FAFBF9] border border-[#E4E7E1] px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#5B6662] line-through truncate">
                          {item.subscription.name}
                        </p>
                        <p className="text-xs text-[#85918C] font-mono tabular-nums">
                          {formatMinorUnits(
                            item.subscription.amountMinorUnits,
                            item.subscription.currency,
                            { showDecimals: item.subscription.currency !== 'PKR' },
                          )}
                          {BILLING_CYCLES[item.subscription.cycle].shortSuffix}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRestoreArchived(item.subscription.id)}
                        aria-label={`Restore ${item.subscription.name}`}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#1E6B58]" aria-hidden="true" />
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
    </div>
  );
};
