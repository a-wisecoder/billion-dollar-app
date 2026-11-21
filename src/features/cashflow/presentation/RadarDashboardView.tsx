import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Search, X } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { CashflowSummary } from '../domain/cashflowEngine';
import { BILLING_CYCLES, type SubscriptionCategory, type VaultSettings } from '../domain/subscription';
import { InteractiveBurnDial } from './InteractiveBurnDial';
import { RunwayCeilingCard } from './RunwayCeilingCard';
import { SubscriptionCard } from './SubscriptionCard';
import { WhatIfSavingsBanner } from './WhatIfSavingsBanner';

interface RadarDashboardViewProps {
  readonly summary: CashflowSummary;
  readonly settings: VaultSettings;
  readonly selectedCategory: SubscriptionCategory | null;
  readonly showAnnual: boolean;
  readonly searchQuery: string;
  readonly onSelectCategory: (category: SubscriptionCategory | null) => void;
  readonly onToggleAnnual: (annual: boolean) => void;
  readonly onSearchChange: (q: string) => void;
  readonly onToggleSimulate: (id: string) => void;
  readonly onResetSimulations: () => void;
  readonly onCommitSimulations: () => void;
  readonly onRestoreArchived: (id: string) => void;
  readonly onAddClick: () => void;
  readonly onEditClick: (id: string) => void;
  readonly onDeleteClick: (id: string) => void;
  readonly onEditCeilingClick: () => void;
}

export const RadarDashboardView: React.FC<RadarDashboardViewProps> = ({
  summary,
  settings,
  selectedCategory,
  showAnnual,
  searchQuery,
  onSelectCategory,
  onToggleAnnual,
  onSearchChange,
  onToggleSimulate,
  onResetSimulations,
  onCommitSimulations,
  onRestoreArchived,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onEditCeilingClick,
}) => {
  const [showArchived, setShowArchived] = useState(false);

  const selectedVisual = selectedCategory ? getCategoryVisual(selectedCategory) : null;

  return (
    <div className="space-y-6">
      {/* Workspace Header & Period Toggle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F8FAFC]">
            Burn Rate Radar
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Drag the dial to inspect categories · Simulate pausing bills to forecast annual savings
          </p>
        </div>

        <div
          className="inline-flex items-center p-1 rounded-xl bg-[#111623] border border-[#232D42]"
          role="group"
          aria-label="Billing period display"
        >
          <button
            type="button"
            aria-pressed={!showAnnual}
            onClick={() => onToggleAnnual(false)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              !showAnnual
                ? 'bg-[#6366F1] text-white'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={showAnnual}
            onClick={() => onToggleAnnual(true)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              showAnnual
                ? 'bg-[#6366F1] text-white'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      {/* What-If Savings Unlocked Banner */}
      <WhatIfSavingsBanner
        annualSavingsBaseMinorUnits={summary.simulatedAnnualSavingsBaseMinorUnits}
        simulatedCount={summary.simulatedCount}
        baseCurrency={settings.baseCurrency}
        onReset={onResetSimulations}
        onCommitArchive={onCommitSimulations}
      />

      {/* Primary 2-Column Desktop / Stacked Mobile Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Burn Dial + Runway Ceiling + Key Totals */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl bg-[#111623] border border-[#232D42] p-6">
            <InteractiveBurnDial
              segments={summary.dialSegments}
              selectedCategory={selectedCategory}
              totalBaseMinorUnits={summary.displayedTotalBaseMinorUnits}
              baseCurrency={settings.baseCurrency}
              showAnnual={showAnnual}
              onSelectCategory={onSelectCategory}
              onTogglePeriod={() => onToggleAnnual(!showAnnual)}
              onAddFirst={onAddClick}
            />

            {/* Clean Unboxed Summary Divider Row */}
            <div className="mt-6 pt-5 border-t border-[#232D42] grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-[#94A3B8]">Active Bills</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-[#F8FAFC]">
                  {summary.activeItems.length - summary.simulatedCount}
                </p>
              </div>
              <div className="border-x border-[#232D42]">
                <p className="text-xs text-[#94A3B8]">Due &le; 3d</p>
                <p
                  className={`mt-1 font-mono tabular-nums text-base font-bold ${
                    summary.dueSoonCount > 0 ? 'text-[#F59E0B]' : 'text-[#F8FAFC]'
                  }`}
                >
                  {summary.dueSoonCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#94A3B8]">Free Trials</p>
                <p
                  className={`mt-1 font-mono tabular-nums text-base font-bold ${
                    summary.activeTrialCount > 0 ? 'text-[#F59E0B]' : 'text-[#F8FAFC]'
                  }`}
                >
                  {summary.activeTrialCount}
                </p>
              </div>
            </div>
          </div>

          <RunwayCeilingCard
            activeMonthlyBaseMinorUnits={summary.activeMonthlyBaseMinorUnits}
            monthlyCeilingMinorUnits={settings.monthlyCeilingMinorUnits}
            budgetUsageRatio={summary.budgetUsageRatio}
            baseCurrency={settings.baseCurrency}
            onEditCeiling={onEditCeilingClick}
          />
        </div>

        {/* Right Column: Search + Renewals List + Archived */}
        <div className="lg:col-span-7 space-y-4">
          {/* Section Header + Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-[#F8FAFC]">
                {selectedVisual
                  ? `${selectedVisual.label} (${summary.visibleItems.length})`
                  : `Upcoming Renewals (${summary.visibleItems.length})`}
              </h2>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="text-xs font-semibold text-[#6366F1] hover:text-[#818CF8] transition-colors cursor-pointer"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search bills or notes..."
                aria-label="Search subscriptions"
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#111623] border border-[#232D42] text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#6366F1]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search query"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Renewals List or Empty State */}
          {summary.visibleItems.length === 0 ? (
            <div className="rounded-2xl bg-[#111623] border border-[#232D42] p-8 text-center">
              <p className="text-sm font-semibold text-[#F8FAFC]">
                {searchQuery || selectedCategory
                  ? 'No matching subscriptions found'
                  : 'Your cashflow radar is empty'}
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                {searchQuery || selectedCategory
                  ? 'Try clearing your active filter or search term.'
                  : 'Add your recurring software, utilities, or free trials to start tracking locally.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {(searchQuery || selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      onSelectCategory(null);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1A2234] border border-[#232D42] text-xs font-semibold text-[#F8FAFC] cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAddClick}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5558E6] text-xs font-semibold text-white cursor-pointer"
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
                  baseCurrency={settings.baseCurrency}
                  showAnnual={showAnnual}
                  onToggleSimulate={onToggleSimulate}
                  onEdit={onEditClick}
                  onDelete={onDeleteClick}
                />
              ))}
            </div>
          )}

          {/* Permanently Paused / Archived Section */}
          {summary.archivedItems.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                aria-expanded={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] py-2 cursor-pointer"
              >
                {showArchived ? (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Paused / Archived ({summary.archivedItems.length})</span>
              </button>

              {showArchived && (
                <div className="mt-2 space-y-2">
                  {summary.archivedItems.map((item) => (
                    <div
                      key={item.subscription.id}
                      className="rounded-xl bg-[#111623]/70 border border-[#232D42] px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#94A3B8] line-through truncate">
                          {item.subscription.name}
                        </p>
                        <p className="text-xs text-[#64748B] font-mono tabular-nums">
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
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#1A2234] border border-[#232D42] hover:border-[#10B981] text-xs font-semibold text-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
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
