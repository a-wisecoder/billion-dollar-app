import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarPlus,
  Check,
  FileSpreadsheet,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { convertMinorUnits } from '../../../core/utils/currencyConverter';
import { addDaysIso, getTodayIso, parseIsoDate } from '../../../core/utils/dateMath';
import {
  formatMinorUnits,
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LIST,
  CATEGORY_LIST,
  CURRENCIES,
  CURRENCY_CODES,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  getEffectiveExchangeRates,
  getMonthlyMinorUnits,
  type BillingCycle,
  type CurrencyCode,
  type Subscription,
  type SubscriptionCategory,
  type VaultSettings,
} from '../../cashflow/domain/subscription';
import { CurrencySearchSelect } from '../../cashflow/presentation/CurrencySearchSelect';
import {
  searchServiceCatalog,
  type ServiceCatalogEntry,
} from '../../catalog/domain/serviceCatalog';
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import {
  can,
  type EntitlementsState,
} from '../../billing/domain/entitlements';
import { buildIcs } from '../../reminders/domain/icsExport';

const POPULAR_CURRENCIES: readonly CurrencyCode[] = ['USD', 'PKR', 'EUR', 'GBP', 'AED', 'INR'];

interface OnboardingFlowProps {
  readonly settings: VaultSettings;
  readonly entitlements: EntitlementsState;
  readonly externalAddedSubscription?: Subscription | null;
  readonly onConsumedExternalSubscription?: () => void;
  readonly onRequireUpgradeForSubscription: (sub: Subscription) => void;
  readonly onFinish: (payload: {
    readonly baseCurrency: CurrencyCode;
    readonly reminderLeadDays: 1 | 2 | 3;
    readonly subscriptions: Subscription[];
    readonly exportedCalendar?: boolean;
  }) => void;
  readonly onImportStatement: (baseCurrency: CurrencyCode) => void;
  readonly onExploreSampleData: (baseCurrency: CurrencyCode) => void;
}

type OnboardingStep = 1 | 2 | 3;

interface MiniFormState {
  readonly editingLocalId: string | null;
  readonly catalogId?: string;
  readonly cancelUrl?: string;
  readonly name: string;
  readonly amountInput: string;
  readonly currency: CurrencyCode;
  readonly cycle: BillingCycle;
  readonly category: SubscriptionCategory;
  readonly nextBillingDate: string;
  readonly isFreeTrial: boolean;
}

