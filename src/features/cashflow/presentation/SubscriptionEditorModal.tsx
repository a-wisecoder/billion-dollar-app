import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldAlert, X } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { addDaysIso, getTodayIso, parseIsoDate } from '../../../core/utils/dateMath';
import {
  formatMinorUnits,
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
import {
  searchServiceCatalog,
  type ServiceCatalogEntry,
} from '../../catalog/domain/serviceCatalog';
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LIST,
  CATEGORY_LIST,
  CURRENCY_CODES,
  USAGE_FREQUENCY_LIST,
  USAGE_FREQUENCY_META,
  type BillingCycle,
  type CurrencyCode,
  type Subscription,
  type SubscriptionCategory,
  type UsageFrequency,
} from '../domain/subscription';

export interface SubscriptionPrefillDraft {
  readonly name: string;
  readonly category: SubscriptionCategory;
  readonly notes: string;
}

interface SubscriptionEditorModalProps {
  readonly isOpen: boolean;
  readonly editingSubscription: Subscription | null;
  readonly prefillDraft?: SubscriptionPrefillDraft | null;
  readonly defaultCurrency: CurrencyCode;
  readonly onClose: () => void;
  readonly onSave: (sub: Subscription) => void;
}

export const SubscriptionEditorModal: React.FC<SubscriptionEditorModalProps> = ({
  isOpen,
  editingSubscription,
  prefillDraft,
  defaultCurrency,
  onClose,
  onSave,
}) => {
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogId, setCatalogId] = useState<string | undefined>(undefined);
  const [cancelUrl, setCancelUrl] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [previousAmountInput, setPreviousAmountInput] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [category, setCategory] = useState<SubscriptionCategory>('streaming');
  const [usageFrequency, setUsageFrequency] = useState<UsageFrequency>('weekly');
  const [nextBillingDate, setNextBillingDate] = useState(addDaysIso(getTodayIso(), 7));
  const [startDate, setStartDate] = useState('');
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCatalogQuery('');
    if (editingSubscription) {
      setCatalogId(editingSubscription.catalogId);
      setCancelUrl(editingSubscription.cancelUrl);
      setName(editingSubscription.name);
      setAmountInput(minorUnitsToInputString(editingSubscription.amountMinorUnits));
      setPreviousAmountInput(
        editingSubscription.previousAmountMinorUnits
          ? minorUnitsToInputString(editingSubscription.previousAmountMinorUnits)
          : '',
      );
      setCurrency(editingSubscription.currency);
      setCycle(editingSubscription.cycle);
      setCategory(editingSubscription.category);
      setUsageFrequency(editingSubscription.usageFrequency ?? 'weekly');
      setNextBillingDate(editingSubscription.nextBillingDate);
      setStartDate(editingSubscription.startDate ?? '');
      setIsFreeTrial(editingSubscription.isFreeTrial);
      setNotes(editingSubscription.notes);
    } else {
      setCatalogId(undefined);
      setCancelUrl(undefined);
      setName(prefillDraft?.name ?? '');
      setAmountInput('');
      setPreviousAmountInput('');
      setCurrency(defaultCurrency);
      setCycle('monthly');
      setCategory(prefillDraft?.category ?? 'other');
      setUsageFrequency('weekly');
      setNextBillingDate(addDaysIso(getTodayIso(), 7));
      setStartDate('');
      setIsFreeTrial(false);
      setNotes(prefillDraft?.notes ?? '');
    }
    setError(null);
  }, [isOpen, editingSubscription, prefillDraft, defaultCurrency]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const catalogMatches = useMemo(() => {
    const matches = searchServiceCatalog(catalogQuery, {
      preferredCurrency: defaultCurrency,
    });
    return matches.slice(0, catalogQuery.trim() ? 10 : 8);
  }, [catalogQuery, defaultCurrency]);

  if (!isOpen) return null;

  const applyCatalogEntry = (entry: ServiceCatalogEntry) => {
    setCatalogId(entry.id);
    setCancelUrl(entry.cancelUrl);
    setName(entry.name);
    setCategory(entry.category);
    setCycle(entry.defaultCycle);

    const localPrice = entry.typicalPriceMinorUnits?.[defaultCurrency];
    const usdPrice = entry.typicalPriceMinorUnits?.USD;
    if (typeof localPrice === 'number') {
      setCurrency(defaultCurrency);
      setAmountInput(minorUnitsToInputString(localPrice));
    } else if (typeof usdPrice === 'number') {
      setCurrency('USD');
      setAmountInput(minorUnitsToInputString(usdPrice));
    } else {
      setCurrency(defaultCurrency);
      setAmountInput('');
    }
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a subscription name.');
      return;
    }

    const amountMinorUnits = parseDecimalToMinorUnits(amountInput);
    if (amountMinorUnits === null) {
      setError('Enter a valid positive amount (up to 2 decimal places).');
      return;
    }

    let previousAmountMinorUnits: number | undefined;
    if (previousAmountInput.trim()) {
      const parsedPrev = parseDecimalToMinorUnits(previousAmountInput);
      if (parsedPrev === null) {
        setError('Previous price must be a positive number or blank.');
        return;
      }
      previousAmountMinorUnits = parsedPrev;
    }

    const parsedBillingDate = parseIsoDate(nextBillingDate);
    if (!parsedBillingDate) {
      setError('Pick a valid renewal date.');
      return;
    }

    let validStartDate: string | undefined;
    if (startDate.trim()) {
      if (!parseIsoDate(startDate.trim())) {
        setError('Pick a valid start date or leave it blank.');
        return;
      }
      validStartDate = startDate.trim();
    }

    const billingDay =
      !editingSubscription || nextBillingDate !== editingSubscription.nextBillingDate
        ? parsedBillingDate.day
        : (editingSubscription.billingDay ?? parsedBillingDate.day);

    const saved: Subscription = {
      id: editingSubscription?.id ?? `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      ...(catalogId ? { catalogId } : {}),
      amountMinorUnits,
      ...(previousAmountMinorUnits !== undefined ? { previousAmountMinorUnits } : {}),
      currency,
      cycle,
      category,
      nextBillingDate,
      billingDay,
      ...(validStartDate ? { startDate: validStartDate } : {}),
      isFreeTrial,
      isSimulatedPaused: editingSubscription?.isSimulatedPaused ?? false,
      isArchived: editingSubscription?.isArchived ?? false,
      usageFrequency,
      ...(cancelUrl ? { cancelUrl } : {}),
      notes: notes.trim(),
    };

    onSave(saved);
    onClose();
  };

  const todayIso = getTodayIso();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-editor-title"
      data-testid="subscription-editor-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-xl">
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" aria-hidden="true" />

        <div className="flex items-center justify-between gap-4">
          <h2 id="sub-editor-title" className="text-lg font-bold text-text-primary">
            {editingSubscription ? 'Edit subscription' : 'Add subscription'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close subscription editor"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-subtle border border-border text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Searchable Service Catalog Picker (replaces the old 9 quick-fill chips) */}
        {!editingSubscription && (
          <div className="mt-4 space-y-2.5" data-testid="editor-catalog-picker">
            <label htmlFor="editor-catalog-search" className="sr-only">
              Search service catalog
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="editor-catalog-search"
                type="search"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Pick from 100+ services (Netflix, Spotify, PTCL...)"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-subtle border border-border text-[15px] sm:text-sm text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
              />
            </div>

            {catalogMatches.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-[168px] overflow-y-auto pr-0.5">
                {catalogMatches.map((entry) => {
                  const isPicked = catalogId === entry.id;
                  const hintPrice =
                    entry.typicalPriceMinorUnits?.[defaultCurrency] ??
                    entry.typicalPriceMinorUnits?.USD;
                  const hintCurrency: CurrencyCode =
                    typeof entry.typicalPriceMinorUnits?.[defaultCurrency] === 'number'
                      ? defaultCurrency
                      : 'USD';
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => applyCatalogEntry(entry)}
                      className={`min-h-[48px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isPicked
                          ? 'bg-brand-soft border-brand'
                          : 'bg-subtle border-border hover:border-brand'
                      }`}
                    >
                      <ServiceAvatar
                        name={entry.name}
                        category={entry.category}
                        catalogId={entry.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-text-primary truncate">
                          {entry.name}
                        </span>
                        <span className="block text-xs text-text-secondary tabular-nums truncate">
                          {typeof hintPrice === 'number'
                            ? `${formatMinorUnits(hintPrice, hintCurrency, {
                                showDecimals: hintCurrency !== 'PKR',
                              })}${BILLING_CYCLES[entry.defaultCycle].shortSuffix}`
                            : BILLING_CYCLES[entry.defaultCycle].label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-text-secondary">
                Not in the catalog? Enter the details below.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-soft border border-red-border px-3.5 py-2.5 text-[13px] font-medium text-red-text"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="sub-name" className="block text-[13px] font-semibold text-text-secondary mb-1.5">
              Subscription name
            </label>
            <input
              id="sub-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. ChatGPT Plus, Spotify, StormFiber"
              className="w-full h-11 px-3.5 rounded-xl bg-subtle border border-border text-[15px] text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="sub-amount" className="block text-[13px] font-semibold text-text-secondary mb-1.5">
                Current price
              </label>
              <input
                id="sub-amount"
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[0-9,]*\.?[0-9]{0,2}$/.test(val)) {
                    setAmountInput(val);
                    if (error) setError(null);
                  }
                }}
                placeholder="19.99"
                className="w-full h-11 px-3 rounded-xl bg-subtle border border-border tabular-nums text-[15px] text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="sub-prev-amount" className="block text-[13px] font-semibold text-text-secondary mb-1.5">
                Prior price
              </label>
              <input
                id="sub-prev-amount"
                type="text"
                inputMode="decimal"
                value={previousAmountInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[0-9,]*\.?[0-9]{0,2}$/.test(val)) {
                    setPreviousAmountInput(val);
                    if (error) setError(null);
                  }
                }}
                placeholder="Optional"
                className="w-full h-11 px-3 rounded-xl bg-subtle border border-border tabular-nums text-[15px] text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="sub-currency" className="block text-[13px] font-semibold text-text-secondary mb-1.5">
                Currency
              </label>
              <select
                id="sub-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full h-11 px-3 rounded-xl bg-subtle border border-border text-[15px] font-medium text-text-primary focus:bg-card focus:border-brand"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-[13px] font-semibold text-text-secondary mb-1.5">
                Billing cycle
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-subtle border border-border">
                {BILLING_CYCLE_LIST.map((itemCycle) => {
                  const selected = cycle === itemCycle;
                  return (
                    <button
                      key={itemCycle}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCycle(itemCycle)}
                      className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        selected
                          ? 'bg-card text-text-primary shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {BILLING_CYCLES[itemCycle].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-[13px] font-semibold text-text-secondary mb-1.5">
                How often do you use it?
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-subtle border border-border">
                {USAGE_FREQUENCY_LIST.map((freq) => {
                  const selected = usageFrequency === freq;
                  return (
                    <button
                      key={freq}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setUsageFrequency(freq)}
                      className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        selected
                          ? 'bg-card text-text-primary shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {USAGE_FREQUENCY_META[freq].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <span className="block text-[13px] font-semibold text-text-secondary mb-1.5">
              Category
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_LIST.map((cat) => {
                const visual = getCategoryVisual(cat);
                const CatIcon = visual.Icon;
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategory(cat)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
                      selected
                        ? 'text-text-primary'
                        : 'bg-subtle border-border text-text-secondary hover:text-text-primary'
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: visual.color,
                            backgroundColor: `${visual.color}1F`,
                          }
                        : undefined
                    }
                  >
                    <CatIcon className="w-3.5 h-3.5" style={{ color: visual.color }} aria-hidden="true" />
                    <span>{visual.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label htmlFor="sub-date" className="text-[13px] font-semibold text-text-secondary">
                  Next renewal date
                </label>
                <div className="flex items-center gap-1">
                  {[7, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNextBillingDate(addDaysIso(todayIso, d))}
                      className="min-h-[30px] px-2 py-0.5 rounded-lg bg-subtle border border-border hover:border-brand text-xs font-medium tabular-nums text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      +{d}d
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="sub-date"
                type="date"
                value={nextBillingDate}
                onChange={(e) => setNextBillingDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-subtle border border-border tabular-nums text-[15px] text-text-primary focus:bg-card focus:border-brand"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label htmlFor="sub-start-date" className="text-[13px] font-semibold text-text-secondary">
                  Started on (optional)
                </label>
                {startDate && (
                  <button
                    type="button"
                    onClick={() => setStartDate('')}
                    className="min-h-[30px] px-2 text-xs font-medium text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                id="sub-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-subtle border border-border tabular-nums text-[15px] text-text-primary focus:bg-card focus:border-brand"
              />
            </div>
          </div>

          <div className="rounded-xl bg-amber-soft border border-amber-border p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-bold text-text-primary">This is a free trial</p>
                <p className="text-xs text-text-secondary">
                  Highlights the trial end date before you get charged.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isFreeTrial}
              aria-label="This is a free trial"
              onClick={() => setIsFreeTrial((v) => !v)}
              className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                isFreeTrial ? 'bg-amber' : 'bg-border'
              }`}
            >
              <span
                className={`block w-6 h-6 rounded-full bg-card shadow-xs transition-transform ${
                  isFreeTrial ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="sub-notes" className="block text-[13px] font-semibold text-text-secondary mb-1.5">
              Notes (optional)
            </label>
            <input
              id="sub-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Plan tier, seats, or account email"
              className="w-full h-11 px-3.5 rounded-xl bg-subtle border border-border text-[15px] text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
            />
          </div>

          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-xl bg-subtle border border-border text-[15px] font-semibold text-text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] min-h-[44px] rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white transition-colors cursor-pointer"
            >
              {editingSubscription ? 'Save changes' : 'Add subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
