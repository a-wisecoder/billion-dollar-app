import React, { useState } from 'react';
import {
  Bell,
  Check,
  Copy,
  Database,
  Download,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { exportVaultBackup, parseVaultBackup } from '../../../core/utils/backupService';
import {
  CURRENCIES,
  CURRENCY_CODES,
  createDefaultSettings,
  type CurrencyCode,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';

interface VaultSettingsViewProps {
  readonly subscriptions: readonly Subscription[];
  readonly settings: VaultSettings;
  readonly onUpdateSettings: (next: VaultSettings) => void;
  readonly onImportVault: (subscriptions: Subscription[], settings: VaultSettings) => void;
  readonly onSeedDemoData: () => void;
  readonly onClearAllData: () => void;
}

export const VaultSettingsView: React.FC<VaultSettingsViewProps> = ({
  subscriptions,
  settings,
  onUpdateSettings,
  onImportVault,
  onSeedDemoData,
  onClearAllData,
}) => {
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const handleCurrencySelect = (code: CurrencyCode) => {
    if (code === settings.baseCurrency) return;
    // Scale monthly ceiling cleanly into the newly selected base currency
    const oldRate = settings.exchangeRatesPerUsd[settings.baseCurrency];
    const newRate = settings.exchangeRatesPerUsd[code];
    const convertedCeiling =
      oldRate > 0 && newRate > 0
        ? Math.max(1000, Math.round((settings.monthlyCeilingMinorUnits * newRate) / oldRate))
        : CURRENCIES[code].defaultMonthlyCeilingMinorUnits;

    onUpdateSettings({
      ...settings,
      baseCurrency: code,
      monthlyCeilingMinorUnits: convertedCeiling,
    });
  };

  const handleRateChange = (code: CurrencyCode, rawValue: string) => {
    if (code === 'USD') return;
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onUpdateSettings({
      ...settings,
      exchangeRatesPerUsd: {
        ...settings.exchangeRatesPerUsd,
        [code]: parsed,
      },
    });
  };

  const handleResetRates = () => {
    const defaults = createDefaultSettings();
    onUpdateSettings({
      ...settings,
      exchangeRatesPerUsd: defaults.exchangeRatesPerUsd,
    });
  };

  const handleCopyBackup = async () => {
    const json = exportVaultBackup(subscriptions, settings);
    try {
      await navigator.clipboard.writeText(json);
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2400);
    } catch {
      setImportText(json);
      setImportFeedback({
        type: 'success',
        message: 'Clipboard unavailable in this browser; backup JSON placed in the editor below.',
      });
    }
  };

  const handleDownloadBackup = () => {
    const json = exportVaultBackup(subscriptions, settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vaultflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseVaultBackup(importText);
    if (!result.ok) {
      setImportFeedback({ type: 'error', message: result.error });
      return;
    }
    onImportVault([...result.data.subscriptions], result.data.settings);
    setImportFeedback({
      type: 'success',
      message: `Restored ${result.data.subscriptions.length} subscriptions and vault preferences.`,
    });
    setImportText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setImportText(content);
      setImportFeedback(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifStatus('Browser notifications are not supported in this environment.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(
        permission === 'granted'
          ? 'Browser renewal reminders enabled.'
          : 'Notification permission was not granted; in-app renewal badges remain active.',
      );
    } catch {
      setNotifStatus('Notification request unavailable in this embedded preview.');
    }
  };

  return (
    <div className="space-y-6" data-testid="vault-settings-view">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F8FAFC]">
          Vault &amp; Preferences
        </h1>
        <p className="mt-1 text-sm text-[#94A3B8]">
          100% local on-device storage · Multi-currency offline rates · Full JSON portability
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Base Display Currency & Offline Exchange Rates */}
        <section className="rounded-2xl bg-[#111623] border border-[#232D42] p-5 space-y-5">
          <div>
            <h2 className="text-base font-bold text-[#F8FAFC]">Base Display Currency</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Normalizes all subscriptions in the Burn Dial and Runway Ceiling while keeping original billed currencies visible.
            </p>
          </div>

          <div
            className="grid grid-cols-5 gap-2"
            role="radiogroup"
            aria-label="Select base display currency"
          >
            {CURRENCY_CODES.map((code) => {
              const selected = settings.baseCurrency === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleCurrencySelect(code)}
                  className={`min-h-[44px] rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#6366F1] border-[#6366F1] text-white'
                      : 'bg-[#1A2234] border-[#232D42] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#232D42]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#94A3B8]">
                Offline Exchange Rates (per 1 USD)
              </h3>
              <button
                type="button"
                onClick={handleResetRates}
                className="text-xs font-semibold text-[#6366F1] hover:text-[#818CF8] cursor-pointer"
              >
                Reset defaults
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CURRENCY_CODES.filter((c) => c !== 'USD').map((code) => (
                <div key={code}>
                  <label
                    htmlFor={`rate-${code}`}
                    className="block text-xs text-[#94A3B8] mb-1"
                  >
                    {code} ({CURRENCIES[code].name})
                  </label>
                  <input
                    id={`rate-${code}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    defaultValue={settings.exchangeRatesPerUsd[code]}
                    key={`${code}-${settings.exchangeRatesPerUsd[code]}`}
                    onBlur={(e) => handleRateChange(code, e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#1A2234] border border-[#232D42] font-mono tabular-nums text-sm text-[#F8FAFC] focus:outline-none focus:border-[#6366F1]"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Renewal Alerts & Local Data Controls */}
        <div className="space-y-6">
          {/* Alert Preferences */}
          <section className="rounded-2xl bg-[#111623] border border-[#232D42] p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[#6366F1]" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC]">Renewal &amp; Trial Alerts</h2>
                  <p className="text-xs text-[#94A3B8]">
                    Highlight upcoming bills and Free Trial Guard cutoffs
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.notificationsEnabled}
                aria-label="Toggle renewal alerts"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    notificationsEnabled: !settings.notificationsEnabled,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                  settings.notificationsEnabled ? 'bg-[#6366F1]' : 'bg-[#232D42]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#94A3B8] mb-2">
                Alert Lead Time
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
                        onUpdateSettings({ ...settings, reminderLeadDays: days })
                      }
                      className={`min-h-[38px] rounded-xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                        selected
                          ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#F8FAFC]'
                          : 'bg-[#1A2234] border-[#232D42] text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      {days} {days === 1 ? 'day before' : 'days before'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleRequestBrowserPermission}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-xs font-semibold text-[#F8FAFC] cursor-pointer"
              >
                Enable Browser Alerts
              </button>
              {notifStatus && <p className="text-xs text-[#94A3B8]">{notifStatus}</p>}
            </div>
          </section>

          {/* Local Data Ownership: JSON Backup & Restore */}
          <section className="rounded-2xl bg-[#111623] border border-[#232D42] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
              <div>
                <h2 className="text-base font-bold text-[#F8FAFC]">
                  Local Data Backup &amp; Restore
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Versioned JSON snapshot (schema v1) · {subscriptions.length} bills stored locally
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyBackup}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-xs font-semibold text-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedBackup ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy JSON Backup</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-xs font-semibold text-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download .json</span>
              </button>

              <label className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-xs font-semibold text-[#F8FAFC] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Load File</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-2.5">
              <label htmlFor="backup-json-input" className="block text-xs font-semibold text-[#94A3B8]">
                Paste Backup JSON to Restore
              </label>
              <textarea
                id="backup-json-input"
                rows={4}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (importFeedback) setImportFeedback(null);
                }}
                placeholder='{"schemaVersion": 1, "subscriptions": [...]}'
                className="w-full p-3 rounded-xl bg-[#0B101B] border border-[#232D42] font-mono text-xs text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-[#6366F1]"
              />

              {importFeedback && (
                <p
                  role={importFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`text-xs font-medium ${
                    importFeedback.type === 'error' ? 'text-[#FCA5A5]' : 'text-[#10B981]'
                  }`}
                >
                  {importFeedback.message}
                </p>
              )}

              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5558E6] text-xs font-semibold text-white cursor-pointer"
              >
                Validate &amp; Restore Backup
              </button>
            </form>

            {/* Sample Data & Reset Vault */}
            <div className="pt-4 border-t border-[#232D42] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSeedDemoData}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-xs font-semibold text-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Load Demo Data</span>
              </button>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/35 hover:border-[#EF4444] text-xs font-semibold text-[#FCA5A5] flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear Vault</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#FCA5A5]">Remove all bills?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllData();
                      setConfirmClear(false);
                    }}
                    className="min-h-[34px] px-3 rounded-lg bg-[#EF4444] text-xs font-semibold text-white cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[34px] px-3 rounded-lg bg-[#1A2234] text-xs font-semibold text-[#F8FAFC] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
