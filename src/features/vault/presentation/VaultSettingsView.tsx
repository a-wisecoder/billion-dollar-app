import React, { useState } from 'react';
import {
  Bell,
  Check,
  Copy,
  Database,
  Download,
  Gamepad2,
  RotateCcw,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  exportSubscriptionsJson,
  exportVaultBackup,
  parseVaultBackup,
} from '../../../core/utils/backupService';
import {
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
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
  readonly onLaunchArcade: () => void;
}

export const VaultSettingsView: React.FC<VaultSettingsViewProps> = ({
  subscriptions,
  settings,
  onUpdateSettings,
  onImportVault,
  onSeedDemoData,
  onClearAllData,
  onLaunchArcade,
}) => {
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [downloadedSubs, setDownloadedSubs] = useState(false);
  const [incomeInput, setIncomeInput] = useState(() =>
    minorUnitsToInputString(
      settings.monthlyIncomeMinorUnits ??
        CURRENCIES[settings.baseCurrency].defaultMonthlyIncomeMinorUnits,
    ),
  );
  const [incomeSaved, setIncomeSaved] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const handleCurrencySelect = (code: CurrencyCode) => {
    if (code === settings.baseCurrency) return;
    const oldRate = settings.exchangeRatesPerUsd[settings.baseCurrency];
    const newRate = settings.exchangeRatesPerUsd[code];
    const convertedCeiling =
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

    setIncomeInput(minorUnitsToInputString(convertedIncome));
    onUpdateSettings({
      ...settings,
      baseCurrency: code,
      monthlyCeilingMinorUnits: convertedCeiling,
      monthlyIncomeMinorUnits: convertedIncome,
    });
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
      window.setTimeout(() => setCopiedBackup(false), 2400);
    } catch {
      setImportText(json);
      setImportFeedback({
        type: 'success',
        message: 'Clipboard unavailable in this browser; backup JSON placed in the editor below.',
      });
    }
  };

  const triggerJsonDownload = (jsonContent: string, filename: string) => {
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
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

  const handleDownloadSubscriptionsJson = () => {
    const json = exportSubscriptionsJson(subscriptions);
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(json, `vaultflow-subscriptions-${dateStamp}.json`);
    setDownloadedSubs(true);
    window.setTimeout(() => setDownloadedSubs(false), 2400);
  };

  const handleDownloadBackup = () => {
    const json = exportVaultBackup(subscriptions, settings);
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(json, `vaultflow-backup-${dateStamp}.json`);
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
          : 'Notification permission was not granted; in-app renewal highlights remain active.',
      );
    } catch {
      setNotifStatus('Notification request unavailable in this embedded preview.');
    }
  };

  return (
    <div className="space-y-6" data-testid="vault-settings-view">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#17211E]">
          Vault &amp; Preferences
        </h1>
        <p className="mt-1 text-sm text-[#5B6662]">
          100% local on-device storage · Take-home income ratio · Full JSON portability
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Currency, Take-Home Income & Offline Rates */}
        <div className="space-y-6">
          <section className="rounded-2xl vault-surface p-5 space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#17211E]">Base Display Currency</h2>
              <p className="mt-1 text-xs text-[#5B6662]">
                Normalizes totals across Overview, Audit, and Timeline while preserving original billed currencies.
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
                    className={`min-h-[42px] rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#1E6B58] border-[#1E6B58] text-white'
                        : 'bg-[#F5F6F3] border-[#E4E7E1] text-[#5B6662] hover:text-[#17211E]'
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>

            {/* Take-Home Monthly Income */}
            <form
              onSubmit={handleSaveIncome}
              className="pt-4 border-t border-[#EEF1EC] space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#1E6B58]" aria-hidden="true" />
                <label
                  htmlFor="monthly-income-input"
                  className="text-xs font-bold text-[#17211E]"
                >
                  Monthly Take-Home Income ({settings.baseCurrency})
                </label>
              </div>
              <p className="text-xs text-[#5B6662]">
                Used locally to display what percentage of your net income goes to recurring bills.
              </p>
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
                  className="flex-1 h-10 px-3 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] font-mono tabular-nums text-sm text-[#17211E] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-xl bg-[#1E6B58] hover:bg-[#175747] text-xs font-semibold text-white cursor-pointer transition-colors"
                >
                  {incomeSaved ? 'Saved' : 'Update'}
                </button>
              </div>
            </form>

            {/* Offline Exchange Rates */}
            <div className="pt-4 border-t border-[#EEF1EC]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#5B6662]">
                  Offline Exchange Rates (per 1 USD)
                </h3>
                <button
                  type="button"
                  onClick={handleResetRates}
                  className="text-xs font-semibold text-[#1E6B58] hover:text-[#155243] cursor-pointer"
                >
                  Reset defaults
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {CURRENCY_CODES.filter((c) => c !== 'USD').map((code) => (
                  <div key={code}>
                    <label
                      htmlFor={`rate-${code}`}
                      className="block text-xs text-[#5B6662] mb-1"
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
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] font-mono tabular-nums text-sm text-[#17211E] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Vault Sentinel Arcade Bonus Launch Card */}
          <section className="rounded-2xl vault-surface p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E6F2EE] flex items-center justify-center shrink-0">
                <Gamepad2 className="w-5 h-5 text-[#1E6B58]" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#17211E]">Vault Sentinel Mini-Game</h2>
                <p className="text-xs text-[#5B6662]">
                  Defend your vault core from rogue renewal charges in a 60fps arcade break.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLaunchArcade}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Play
            </button>
          </section>
        </div>

        {/* Right Column: Alerts + Local Data Ownership */}
        <div className="space-y-6">
          <section className="rounded-2xl vault-surface p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[#1E6B58]" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-bold text-[#17211E]">Renewal &amp; Trial Alerts</h2>
                  <p className="text-xs text-[#5B6662]">
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
                  settings.notificationsEnabled ? 'bg-[#1E6B58]' : 'bg-[#D5DBD2]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                    settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#5B6662] mb-2">
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
                          ? 'bg-[#E6F2EE] border-[#1E6B58] text-[#155243]'
                          : 'bg-[#F5F6F3] border-[#E4E7E1] text-[#5B6662] hover:text-[#17211E]'
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
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] cursor-pointer"
              >
                Enable Browser Alerts
              </button>
              {notifStatus && <p className="text-xs text-[#5B6662]">{notifStatus}</p>}
            </div>
          </section>

          {/* Local Data Ownership: JSON Export, Backup & Restore */}
          <section className="rounded-2xl vault-surface p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-[#1E6B58]" aria-hidden="true" />
              <div>
                <h2 className="text-base font-bold text-[#17211E]">
                  Local Data Export &amp; Backup
                </h2>
                <p className="text-xs text-[#5B6662]">
                  Versioned JSON snapshot (schema v1) · {subscriptions.length} bills stored locally
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                data-testid="download-subscriptions-json"
                onClick={handleDownloadSubscriptionsJson}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1E6B58] hover:bg-[#175747] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6B58]"
              >
                {downloadedSubs ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Downloaded Subscriptions JSON</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>
                      Download Subscriptions JSON ({subscriptions.length})
                    </span>
                  </>
                )}
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyBackup}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedBackup ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#1E7E5F]" aria-hidden="true" />
                      <span>Copied JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
                      <span>Copy Full Backup</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
                  <span>Full Vault Backup</span>
                </button>

                <label className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
                  <span>Load File</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-2.5">
              <label htmlFor="backup-json-input" className="block text-xs font-semibold text-[#5B6662]">
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
                className="w-full p-3 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] font-mono text-xs text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
              />

              {importFeedback && (
                <p
                  role={importFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`text-xs font-semibold ${
                    importFeedback.type === 'error' ? 'text-[#A63535]' : 'text-[#1E7E5F]'
                  }`}
                >
                  {importFeedback.message}
                </p>
              )}

              <button
                type="submit"
                className="min-h-[38px] px-4 py-2 rounded-xl bg-[#17211E] hover:bg-[#2A3733] text-xs font-semibold text-white cursor-pointer transition-colors"
              >
                Validate &amp; Restore Backup
              </button>
            </form>

            <div className="pt-4 border-t border-[#EEF1EC] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSeedDemoData}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
                <span>Load Demo Data</span>
              </button>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#FCEEEE] border border-[#EBCACA] hover:border-[#C64545] text-xs font-semibold text-[#A63535] flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear Vault</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#A63535]">Remove all bills?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllData();
                      setConfirmClear(false);
                    }}
                    className="min-h-[32px] px-3 rounded-lg bg-[#C64545] text-xs font-semibold text-white cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[32px] px-3 rounded-lg bg-[#F5F6F3] border border-[#E4E7E1] text-xs font-semibold text-[#17211E] cursor-pointer"
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