const REMINDER_OPTIONS: readonly {
  readonly days: 1 | 2 | 3;
  readonly title: string;
  readonly subtitle: string;
}[] = [
  { days: 1, title: '1 day before', subtitle: 'A quick heads-up the day before renewal' },
  { days: 2, title: '2 days before', subtitle: 'Enough time to cancel before you get billed' },
  { days: 3, title: '3 days before', subtitle: 'Extra cushion for trials and annual plans' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  settings,
  entitlements,
  externalAddedSubscription,
  onConsumedExternalSubscription,
  onRequireUpgradeForSubscription,
  onFinish,
  onImportStatement,
  onExploreSampleData,
}) => {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(settings.baseCurrency);
  const [reminderLeadDays, setReminderLeadDays] = useState<1 | 2 | 3>(settings.reminderLeadDays);
  const [addedSubscriptions, setAddedSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    if (!externalAddedSubscription) return;
    setAddedSubscriptions((prev) =>
      prev.some((item) => item.id === externalAddedSubscription.id)
        ? prev
        : [...prev, externalAddedSubscription],
    );
    onConsumedExternalSubscription?.();
  }, [externalAddedSubscription, onConsumedExternalSubscription]);

  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<SubscriptionCategory | null>(null);
  const [miniForm, setMiniForm] = useState<MiniFormState | null>(null);
  const [miniFormError, setMiniFormError] = useState<string | null>(null);
  const [calendarExported, setCalendarExported] = useState(false);

  const todayIso = useMemo(() => getTodayIso(), []);
  const effectiveRates = useMemo(() => getEffectiveExchangeRates(settings), [settings]);
  const cardMarkup = settings.cardMarkupPercent ?? 0;

  const catalogEntries = useMemo(() => {
    const results = searchServiceCatalog(catalogQuery, {
      category: catalogCategory,
      preferredCurrency: selectedCurrency,
    });
    return catalogQuery.trim() || catalogCategory ? results.slice(0, 36) : results.slice(0, 18);
  }, [catalogQuery, catalogCategory, selectedCurrency]);

  const addedByCatalogId = useMemo(() => {
    const map = new Map<string, Subscription>();
    for (const sub of addedSubscriptions) {
      if (sub.catalogId) map.set(sub.catalogId, sub);
    }
    return map;
  }, [addedSubscriptions]);

  const runningMonthlyBaseMinorUnits = useMemo(() => {
    return addedSubscriptions.reduce((sum, sub) => {
      const monthlyOwn = getMonthlyMinorUnits(sub.amountMinorUnits, sub.cycle);
      const monthlyBase = convertMinorUnits(
        monthlyOwn,
        sub.currency,
        selectedCurrency,
        effectiveRates,
        cardMarkup,
      );
      return sum + monthlyBase;
    }, 0);
  }, [addedSubscriptions, selectedCurrency, effectiveRates, cardMarkup]);

  const openCatalogMiniForm = (entry: ServiceCatalogEntry) => {
    const existing = addedByCatalogId.get(entry.id);
    if (existing) {
      setMiniForm({
        editingLocalId: existing.id,
        catalogId: existing.catalogId,
        cancelUrl: existing.cancelUrl,
        name: existing.name,
        amountInput: minorUnitsToInputString(existing.amountMinorUnits),
        currency: existing.currency,
        cycle: existing.cycle,
        category: existing.category,
        nextBillingDate: existing.nextBillingDate,
        isFreeTrial: existing.isFreeTrial,
      });
      setMiniFormError(null);
      return;
    }

    const localPrice = entry.typicalPriceMinorUnits?.[selectedCurrency];
    const usdPrice = entry.typicalPriceMinorUnits?.USD;
    const priceMinor = typeof localPrice === 'number' ? localPrice : usdPrice;
    const formCurrency: CurrencyCode =
      typeof localPrice === 'number'
        ? selectedCurrency
        : typeof usdPrice === 'number'
          ? 'USD'
          : selectedCurrency;

    setMiniForm({
      editingLocalId: null,
      catalogId: entry.id,
      cancelUrl: entry.cancelUrl,
      name: entry.name,
      amountInput: typeof priceMinor === 'number' ? minorUnitsToInputString(priceMinor) : '',
      currency: formCurrency,
      cycle: entry.defaultCycle,
      category: entry.category,
      nextBillingDate: addDaysIso(todayIso, 7),
      isFreeTrial: false,
    });
    setMiniFormError(null);
  };

  const openCustomMiniForm = () => {
    setMiniForm({
      editingLocalId: null,
      name: catalogQuery.trim(),
      amountInput: '',
      currency: selectedCurrency,
      cycle: 'monthly',
      category: catalogCategory ?? 'other',
      nextBillingDate: addDaysIso(todayIso, 7),
      isFreeTrial: false,
    });
    setMiniFormError(null);
  };

  const handleSaveMiniForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!miniForm) return;

    const trimmedName = miniForm.name.trim();
    if (!trimmedName) {
      setMiniFormError('Enter a service name.');
      return;
    }

    const amountMinorUnits = parseDecimalToMinorUnits(miniForm.amountInput);
    if (amountMinorUnits === null) {
      setMiniFormError('Enter a valid price (e.g. 15.49 or 1100).');
      return;
    }

    const parsedDate = parseIsoDate(miniForm.nextBillingDate);
    if (!parsedDate) {
      setMiniFormError('Pick a valid next payment date.');
      return;
    }

    const saved: Subscription = {
      id:
        miniForm.editingLocalId ??
        `sub_onb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      ...(miniForm.catalogId ? { catalogId: miniForm.catalogId } : {}),
      amountMinorUnits,
      currency: miniForm.currency,
      cycle: miniForm.cycle,
      category: miniForm.category,
      nextBillingDate: miniForm.nextBillingDate,
      billingDay: parsedDate.day,
      isFreeTrial: miniForm.isFreeTrial,
      isSimulatedPaused: false,
      isArchived: false,
      usageFrequency: 'weekly',
      ...(miniForm.cancelUrl ? { cancelUrl: miniForm.cancelUrl } : {}),
      notes: '',
    };

    if (
      !miniForm.editingLocalId &&
      !can('addSubscription', {
        plan: entitlements.plan,
        activeSubscriptionCount: addedSubscriptions.length,
        isDemo: false,
      })
    ) {
      setMiniForm(null);
      setMiniFormError(null);
      onRequireUpgradeForSubscription(saved);
      return;
    }

    setAddedSubscriptions((prev) => {
      if (miniForm.editingLocalId) {
        return prev.map((item) => (item.id === miniForm.editingLocalId ? saved : item));
      }
      return [...prev, saved];
    });
    setMiniForm(null);
    setMiniFormError(null);
  };

  const handleRemoveAdded = (id: string) => {
    setAddedSubscriptions((prev) => prev.filter((item) => item.id !== id));
  };

  const completeSetup = () => {
    onFinish({
      baseCurrency: selectedCurrency,
      reminderLeadDays,
      subscriptions: addedSubscriptions,
      exportedCalendar: calendarExported,
    });
  };

  const handleExportOnboardingCalendar = () => {
    if (addedSubscriptions.length === 0) return;
    const ics = buildIcs(addedSubscriptions, { reminderLeadDays }, new Date().toISOString());
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subscription-renewals.ics';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCalendarExported(true);
  };

  const formattedRunningMonthly = formatMinorUnits(runningMonthlyBaseMinorUnits, selectedCurrency, {
    showDecimals: false,
  });

  return (
    <div
      className="max-w-2xl mx-auto pb-28 sm:pb-12"
      data-testid="onboarding-flow"
    >
      {/* Top Progress + Skip Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
          {([1, 2, 3] as const).map((n) => (
            <span
              key={n}
              className={`h-2 rounded-full transition-all ${
                n === step
                  ? 'w-7 bg-brand'
                  : n < step
                    ? 'w-2.5 bg-brand/50'
                    : 'w-2.5 bg-border'
              }`}
            />
          ))}
          <span className="ml-1.5 text-[13px] font-semibold text-text-secondary tabular-nums">
            Step {step} of 3
          </span>
        </div>

        <button
          type="button"
          onClick={completeSetup}
          data-testid="onboarding-skip"
          className="min-h-[44px] px-3 rounded-xl text-[13px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
        >
          Skip setup
        </button>
      </div>

      {/* STEP 1: Your currency */}
      {step === 1 && (
        <section className="rounded-2xl app-surface p-5 sm:p-7 space-y-6" data-testid="onboarding-step-1">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-text-primary">
              Your currency
            </h1>
            <p className="mt-1.5 text-[15px] text-text-secondary leading-relaxed">
              We&apos;ll show your monthly total in this currency. You can still add subscriptions billed in other currencies.
            </p>
          </div>

          <div className="space-y-3">
            <CurrencySearchSelect
              id="onboarding-currency-select"
              value={selectedCurrency}
              onChange={setSelectedCurrency}
              label="Choose your primary currency"
              testId="onboarding-currency-picker"
            />

            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="Popular currencies"
            >
              {POPULAR_CURRENCIES.map((code) => {
                const meta = CURRENCIES[code];
                const active = selectedCurrency === code;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`onboarding-currency-${code}`}
                    onClick={() => setSelectedCurrency(code)}
                    className={`min-h-[48px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-brand-soft border-brand'
                        : 'bg-subtle border-border hover:border-brand'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-bold text-text-secondary shrink-0">
                        {meta.symbol.trim()}
                      </span>
                      <span className="text-[14px] font-bold text-text-primary">{meta.code}</span>
                    </div>
                    {active && (
                      <Check className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => setStep(2)}
              data-testid="onboarding-confirm-currency"
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue with {selectedCurrency}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5">
              <button
                type="button"
                onClick={() => onImportStatement(selectedCurrency)}
                data-testid="onboarding-import-link"
                className="min-h-[44px] px-2 text-[13px] font-semibold text-brand-text hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span>Import from bank statement</span>
              </button>

              <button
                type="button"
                onClick={() => onExploreSampleData(selectedCurrency)}
                data-testid="onboarding-sample-link"
                className="min-h-[44px] px-2 text-[13px] font-semibold text-text-secondary hover:text-text-primary hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Explore with sample data</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2: What do you pay for? */}
      {step === 2 && (
        <section className="space-y-5" data-testid="onboarding-step-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-text-primary">
                What do you pay for?
              </h1>
              <p className="mt-1 text-[15px] text-text-secondary">
                Tap a service to confirm its price, or add anything else you pay for.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[44px] px-3 rounded-xl bg-card border border-border text-[13px] font-semibold text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back</span>
            </button>
          </div>

          {/* Added chips strip */}
          {addedSubscriptions.length > 0 && (
            <div
              className="rounded-2xl bg-brand-soft border border-brand-border p-3.5 space-y-2"
              data-testid="onboarding-added-list"
            >
              <p className="text-[13px] font-semibold text-brand-text">
                Added ({addedSubscriptions.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {addedSubscriptions.map((sub) => (
                  <span
                    key={sub.id}
                    className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-xl bg-card border border-brand-border text-[13px] font-semibold text-text-primary"
                  >
                    <span>{sub.name}</span>
                    <span className="text-text-secondary tabular-nums font-medium">
                      {formatMinorUnits(sub.amountMinorUnits, sub.currency, {
                        showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
                      })}
                      {BILLING_CYCLES[sub.cycle].shortSuffix}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdded(sub.id)}
                      aria-label={`Remove ${sub.name}`}
                      className="min-h-[30px] min-w-[30px] rounded-lg hover:bg-subtle text-text-secondary hover:text-red-text flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="space-y-2.5">
            <label htmlFor="onboarding-catalog-search" className="sr-only">
              Search subscriptions
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="onboarding-catalog-search"
                type="search"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search Netflix, Spotify, ChatGPT, PTCL..."
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-card border border-border text-[15px] text-text-primary placeholder:text-text-secondary focus:border-brand"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                aria-pressed={catalogCategory === null}
                onClick={() => setCatalogCategory(null)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[13px] font-semibold border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  catalogCategory === null
                    ? 'bg-brand text-white border-brand'
                    : 'bg-card border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                Popular
              </button>
              {CATEGORY_LIST.map((cat) => {
                const visual = getCategoryVisual(cat);
                const selected = catalogCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCatalogCategory(selected ? null : cat)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[13px] font-semibold border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-brand text-white border-brand'
                        : 'bg-card border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {visual.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Searchable Service Grid + Add Something Else */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" data-testid="onboarding-service-grid">
            <button
              type="button"
              onClick={openCustomMiniForm}
              data-testid="onboarding-add-custom"
              className="min-h-[72px] p-2.5 sm:p-3 rounded-2xl bg-card border border-dashed border-brand-border hover:border-brand text-left flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 rounded-lg bg-brand-soft text-brand-text flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-text-primary leading-snug">
                  Add something else
                </span>
                <span className="block text-xs text-text-secondary mt-0.5">
                  Custom plan
                </span>
              </span>
            </button>

            {catalogEntries.map((entry) => {
              const addedSub = addedByCatalogId.get(entry.id);
              const localPrice = entry.typicalPriceMinorUnits?.[selectedCurrency];
              const usdPrice = entry.typicalPriceMinorUnits?.USD;
              const priceHint = typeof localPrice === 'number' ? localPrice : usdPrice;
              const priceCurrency: CurrencyCode =
                typeof localPrice === 'number' ? selectedCurrency : 'USD';

              return (
                <button
                  key={entry.id}
                  type="button"
                  data-testid={`onboarding-service-${entry.id}`}
                  onClick={() => openCatalogMiniForm(entry)}
                  className={`relative min-h-[72px] p-2.5 sm:p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                    addedSub
                      ? 'bg-brand-soft border-brand'
                      : 'bg-card border-border hover:border-brand'
                  }`}
                >
                  <ServiceAvatar
                    name={entry.name}
                    category={entry.category}
                    catalogId={entry.id}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 pr-3">
                    <span className="block text-[13px] font-bold text-text-primary truncate leading-snug">
                      {entry.name}
                    </span>
                    <span className="block text-xs text-text-secondary tabular-nums truncate mt-0.5">
                      {addedSub
                        ? `${formatMinorUnits(addedSub.amountMinorUnits, addedSub.currency, {
                            showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(addedSub.currency),
                          })}${BILLING_CYCLES[addedSub.cycle].shortSuffix}`
                        : typeof priceHint === 'number'
                          ? `${formatMinorUnits(priceHint, priceCurrency, {
                              showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(priceCurrency),
                            })}${BILLING_CYCLES[entry.defaultCycle].shortSuffix}`
                          : BILLING_CYCLES[entry.defaultCycle].label}
                    </span>
                  </span>
                  {addedSub && (
                    <span
                      aria-label="Added"
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center shrink-0"
                    >
                      <Check className="w-3 h-3" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sticky Running Total Bar */}
          <div className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  data-testid="onboarding-running-total"
                  className="text-[15px] font-bold text-text-primary tabular-nums truncate"
                >
                  You pay ≈ {formattedRunningMonthly}/month
                </p>
                <p className="text-xs text-text-secondary">
                  {addedSubscriptions.length === 0
                    ? 'Pick any services above or skip for now'
                    : `${addedSubscriptions.length} ${
                        addedSubscriptions.length === 1 ? 'subscription' : 'subscriptions'
                      } added`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  data-testid="onboarding-step2-continue"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{addedSubscriptions.length > 0 ? 'Continue' : 'Skip'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 3: Get reminded */}
      {step === 3 && (
        <section className="rounded-2xl app-surface p-5 sm:p-7 space-y-6" data-testid="onboarding-step-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-brand-text mb-1">
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span className="text-[13px] font-semibold">Renewal reminders</span>
              </div>
              <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-text-primary">
                Get reminded
              </h1>
              <p className="mt-1.5 text-[15px] text-text-secondary">
                Choose how early VaultFlow should highlight upcoming payments and ending trials.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-[44px] px-3 rounded-xl bg-subtle border border-border text-[13px] font-semibold text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back</span>
            </button>
          </div>

          <div
            className="space-y-2.5"
            role="radiogroup"
            aria-label="Reminder lead time"
          >
            {REMINDER_OPTIONS.map((opt) => {
              const selected = reminderLeadDays === opt.days;
              return (
                <button
                  key={opt.days}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`onboarding-reminder-${opt.days}`}
                  onClick={() => setReminderLeadDays(opt.days)}
                  className={`w-full min-h-[60px] px-4 py-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-brand-soft border-brand'
                      : 'bg-subtle border-border hover:border-brand'
                  }`}
                >
                  <div>
                    <p className="text-[15px] font-bold text-text-primary">{opt.title}</p>
                    <p className="text-[13px] text-text-secondary mt-0.5">{opt.subtitle}</p>
                  </div>
                  {selected && (
                    <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {addedSubscriptions.length > 0 && (
            <div className="rounded-xl bg-subtle border border-border p-4 space-y-2.5">
              <p className="text-[13px] text-text-secondary">
                Download a calendar file (.ics) so Google Calendar, Apple Calendar, or Outlook alerts you automatically — even when this app is closed.
              </p>
              <button
                type="button"
                onClick={handleExportOnboardingCalendar}
                data-testid="onboarding-export-calendar"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-card border border-border hover:border-brand text-[14px] font-semibold text-text-primary flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {calendarExported ? (
                  <>
                    <Check className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
                    <span>Downloaded subscription-renewals.ics</span>
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
                    <span>Add renewals to my calendar</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={completeSetup}
              data-testid="onboarding-finish"
              className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Finish setup</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Mini Form Modal for adding/editing a service in Step 2 */}
      {miniForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[2px] p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-mini-title"
          data-testid="onboarding-mini-form"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMiniForm(null);
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <ServiceAvatar
                  name={miniForm.name || '?'}
                  category={miniForm.category}
                  catalogId={miniForm.catalogId}
                  size="md"
                />
                <h2
                  id="onboarding-mini-title"
                  className="text-lg font-bold text-text-primary truncate"
                >
                  {miniForm.catalogId ? miniForm.name : 'Add subscription'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMiniForm(null)}
                aria-label="Close"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-subtle border border-border text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveMiniForm} className="space-y-4" noValidate>
              {miniFormError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-soft border border-red-border px-3.5 py-2.5 text-[13px] font-medium text-red-text"
                >
                  {miniFormError}
                </div>
              )}

              {!miniForm.catalogId && (
                <div>
                  <label
                    htmlFor="mini-name"
                    className="block text-[13px] font-semibold text-text-secondary mb-1.5"
                  >
                    Service name
                  </label>
                  <input
                    id="mini-name"
                    type="text"
                    autoFocus
                    value={miniForm.name}
                    onChange={(e) => {
                      setMiniForm({ ...miniForm, name: e.target.value });
                      if (miniFormError) setMiniFormError(null);
                    }}
                    placeholder="e.g. Local Gym, Cloud Server"
                    className="w-full h-11 px-3.5 rounded-xl bg-subtle border border-border text-[15px] text-text-primary focus:bg-card focus:border-brand"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    htmlFor="mini-price"
                    className="block text-[13px] font-semibold text-text-secondary mb-1.5"
                  >
                    Price
                  </label>
                  <input
                    id="mini-price"
                    type="text"
                    inputMode="decimal"
                    autoFocus={Boolean(miniForm.catalogId)}
                    value={miniForm.amountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9,]*\.?[0-9]{0,2}$/.test(val)) {
                        setMiniForm({ ...miniForm, amountInput: val });
                        if (miniFormError) setMiniFormError(null);
                      }
                    }}
                    placeholder={miniForm.currency === 'PKR' ? '1100' : '15.49'}
                    className="w-full h-11 px-3.5 rounded-xl bg-subtle border border-border tabular-nums text-[15px] text-text-primary focus:bg-card focus:border-brand"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mini-currency"
                    className="block text-[13px] font-semibold text-text-secondary mb-1.5"
                  >
                    Currency
                  </label>
                  <select
                    id="mini-currency"
                    value={miniForm.currency}
                    onChange={(e) =>
                      setMiniForm({ ...miniForm, currency: e.target.value as CurrencyCode })
                    }
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

              <div>
                <span className="block text-[13px] font-semibold text-text-secondary mb-1.5">
                  Billing cycle
                </span>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-subtle border border-border">
                  {BILLING_CYCLE_LIST.map((cycleOption) => {
                    const selected = miniForm.cycle === cycleOption;
                    return (
                      <button
                        key={cycleOption}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setMiniForm({ ...miniForm, cycle: cycleOption })}
                        className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          selected
                            ? 'bg-card text-text-primary shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {BILLING_CYCLES[cycleOption].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="mini-next-date"
                  className="block text-[13px] font-semibold text-text-secondary mb-1.5"
                >
                  Next payment date
                </label>
                <input
                  id="mini-next-date"
                  type="date"
                  value={miniForm.nextBillingDate}
                  onChange={(e) => setMiniForm({ ...miniForm, nextBillingDate: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-subtle border border-border tabular-nums text-[15px] text-text-primary focus:bg-card focus:border-brand"
                />
              </div>

              <div className="rounded-xl bg-amber-soft border border-amber-border px-3.5 py-3 flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-text-primary">
                  This is a free trial
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={miniForm.isFreeTrial}
                  aria-label="This is a free trial"
                  onClick={() =>
                    setMiniForm({ ...miniForm, isFreeTrial: !miniForm.isFreeTrial })
                  }
                  className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                    miniForm.isFreeTrial ? 'bg-amber' : 'bg-border'
                  }`}
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-card shadow-xs transition-transform ${
                      miniForm.isFreeTrial ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-1 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMiniForm(null)}
                  className="flex-1 min-h-[44px] rounded-xl bg-subtle border border-border text-[15px] font-semibold text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="onboarding-mini-save"
                  className="flex-[2] min-h-[44px] rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white cursor-pointer"
                >
                  {miniForm.editingLocalId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
