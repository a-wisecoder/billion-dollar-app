import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Mail,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ThemeMode } from '../../../core/theme/themeService';
import { Button, ToggleSwitch } from '../../../core/ui/primitives';
import {
  MAX_BACKUP_BYTES,
  exportVaultBackup,
  parseVaultBackup,
} from '../../../core/utils/backupService';
import { exportSubscriptionsCsv } from '../../../core/utils/csvExport';
import {
  EXCHANGE_RATE_ATTRIBUTION_URL,
  formatRatesDate,
} from '../../../core/utils/exchangeRates';
import {
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
import { detectDeviceLabel } from '../../billing/data/licenseProvider';
import {
  FREE_MAX_ACTIVE_SUBSCRIPTIONS,
  can,
  getCountedActiveSubscriptions,
  maskLicenseKey,
  type EntitlementsState,
  type LicenseEvaluation,
  type LicenseRecord,
} from '../../billing/domain/entitlements';
import {
  CURRENCIES,
  CURRENCY_CODES,
  getEffectiveExchangeRates,
  type CurrencyCode,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';
import { CurrencySearchSelect } from '../../cashflow/presentation/CurrencySearchSelect';
import type { PwaInstallState } from '../../pwa/usePwaInstall';

interface VaultSettingsViewProps {
  readonly subscriptions: readonly Subscription[];
  readonly settings: VaultSettings;
  readonly entitlements: EntitlementsState;
  readonly licenseRecord: LicenseRecord | null;
  readonly licenseEvaluation: LicenseEvaluation;
  readonly themeMode: ThemeMode;
  readonly ratesFetchedAt: string | null;
  readonly ratesSource: 'live' | 'cache' | 'default';
  readonly refreshingRates: boolean;
  readonly pwaInstall: PwaInstallState;
  readonly onChangeThemeMode: (mode: ThemeMode) => void;
  readonly onUpdateSettings: (next: VaultSettings) => void;
  readonly onRefreshRates: () => void;
  readonly onExportAllCalendar: () => void;
  readonly onOpenUpgrade: (options?: {
    readonly showKeyInput?: boolean;
    readonly contextMessage?: string;
  }) => void;
  readonly onDeactivateLicense: () => Promise<void>;
  readonly onImportVault: (subscriptions: Subscription[], settings: VaultSettings) => void;
  readonly onSeedDemoData: () => void;
  readonly onClearAllData: () => void;
}

const THEME_OPTIONS: readonly {
  readonly id: ThemeMode;
  readonly label: string;
  readonly Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}[] = [
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

const FEATURED_RATE_CURRENCIES: readonly CurrencyCode[] = ['PKR', 'EUR', 'GBP', 'AED', 'INR'];

export const VaultSettingsView: React.FC<VaultSettingsViewProps> = ({
  subscriptions,
  settings,
  entitlements,
  licenseRecord,
  licenseEvaluation,
  themeMode,
  ratesFetchedAt,
  ratesSource,
  refreshingRates,
  pwaInstall,
  onChangeThemeMode,
  onUpdateSettings,
  onRefreshRates,
  onExportAllCalendar,
  onOpenUpgrade,
  onDeactivateLicense,
  onImportVault,
  onSeedDemoData,
  onClearAllData,
}) => {
  const [budgetInput, setBudgetInput] = useState(() =>
    minorUnitsToInputString(settings.monthlyCeilingMinorUnits),
  );
  const [incomeInput, setIncomeInput] = useState(() =>
    minorUnitsToInputString(
      settings.monthlyIncomeMinorUnits ??
        CURRENCIES[settings.baseCurrency].defaultMonthlyIncomeMinorUnits,
    ),
  );
  const [markupInput, setMarkupInput] = useState(() => String(settings.cardMarkupPercent ?? 0));
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [incomeSaved, setIncomeSaved] = useState(false);
  const [showAllRates, setShowAllRates] = useState(false);

  const [downloadedBackup, setDownloadedBackup] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState(false);
  const [downloadedIcs, setDownloadedIcs] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    readonly subscriptions: Subscription[];
    readonly settings: VaultSettings;
  } | null>(null);

  const [confirmDemoSeed, setConfirmDemoSeed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canExportCsv = can('csvExport', entitlements);
  const canCustomRates = can('customRatesAndMarkup', entitlements);
  const countedActive = getCountedActiveSubscriptions(entitlements);

  const activeSubscriptionCount = useMemo(
    () => subscriptions.filter((s) => !s.isArchived).length,
    [subscriptions],
  );

  const effectiveRates = useMemo(() => getEffectiveExchangeRates(settings), [settings]);
  const customRates = settings.customExchangeRates ?? {};
  const customRateCount = Object.keys(customRates).length;

  const prioritizedRateCurrencies = useMemo(() => {
    const nonUsd = CURRENCY_CODES.filter((c) => c !== 'USD');
    if (showAllRates) return nonUsd;

    const pinned = new Set<CurrencyCode>();
    if (settings.baseCurrency !== 'USD') pinned.add(settings.baseCurrency);
    for (const sub of subscriptions) {
      if (sub.currency !== 'USD') pinned.add(sub.currency);
    }
    for (const code of Object.keys(customRates) as CurrencyCode[]) {
      if (code !== 'USD') pinned.add(code);
    }
    for (const code of FEATURED_RATE_CURRENCIES) {
      if (pinned.size < 5) pinned.add(code);
    }
    return nonUsd.filter((code) => pinned.has(code));
  }, [showAllRates, settings.baseCurrency, subscriptions, customRates]);

  const formattedRatesDate = formatRatesDate(ratesFetchedAt);

  useEffect(() => {
    setBudgetInput(minorUnitsToInputString(settings.monthlyCeilingMinorUnits));
  }, [settings.monthlyCeilingMinorUnits]);

  useEffect(() => {
    setIncomeInput(
      minorUnitsToInputString(
        settings.monthlyIncomeMinorUnits ??
          CURRENCIES[settings.baseCurrency].defaultMonthlyIncomeMinorUnits,
      ),
    );
  }, [settings.baseCurrency, settings.monthlyIncomeMinorUnits]);

  useEffect(() => {
    setMarkupInput(String(settings.cardMarkupPercent ?? 0));
  }, [settings.cardMarkupPercent]);

  const handleCurrencySelect = (code: CurrencyCode) => {
    if (code === settings.baseCurrency) return;
    const oldRate = effectiveRates[settings.baseCurrency];
    const newRate = effectiveRates[code];
    const convertedBudget =
      oldRate > 0 && newRate > 0
        ? Math.max(1000, Math.round((settings.monthlyCeilingMinorUnits * newRate) / oldRate))
        : CURRENCIES[code].defaultMonthlyCeilingMinorUnits;

    const oldIncome =
      settings.monthlyIncomeMinorUnits ??
      CURRENCIES[settings.baseCurrency].defaultMonthlyIncomeMinorUnits;
    const convertedIncome =
      oldRate > 0 && newRate > 0
        ? Math.max(1000, Math.round((oldIncome * newRate) / oldRate))
        : CURRENCIES[code].defaultMonthlyIncomeMinorUnits;

    setBudgetInput(minorUnitsToInputString(convertedBudget));
    setIncomeInput(minorUnitsToInputString(convertedIncome));
    onUpdateSettings({
      ...settings,
      baseCurrency: code,
      monthlyCeilingMinorUnits: convertedBudget,
      monthlyIncomeMinorUnits: convertedIncome,
    });
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseDecimalToMinorUnits(budgetInput);
    if (parsed === null || parsed <= 0) return;
    onUpdateSettings({
      ...settings,
      monthlyCeilingMinorUnits: parsed,
    });
    setBudgetSaved(true);
    window.setTimeout(() => setBudgetSaved(false), 1800);
  };

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseDecimalToMinorUnits(incomeInput);
    if (parsed === null || parsed <= 0) return;
    onUpdateSettings({
      ...settings,
      monthlyIncomeMinorUnits: parsed,
    });
    setIncomeSaved(true);
    window.setTimeout(() => setIncomeSaved(false), 1800);
  };

  const handleMarkupChange = (raw: string) => {
    if (!canCustomRates) {
      onOpenUpgrade({
        contextMessage: 'Card foreign-currency markup is included in VaultFlow Pro.',
      });
      return;
    }
    setMarkupInput(raw);
    if (raw.trim() === '') {
      onUpdateSettings({ ...settings, cardMarkupPercent: 0 });
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(10, Math.max(0, Math.round(parsed * 100) / 100));
    onUpdateSettings({ ...settings, cardMarkupPercent: clamped });
  };

  const handleToggleCustomRate = (code: CurrencyCode) => {
    if (code === 'USD') return;
    if (!canCustomRates) {
      onOpenUpgrade({
        contextMessage: 'Custom offline exchange rates are included in VaultFlow Pro.',
      });
      return;
    }
    const nextCustom: Partial<Record<CurrencyCode, number>> = { ...customRates };
    if (typeof nextCustom[code] === 'number') {
      delete nextCustom[code];
    } else {
      nextCustom[code] = settings.exchangeRatesPerUsd[code] ?? CURRENCIES[code].defaultRatePerUsd;
    }
    onUpdateSettings({
      ...settings,
      customExchangeRates: nextCustom,
    });
  };

  const handleCustomRateValueChange = (code: CurrencyCode, rawValue: string) => {
    if (code === 'USD') return;
    if (!canCustomRates) {
      onOpenUpgrade({
        contextMessage: 'Custom offline exchange rates are included in VaultFlow Pro.',
      });
      return;
    }
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onUpdateSettings({
      ...settings,
      customExchangeRates: {
        ...customRates,
        [code]: parsed,
      },
    });
  };

  const handleClearAllCustomRates = () => {
    if (!canCustomRates) {
      onOpenUpgrade({
        contextMessage: 'Custom offline exchange rates are included in VaultFlow Pro.',
      });
      return;
    }
    onUpdateSettings({
      ...settings,
      customExchangeRates: {},
    });
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportBackup = () => {
    const json = exportVaultBackup(subscriptions, settings);
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerDownload(json, `vaultflow-backup-${dateStamp}.json`, 'application/json;charset=utf-8');
    setDownloadedBackup(true);
    window.setTimeout(() => setDownloadedBackup(false), 2200);
  };

  const handleExportCsv = () => {
    if (!canExportCsv) {
      onOpenUpgrade({
        contextMessage: 'CSV export for spreadsheets is included in VaultFlow Pro.',
      });
      return;
    }
    const csv = exportSubscriptionsCsv(subscriptions);
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerDownload(csv, `vaultflow-subscriptions-${dateStamp}.csv`, 'text/csv;charset=utf-8');
    setDownloadedCsv(true);
    window.setTimeout(() => setDownloadedCsv(false), 2200);
  };

  const handleConfirmDeactivate = async () => {
    if (deactivating) return;
    setDeactivating(true);
    try {
      await onDeactivateLicense();
      setConfirmDeactivate(false);
    } finally {
      setDeactivating(false);
    }
  };

  const handleCalendarExportClick = () => {
    if (activeSubscriptionCount === 0) return;
    onExportAllCalendar();
    setDownloadedIcs(true);
    window.setTimeout(() => setDownloadedIcs(false), 2500);
  };

  const applyBackupRestore = (
    nextSubscriptions: Subscription[],
    nextSettings: VaultSettings,
  ) => {
    onImportVault(nextSubscriptions, nextSettings);
    setImportFeedback({
      type: 'success',
      message: `Restored ${nextSubscriptions.length} ${nextSubscriptions.length === 1 ? 'subscription' : 'subscriptions'} and settings.`,
    });
    setPendingRestore(null);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setPendingRestore(null);
      setImportFeedback({
        type: 'error',
        message: 'Backup file is too large (max 1 MB). Please choose a valid VaultFlow backup.',
      });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const result = parseVaultBackup(content);
      if (!result.ok) {
        setPendingRestore(null);
        setImportFeedback({ type: 'error', message: result.error });
        return;
      }
      const nextSubs = [...result.data.subscriptions];
      if (subscriptions.length > 0) {
        setImportFeedback(null);
        setPendingRestore({ subscriptions: nextSubs, settings: result.data.settings });
      } else {
        applyBackupRestore(nextSubs, result.data.settings);
      }
    };
    reader.onerror = () => {
      setPendingRestore(null);
      setImportFeedback({
        type: 'error',
        message: 'Could not read that backup file. Please try exporting a fresh JSON backup.',
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifStatus('Browser notifications are not supported here.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(
        permission === 'granted'
          ? 'Browser notifications allowed while this app is open.'
          : 'Permission not granted; in-app highlights stay active.',
      );
    } catch {
      setNotifStatus('Browser notifications unavailable in this preview.');
    }
  };

  const showInstallCard =
    pwaInstall.canInstall || pwaInstall.isIosSafari || pwaInstall.isInstalled;

  return (
    <div className="space-y-6" data-testid="settings-view">
      {/* Header + Appearance Switch */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.025em] text-text-primary leading-tight">
            Settings
          </h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            All data stays on this device. No bank logins.
          </p>
        </div>

        <div
          className="relative inline-flex items-center p-1 rounded-xl bg-subtle/90 border border-border"
          role="radiogroup"
          aria-label="Theme"
          data-testid="theme-selector"
        >
          {THEME_OPTIONS.map(({ id, label, Icon }) => {
            const selected = themeMode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChangeThemeMode(id)}
                className={`relative z-10 min-h-[38px] px-3 py-1.5 rounded-[9px] text-[13px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  selected
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="settings-theme-pill"
                    transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }}
                    className="absolute inset-0 -z-10 rounded-[9px] bg-card border border-border/80 shadow-[0_1px_3px_rgba(15,26,23,0.08)]"
                  />
                )}
                <Icon className="w-3.5 h-3.5" aria-hidden={true} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Currency & Rates + Budget & Income */}
        <div className="space-y-6">
          {/* Card 1: Currency and rates */}
          <section className="rounded-2xl app-surface p-5 sm:p-6 space-y-5">
            <div className="flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-brand-text mt-1 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Currency and rates
                </h2>
                <p className="mt-0.5 text-[13px] text-text-secondary">
                  Choose your main currency, card foreign-currency markup, and custom offline rates.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="settings-base-currency"
                className="block text-[13px] font-semibold text-text-primary mb-2"
              >
                Main currency
              </label>
              <CurrencySearchSelect
                id="settings-base-currency"
                value={settings.baseCurrency}
                onChange={handleCurrencySelect}
                label="Select main currency"
                testId="settings-currency-picker"
              />
            </div>

            {/* Card foreign-currency markup % */}
            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="card-markup-percent"
                    className="text-[13px] font-semibold text-text-primary"
                  >
                    Card foreign-currency markup %
                  </label>
                  {!canCustomRates && (
                    <span
                      data-testid="card-markup-pro-badge"
                      className="text-xs font-bold text-brand-text"
                    >
                      · Pro
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-text-secondary tabular-nums">0% – 10%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="card-markup-percent"
                  data-testid="card-markup-input"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  readOnly={!canCustomRates}
                  value={markupInput}
                  onClick={() => {
                    if (!canCustomRates) {
                      onOpenUpgrade({
                        contextMessage: 'Card foreign-currency markup is included in VaultFlow Pro.',
                      });
                    }
                  }}
                  onChange={(e) => handleMarkupChange(e.target.value)}
                  className="w-24 h-11 px-3 rounded-xl bg-subtle/80 border border-border font-mono tabular-nums text-[15px] font-semibold text-text-primary focus:bg-card focus:border-brand cursor-pointer transition-colors"
                />
                <p className="text-[13px] text-text-secondary leading-snug">
                  Added to converted totals when a subscription is billed in another currency.
                </p>
              </div>
            </div>

            {/* Live rates status + custom per-currency overrides */}
            <div className="pt-4 border-t border-border space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-text-primary">
                    Exchange rates (per 1 USD)
                  </h3>
                  <p
                    className="text-xs text-text-secondary tabular-nums mt-0.5"
                    data-testid="rates-date-label"
                  >
                    {formattedRatesDate
                      ? `Rates from ${formattedRatesDate}`
                      : ratesSource === 'default'
                        ? 'Using built-in offline rates'
                        : 'Rates loaded'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {customRateCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllCustomRates}
                      className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:underline cursor-pointer"
                    >
                      Clear custom ({customRateCount})
                    </button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRefreshRates}
                    disabled={refreshingRates}
                    data-testid="refresh-rates-button"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-brand-text ${refreshingRates ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{refreshingRates ? 'Updating...' : 'Refresh'}</span>
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/80">
                {prioritizedRateCurrencies.map((code) => {
                  const hasCustom = typeof customRates[code] === 'number';
                  const liveRate =
                    settings.exchangeRatesPerUsd[code] ?? CURRENCIES[code].defaultRatePerUsd;
                  const displayedValue = hasCustom ? customRates[code]! : liveRate;

                  return (
                    <div
                      key={code}
                      data-testid={`rate-row-${code}`}
                      className="bg-subtle/35 px-3.5 py-2.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-[13px] font-bold text-text-primary">
                            {code}
                          </span>
                          <span className="ml-1.5 text-[13px] text-text-secondary">
                            {CURRENCIES[code].name}
                          </span>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary cursor-pointer min-h-[30px]">
                          <input
                            type="checkbox"
                            checked={canCustomRates && hasCustom}
                            onChange={() => handleToggleCustomRate(code)}
                            data-testid={`custom-rate-toggle-${code}`}
                            className="accent-brand w-4 h-4 rounded cursor-pointer"
                          />
                          <span>Use my own rate</span>
                          {!canCustomRates && (
                            <span className="text-brand-text font-bold">· Pro</span>
                          )}
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-mono text-text-secondary tabular-nums">
                          {hasCustom
                            ? `Custom (live: ${liveRate})`
                            : `1 USD = ${liveRate} ${code}`}
                        </span>
                        {canCustomRates && hasCustom && (
                          <input
                            id={`rate-${code}`}
                            data-testid={`custom-rate-input-${code}`}
                            aria-label={`Custom exchange rate for ${code} per 1 USD`}
                            type="number"
                            step="0.01"
                            min="0.01"
                            defaultValue={displayedValue}
                            key={`${code}-custom-${displayedValue}`}
                            onBlur={(e) => handleCustomRateValueChange(code, e.target.value)}
                            onChange={(e) => handleCustomRateValueChange(code, e.target.value)}
                            className="w-28 h-9 px-3 rounded-lg bg-card border border-brand font-mono tabular-nums text-[13px] font-semibold text-text-primary"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllRates((v) => !v)}
                  data-testid="toggle-all-rates"
                  className="min-h-[36px] text-[13px] font-semibold text-brand-text hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {showAllRates ? (
                    <>
                      <ChevronUp className="w-4 h-4" aria-hidden="true" />
                      <span>Show fewer currencies</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      <span>Show all {CURRENCY_CODES.length - 1} currencies</span>
                    </>
                  )}
                </button>

                <a
                  href={EXCHANGE_RATE_ATTRIBUTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="rates-attribution-link"
                  className="min-h-[36px] inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:underline"
                >
                  <span>Rates by Exchange Rate API</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          {/* Card 2: Budget and income */}
          <section className="rounded-2xl app-surface p-5 sm:p-6 space-y-5">
            <div className="flex items-start gap-2.5">
              <Wallet className="w-4 h-4 text-brand-text mt-1 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Budget and income
                </h2>
                <p className="mt-0.5 text-[13px] text-text-secondary">
                  Set your monthly limit and take-home pay.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-2">
              <label
                htmlFor="monthly-budget-setting"
                className="block text-[13px] font-semibold text-text-primary"
              >
                Monthly budget ({settings.baseCurrency})
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="monthly-budget-setting"
                  type="text"
                  inputMode="decimal"
                  value={budgetInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^[0-9,]*\.?[0-9]{0,2}$/.test(v)) {
                      setBudgetInput(v);
                    }
                  }}
                  className="flex-1 h-11 px-3.5 rounded-xl bg-subtle/80 border border-border font-mono tabular-nums text-[15px] font-semibold text-text-primary focus:bg-card focus:border-brand transition-colors"
                />
                <Button variant="primary" size="md" type="submit">
                  {budgetSaved ? 'Saved' : 'Save'}
                </Button>
              </div>
            </form>

            <form onSubmit={handleSaveIncome} className="pt-4 border-t border-border space-y-2">
              <label
                htmlFor="monthly-income-input"
                className="block text-[13px] font-semibold text-text-primary"
              >
                Monthly take-home income ({settings.baseCurrency})
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="monthly-income-input"
                  type="text"
                  inputMode="decimal"
                  value={incomeInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^[0-9,]*\.?[0-9]{0,2}$/.test(v)) {
                      setIncomeInput(v);
                    }
                  }}
                  className="flex-1 h-11 px-3.5 rounded-xl bg-subtle/80 border border-border font-mono tabular-nums text-[15px] font-semibold text-text-primary focus:bg-card focus:border-brand transition-colors"
                />
                <Button variant="primary" size="md" type="submit">
                  {incomeSaved ? 'Saved' : 'Save'}
                </Button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Plan, Reminders, Install app, Data, Danger zone, Legal */}
        <div className="space-y-6">
          {/* Card 3: Plan & License */}
          <section
            className="rounded-2xl app-surface p-5 sm:p-6 space-y-4"
            data-testid="settings-plan-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CreditCard className="w-4 h-4 text-brand-text mt-1 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                    Plan
                  </h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary tabular-nums">
                    {entitlements.plan === 'pro'
                      ? licenseRecord?.expiresAt
                        ? `Pro active until ${formatRatesDate(licenseRecord.expiresAt) ?? licenseRecord.expiresAt.slice(0, 10)}`
                        : 'Pro active — unlimited subscriptions and tools'
                      : `${countedActive} of ${FREE_MAX_ACTIVE_SUBSCRIPTIONS} active subscriptions used on Free`}
                  </p>
                </div>
              </div>

              <span
                data-testid="settings-plan-badge"
                className={`text-xs font-mono font-bold uppercase tracking-wider shrink-0 mt-1 ${
                  entitlements.plan === 'pro' ? 'text-brand-text' : 'text-text-secondary'
                }`}
              >
                {entitlements.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>

            {licenseRecord && (
              <div className="py-2.5 border-y border-border flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="text-text-secondary font-medium">License key</span>
                <span
                  data-testid="settings-masked-license-key"
                  className="font-mono font-semibold text-text-primary tabular-nums"
                >
                  {maskLicenseKey(licenseRecord.key)}
                </span>
              </div>
            )}

            {licenseEvaluation.reason === 'offline_grace' && (
              <p
                data-testid="settings-offline-grace-note"
                className="text-[13px] text-text-secondary"
              >
                You&apos;re offline. Pro stays active for up to{' '}
                {licenseEvaluation.daysRemainingInGrace ?? 14}{' '}
                {licenseEvaluation.daysRemainingInGrace === 1 ? 'day' : 'days'} until your device
                reconnects.
              </p>
            )}

            {licenseEvaluation.reason === 'offline_grace_exceeded' && (
              <p
                data-testid="settings-offline-expired-note"
                className="rounded-xl bg-amber-soft border border-amber-border px-3.5 py-2.5 text-[13px] font-medium text-amber-text"
              >
                Your license hasn&apos;t been checked online in over 14 days, so this device is back
                on Free. Reconnect and tap Restore to reactivate Pro — no data was removed.
              </p>
            )}

            {licenseEvaluation.reason === 'expired' && (
              <p className="rounded-xl bg-amber-soft border border-amber-border px-3.5 py-2.5 text-[13px] font-medium text-amber-text">
                Your Pro license expired. All your subscriptions are safe; upgrade or enter a new
                key to unlock Pro again.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              {entitlements.plan === 'free' && (
                <Button
                  variant="primary"
                  size="md"
                  data-testid="settings-upgrade-button"
                  onClick={() => onOpenUpgrade()}
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Upgrade to Pro</span>
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                data-testid="settings-restore-license-button"
                onClick={() => onOpenUpgrade({ showKeyInput: true })}
              >
                <KeyRound className="w-4 h-4 text-brand-text" aria-hidden="true" />
                <span>Restore</span>
              </Button>

              {licenseRecord && !confirmDeactivate && (
                <Button
                  variant="ghost"
                  size="md"
                  data-testid="settings-deactivate-license-button"
                  onClick={() => setConfirmDeactivate(true)}
                  className="hover:text-red-text"
                >
                  Deactivate on this device
                </Button>
              )}
            </div>

            {licenseRecord && confirmDeactivate && (
              <div
                role="alert"
                data-testid="confirm-deactivate-license"
                className="rounded-xl bg-amber-soft border border-amber-border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-[13px] font-semibold text-amber-text">
                  Deactivate Pro on this device? Your subscriptions stay saved.
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={deactivating}
                    onClick={() => {
                      void handleConfirmDeactivate();
                    }}
                  >
                    {deactivating ? 'Deactivating...' : 'Deactivate'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmDeactivate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Card 4: Reminders */}
          <section className="rounded-2xl app-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-brand-text mt-1 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                    Reminders
                  </h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">
                    Highlight upcoming renewals and add them to your calendar.
                  </p>
                </div>
              </div>

              <ToggleSwitch
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) =>
                  onUpdateSettings({
                    ...settings,
                    notificationsEnabled: checked,
                  })
                }
                ariaLabel="Toggle renewal reminders"
              />
            </div>

            <div>
              <span className="block text-[13px] font-semibold text-text-secondary mb-2">
                Remind me
              </span>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((days) => {
                  const selected = settings.reminderLeadDays === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      disabled={!settings.notificationsEnabled}
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          reminderLeadDays: days,
                          ...(settings.calendarExportedAt ? { calendarExportDirty: true } : {}),
                        })
                      }
                      className={`min-h-[40px] rounded-xl border text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:text-text-disabled ${
                        selected
                          ? 'bg-brand-soft border-brand text-brand-text'
                          : 'bg-subtle/70 border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {days} {days === 1 ? 'day before' : 'days before'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar (.ics) export */}
            <div className="pt-3.5 border-t border-border space-y-3">
              <Button
                variant="primary"
                size="md"
                disabled={activeSubscriptionCount === 0}
                onClick={handleCalendarExportClick}
                data-testid="export-all-calendar-ics"
                className="w-full"
              >
                {downloadedIcs ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Downloaded subscription-renewals.ics</span>
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Add all renewals to my calendar</span>
                  </>
                )}
              </Button>

              <div className="rounded-xl bg-subtle/60 border border-border p-3.5 space-y-1.5 text-[13px] text-text-secondary leading-relaxed">
                <p>
                  <strong className="text-text-primary">Google Calendar:</strong> Create a calendar
                  called &ldquo;Subscriptions&rdquo;, set its default all-day notification, then go
                  to Settings &gt; Import &amp; export &gt; Import into it.
                </p>
                <p>
                  <strong className="text-text-primary">iPhone &amp; Mac:</strong> Open the
                  downloaded file and tap Add All.
                </p>
                <p>
                  <strong className="text-text-primary">Outlook:</strong> Open Calendar &gt; Add
                  calendar &gt; Upload from file.
                </p>
              </div>
            </div>

            {/* Honest browser notification notice */}
            <div className="pt-3.5 border-t border-border space-y-2.5">
              <p className="text-[13px] text-text-secondary leading-relaxed">
                Browser notifications only appear while the app is open. For reminders you
                can&apos;t miss, add renewals to your calendar.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={handleRequestBrowserPermission}>
                  Allow browser notifications
                </Button>
                {notifStatus && <p className="text-[13px] text-text-secondary">{notifStatus}</p>}
              </div>
            </div>
          </section>

          {/* Card 5: Install app */}
          {showInstallCard && (
            <section
              className="rounded-2xl app-surface p-5 sm:p-6 space-y-3"
              data-testid="install-app-section"
            >
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-brand-text mt-1 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                    Install app
                  </h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">
                    {pwaInstall.isInstalled
                      ? 'VaultFlow is installed on this device and works offline.'
                      : pwaInstall.isIosSafari
                        ? 'Open VaultFlow like a native app without browser bars.'
                        : 'Add VaultFlow to your home screen for quick offline access.'}
                  </p>
                </div>
              </div>

              {pwaInstall.canInstall && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    void pwaInstall.promptInstall();
                  }}
                  data-testid="install-app-button"
                  className="w-full"
                >
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Install app</span>
                </Button>
              )}

              {!pwaInstall.canInstall && pwaInstall.isIosSafari && !pwaInstall.isInstalled && (
                <p className="rounded-xl bg-subtle/70 border border-border px-3.5 py-2.5 text-[13px] font-medium text-text-primary">
                  In Safari, tap <strong>Share &gt; Add to Home Screen</strong>.
                </p>
              )}
            </section>
          )}

          {/* Card 6: Data */}
          <section className="rounded-2xl app-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-brand-text mt-1 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Data
                </h2>
                <p className="mt-0.5 text-[13px] text-text-secondary tabular-nums">
                  Back up, restore, or open in Excel ({subscriptions.length} saved).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Button
                variant="primary"
                size="md"
                data-testid="export-backup-json"
                onClick={handleExportBackup}
                className="text-[13px] px-3"
              >
                {downloadedBackup ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Export (.json)</span>
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="md"
                data-testid="import-backup-trigger"
                onClick={() => fileInputRef.current?.click()}
                className="text-[13px] px-3"
              >
                <Upload className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <span>Import backup</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                aria-label="Import backup JSON file"
                data-testid="import-backup-input"
                onChange={handleImportFileChange}
                className="sr-only"
              />

              <Button
                variant="secondary"
                size="md"
                data-testid="export-csv-button"
                onClick={handleExportCsv}
                className="text-[13px] px-3"
              >
                {downloadedCsv ? (
                  <>
                    <Check className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
                    <span>Saved CSV</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet
                      className="w-4 h-4 text-text-secondary shrink-0"
                      aria-hidden="true"
                    />
                    <span>Export CSV</span>
                    {!canExportCsv && (
                      <span
                        data-testid="export-csv-pro-badge"
                        className="text-xs font-bold text-brand-text"
                      >
                        · Pro
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>

            {importFeedback && (
              <p
                role={importFeedback.type === 'error' ? 'alert' : 'status'}
                className={`text-[13px] font-semibold ${
                  importFeedback.type === 'error' ? 'text-red-text' : 'text-brand-text'
                }`}
              >
                {importFeedback.message}
              </p>
            )}

            {pendingRestore && (
              <div
                role="alert"
                data-testid="confirm-restore-backup"
                className="rounded-xl bg-amber-soft border border-amber-border p-3.5 flex flex-wrap items-center justify-between gap-2.5"
              >
                <span className="text-[13px] font-semibold text-amber-text">
                  This replaces your {subscriptions.length}{' '}
                  {subscriptions.length === 1 ? 'subscription' : 'subscriptions'}.
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      applyBackupRestore(pendingRestore.subscriptions, pendingRestore.settings)
                    }
                  >
                    Replace
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setPendingRestore(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Card 7: Danger zone */}
          <section className="rounded-2xl app-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red mt-1 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Danger zone
                </h2>
                <p className="mt-0.5 text-[13px] text-text-secondary">
                  Reset with sample data or wipe everything on this device.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!confirmDemoSeed ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    if (subscriptions.length > 0) {
                      setConfirmDemoSeed(true);
                    } else {
                      onSeedDemoData();
                    }
                  }}
                >
                  <RotateCcw className="w-4 h-4 text-text-secondary" aria-hidden="true" />
                  <span>Load sample data</span>
                </Button>
              ) : (
                <div
                  role="alert"
                  data-testid="confirm-seed-demo"
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-soft border border-amber-border px-3.5 py-2.5 w-full justify-between"
                >
                  <span className="text-[13px] font-semibold text-amber-text">
                    This replaces your {subscriptions.length}{' '}
                    {subscriptions.length === 1 ? 'subscription' : 'subscriptions'}.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onSeedDemoData();
                        setConfirmDemoSeed(false);
                      }}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDemoSeed(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!confirmClear ? (
                <Button variant="dangerSoft" size="md" onClick={() => setConfirmClear(true)}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Clear all data</span>
                </Button>
              ) : (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-red-soft border border-red-border px-3.5 py-2.5 w-full justify-between"
                >
                  <span className="text-[13px] font-semibold text-red-text">
                    Remove all saved subscriptions?
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        onClearAllData();
                        setConfirmClear(false);
                      }}
                    >
                      Clear all
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Card 8: Legal & Feedback */}
          <section
            className="rounded-2xl app-surface p-5 sm:p-6 space-y-4"
            data-testid="settings-legal-feedback"
          >
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-brand-text mt-1 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-text-primary">
                  Legal &amp; feedback
                </h2>
                <p className="mt-0.5 text-[13px] text-text-secondary">
                  Read how your data is handled or report an issue.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
              <a
                href="/privacy/"
                className="min-h-[40px] inline-flex items-center font-semibold text-brand-text hover:underline"
              >
                Privacy
              </a>
              <a
                href="/terms/"
                className="min-h-[40px] inline-flex items-center font-semibold text-brand-text hover:underline"
              >
                Terms
              </a>
              <a
                href="/refunds/"
                className="min-h-[40px] inline-flex items-center font-semibold text-brand-text hover:underline"
              >
                Refunds
              </a>
              <a
                href="/"
                className="min-h-[40px] inline-flex items-center font-medium text-text-secondary hover:text-text-primary"
              >
                Website
              </a>
            </div>

            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono text-text-secondary tabular-nums">
                VaultFlow v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
              </span>
              <a
                href={`mailto:[CONTACT EMAIL]?subject=${encodeURIComponent(
                  'VaultFlow feedback',
                )}&body=${encodeURIComponent(
                  `\n\n---\nApp version: ${
                    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'
                  }\nBrowser: ${detectDeviceLabel()}\nUser agent: ${
                    typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
                  }`,
                )}`}
                data-testid="settings-send-feedback"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-card border border-border hover:border-border-strong hover:bg-subtle/60 text-[13px] font-semibold text-text-primary inline-flex items-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4 text-brand-text" aria-hidden="true" />
                <span>Send feedback</span>
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
