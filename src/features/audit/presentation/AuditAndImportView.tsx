import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
  Layers,
  Mail,
  Pause,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import {
  BILLING_CYCLES,
  USAGE_FREQUENCY_META,
  getAnnualMinorUnits,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';
import {
  SAMPLE_BANK_STATEMENT,
  parseStatementText,
  type LeakAuditReport,
  type ParsedStatementCandidate,
} from '../domain/auditEngine';

interface AuditAndImportViewProps {
  readonly subscriptions: readonly Subscription[];
  readonly audit: LeakAuditReport;
  readonly settings: VaultSettings;
  readonly onOpenCancelKit: (id: string) => void;
  readonly onToggleSimulate: (id: string) => void;
  readonly onImportCandidates: (candidates: readonly ParsedStatementCandidate[]) => void;
}

export const AuditAndImportView: React.FC<AuditAndImportViewProps> = ({
  subscriptions,
  audit,
  settings,
  onOpenCancelKit,
  onToggleSimulate,
  onImportCandidates,
}) => {
  const [statementText, setStatementText] = useState('');
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [importBanner, setImportBanner] = useState<string | null>(null);

  const baseCurrency = settings.baseCurrency;
  const showDecimals = baseCurrency !== 'PKR';

  const parsedCandidates = useMemo(
    () => parseStatementText(statementText, subscriptions),
    [statementText, subscriptions],
  );

  const selectedCandidates = useMemo(
    () => parsedCandidates.filter((c) => !deselectedIds.has(c.tempId)),
    [parsedCandidates, deselectedIds],
  );

  const toggleCandidate = (tempId: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  const handleLoadSample = () => {
    setStatementText(SAMPLE_BANK_STATEMENT);
    setDeselectedIds(new Set());
    setImportBanner(null);
  };

  const handleCommitImport = () => {
    if (selectedCandidates.length === 0) return;
    onImportCandidates(selectedCandidates);
    setImportBanner(
      `Imported ${selectedCandidates.length} ${selectedCandidates.length === 1 ? 'bill' : 'bills'} into your Cashflow Overview.`,
    );
    setStatementText('');
    setDeselectedIds(new Set());
  };

  return (
    <div className="space-y-6" data-testid="audit-view">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#17211E]">
          Leak Audit &amp; Statement Scanner
        </h1>
        <p className="mt-1 text-sm text-[#5B6662]">
          Catch silent price hikes, unused subscriptions, and overlapping tools — or paste a bank statement locally.
        </p>
      </div>

      {/* Top Opportunity Cost Summary Card */}
      <section className="rounded-2xl bg-[#E6F2EE]/75 border border-[#C6E2D8] p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          <div>
            <p className="text-xs font-semibold text-[#155243]">Reclaimable Annual Spend</p>
            <p
              className="mt-1 font-mono tabular-nums text-3xl font-extrabold text-[#1E6B58]"
              data-testid="audit-reclaimable-total"
            >
              {formatMinorUnits(audit.totalReclaimableAnnualMinorUnits, baseCurrency, {
                showDecimals: false,
              })}
              <span className="text-base font-semibold text-[#386559]">/yr</span>
            </p>
            <p className="mt-1 text-xs text-[#386559]">
              From {audit.lowValueSubscriptions.length} low-use{' '}
              {audit.lowValueSubscriptions.length === 1 ? 'bill' : 'bills'} and{' '}
              {audit.priceHikes.length} price {audit.priceHikes.length === 1 ? 'hike' : 'hikes'}
            </p>
          </div>

          <div className="md:border-l md:border-[#C6E2D8] md:pl-5">
            <p className="text-xs font-semibold text-[#155243] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#1E6B58]" aria-hidden="true" />
              <span>5-Year Wealth Impact (7% APR)</span>
            </p>
            <p
              className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#17211E]"
              data-testid="audit-5yr-wealth"
            >
              {formatMinorUnits(audit.fiveYearInvestedValueMinorUnits, baseCurrency, {
                showDecimals: false,
              })}
            </p>
            <p className="mt-1 text-xs text-[#386559]">
              If reclaimed monthly cash is invested instead
            </p>
          </div>

          <div className="md:border-l md:border-[#C6E2D8] md:pl-5">
            <p className="text-xs font-semibold text-[#155243]">Silent Price Creep</p>
            <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#B86A14]">
              +
              {formatMinorUnits(audit.annualPriceHikeCreepMinorUnits, baseCurrency, {
                showDecimals,
              })}
              <span className="text-sm font-semibold">/yr</span>
            </p>
            <p className="mt-1 text-xs text-[#386559]">
              Extra yearly cost from recent provider increases
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Price Hikes, Unused Bills, Overlaps */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Price Hike Radar */}
          <section className="rounded-2xl vault-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#B86A14]" aria-hidden="true" />
                <h2 className="text-base font-bold text-[#17211E]">
                  Price Hikes Detected ({audit.priceHikes.length})
                </h2>
              </div>
              <span className="text-xs text-[#85918C]">Compare vs. prior rate</span>
            </div>

            {audit.priceHikes.length === 0 ? (
              <p className="text-xs text-[#5B6662] py-2">
                No recent price increases flagged. Add a prior rate when editing any bill or scan a new bank statement to catch hikes automatically.
              </p>
            ) : (
              <div className="space-y-3">
                {audit.priceHikes.map((hike) => {
                  const sub = hike.subscription;
                  const visual = getCategoryVisual(sub.category);
                  const Icon = visual.Icon;
                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl bg-[#FDF9F3] border border-[#EED9BD] p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${visual.color}16` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: visual.color }} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#17211E] truncate">{sub.name}</p>
                          <p className="text-xs text-[#5B6662] font-mono tabular-nums">
                            {formatMinorUnits(sub.previousAmountMinorUnits!, sub.currency, {
                              showDecimals: sub.currency !== 'PKR',
                            })}{' '}
                            &rarr;{' '}
                            <strong className="text-[#17211E]">
                              {formatMinorUnits(sub.amountMinorUnits, sub.currency, {
                                showDecimals: sub.currency !== 'PKR',
                              })}
                            </strong>
                            {BILLING_CYCLES[sub.cycle].shortSuffix}{' '}
                            <span className="text-[#B86A14] font-semibold">
                              (+{hike.percentIncrease}%)
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenCancelKit(sub.id)}
                        className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white border border-[#E4D0B5] hover:border-[#B86A14] text-xs font-semibold text-[#8A4F0B] flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Negotiate Rate</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. Low-Value & Zombie Subscriptions */}
          <section className="rounded-2xl vault-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#C64545]" aria-hidden="true" />
                <h2 className="text-base font-bold text-[#17211E]">
                  Unused &amp; Rarely Used ({audit.lowValueSubscriptions.length})
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-[#C64545]">
                {formatMinorUnits(audit.annualLowValueSavingsMinorUnits, baseCurrency, {
                  showDecimals: false,
                })}
                /yr at risk
              </span>
            </div>

            {audit.lowValueSubscriptions.length === 0 ? (
              <p className="text-xs text-[#5B6662] py-2">
                Every active bill is marked Daily or Weekly. Mark any bill as Rarely or Unused on Overview to surface savings here.
              </p>
            ) : (
              <div className="space-y-3">
                {audit.lowValueSubscriptions.map((sub) => {
                  const visual = getCategoryVisual(sub.category);
                  const Icon = visual.Icon;
                  const freq = sub.usageFrequency ?? 'unused';
                  const annualOwn = getAnnualMinorUnits(sub.amountMinorUnits, sub.cycle);
                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl bg-[#FDF6F6] border border-[#EED3D3] p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${visual.color}16` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: visual.color }} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#17211E] truncate">{sub.name}</p>
                          <p className="text-xs text-[#5B6662] font-mono tabular-nums">
                            <span
                              className="font-semibold"
                              style={{ color: USAGE_FREQUENCY_META[freq].tone }}
                            >
                              {USAGE_FREQUENCY_META[freq].label}
                            </span>{' '}
                            ·{' '}
                            {formatMinorUnits(annualOwn, sub.currency, {
                              showDecimals: false,
                            })}
                            /yr
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleSimulate(sub.id)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1 cursor-pointer"
                        >
                          <Pause className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
                          <span>Simulate Cut</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCancelKit(sub.id)}
                          className="min-h-[34px] px-3 py-1 rounded-lg bg-[#C64545] hover:bg-[#AE3939] text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Cancel Kit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. Category Overlap Radar */}
          {audit.overlapGroups.length > 0 && (
            <section className="rounded-2xl vault-surface p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2A8C94]" aria-hidden="true" />
                <h2 className="text-base font-bold text-[#17211E]">
                  Category Overlaps ({audit.overlapGroups.length})
                </h2>
              </div>
              <div className="space-y-2.5">
                {audit.overlapGroups.map((group) => (
                  <div
                    key={group.category}
                    className="rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#17211E]">
                        {group.label} · {group.count} active bills
                      </p>
                      <p className="text-xs text-[#5B6662] mt-0.5">
                        {group.items.map((i) => i.name).join(', ')}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-bold text-[#17211E]">
                      {formatMinorUnits(group.monthlyTotalBaseMinorUnits, baseCurrency, {
                        showDecimals,
                      })}
                      /mo
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (5 cols): Smart Local Bank Statement / SMS / CSV Importer */}
        <section
          className="lg:col-span-5 rounded-2xl vault-surface p-5 space-y-4"
          aria-label="Smart bank statement importer"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#1E6B58]" aria-hidden="true" />
                <h2 className="text-base font-bold text-[#17211E]">
                  Statement &amp; SMS Scanner
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#5B6662]">
                Paste card SMS alerts, bank CSV rows, or billing emails. Parsed 100% offline in your browser.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="statement-paste-input" className="text-xs font-semibold text-[#5B6662]">
                Paste raw transactions
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                data-testid="load-sample-statement"
                className="text-xs font-semibold text-[#1E6B58] hover:text-[#155243] cursor-pointer"
              >
                Load Realistic Statement
              </button>
            </div>

            <textarea
              id="statement-paste-input"
              rows={5}
              value={statementText}
              onChange={(e) => {
                setStatementText(e.target.value);
                setDeselectedIds(new Set());
                if (importBanner) setImportBanner(null);
              }}
              placeholder={`2026-11-18 | SPOTIFY PREMIUM | $11.99\n2026-11-19 | CHATGPT PLUS | $20.00`}
              className="w-full p-3 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] font-mono text-xs text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:border-[#1E6B58]"
            />
          </div>

          {importBanner && (
            <div
              role="status"
              data-testid="statement-import-success"
              className="rounded-xl bg-[#E6F2EE] border border-[#B9DDD0] px-3.5 py-2.5 text-xs font-semibold text-[#155243] flex items-center gap-2"
            >
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{importBanner}</span>
            </div>
          )}

          {parsedCandidates.length > 0 && (
            <div className="space-y-3" data-testid="parsed-statement-results">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#17211E]">
                  Detected {parsedCandidates.length} recurring{' '}
                  {parsedCandidates.length === 1 ? 'charge' : 'charges'}
                </span>
                <span className="text-[#5B6662]">
                  {selectedCandidates.length} selected
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {parsedCandidates.map((cand) => {
                  const checked = !deselectedIds.has(cand.tempId);
                  const visual = getCategoryVisual(cand.category);
                  return (
                    <label
                      key={cand.tempId}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-white border-[#1E6B58]/50'
                          : 'bg-[#F5F6F3] border-[#E4E7E1] opacity-65'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCandidate(cand.tempId)}
                        className="mt-0.5 accent-[#1E6B58] w-4 h-4 rounded cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#17211E] truncate">
                            {cand.name}
                          </span>
                          <span className="font-mono tabular-nums text-xs font-bold text-[#17211E] shrink-0">
                            {formatMinorUnits(cand.amountMinorUnits, cand.currency, {
                              showDecimals: cand.currency !== 'PKR',
                            })}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#5B6662]">
                          <span>{visual.label}</span>
                          <span>·</span>
                          <span>{BILLING_CYCLES[cand.cycle].label}</span>
                          {cand.detectedPriceHikeMinorUnits > 0 && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-[#B86A14]">
                                +
                                {formatMinorUnits(cand.detectedPriceHikeMinorUnits, cand.currency)}{' '}
                                hike vs. existing
                              </span>
                            </>
                          )}
                          {cand.matchedExistingId && cand.detectedPriceHikeMinorUnits === 0 && (
                            <>
                              <span>·</span>
                              <span className="text-[#1E6B58] font-medium">Matches existing</span>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={selectedCandidates.length === 0}
                onClick={handleCommitImport}
                data-testid="commit-statement-import"
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#1E6B58] hover:bg-[#175747] disabled:opacity-45 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>
                  Import {selectedCandidates.length} Selected{' '}
                  {selectedCandidates.length === 1 ? 'Bill' : 'Bills'}
                </span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
