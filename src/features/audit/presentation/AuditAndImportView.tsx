import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  Mail,
  Pause,
  Plus,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { convertMinorUnits } from '../../../core/utils/currencyConverter';
import { formatShortDate } from '../../../core/utils/dateMath';
import {
  formatMinorUnits,
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LIST,
  USAGE_FREQUENCY_META,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  getAnnualMinorUnits,
  getEffectiveExchangeRates,
  getMonthlyMinorUnits,
  type BillingCycle,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';
import {
  can,
  remaining,
  type EntitlementsState,
} from '../../billing/domain/entitlements';
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import { detectDefaultDateOrder } from '../../onboarding/domain/localeCurrency';
import type { LeakAuditReport } from '../domain/auditEngine';
import {
  SAMPLE_STATEMENT_CSV,
  parseStatementImport,
  type DateOrder,
  type StatementImportCandidate,
} from '../domain/statementImport';

interface AuditAndImportViewProps {
  readonly subscriptions: readonly Subscription[];
  readonly audit: LeakAuditReport;
  readonly settings: VaultSettings;
  readonly entitlements: EntitlementsState;
  readonly onOpenCancelKit: (id: string) => void;
  readonly onToggleSimulate: (id: string) => void;
  readonly onImportCandidates: (candidates: readonly StatementImportCandidate[]) => void;
  readonly onAddSingleCandidate: (candidate: StatementImportCandidate) => boolean;
  readonly onOpenUpgradeForImport: (
    candidates: readonly StatementImportCandidate[],
    contextMessage?: string,
  ) => void;
  readonly postUpgradeImportNotice?: { readonly id: number; readonly message: string } | null;
}

interface CandidateEditOverride {
  readonly name?: string;
  readonly amountInput?: string;
  readonly cycle?: BillingCycle;
}

export const AuditAndImportView: React.FC<AuditAndImportViewProps> = ({
  subscriptions,
  audit,
  settings,
  entitlements,
  onOpenCancelKit,
  onToggleSimulate,
  onImportCandidates,
  onAddSingleCandidate,
  onOpenUpgradeForImport,
  postUpgradeImportNotice,
}) => {
  const [statementText, setStatementText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [preferredDateOrder, setPreferredDateOrder] = useState<DateOrder>(() =>
    detectDefaultDateOrder(),
  );
  const [deselectedSubIds, setDeselectedSubIds] = useState<Set<string>>(new Set());
  const [selectedOneOffIds, setSelectedOneOffIds] = useState<Set<string>>(new Set());
  const [addedSingleIds, setAddedSingleIds] = useState<Set<string>>(new Set());
  const [showOneOffs, setShowOneOffs] = useState(false);
  const [editsByTempId, setEditsByTempId] = useState<Record<string, CandidateEditOverride>>({});
  const [importBanner, setImportBanner] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const handledImportNoticeIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!postUpgradeImportNotice) return;
    if (handledImportNoticeIdRef.current === postUpgradeImportNotice.id) return;
    handledImportNoticeIdRef.current = postUpgradeImportNotice.id;
    setImportBanner(postUpgradeImportNotice.message);
    setStatementText('');
    setUploadedFileName(null);
    setDeselectedSubIds(new Set());
    setSelectedOneOffIds(new Set());
    setAddedSingleIds(new Set());
    setEditsByTempId({});
    setShowOneOffs(false);
    setFileError(null);
  }, [postUpgradeImportNotice]);

  const canBulkImport = can('statementImport', entitlements);
  const remainingFreeSlots = remaining('addSubscription', entitlements);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const baseCurrency = settings.baseCurrency;
  const showDecimals = !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(baseCurrency);

  const parseResult = useMemo(
    () =>
      parseStatementImport(statementText, subscriptions, {
        preferredDateOrder,
        defaultCurrency: baseCurrency,
      }),
    [statementText, subscriptions, preferredDateOrder, baseCurrency],
  );

  const effectiveDateOrder = parseResult.detectedDateOrder;

  const applyCandidateEdits = (cand: StatementImportCandidate): StatementImportCandidate => {
    const override = editsByTempId[cand.tempId];
    if (!override) return cand;
    const editedName = override.name !== undefined ? override.name.trim() || cand.name : cand.name;
    const parsedMinor =
      override.amountInput !== undefined ? parseDecimalToMinorUnits(override.amountInput) : null;
    const editedAmount = parsedMinor !== null ? parsedMinor : cand.amountMinorUnits;
    const editedCycle = override.cycle ?? cand.cycle;
    return {
      ...cand,
      name: editedName,
      amountMinorUnits: editedAmount,
      cycle: editedCycle,
    };
  };

  const selectedCandidates = useMemo(() => {
    const subs = parseResult.subscriptions
      .filter((c) => !deselectedSubIds.has(c.tempId))
      .map(applyCandidateEdits);
    const oneOffs = parseResult.oneOffCharges
      .filter((c) => selectedOneOffIds.has(c.tempId))
      .map(applyCandidateEdits);
    return [...subs, ...oneOffs];
  }, [parseResult, deselectedSubIds, selectedOneOffIds, editsByTempId]);

  const foundMonthlyTotalBaseMinorUnits = useMemo(() => {
    const rates = getEffectiveExchangeRates(settings);
    const markup = settings.cardMarkupPercent ?? 0;
    return parseResult.subscriptions.reduce((sum, rawCand) => {
      const cand = applyCandidateEdits(rawCand);
      const monthlyOwn = getMonthlyMinorUnits(cand.amountMinorUnits, cand.cycle);
      return (
        sum +
        convertMinorUnits(monthlyOwn, cand.currency, baseCurrency, rates, markup)
      );
    }, 0);
  }, [parseResult.subscriptions, editsByTempId, baseCurrency, settings]);

  const resetImportSelections = () => {
    setDeselectedSubIds(new Set());
    setSelectedOneOffIds(new Set());
    setAddedSingleIds(new Set());
    setEditsByTempId({});
    setShowOneOffs(false);
    setImportBanner(null);
    setFileError(null);
  };

  const toggleSubCandidate = (tempId: string) => {
    setDeselectedSubIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const toggleOneOffCandidate = (tempId: string) => {
    setSelectedOneOffIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const updateCandidateField = (tempId: string, patch: Partial<CandidateEditOverride>) => {
    setEditsByTempId((prev) => ({
      ...prev,
      [tempId]: { ...prev[tempId], ...patch },
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File is too large (max 5 MB). Export 3–6 months of statement rows.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text.trim()) {
        setFileError('This file looks empty.');
        return;
      }
      setStatementText(text);
      setUploadedFileName(file.name);
      resetImportSelections();
    };
    reader.onerror = () => {
      setFileError('Could not read that file. Try saving as CSV or pasting the text.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadSample = () => {
    setStatementText(SAMPLE_STATEMENT_CSV);
    setUploadedFileName(null);
    resetImportSelections();
  };

  const handleCommitImport = () => {
    if (!canBulkImport) {
      const targetCandidates =
        selectedCandidates.length > 0
          ? selectedCandidates
          : parseResult.subscriptions.map(applyCandidateEdits);
      onOpenUpgradeForImport(
        targetCandidates,
        `Unlock Pro to import all ${targetCandidates.length} detected ${
          targetCandidates.length === 1 ? 'subscription' : 'subscriptions'
        } in one click.`,
      );
      return;
    }

    if (selectedCandidates.length === 0) return;
    const updatesCount = selectedCandidates.filter((c) => Boolean(c.matchedExistingId)).length;
    const addsCount = selectedCandidates.length - updatesCount;
    onImportCandidates(selectedCandidates);

    const parts: string[] = [];
    if (addsCount > 0) parts.push(`added ${addsCount}`);
    if (updatesCount > 0) parts.push(`updated ${updatesCount}`);
    setImportBanner(
      `Done — ${parts.join(' and ')} ${
        selectedCandidates.length === 1 ? 'subscription' : 'subscriptions'
      } in Home.`,
    );
    setStatementText('');
    setUploadedFileName(null);
    setDeselectedSubIds(new Set());
    setSelectedOneOffIds(new Set());
    setAddedSingleIds(new Set());
    setEditsByTempId({});
    setShowOneOffs(false);
  };

  const handleAddSingleRow = (rawCand: StatementImportCandidate) => {
    const edited = applyCandidateEdits(rawCand);
    const addedNow = onAddSingleCandidate(edited);
    if (addedNow) {
      setAddedSingleIds((prev) => new Set(prev).add(rawCand.tempId));
      setImportBanner(`Added ${edited.name} to Home.`);
    }
  };

  const renderCandidateRow = (
    cand: StatementImportCandidate,
    checked: boolean,
    onToggle: () => void,
  ) => {
    const override = editsByTempId[cand.tempId];
    const nameValue = override?.name ?? cand.name;
    const amountValue =
      override?.amountInput ?? minorUnitsToInputString(cand.amountMinorUnits);
    const cycleValue = override?.cycle ?? cand.cycle;
    const isUpdate = Boolean(cand.matchedExistingId);

    return (
      <div
        key={cand.tempId}
        data-testid={`import-row-${cand.tempId}`}
        className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
          checked ? 'bg-card border-brand' : 'bg-subtle border-border opacity-70'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <label className="min-h-[36px] min-w-[32px] flex items-center justify-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={checked}
              onChange={onToggle}
              aria-label={`Select ${nameValue}`}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <ServiceAvatar
            name={nameValue}
            category={cand.category}
            catalogId={cand.catalogId}
            size="sm"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 justify-between">
              <input
                type="text"
                aria-label="Subscription name"
                value={nameValue}
                onChange={(e) => updateCandidateField(cand.tempId, { name: e.target.value })}
                className="min-w-[130px] flex-1 h-9 px-2.5 rounded-lg bg-subtle border border-border text-[13px] font-bold text-text-primary focus:bg-card focus:border-brand"
              />
              {!canBulkImport ? (
                addedSingleIds.has(cand.tempId) ? (
                  <span className="px-2.5 py-1 rounded-lg bg-brand-soft text-brand-text text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Added</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`import-single-add-${cand.tempId}`}
                    onClick={() => handleAddSingleRow(cand)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-brand-soft border border-brand-border hover:border-brand text-brand-text text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
                  >
                    {isUpdate ? 'Update' : 'Add one'}
                  </button>
                )
              ) : (
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                    isUpdate
                      ? 'bg-amber-soft text-amber-text'
                      : 'bg-brand-soft text-brand-text'
                  }`}
                >
                  {isUpdate ? 'Update price' : 'Add'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-secondary">
                  {cand.currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Price for ${nameValue}`}
                  value={amountValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9,]*\.?[0-9]{0,2}$/.test(val)) {
                      updateCandidateField(cand.tempId, { amountInput: val });
                    }
                  }}
                  className="w-full h-9 pl-11 pr-2.5 rounded-lg bg-subtle border border-border text-[13px] font-bold tabular-nums text-text-primary focus:bg-card focus:border-brand"
                />
              </div>

              <select
                aria-label={`Billing cycle for ${nameValue}`}
                value={cycleValue}
                onChange={(e) =>
                  updateCandidateField(cand.tempId, {
                    cycle: e.target.value as BillingCycle,
                  })
                }
                className="w-full h-9 px-2.5 rounded-lg bg-subtle border border-border text-[13px] font-medium text-text-primary focus:bg-card focus:border-brand"
              >
                {BILLING_CYCLE_LIST.map((cycleOption) => (
                  <option key={cycleOption} value={cycleOption}>
                    {BILLING_CYCLES[cycleOption].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-secondary tabular-nums">
              <span>
                {cand.confidence === 'high'
                  ? `${cand.chargeCount} matching charges`
                  : cand.confidence === 'likely'
                    ? 'Known service'
                    : 'One-off charge'}
              </span>
              <span>·</span>
              <span>Next {formatShortDate(cand.nextBillingDate)}</span>
              {cand.dateEstimated && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-amber-text">date estimated</span>
                </>
              )}
              {cand.detectedPriceHikeMinorUnits > 0 && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-amber-text">
                    +
                    {formatMinorUnits(cand.detectedPriceHikeMinorUnits, cand.currency, {
                      showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(cand.currency),
                    })}{' '}
                    higher
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="insights-view">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-text-primary">
          Insights
        </h1>
        <p className="mt-1 text-[15px] sm:text-sm text-text-secondary">
          Spot price increases, unused plans, and overlapping tools.
        </p>
      </div>

      {/* Savings Summary First */}
      <section className="rounded-2xl bg-brand-soft border border-brand-border p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          <div>
            <p className="text-[13px] font-semibold text-brand-text">Savings found</p>
            <p
              className="mt-1 tabular-nums text-3xl font-extrabold text-brand-text"
              data-testid="insights-savings-total"
            >
              {formatMinorUnits(audit.totalReclaimableAnnualMinorUnits, baseCurrency, {
                showDecimals: false,
              })}
              <span className="text-base font-semibold text-text-secondary">/yr</span>
            </p>
            <p className="mt-1 text-[13px] text-text-secondary">
              {audit.lowValueSubscriptions.length} low-use and {audit.priceHikes.length} price{' '}
              {audit.priceHikes.length === 1 ? 'increase' : 'increases'}
            </p>
          </div>

          <div className="md:border-l md:border-brand-border md:pl-5">
            <p className="text-[13px] font-semibold text-brand-text flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
              <span>If invested for 5 years at 7%/yr</span>
            </p>
            <p
              className="mt-1 tabular-nums text-2xl font-bold text-text-primary"
              data-testid="insights-5yr-wealth"
            >
              {formatMinorUnits(audit.fiveYearInvestedValueMinorUnits, baseCurrency, {
                showDecimals: false,
              })}
            </p>
            <p className="mt-1 text-[13px] text-text-secondary">
              Illustration only, not financial advice.
            </p>
          </div>

          <div className="md:border-l md:border-brand-border md:pl-5">
            <p className="text-[13px] font-semibold text-brand-text">Yearly price increases</p>
            <p className="mt-1 tabular-nums text-2xl font-bold text-amber-text">
              +
              {formatMinorUnits(audit.annualPriceHikeCreepMinorUnits, baseCurrency, {
                showDecimals,
              })}
              <span className="text-sm font-semibold">/yr</span>
            </p>
            <p className="mt-1 text-[13px] text-text-secondary">
              Extra yearly cost from recent price changes
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Price Increases, Unused, Overlaps */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Price Increases */}
          <section className="rounded-2xl app-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber" aria-hidden="true" />
                <h2 className="text-base font-bold text-text-primary">
                  Price increases ({audit.priceHikes.length})
                </h2>
              </div>
              <span className="text-[13px] text-text-secondary">vs. previous price</span>
            </div>

            {audit.priceHikes.length === 0 ? (
              <p className="text-[13px] text-text-secondary py-1">
                No price increases found. Add a prior price when editing any subscription.
              </p>
            ) : (
              <div className="space-y-3">
                {audit.priceHikes.map((hike) => {
                  const sub = hike.subscription;
                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl bg-amber-soft border border-amber-border p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ServiceAvatar
                          name={sub.name}
                          category={sub.category}
                          catalogId={sub.catalogId}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-text-primary truncate">
                            {sub.name}
                          </p>
                          <p className="text-[13px] text-text-secondary tabular-nums">
                            {formatMinorUnits(sub.previousAmountMinorUnits!, sub.currency, {
                              showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
                            })}{' '}
                            &rarr;{' '}
                            <strong className="text-text-primary">
                              {formatMinorUnits(sub.amountMinorUnits, sub.currency, {
                                showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
                              })}
                            </strong>
                            {BILLING_CYCLES[sub.cycle].shortSuffix}{' '}
                            <span className="text-amber-text font-semibold">
                              (+{hike.percentIncrease}%)
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenCancelKit(sub.id)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-card border border-amber-border hover:border-amber text-[13px] font-semibold text-amber-text flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Mail className="w-4 h-4" aria-hidden="true" />
                        <span>How to cancel</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. Unused & Rarely Used */}
          <section className="rounded-2xl app-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber" aria-hidden="true" />
                <h2 className="text-base font-bold text-text-primary">
                  Unused &amp; rarely used ({audit.lowValueSubscriptions.length})
                </h2>
              </div>
              <span className="text-[13px] tabular-nums font-semibold text-amber-text">
                {formatMinorUnits(audit.annualLowValueSavingsMinorUnits, baseCurrency, {
                  showDecimals: false,
                })}
                /yr
              </span>
            </div>

            {audit.lowValueSubscriptions.length === 0 ? (
              <p className="text-[13px] text-text-secondary py-1">
                Every active subscription is used often. Change usage inside any item on Home.
              </p>
            ) : (
              <div className="space-y-3">
                {audit.lowValueSubscriptions.map((sub) => {
                  const freq = sub.usageFrequency ?? 'unused';
                  const annualOwn = getAnnualMinorUnits(sub.amountMinorUnits, sub.cycle);
                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl bg-subtle border border-border p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ServiceAvatar
                          name={sub.name}
                          category={sub.category}
                          catalogId={sub.catalogId}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-text-primary truncate">
                            {sub.name}
                          </p>
                          <p className="text-[13px] text-text-secondary tabular-nums">
                            <span className="font-semibold text-amber-text">
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

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleSimulate(sub.id)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-card border border-border hover:border-brand text-[13px] font-semibold text-text-primary flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Pause className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                          <span>What if I cancel?</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCancelKit(sub.id)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-[13px] font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>How to cancel</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. Category Overlaps */}
          {audit.overlapGroups.length > 0 && (
            <section className="rounded-2xl app-surface p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-text" aria-hidden="true" />
                <h2 className="text-base font-bold text-text-primary">
                  Overlaps ({audit.overlapGroups.length})
                </h2>
              </div>
              <div className="space-y-2.5">
                {audit.overlapGroups.map((group) => (
                  <div
                    key={group.category}
                    className="rounded-xl bg-subtle border border-border px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-[15px] font-semibold text-text-primary">
                        {group.label} · {group.count} active
                      </p>
                      <p className="text-[13px] text-text-secondary mt-0.5">
                        {group.items.map((i) => i.name).join(', ')}
                      </p>
                    </div>
                    <span className="tabular-nums text-[15px] font-bold text-text-primary">
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

        {/* Right Column (5 cols): Sticky Import from Bank Statement V2 */}
        <section
          className="lg:col-span-5 lg:sticky lg:top-20 rounded-2xl app-surface p-5 space-y-4"
          aria-label="Import from bank statement"
          data-testid="statement-import-section"
        >
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-brand-text" aria-hidden="true" />
              <h2 className="text-base font-bold text-text-primary">
                Import from bank statement
              </h2>
            </div>
            <p className="mt-1 text-[13px] text-text-secondary">
              Upload a CSV/TXT export or paste card SMS alerts. Everything stays in your browser.
            </p>
          </div>

          {/* Upload .csv / .txt + Date Order Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleFileChange}
                className="sr-only"
                id="statement-file-upload"
                data-testid="statement-file-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-subtle border border-border hover:border-brand text-[13px] font-semibold text-text-primary inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 text-brand-text" aria-hidden="true" />
                <span>{uploadedFileName ? uploadedFileName : 'Upload CSV / TXT'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Dates are</span>
              <div
                className="inline-flex rounded-xl bg-subtle border border-border p-0.5"
                role="group"
                aria-label="Statement date format"
              >
                {(['DMY', 'MDY'] as const).map((order) => {
                  const active = effectiveDateOrder === order;
                  return (
                    <button
                      key={order}
                      type="button"
                      aria-pressed={active}
                      data-testid={`date-order-${order}`}
                      onClick={() => setPreferredDateOrder(order)}
                      className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-card text-text-primary shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {order === 'DMY' ? 'DD/MM' : 'MM/DD'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {parseResult.dateOrderAutoSwitched && (
            <p className="text-xs font-medium text-brand-text">
              Detected {effectiveDateOrder === 'MDY' ? 'MM/DD' : 'DD/MM'} dates in this file.
            </p>
          )}

          {fileError && (
            <div
              role="alert"
              className="rounded-xl bg-red-soft border border-red-border px-3.5 py-2.5 text-[13px] font-medium text-red-text"
            >
              {fileError}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="statement-paste-input"
                className="text-[13px] font-semibold text-text-secondary"
              >
                Paste CSV or card alerts
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                data-testid="load-sample-statement"
                className="min-h-[36px] text-[13px] font-semibold text-brand-text hover:underline cursor-pointer"
              >
                Load sample CSV
              </button>
            </div>

            <textarea
              id="statement-paste-input"
              rows={5}
              value={statementText}
              onChange={(e) => {
                setStatementText(e.target.value);
                setUploadedFileName(null);
                resetImportSelections();
              }}
              placeholder={`Date,Description,Debit,Credit\n2026-11-05,NETFLIX.COM,15.49,\nPKR 5,850.00 charged on card ending 1234 at OPENAI *CHATGPT SUBSCR on 18-11-2026`}
              className="w-full p-3 rounded-xl bg-subtle border border-border text-[13px] tabular-nums text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
            />
          </div>

          {importBanner && (
            <div
              role="status"
              data-testid="statement-import-success"
              className="rounded-xl bg-brand-soft border border-brand-border px-3.5 py-2.5 text-[13px] font-semibold text-brand-text flex items-center gap-2"
            >
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{importBanner}</span>
            </div>
          )}

          {(parseResult.subscriptions.length > 0 || parseResult.oneOffCharges.length > 0) && (
            <div className="space-y-3" data-testid="parsed-statement-results">
              {/* Review Summary Header */}
              <div className="rounded-xl bg-brand-soft border border-brand-border px-3.5 py-2.5">
                <p
                  data-testid="statement-found-summary"
                  className="text-[14px] font-bold text-text-primary tabular-nums"
                >
                  We found {parseResult.subscriptions.length}{' '}
                  {parseResult.subscriptions.length === 1 ? 'subscription' : 'subscriptions'} — ≈{' '}
                  {formatMinorUnits(foundMonthlyTotalBaseMinorUnits, baseCurrency, {
                    showDecimals: false,
                  })}
                  /month
                </p>
                {parseResult.skippedCount > 0 && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    Filtered out {parseResult.skippedCount} non-subscription{' '}
                    {parseResult.skippedCount === 1 ? 'entry' : 'entries'} (transfers, groceries,
                    fuel, credits).
                  </p>
                )}
              </div>

              {/* High & Likely Subscriptions */}
              {parseResult.subscriptions.length > 0 && (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-0.5">
                  {parseResult.subscriptions.map((cand) =>
                    renderCandidateRow(
                      cand,
                      !deselectedSubIds.has(cand.tempId),
                      () => toggleSubCandidate(cand.tempId),
                    ),
                  )}
                </div>
              )}

              {/* Collapsed Unchecked One-Off Charges */}
              {parseResult.oneOffCharges.length > 0 && (
                <div className="rounded-xl border border-border bg-subtle/70">
                  <button
                    type="button"
                    aria-expanded={showOneOffs}
                    data-testid="toggle-one-off-charges"
                    onClick={() => setShowOneOffs((prev) => !prev)}
                    className="w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between gap-2 text-[13px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    <span>Other one-off charges ({parseResult.oneOffCharges.length})</span>
                    {showOneOffs ? (
                      <ChevronUp className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                  {showOneOffs && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      {parseResult.oneOffCharges.map((cand) =>
                        renderCandidateRow(
                          cand,
                          selectedOneOffIds.has(cand.tempId),
                          () => toggleOneOffCandidate(cand.tempId),
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {!canBulkImport && (
                <p className="text-xs text-text-secondary">
                  {remainingFreeSlots > 0
                    ? `Free plan: add up to ${remainingFreeSlots} more one by one, or unlock Pro to import everything at once.`
                    : 'Free plan limit of 8 active subscriptions reached. Unlock Pro to import all detected subscriptions.'}
                </p>
              )}

              {canBulkImport ? (
                <button
                  type="button"
                  disabled={selectedCandidates.length === 0}
                  onClick={handleCommitImport}
                  data-testid="commit-statement-import"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-45 text-[15px] font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>
                    Import {selectedCandidates.length}{' '}
                    {selectedCandidates.length === 1 ? 'subscription' : 'subscriptions'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCommitImport}
                  data-testid="statement-unlock-pro-button"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Unlock with Pro</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
