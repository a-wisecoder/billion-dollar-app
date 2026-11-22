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
import { trackEvent } from '../../../core/analytics/analytics';
import { Button, MoneyFigure, SegmentedControl } from '../../../core/ui/primitives';
import { convertMinorUnits } from '../../../core/utils/currencyConverter';
import { formatShortDate } from '../../../core/utils/dateMath';
import {
  formatMinorUnits,
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
import {
  can,
  remaining,
  type EntitlementsState,
} from '../../billing/domain/entitlements';
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
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import { detectDefaultDateOrder } from '../../onboarding/domain/localeCurrency';
import type { LeakAuditReport } from '../domain/auditEngine';
import type {
  DateOrder,
  StatementImportCandidate,
  StatementImportResult,
} from '../domain/statementImport';

type StatementImportModule = typeof import('../domain/statementImport');

const EMPTY_PARSE_RESULT: StatementImportResult = {
  subscriptions: [],
  oneOffCharges: [],
  skippedCount: 0,
  detectedDateOrder: 'MDY',
  dateOrderAutoSwitched: false,
};

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
  const [isDraggingFile, setIsDraggingFile] = useState(false);
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

  const [parserModule, setParserModule] = useState<StatementImportModule | null>(null);
  const [loadingParser, setLoadingParser] = useState(false);

  const ensureParserLoaded = async (): Promise<StatementImportModule> => {
    if (parserModule) return parserModule;
    setLoadingParser(true);
    try {
      const mod = await import('../domain/statementImport');
      setParserModule(mod);
      return mod;
    } finally {
      setLoadingParser(false);
    }
  };

  useEffect(() => {
    if (!statementText.trim() || parserModule) return;
    let active = true;
    setLoadingParser(true);
    void import('../domain/statementImport')
      .then((mod) => {
        if (active) setParserModule(mod);
      })
      .finally(() => {
        if (active) setLoadingParser(false);
      });
    return () => {
      active = false;
    };
  }, [statementText, parserModule]);

  const parseResult = useMemo<StatementImportResult>(() => {
    if (!statementText.trim() || !parserModule) {
      return { ...EMPTY_PARSE_RESULT, detectedDateOrder: preferredDateOrder };
    }
    return parserModule.parseStatementImport(statementText, subscriptions, {
      preferredDateOrder,
      defaultCurrency: baseCurrency,
    });
  }, [parserModule, statementText, subscriptions, preferredDateOrder, baseCurrency]);

  const previewTrackedRef = useRef(false);
  useEffect(() => {
    if (!statementText.trim()) {
      previewTrackedRef.current = false;
      return;
    }
    if (parseResult.subscriptions.length > 0 && !previewTrackedRef.current) {
      previewTrackedRef.current = true;
      trackEvent('import_previewed');
    }
  }, [statementText, parseResult.subscriptions.length]);

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
        sum + convertMinorUnits(monthlyOwn, cand.currency, baseCurrency, rates, markup)
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

  const ingestFile = (file: File) => {
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    ingestFile(file);
    e.target.value = '';
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) ingestFile(file);
  };

  const handleLoadSample = async () => {
    const mod = await ensureParserLoaded();
    setStatementText(mod.SAMPLE_STATEMENT_CSV);
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
          checked ? 'bg-card border-brand/70' : 'bg-subtle/60 border-border opacity-65'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <label className="min-h-[36px] min-w-[30px] flex items-center justify-center cursor-pointer shrink-0">
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
                className="min-w-[130px] flex-1 h-9 px-2.5 rounded-lg bg-subtle/80 border border-border text-[13px] font-bold text-text-primary focus:bg-card focus:border-brand transition-colors"
              />
              {!canBulkImport ? (
                addedSingleIds.has(cand.tempId) ? (
                  <span className="text-xs font-semibold text-brand-text inline-flex items-center gap-1 whitespace-nowrap px-1.5">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Added</span>
                  </span>
                ) : (
                  <Button
                    variant="soft"
                    size="sm"
                    data-testid={`import-single-add-${cand.tempId}`}
                    onClick={() => handleAddSingleRow(cand)}
                    className="min-h-[34px] px-2.5 text-xs"
                  >
                    {isUpdate ? 'Update' : 'Add one'}
                  </Button>
                )
              ) : (
                <span
                  className={`text-xs font-semibold whitespace-nowrap px-1 ${
                    isUpdate ? 'text-amber-text' : 'text-brand-text'
                  }`}
                >
                  {isUpdate ? 'Update price' : 'New'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-text-secondary">
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
                  className="w-full h-9 pl-11 pr-2.5 rounded-lg bg-subtle/80 border border-border text-[13px] font-mono font-bold tabular-nums text-text-primary focus:bg-card focus:border-brand transition-colors"
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
                className="w-full h-9 px-2.5 rounded-lg bg-subtle/80 border border-border text-[13px] font-medium text-text-primary focus:bg-card focus:border-brand transition-colors"
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
                  <span className="font-mono font-semibold text-amber-text">
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

  const formattedReclaimable = formatMinorUnits(
    audit.totalReclaimableAnnualMinorUnits,
    baseCurrency,
    { showDecimals: false },
  );
  const formattedFiveYear = formatMinorUnits(
    audit.fiveYearInvestedValueMinorUnits,
    baseCurrency,
    { showDecimals: false },
  );
  const formattedPriceCreep = formatMinorUnits(
    audit.annualPriceHikeCreepMinorUnits,
    baseCurrency,
    { showDecimals },
  );

  return (
    <div className="space-y-6" data-testid="insights-view">
      {/* Header */}
      <div>
        <h1 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.025em] text-text-primary leading-tight">
          Insights
        </h1>
        <p className="mt-1 text-[14px] text-text-secondary">
          Spot price increases, unused plans, and overlapping tools.
        </p>
      </div>

      {subscriptions.filter((s) => !s.isArchived).length === 0 && (
        <div
          role="status"
          data-testid="insights-empty-banner"
          className="rounded-2xl app-surface p-6 text-center space-y-1.5"
        >
          <p className="font-display text-base font-bold text-text-primary">
            No subscriptions to review yet
          </p>
          <p className="text-[13px] text-text-secondary max-w-md mx-auto">
            Add subscriptions on Home or paste a bank statement below to uncover recurring charges.
          </p>
        </div>
      )}

      {/* Executive Savings Opportunity Strip (Unified Mercury 3-Cell Surface) */}
      <section className="rounded-2xl app-surface overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-5 sm:p-6 bg-brand-soft/45">
            <p className="text-xs font-semibold text-brand-text">Savings found</p>
            <p className="mt-1.5" data-testid="insights-savings-total">
              <MoneyFigure
                value={formattedReclaimable}
                suffix="/yr"
                className="text-[28px] sm:text-[32px] font-bold text-brand-text leading-none"
              />
            </p>
            <p className="mt-2 text-xs text-text-secondary tabular-nums">
              {audit.lowValueSubscriptions.length} low-use · {audit.priceHikes.length} price{' '}
              {audit.priceHikes.length === 1 ? 'increase' : 'increases'}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold text-text-secondary inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-text shrink-0" aria-hidden="true" />
              <span>If invested for 5 years at 7%/yr</span>
            </p>
            <p className="mt-1.5" data-testid="insights-5yr-wealth">
              <MoneyFigure
                value={formattedFiveYear}
                className="text-[24px] sm:text-[26px] font-bold text-text-primary leading-none"
              />
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Illustration only, not financial advice.
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold text-text-secondary">Yearly price increases</p>
            <p className="mt-1.5">
              <MoneyFigure
                value={`+${formattedPriceCreep}`}
                suffix="/yr"
                className="text-[24px] sm:text-[26px] font-bold text-amber-text leading-none"
              />
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Extra yearly cost from recent price changes
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Price Increases, Unused, Overlaps */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Price Increases */}
          <section className="rounded-2xl app-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber" aria-hidden="true" />
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Price increases ({audit.priceHikes.length})
                </h2>
              </div>
              <span className="text-xs font-medium text-text-secondary">vs. previous price</span>
            </div>

            {audit.priceHikes.length === 0 ? (
              <p className="px-5 py-5 text-[13px] text-text-secondary">
                No price increases found. Add a prior price when editing any subscription.
              </p>
            ) : (
              <ul className="divide-y divide-border/80">
                {audit.priceHikes.map((hike) => {
                  const sub = hike.subscription;
                  return (
                    <li
                      key={sub.id}
                      className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 hover:bg-subtle/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ServiceAvatar
                          name={sub.name}
                          category={sub.category}
                          catalogId={sub.catalogId}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p
                            title={sub.name}
                            className="text-[14px] font-semibold text-text-primary truncate"
                          >
                            {sub.name}
                          </p>
                          <p className="text-[13px] text-text-secondary font-mono tabular-nums mt-0.5">
                            {formatMinorUnits(sub.previousAmountMinorUnits!, sub.currency, {
                              showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
                            })}{' '}
                            &rarr;{' '}
                            <strong className="text-text-primary font-semibold">
                              {formatMinorUnits(sub.amountMinorUnits, sub.currency, {
                                showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
                              })}
                            </strong>
                            {BILLING_CYCLES[sub.cycle].shortSuffix}{' '}
                            <span className="text-amber-text font-bold">
                              (+{hike.percentIncrease}%)
                            </span>
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenCancelKit(sub.id)}
                        className="text-amber-text border-amber-border hover:border-amber"
                      >
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>How to cancel</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 2. Unused & Rarely Used */}
          <section className="rounded-2xl app-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber" aria-hidden="true" />
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Unused &amp; rarely used ({audit.lowValueSubscriptions.length})
                </h2>
              </div>
              <MoneyFigure
                value={formatMinorUnits(audit.annualLowValueSavingsMinorUnits, baseCurrency, {
                  showDecimals: false,
                })}
                suffix="/yr"
                className="text-[13px] font-bold text-amber-text"
              />
            </div>

            {audit.lowValueSubscriptions.length === 0 ? (
              <p className="px-5 py-5 text-[13px] text-text-secondary">
                Every active subscription is used often. Change usage inside any item on Home.
              </p>
            ) : (
              <ul className="divide-y divide-border/80">
                {audit.lowValueSubscriptions.map((sub) => {
                  const freq = sub.usageFrequency ?? 'unused';
                  const annualOwn = getAnnualMinorUnits(sub.amountMinorUnits, sub.cycle);
                  return (
                    <li
                      key={sub.id}
                      className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 hover:bg-subtle/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ServiceAvatar
                          name={sub.name}
                          category={sub.category}
                          catalogId={sub.catalogId}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p
                            title={sub.name}
                            className="text-[14px] font-semibold text-text-primary truncate"
                          >
                            {sub.name}
                          </p>
                          <p className="text-[13px] text-text-secondary tabular-nums mt-0.5">
                            <span className="font-semibold text-amber-text">
                              {USAGE_FREQUENCY_META[freq].label}
                            </span>{' '}
                            ·{' '}
                            <span className="font-mono">
                              {formatMinorUnits(annualOwn, sub.currency, {
                                showDecimals: false,
                              })}
                              /yr
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onToggleSimulate(sub.id)}
                        >
                          <Pause className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                          <span>What if I cancel?</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onOpenCancelKit(sub.id)}
                        >
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>How to cancel</span>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 3. Category Overlaps */}
          {audit.overlapGroups.length > 0 && (
            <section className="rounded-2xl app-surface overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-text" aria-hidden="true" />
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Overlaps ({audit.overlapGroups.length})
                </h2>
              </div>
              <ul className="divide-y divide-border/80">
                {audit.overlapGroups.map((group) => (
                  <li
                    key={group.category}
                    className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary">
                        {group.label} · {group.count} active
                      </p>
                      <p className="text-[13px] text-text-secondary mt-0.5">
                        {group.items.map((i) => i.name).join(', ')}
                      </p>
                    </div>
                    <MoneyFigure
                      value={formatMinorUnits(group.monthlyTotalBaseMinorUnits, baseCurrency, {
                        showDecimals,
                      })}
                      suffix="/mo"
                      className="text-[15px] font-bold text-text-primary shrink-0"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right Column (5 cols): Sticky Import from Bank Statement V2 */}
        <section
          className="lg:col-span-5 lg:sticky lg:top-20 rounded-2xl app-surface p-5 sm:p-6 space-y-4"
          aria-label="Import from bank statement"
          data-testid="statement-import-section"
        >
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-brand-text" aria-hidden="true" />
              <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                Import from bank statement
              </h2>
            </div>
            <p className="mt-1 text-[13px] text-text-secondary leading-relaxed">
              Drop a CSV/TXT export or paste card SMS alerts. Everything stays in your browser.
            </p>
          </div>

          {/* Tactile Drag-and-Drop Zone + Date Order Toggle */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={handleDropFile}
            className={`rounded-xl border border-dashed p-3.5 transition-colors flex flex-wrap items-center justify-between gap-2.5 ${
              isDraggingFile
                ? 'bg-brand-soft/80 border-brand'
                : 'bg-subtle/55 border-border-strong'
            }`}
          >
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 text-brand-text" aria-hidden="true" />
                <span className="truncate max-w-[160px]">
                  {uploadedFileName ? uploadedFileName : 'Upload CSV / TXT'}
                </span>
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Dates</span>
              <SegmentedControl
                value={effectiveDateOrder}
                onChange={setPreferredDateOrder}
                ariaLabel="Statement date format"
                layoutId="statement-date-order"
                options={[
                  { value: 'DMY', label: 'DD/MM', testId: 'date-order-DMY' },
                  { value: 'MDY', label: 'MM/DD', testId: 'date-order-MDY' },
                ]}
              />
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
                className="min-h-[34px] text-[13px] font-semibold text-brand-text hover:underline cursor-pointer"
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
              className="w-full p-3 rounded-xl bg-subtle/80 border border-border font-mono text-xs leading-relaxed text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand transition-colors"
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

          {statementText.trim().length > 0 && loadingParser && (
            <p role="status" className="text-[13px] text-text-secondary">
              Analyzing statement locally in your browser...
            </p>
          )}

          {statementText.trim().length > 0 &&
            !loadingParser &&
            parserModule &&
            parseResult.subscriptions.length === 0 && (
              <div
                role="status"
                data-testid="statement-no-matches"
                className="rounded-xl bg-subtle/70 border border-border px-3.5 py-3 text-[13px] text-text-secondary space-y-1"
              >
                <p className="font-semibold text-text-primary">
                  No subscriptions found in this statement
                </p>
                <p>
                  Try pasting 2–3 months of card charges, switching DD/MM vs MM/DD dates, or
                  loading the sample CSV to see the expected format.
                </p>
                {parseResult.skippedCount > 0 && (
                  <p className="text-xs text-text-secondary">
                    Filtered out {parseResult.skippedCount} non-subscription{' '}
                    {parseResult.skippedCount === 1 ? 'entry' : 'entries'} (transfers, groceries,
                    fuel, credits).
                  </p>
                )}
              </div>
            )}

          {(parseResult.subscriptions.length > 0 || parseResult.oneOffCharges.length > 0) && (
            <div className="space-y-3" data-testid="parsed-statement-results">
              {/* Review Summary Header */}
              {parseResult.subscriptions.length > 0 && (
                <div className="rounded-xl bg-brand-soft/80 border border-brand-border px-3.5 py-2.5">
                  <p
                    data-testid="statement-found-summary"
                    className="text-[14px] font-bold text-text-primary tabular-nums"
                  >
                    We found {parseResult.subscriptions.length}{' '}
                    {parseResult.subscriptions.length === 1 ? 'subscription' : 'subscriptions'} — ≈{' '}
                    <span className="font-mono">
                      {formatMinorUnits(foundMonthlyTotalBaseMinorUnits, baseCurrency, {
                        showDecimals: false,
                      })}
                    </span>
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
              )}

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
                <div className="rounded-xl border border-border bg-subtle/60">
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
                <p className="text-xs text-text-secondary leading-relaxed">
                  {remainingFreeSlots > 0
                    ? `Free plan: add up to ${remainingFreeSlots} more one by one, or unlock Pro to import everything at once.`
                    : 'Free plan limit of 8 active subscriptions reached. Unlock Pro to import all detected subscriptions.'}
                </p>
              )}

              {canBulkImport ? (
                <Button
                  variant="primary"
                  size="md"
                  disabled={selectedCandidates.length === 0}
                  onClick={handleCommitImport}
                  data-testid="commit-statement-import"
                  className="w-full"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>
                    Import {selectedCandidates.length}{' '}
                    {selectedCandidates.length === 1 ? 'subscription' : 'subscriptions'}
                  </span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCommitImport}
                  data-testid="statement-unlock-pro-button"
                  className="w-full"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Unlock with Pro</span>
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
