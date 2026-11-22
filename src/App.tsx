import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Home,
  Info,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { trackEvent } from './core/analytics/analytics';
import { useDialogA11y } from './core/hooks/useDialogA11y';
import { Button } from './core/ui/primitives';
import {
  applyThemeToDocument,
  loadThemeMode,
  saveThemeMode,
  type ThemeMode,
} from './core/theme/themeService';
import {
  formatTabHash,
  parseTabFromLocation,
  type AppTabId,
} from './core/utils/appTabHash';
import { advanceOverdueBillingDate, getTodayIso } from './core/utils/dateMath';
import {
  loadCachedExchangeRates,
  syncExchangeRates,
} from './core/utils/exchangeRates';
import { computeLeakAudit } from './features/audit/domain/auditEngine';
import type { StatementImportCandidate } from './features/audit/domain/statementImport';
import { CancelKitModal } from './features/audit/presentation/CancelKitModal';

const AuditAndImportView = lazy(() =>
  import('./features/audit/presentation/AuditAndImportView').then((m) => ({
    default: m.AuditAndImportView,
  })),
);
import { getLicenseProvider } from './features/billing/data/licenseProvider';
import {
  clearLicenseRecord,
  loadLicenseRecord,
  saveLicenseRecord,
} from './features/billing/data/licenseStorage';
import {
  can,
  evaluateLicense,
  getReadOnlySubscriptionIds,
  type EntitlementsState,
  type LicenseRecord,
} from './features/billing/domain/entitlements';
import { UpgradeSheet } from './features/billing/presentation/UpgradeSheet';
import {
  loadVaultState,
  saveSettings,
  saveSubscriptions,
} from './features/cashflow/data/localStorageRepository';
import { computeCashflowSummary } from './features/cashflow/domain/cashflowEngine';
import { createSeedSubscriptions } from './features/cashflow/domain/presets';
import {
  CURRENCIES,
  type CurrencyCode,
  type Subscription,
  type SubscriptionCategory,
  type UsageFrequency,
  type VaultSettings,
} from './features/cashflow/domain/subscription';
import { RadarDashboardView } from './features/cashflow/presentation/RadarDashboardView';
import { RunwayCeilingModal } from './features/cashflow/presentation/RunwayCeilingModal';
import {
  SubscriptionEditorModal,
  type SubscriptionPrefillDraft,
} from './features/cashflow/presentation/SubscriptionEditorModal';
import { getCatalogEntryById } from './features/catalog/domain/serviceCatalog';
import { OnboardingFlow } from './features/onboarding/presentation/OnboardingFlow';
import { usePwaInstall } from './features/pwa/usePwaInstall';
import { usePwaUpdate } from './features/pwa/usePwaUpdate';
import { buildIcs, slugifyIcsFilename } from './features/reminders/domain/icsExport';
import {
  getComingUpReminders,
  markNotifiedForDate,
  selectUnnotifiedReminders,
} from './features/reminders/domain/reminderEngine';
import { TimelineView } from './features/timeline/presentation/TimelineView';
import { VaultSettingsView } from './features/vault/presentation/VaultSettingsView';

type TabId = AppTabId;

type UndoToastState =
  | { readonly kind: 'delete'; readonly sub: Subscription }
  | {
      readonly kind: 'replace';
      readonly message: string;
      readonly previousSubscriptions: Subscription[];
      readonly previousSettings: VaultSettings;
    };

type PendingDemoAction =
  | { readonly kind: 'add' }
  | { readonly kind: 'edit'; readonly id: string }
  | { readonly kind: 'import'; readonly candidates: readonly StatementImportCandidate[] };

type PendingUpgradeAction =
  | { readonly kind: 'save-subscription'; readonly subscription: Subscription }
  | { readonly kind: 'onboarding-subscription'; readonly subscription: Subscription }
  | { readonly kind: 'import-candidates'; readonly candidates: readonly StatementImportCandidate[] }
  | { readonly kind: 'restore-archived'; readonly id: string };

const NAV_TABS: readonly {
  readonly id: TabId;
  readonly label: string;
  readonly Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'insights', label: 'Insights', Icon: Sparkles },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

function getInitialTab(): TabId {
  if (typeof window === 'undefined') return 'home';
  return parseTabFromLocation(window.location.hash, window.location.search);
}

export const App: React.FC = () => {
  const initial = useMemo(() => loadVaultState(), []);
  const initialTab = useMemo(() => getInitialTab(), []);

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [bypassOnboardingForDeepLink] = useState<boolean>(() => initialTab !== 'home');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());

  const selectTab = useCallback((nextTab: TabId) => {
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      const targetHash = formatTabHash(nextTab);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      setActiveTab(parseTabFromLocation(window.location.hash, window.location.search));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initial.subscriptions);
  const [settings, setSettings] = useState<VaultSettings>(initial.settings);
  const [todayIso, setTodayIso] = useState<string>(() => getTodayIso());

  const initialRatesCache = useMemo(() => loadCachedExchangeRates(), []);
  const [ratesFetchedAt, setRatesFetchedAt] = useState<string | null>(
    initialRatesCache?.fetchedAt ?? null,
  );
  const [ratesSource, setRatesSource] = useState<'live' | 'cache' | 'default'>(
    initialRatesCache ? 'cache' : 'default',
  );
  const [refreshingRates, setRefreshingRates] = useState(false);

  const pwaInstall = usePwaInstall();
  const pwaUpdate = usePwaUpdate();

  const [selectedCategory, setSelectedCategory] = useState<SubscriptionCategory | null>(null);
  const [showAnnual, setShowAnnual] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [prefillDraft, setPrefillDraft] = useState<SubscriptionPrefillDraft | null>(null);
  const [ceilingModalOpen, setCeilingModalOpen] = useState(false);
  const [cancelKitSubId, setCancelKitSubId] = useState<string | null>(null);

  const [confirmClearDemoBanner, setConfirmClearDemoBanner] = useState(false);
  const [pendingDemoAction, setPendingDemoAction] = useState<PendingDemoAction | null>(null);

  const [licenseRecord, setLicenseRecord] = useState<LicenseRecord | null>(() =>
    loadLicenseRecord(),
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  const [licenseClockMs, setLicenseClockMs] = useState<number>(() => Date.now());
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [upgradeInitialShowKey, setUpgradeInitialShowKey] = useState(false);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | null>(null);
  const [pendingUpgradeAction, setPendingUpgradeAction] = useState<PendingUpgradeAction | null>(
    null,
  );
  const [externalOnboardingSub, setExternalOnboardingSub] = useState<Subscription | null>(null);
  const [postUpgradeImportNotice, setPostUpgradeImportNotice] = useState<{
    readonly id: number;
    readonly message: string;
  } | null>(null);
  const revalidatingLicenseRef = useRef(false);

  const [storageWarning, setStorageWarning] = useState<'blocked' | 'quota' | null>(() =>
    initial.storageAvailable ? null : 'blocked',
  );
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false);

  const demoDialogRef = useRef<HTMLDivElement | null>(null);
  const handleCloseDemoPrompt = useCallback(() => {
    setPendingDemoAction(null);
  }, []);
  useDialogA11y({
    isOpen: Boolean(pendingDemoAction),
    containerRef: demoDialogRef,
    onClose: handleCloseDemoPrompt,
  });

  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const res = saveSubscriptions(subscriptions);
    if (!res.ok && res.reason) {
      setStorageWarning(res.reason);
      setStorageWarningDismissed(false);
    }
  }, [subscriptions]);

  useEffect(() => {
    const res = saveSettings(settings);
    if (!res.ok && res.reason) {
      setStorageWarning(res.reason);
      setStorageWarningDismissed(false);
    }
  }, [settings]);

  useEffect(() => {
    saveThemeMode(themeMode);
    applyThemeToDocument(themeMode);

    if (themeMode !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyThemeToDocument('system');
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [themeMode]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  // Live exchange rate sync (at most once every 24h when online; preserves custom overrides)
  const runRateSync = useCallback(async (forceRefresh = false) => {
    setRefreshingRates(true);
    try {
      const resolution = await syncExchangeRates({ forceRefresh });
      setRatesFetchedAt(resolution.fetchedAt);
      setRatesSource(resolution.source);
      setSettings((prev) => ({
        ...prev,
        exchangeRatesPerUsd: resolution.rates,
      }));
    } finally {
      setRefreshingRates(false);
    }
  }, []);

  useEffect(() => {
    void runRateSync(false);
    const onOnline = () => {
      void runRateSync(false);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [runRateSync]);

  // Refresh todayIso and license clock periodically, on visibility change, and on network change
  useEffect(() => {
    const tick = () => {
      const latest = getTodayIso();
      setTodayIso((prev) => (prev === latest ? prev : latest));
      setLicenseClockMs(Date.now());
    };
    const handleOnline = () => {
      setIsOnline(true);
      setLicenseClockMs(Date.now());
    };
    const handleOffline = () => {
      setIsOnline(false);
      setLicenseClockMs(Date.now());
    };
    const intervalId = window.setInterval(tick, 60 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const licenseEvaluation = useMemo(
    () => evaluateLicense(licenseRecord, licenseClockMs, isOnline),
    [licenseRecord, licenseClockMs, isOnline],
  );

  const activeSubscriptionCount = useMemo(
    () => subscriptions.filter((s) => !s.isArchived).length,
    [subscriptions],
  );

  const entitlements: EntitlementsState = useMemo(
    () => ({
      plan: licenseEvaluation.plan,
      activeSubscriptionCount,
      isDemo: Boolean(settings.isDemo),
    }),
    [licenseEvaluation.plan, activeSubscriptionCount, settings.isDemo],
  );

  const readOnlyIds = useMemo(
    () => getReadOnlySubscriptionIds(subscriptions, entitlements),
    [subscriptions, entitlements],
  );

  // Silent startup/online re-validation when lastValidatedAt is older than 7 days
  useEffect(() => {
    if (!licenseRecord || !licenseEvaluation.needsRevalidation || !isOnline) return;
    if (revalidatingLicenseRef.current) return;

    let cancelled = false;
    revalidatingLicenseRef.current = true;

    void getLicenseProvider()
      .then((provider) => provider.validate(licenseRecord.key, licenseRecord.activationId))
      .then((result) => {
        if (cancelled) return;
        if (result.valid) {
          const refreshed: LicenseRecord = {
            ...licenseRecord,
            expiresAt: result.expiresAt,
            lastValidatedAt: new Date().toISOString(),
          };
          saveLicenseRecord(refreshed);
          setLicenseRecord(refreshed);
          setLicenseClockMs(Date.now());
        } else if (!result.requiresActivation) {
          // Revoked or expired remotely: drop to Free without deleting any user data
          clearLicenseRecord();
          setLicenseRecord(null);
        }
      })
      .catch(() => {
        // Keep stored record so 14-day offline grace continues undisturbed
      })
      .finally(() => {
        revalidatingLicenseRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [licenseRecord, licenseEvaluation.needsRevalidation, isOnline]);

  // Apply custom rates and card markup only while Pro is active (without deleting saved preferences)
  const effectiveSettings = useMemo<VaultSettings>(() => {
    if (can('customRatesAndMarkup', entitlements)) {
      return settings;
    }
    return {
      ...settings,
      customExchangeRates: {},
      cardMarkupPercent: 0,
    };
  }, [settings, entitlements]);

  const summary = useMemo(
    () =>
      computeCashflowSummary(subscriptions, effectiveSettings, {
        selectedCategory,
        showAnnual,
        searchQuery: '',
        todayIso,
      }),
    [subscriptions, effectiveSettings, selectedCategory, showAnnual, todayIso],
  );

  const audit = useMemo(
    () => computeLeakAudit(subscriptions, effectiveSettings, todayIso),
    [subscriptions, effectiveSettings, todayIso],
  );

  const comingUpReminders = useMemo(
    () => getComingUpReminders(subscriptions, effectiveSettings, todayIso),
    [subscriptions, effectiveSettings, todayIso],
  );

  // Fire at most one browser notification per subscription per day while the app is open
  useEffect(() => {
    if (!settings.notificationsEnabled || comingUpReminders.length === 0) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const unnotified = selectUnnotifiedReminders(comingUpReminders, todayIso);
    if (unnotified.length === 0) return;

    const shownIds: string[] = [];
    for (const item of unnotified) {
      try {
        new Notification(item.title, {
          body: item.body,
          icon: '/icons/icon-192.png',
        });
        shownIds.push(item.subscription.id);
      } catch {
        // Ignore restricted notification environments
      }
    }
    if (shownIds.length > 0) {
      markNotifiedForDate(shownIds, todayIso);
    }
  }, [settings.notificationsEnabled, comingUpReminders, todayIso]);

  useEffect(() => {
    if (
      selectedCategory &&
      !subscriptions.some((s) => !s.isArchived && s.category === selectedCategory)
    ) {
      setSelectedCategory(null);
    }
  }, [subscriptions, selectedCategory]);

  const editingSubscription = useMemo(
    () => (editingId ? (subscriptions.find((s) => s.id === editingId) ?? null) : null),
    [editingId, subscriptions],
  );

  const cancelKitSubscription = useMemo(
    () =>
      cancelKitSubId ? (subscriptions.find((s) => s.id === cancelKitSubId) ?? null) : null,
    [cancelKitSubId, subscriptions],
  );

  const showUndoToast = (toast: UndoToastState) => {
    setUndoToast(toast);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast(null);
      undoTimerRef.current = null;
    }, 6000);
  };

  const openUpgradeSheet = useCallback(
    (options?: {
      readonly showKeyInput?: boolean;
      readonly contextMessage?: string | null;
      readonly pendingAction?: PendingUpgradeAction | null;
    }) => {
      setUpgradeInitialShowKey(Boolean(options?.showKeyInput));
      setUpgradeContextMessage(options?.contextMessage ?? null);
      if (options && 'pendingAction' in options) {
        setPendingUpgradeAction(options.pendingAction ?? null);
      } else {
        setPendingUpgradeAction(null);
      }
      setUpgradeSheetOpen(true);
      trackEvent('paywall_viewed');
    },
    [],
  );

  const openAddModalDirectly = () => {
    setEditingId(null);
    setPrefillDraft(null);
    setEditorOpen(true);
  };

  const openEditModalDirectly = (id: string) => {
    setEditingId(id);
    setPrefillDraft(null);
    setEditorOpen(true);
  };

  const openAddModal = () => {
    if (settings.isDemo) {
      setPendingDemoAction({ kind: 'add' });
      return;
    }
    openAddModalDirectly();
  };

  const openEditModal = (id: string) => {
    if (settings.isDemo) {
      setPendingDemoAction({ kind: 'edit', id });
      return;
    }
    if (readOnlyIds.has(id)) {
      openUpgradeSheet({
        contextMessage: 'Free keeps your first 8 active subscriptions editable. Upgrade to edit all.',
      });
      return;
    }
    openEditModalDirectly(id);
  };

  const markCalendarDirtyIfExported = useCallback(() => {
    setSettings((prev) =>
      prev.calendarExportedAt && !prev.calendarExportDirty
        ? { ...prev, calendarExportDirty: true }
        : prev,
    );
  }, []);

  const triggerIcsDownload = useCallback((icsContent: string, filename: string) => {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const handleExportAllCalendar = useCallback(() => {
    const ics = buildIcs(subscriptions, settings, new Date().toISOString());
    triggerIcsDownload(ics, 'subscription-renewals.ics');
    trackEvent('calendar_exported');
    setSettings((prev) => ({
      ...prev,
      calendarExportedAt: new Date().toISOString(),
      calendarExportDirty: false,
    }));
  }, [subscriptions, settings, triggerIcsDownload]);

  const handleExportSingleCalendar = useCallback(
    (subId: string) => {
      const target = subscriptions.find((s) => s.id === subId);
      if (!target) return;
      const ics = buildIcs([target], settings, new Date().toISOString());
      triggerIcsDownload(ics, slugifyIcsFilename(target.name));
      trackEvent('calendar_exported');
    },
    [subscriptions, settings, triggerIcsDownload],
  );

  const commitSubscriptionSave = (saved: Subscription) => {
    const isNew = !subscriptions.some((item) => item.id === saved.id);
    setSubscriptions((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      if (exists) {
        return prev.map((item) => (item.id === saved.id ? saved : item));
      }
      return [...prev, saved];
    });
    if (isNew) {
      trackEvent('subscription_added');
    }
    markCalendarDirtyIfExported();
  };

  const handleSaveSubscription = (saved: Subscription) => {
    const exists = subscriptions.some((item) => item.id === saved.id);
    if (!exists && !saved.isArchived && !can('addSubscription', entitlements)) {
      openUpgradeSheet({
        contextMessage: `Free includes up to 8 active subscriptions. Upgrade to save ${saved.name}.`,
        pendingAction: { kind: 'save-subscription', subscription: saved },
      });
      return;
    }
    commitSubscriptionSave(saved);
  };

  const handleToggleSimulate = useCallback((id: string) => {
    setSubscriptions((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isSimulatedPaused: !item.isSimulatedPaused }
          : item,
      ),
    );
  }, []);

  const handleUpdateUsageFrequency = (id: string, usageFrequency: UsageFrequency) => {
    setSubscriptions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, usageFrequency } : item)),
    );
  };

  const handleArchiveSubscription = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isSimulatedPaused: false, isArchived: true } : item,
      ),
    );
    markCalendarDirtyIfExported();
  };

  const handleExpiredTrialPaid = (id: string) => {
    const currentToday = getTodayIso();
    setSubscriptions((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextBillingDate = advanceOverdueBillingDate(
          item.nextBillingDate,
          item.cycle,
          currentToday,
          item.billingDay,
        );
        return {
          ...item,
          isFreeTrial: false,
          nextBillingDate,
        };
      }),
    );
    markCalendarDirtyIfExported();
  };

  const commitStatementImport = (
    candidates: readonly StatementImportCandidate[],
    clearExisting: boolean,
  ) => {
    setSubscriptions((prev) => {
      const next = clearExisting ? [] : [...prev];
      const nowStamp = Date.now();
      candidates.forEach((cand, idx) => {
        const catalogEntry = cand.catalogId ? getCatalogEntryById(cand.catalogId) : undefined;
        if (!clearExisting && cand.matchedExistingId) {
          const matchIdx = next.findIndex((s) => s.id === cand.matchedExistingId);
          if (matchIdx >= 0) {
            const existing = next[matchIdx];
            next[matchIdx] = {
              ...existing,
              name: cand.name,
              ...(cand.catalogId ? { catalogId: cand.catalogId } : {}),
              previousAmountMinorUnits:
                cand.amountMinorUnits > existing.amountMinorUnits
                  ? existing.amountMinorUnits
                  : (cand.previousAmountMinorUnits ?? existing.previousAmountMinorUnits),
              amountMinorUnits: cand.amountMinorUnits,
              cycle: cand.cycle,
              nextBillingDate: cand.nextBillingDate,
              billingDay: cand.billingDay,
              ...(existing.startDate ? {} : { startDate: cand.startDate }),
              ...(existing.cancelUrl
                ? {}
                : catalogEntry?.cancelUrl
                  ? { cancelUrl: catalogEntry.cancelUrl }
                  : {}),
              isArchived: false,
            };
            return;
          }
        }
        next.push({
          id: `sub_import_${nowStamp}_${idx}`,
          name: cand.name,
          ...(cand.catalogId ? { catalogId: cand.catalogId } : {}),
          amountMinorUnits: cand.amountMinorUnits,
          ...(cand.previousAmountMinorUnits !== undefined
            ? { previousAmountMinorUnits: cand.previousAmountMinorUnits }
            : {}),
          currency: cand.currency,
          cycle: cand.cycle,
          category: cand.category,
          nextBillingDate: cand.nextBillingDate,
          billingDay: cand.billingDay,
          startDate: cand.startDate,
          isFreeTrial: false,
          isSimulatedPaused: false,
          isArchived: false,
          usageFrequency: 'weekly',
          ...(catalogEntry?.cancelUrl ? { cancelUrl: catalogEntry.cancelUrl } : {}),
          notes: 'Imported from statement',
        });
      });
      return next;
    });
    markCalendarDirtyIfExported();
    if (candidates.length > 0) {
      trackEvent('import_completed');
    }
  };

  const handleImportStatementCandidates = (
    candidates: readonly StatementImportCandidate[],
  ) => {
    if (settings.isDemo) {
      setPendingDemoAction({ kind: 'import', candidates });
      return;
    }
    commitStatementImport(candidates, false);
  };

  const handleAddSingleStatementCandidate = (candidate: StatementImportCandidate): boolean => {
    if (settings.isDemo) {
      setPendingDemoAction({ kind: 'import', candidates: [candidate] });
      return false;
    }
    if (!candidate.matchedExistingId && !can('addSubscription', entitlements)) {
      openUpgradeSheet({
        contextMessage: `Free includes up to 8 active subscriptions. Upgrade to add ${candidate.name}.`,
        pendingAction: { kind: 'import-candidates', candidates: [candidate] },
      });
      return false;
    }
    commitStatementImport([candidate], false);
    return true;
  };

  const handleOpenUpgradeForImport = (
    candidates: readonly StatementImportCandidate[],
    contextMessage?: string,
  ) => {
    openUpgradeSheet({
      contextMessage:
        contextMessage ?? 'Upgrade to Pro to import all detected subscriptions in one click.',
      pendingAction:
        candidates.length > 0 ? { kind: 'import-candidates', candidates } : null,
    });
  };

  const formatImportConfirmation = (
    candidates: readonly StatementImportCandidate[],
    clearExisting: boolean,
  ): string => {
    const updatesCount = clearExisting
      ? 0
      : candidates.filter((c) => Boolean(c.matchedExistingId)).length;
    const addsCount = candidates.length - updatesCount;
    const parts: string[] = [];
    if (addsCount > 0) parts.push(`added ${addsCount}`);
    if (updatesCount > 0) parts.push(`updated ${updatesCount}`);
    return `Done — ${parts.join(' and ')} ${
      candidates.length === 1 ? 'subscription' : 'subscriptions'
    } in Home.`;
  };

  const handleLicenseUnlocked = (record: LicenseRecord) => {
    saveLicenseRecord(record);
    setLicenseRecord(record);
    setLicenseClockMs(Date.now());
    setUpgradeSheetOpen(false);
    setUpgradeContextMessage(null);
    trackEvent('license_activated');

    const pending = pendingUpgradeAction;
    setPendingUpgradeAction(null);
    if (!pending) return;

    if (pending.kind === 'save-subscription') {
      commitSubscriptionSave(pending.subscription);
    } else if (pending.kind === 'onboarding-subscription') {
      setExternalOnboardingSub(pending.subscription);
    } else if (pending.kind === 'import-candidates') {
      handleImportStatementCandidates(pending.candidates);
      if (!settings.isDemo && pending.candidates.length > 0) {
        setPostUpgradeImportNotice({
          id: Date.now(),
          message: formatImportConfirmation(pending.candidates, false),
        });
      }
    } else if (pending.kind === 'restore-archived') {
      setSubscriptions((prev) =>
        prev.map((item) => (item.id === pending.id ? { ...item, isArchived: false } : item)),
      );
      markCalendarDirtyIfExported();
    }
  };

  const handleDeactivateLicense = async () => {
    const current = licenseRecord;
    if (current?.activationId) {
      try {
        const provider = await getLicenseProvider();
        if (provider.deactivate) {
          await provider.deactivate(current.key, current.activationId);
        }
      } catch {
        // Still allow local deactivation even if offline
      }
    }
    clearLicenseRecord();
    setLicenseRecord(null);
    setLicenseClockMs(Date.now());
  };

  const handleResolveDemoPrompt = (removeSampleFirst: boolean) => {
    const action = pendingDemoAction;
    setPendingDemoAction(null);
    setConfirmClearDemoBanner(false);
    setSettings((prev) => ({ ...prev, isDemo: false }));

    if (!action) return;

    if (action.kind === 'add') {
      if (removeSampleFirst) {
        setSubscriptions([]);
        setSelectedCategory(null);
      }
      openAddModalDirectly();
      return;
    }

    if (action.kind === 'edit') {
      if (removeSampleFirst) {
        setSubscriptions([]);
        setSelectedCategory(null);
        openAddModalDirectly();
      } else {
        openEditModalDirectly(action.id);
      }
      return;
    }

    if (action.kind === 'import') {
      if (removeSampleFirst) {
        setSelectedCategory(null);
      }
      commitStatementImport(action.candidates, removeSampleFirst);
      if (action.candidates.length > 0) {
        setPostUpgradeImportNotice({
          id: Date.now(),
          message: formatImportConfirmation(action.candidates, removeSampleFirst),
        });
      }
    }
  };

  const handleClearSampleAndAdd = () => {
    setSubscriptions([]);
    setSelectedCategory(null);
    setSettings((prev) => ({ ...prev, isDemo: false, onboardingDone: true }));
    setConfirmClearDemoBanner(false);
    openAddModalDirectly();
  };

  const applyOnboardingCurrency = (prev: VaultSettings, nextCurrency: CurrencyCode): VaultSettings => {
    if (prev.baseCurrency === nextCurrency) return prev;
    return {
      ...prev,
      baseCurrency: nextCurrency,
      monthlyCeilingMinorUnits: CURRENCIES[nextCurrency].defaultMonthlyCeilingMinorUnits,
      monthlyIncomeMinorUnits: CURRENCIES[nextCurrency].defaultMonthlyIncomeMinorUnits,
    };
  };

  const handleFinishOnboarding = (payload: {
    readonly baseCurrency: CurrencyCode;
    readonly reminderLeadDays: 1 | 2 | 3;
    readonly subscriptions: Subscription[];
    readonly exportedCalendar?: boolean;
  }) => {
    setSettings((prev) => ({
      ...applyOnboardingCurrency(prev, payload.baseCurrency),
      reminderLeadDays: payload.reminderLeadDays,
      isDemo: false,
      onboardingDone: true,
      ...(payload.exportedCalendar
        ? { calendarExportedAt: new Date().toISOString(), calendarExportDirty: false }
        : {}),
    }));
    if (payload.subscriptions.length > 0) {
      setSubscriptions(payload.subscriptions);
      trackEvent('subscription_added');
    }
    if (payload.exportedCalendar) {
      trackEvent('calendar_exported');
    }
    trackEvent('onboarding_completed');
    selectTab('home');
  };

  const handleOnboardingImport = (baseCurrency: CurrencyCode) => {
    setSettings((prev) => ({
      ...applyOnboardingCurrency(prev, baseCurrency),
      isDemo: false,
      onboardingDone: true,
    }));
    trackEvent('onboarding_completed');
    selectTab('insights');
  };

  const handleOnboardingSampleData = (baseCurrency: CurrencyCode) => {
    setSubscriptions(createSeedSubscriptions());
    setSettings((prev) => ({
      ...applyOnboardingCurrency(prev, baseCurrency),
      isDemo: true,
      onboardingDone: true,
    }));
    setSelectedCategory(null);
    trackEvent('onboarding_completed');
    selectTab('home');
  };

  const handleResetSimulations = () => {
    setSubscriptions((prev) =>
      prev.map((item) =>
        item.isSimulatedPaused ? { ...item, isSimulatedPaused: false } : item,
      ),
    );
  };

  const handleCommitSimulations = () => {
    setSubscriptions((prev) =>
      prev.map((item) =>
        item.isSimulatedPaused
          ? { ...item, isSimulatedPaused: false, isArchived: true }
          : item,
      ),
    );
    markCalendarDirtyIfExported();
  };

  const handleRestoreArchived = (id: string) => {
    if (!can('addSubscription', entitlements)) {
      const target = subscriptions.find((item) => item.id === id);
      openUpgradeSheet({
        contextMessage: `Free includes up to 8 active subscriptions. Upgrade to restore ${
          target?.name ?? 'this subscription'
        }.`,
        pendingAction: { kind: 'restore-archived', id },
      });
      return;
    }
    setSubscriptions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isArchived: false } : item)),
    );
    markCalendarDirtyIfExported();
  };

  const handleDeleteSubscription = (id: string) => {
    const target = subscriptions.find((item) => item.id === id);
    if (!target) return;

    setSubscriptions((prev) => prev.filter((item) => item.id !== id));
    markCalendarDirtyIfExported();
    showUndoToast({ kind: 'delete', sub: target });
  };

  const handleReplaceWithBackup = (
    nextSubs: Subscription[],
    nextSettings: VaultSettings,
  ) => {
    const previousSubscriptions = [...subscriptions];
    const previousSettings = settings;
    setSubscriptions(nextSubs);
    setSettings(nextSettings);
    setSelectedCategory(null);
    setConfirmClearDemoBanner(false);
    if (previousSubscriptions.length > 0) {
      showUndoToast({
        kind: 'replace',
        message: 'Restored backup',
        previousSubscriptions,
        previousSettings,
      });
    }
  };

  const handleSeedDemoData = () => {
    const previousSubscriptions = [...subscriptions];
    const previousSettings = settings;
    setSubscriptions(createSeedSubscriptions());
    setSettings((prev) => ({ ...prev, isDemo: true, onboardingDone: true }));
    setSelectedCategory(null);
    setConfirmClearDemoBanner(false);
    if (previousSubscriptions.length > 0) {
      showUndoToast({
        kind: 'replace',
        message: 'Loaded sample data',
        previousSubscriptions,
        previousSettings,
      });
    }
  };

  const handleUndo = () => {
    if (!undoToast) return;
    if (undoToast.kind === 'delete') {
      const restored = undoToast.sub;
      setSubscriptions((prev) =>
        prev.some((s) => s.id === restored.id) ? prev : [...prev, restored],
      );
    } else {
      setSubscriptions(undoToast.previousSubscriptions);
      setSettings(undoToast.previousSettings);
      setSelectedCategory(null);
    }
    setUndoToast(null);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const showOnboarding =
    subscriptions.length === 0 && !settings.onboardingDone && !bypassOnboardingForDeepLink;

  return (
    <div className="min-h-screen app-canvas text-text-primary flex flex-col">
      {/* Top Bar: Strict 3-zone Mercury/Linear header (Brand | Navigation | Primary CTA) */}
      <header className="sticky top-0 z-30 bg-page/85 backdrop-blur-xl border-b border-border/80">
        <div className="max-w-6xl mx-auto h-14 md:h-16 px-4 sm:px-6 flex items-center justify-between gap-6">
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              if (!showOnboarding) selectTab('home');
            }}
            className="inline-flex items-center gap-2.5 text-text-primary whitespace-nowrap shrink-0 group"
          >
            <span
              className="w-7 h-7 rounded-[9px] bg-brand text-white flex items-center justify-center shadow-[0_1px_3px_rgba(15,107,84,0.3),inset_0_1px_0_rgba(255,255,255,0.22)] transition-transform duration-150 group-hover:scale-[1.03]"
              aria-hidden="true"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2.5 4.25L8 12.75L13.5 4.25"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="4.25" r="1.4" fill="currentColor" />
              </svg>
            </span>
            <span className="font-display text-[19px] font-bold tracking-[-0.025em]">
              VaultFlow
            </span>
          </a>

          {!showOnboarding && (
            <>
              <nav
                className="hidden md:flex items-center gap-1"
                aria-label="Primary navigation"
              >
                {NAV_TABS.map(({ id, label }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => selectTab(id)}
                      className={`relative px-3.5 py-2 rounded-lg text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        active
                          ? 'text-text-primary'
                          : 'text-text-secondary hover:text-text-primary hover:bg-subtle/60'
                      }`}
                    >
                      {label}
                      {active && (
                        <motion.span
                          layoutId="desktop-nav-indicator"
                          transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }}
                          className="absolute left-3 right-3 -bottom-[14px] h-[2px] rounded-full bg-brand"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="hidden md:flex items-center shrink-0">
                <Button variant="primary" size="md" onClick={openAddModal}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add subscription</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content Canvas (extra bottom padding on mobile so 56px + button & tab bar never cover last row) */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-36 md:pb-14">
        {showOnboarding ? (
          <OnboardingFlow
            settings={effectiveSettings}
            entitlements={entitlements}
            externalAddedSubscription={externalOnboardingSub}
            onConsumedExternalSubscription={() => setExternalOnboardingSub(null)}
            onRequireUpgradeForSubscription={(sub) =>
              openUpgradeSheet({
                contextMessage: `Free includes up to 8 active subscriptions. Upgrade to add ${sub.name}.`,
                pendingAction: { kind: 'onboarding-subscription', subscription: sub },
              })
            }
            onFinish={handleFinishOnboarding}
            onImportStatement={handleOnboardingImport}
            onExploreSampleData={handleOnboardingSampleData}
          />
        ) : (
          <>
        {/* Storage Blocked / Quota Warning Banner */}
        {storageWarning && !storageWarningDismissed && (
          <div
            role="alert"
            data-testid="storage-warning-banner"
            className="mb-5 rounded-2xl bg-amber-soft/90 border border-amber-border px-4 py-3 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[13px] font-medium text-text-primary leading-relaxed">
                {storageWarning === 'quota'
                  ? 'Browser storage is full. Changes stay active for this session — export a JSON backup in Settings so you do not lose edits.'
                  : 'Browser storage is blocked (for example, in Private mode). Changes stay active for this session — export a JSON backup in Settings before closing.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStorageWarningDismissed(true)}
              aria-label="Dismiss storage warning"
              className="min-h-[36px] min-w-[36px] shrink-0 rounded-lg text-text-secondary hover:text-text-primary hover:bg-card/60 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Sample Data Mode Banner (visible on every tab while settings.isDemo is true) */}
        {settings.isDemo && (
          <div
            role="status"
            data-testid="sample-data-banner"
            className="mb-5 rounded-2xl bg-brand-soft/85 border border-brand-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Info className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-text-primary">
                You&apos;re looking at sample data.
              </span>
            </div>

            {!confirmClearDemoBanner ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmClearDemoBanner(true)}
                className="border-brand-border text-brand-text hover:border-brand"
              >
                Clear and add mine
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-text-secondary">
                  Clear sample items and start fresh?
                </span>
                <Button variant="primary" size="sm" onClick={handleClearSampleAndAdd}>
                  Confirm
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmClearDemoBanner(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Quiet Calendar Out-of-Date Banner */}
        {settings.calendarExportDirty && summary.activeItems.length > 0 && (
          <div
            role="status"
            data-testid="calendar-outdated-banner"
            className="mb-5 rounded-2xl app-surface px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CalendarPlus className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
              <span className="text-[13px] font-medium text-text-primary">
                Your calendar is out of date — export again.
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportAllCalendar}
              data-testid="calendar-export-again-button"
              className="text-brand-text"
            >
              Export again
            </Button>
          </div>
        )}

        {activeTab === 'home' && (
          <RadarDashboardView
            summary={summary}
            audit={audit}
            settings={effectiveSettings}
            todayIso={todayIso}
            comingUpReminders={comingUpReminders}
            selectedCategory={selectedCategory}
            showAnnual={showAnnual}
            searchQuery={searchQuery}
            readOnlyIds={readOnlyIds}
            onSelectCategory={setSelectedCategory}
            onToggleAnnual={setShowAnnual}
            onSearchChange={setSearchQuery}
            onToggleSimulate={handleToggleSimulate}
            onUpdateUsage={handleUpdateUsageFrequency}
            onOpenCancelKit={setCancelKitSubId}
            onExportSingleIcs={handleExportSingleCalendar}
            onResetSimulations={handleResetSimulations}
            onCommitSimulations={handleCommitSimulations}
            onRestoreArchived={handleRestoreArchived}
            onAddClick={openAddModal}
            onEditClick={openEditModal}
            onOpenUpgrade={() => openUpgradeSheet()}
            onDeleteClick={handleDeleteSubscription}
            onEditCeilingClick={() => setCeilingModalOpen(true)}
            onOpenAuditTab={() => selectTab('insights')}
            onExpiredTrialCancelled={handleArchiveSubscription}
            onExpiredTrialPaid={handleExpiredTrialPaid}
          />
        )}

        {activeTab === 'calendar' && (
          <TimelineView
            subscriptions={subscriptions}
            settings={effectiveSettings}
            readOnlyIds={readOnlyIds}
            onEditSubscription={openEditModal}
            onOpenUpgrade={() => openUpgradeSheet()}
          />
        )}

        {activeTab === 'insights' && (
          <Suspense
            fallback={
              <div role="status" aria-label="Loading Insights" className="space-y-6">
                <div className="space-y-2">
                  <div className="h-8 w-36 rounded-lg bg-subtle animate-pulse" />
                  <div className="h-4 w-72 max-w-full rounded-md bg-subtle animate-pulse" />
                </div>
                <div className="rounded-2xl app-surface p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="h-16 rounded-xl bg-subtle animate-pulse" />
                    <div className="h-16 rounded-xl bg-subtle animate-pulse" />
                    <div className="h-16 rounded-xl bg-subtle animate-pulse" />
                  </div>
                </div>
                <div className="rounded-2xl app-surface p-6 space-y-3">
                  <div className="h-5 w-44 rounded-md bg-subtle animate-pulse" />
                  <div className="h-28 rounded-xl bg-subtle animate-pulse" />
                </div>
              </div>
            }
          >
            <AuditAndImportView
              subscriptions={subscriptions}
              audit={audit}
              settings={effectiveSettings}
              entitlements={entitlements}
              onOpenCancelKit={setCancelKitSubId}
              onToggleSimulate={handleToggleSimulate}
              onImportCandidates={handleImportStatementCandidates}
              onAddSingleCandidate={handleAddSingleStatementCandidate}
              onOpenUpgradeForImport={handleOpenUpgradeForImport}
              postUpgradeImportNotice={postUpgradeImportNotice}
            />
          </Suspense>
        )}

        {activeTab === 'settings' && (
          <VaultSettingsView
            subscriptions={subscriptions}
            settings={settings}
            entitlements={entitlements}
            licenseRecord={licenseRecord}
            licenseEvaluation={licenseEvaluation}
            themeMode={themeMode}
            ratesFetchedAt={ratesFetchedAt}
            ratesSource={ratesSource}
            refreshingRates={refreshingRates}
            pwaInstall={pwaInstall}
            onChangeThemeMode={setThemeMode}
            onUpdateSettings={setSettings}
            onRefreshRates={() => {
              void runRateSync(true);
            }}
            onExportAllCalendar={handleExportAllCalendar}
            onOpenUpgrade={(opts) => openUpgradeSheet(opts)}
            onDeactivateLicense={handleDeactivateLicense}
            onImportVault={handleReplaceWithBackup}
            onSeedDemoData={handleSeedDemoData}
            onClearAllData={() => {
              setSubscriptions([]);
              setSettings((prev) => ({
                ...prev,
                isDemo: false,
                onboardingDone: true,
                calendarExportDirty: false,
              }));
              setSelectedCategory(null);
            }}
          />
        )}
          </>
        )}
      </main>

      {!showOnboarding && (
        <>
          {/* Mobile Floating Round 56px Brand-Green "+" Button above Tab Bar */}
          <button
            type="button"
            onClick={openAddModal}
            aria-label="Add subscription"
            data-testid="mobile-add-fab"
            className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-brand hover:bg-brand-hover text-white shadow-[0_8px_24px_-4px_rgba(15,107,84,0.45),inset_0_1px_0_rgba(255,255,255,0.24)] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-6 h-6" aria-hidden="true" />
          </button>

          {/* Mobile Pinned Bottom Tab Bar (4 tabs: Home, Calendar, Insights, Settings) */}
          <nav
            aria-label="Mobile navigation"
            className="md:hidden fixed bottom-0 inset-x-0 z-40 w-full min-h-[60px] pb-[env(safe-area-inset-bottom)] bg-card/95 backdrop-blur-xl border-t border-border/90 shadow-[0_-8px_24px_-12px_rgba(15,26,23,0.14)] grid grid-cols-4 items-center px-1"
          >
            {NAV_TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectTab(id)}
                  className={`relative min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
                    active ? 'text-brand-text' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mobile-nav-indicator"
                      transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }}
                      className="absolute top-0 inset-x-5 h-[2px] rounded-full bg-brand"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="w-[19px] h-[19px]" aria-hidden={true} />
                  <span className="text-xs font-semibold tracking-tight">{label}</span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      {/* PWA Update Toast */}
      <AnimatePresence>
        {pwaUpdate.needRefresh && !undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            aria-live="polite"
            data-testid="pwa-update-toast"
            className="fixed bottom-36 md:bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-text-primary text-card px-4 py-2.5 shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)]"
          >
            <span className="text-[13px] font-medium">Update available</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                void pwaUpdate.reloadForUpdate();
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reload</span>
            </Button>
            <button
              type="button"
              onClick={pwaUpdate.dismissUpdate}
              aria-label="Dismiss update notice"
              className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 text-card flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Toast (6s) */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            aria-live="assertive"
            data-testid="undo-toast"
            className="fixed bottom-36 md:bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-text-primary text-card px-4 py-2.5 shadow-2xl flex items-center gap-4 max-w-[calc(100vw-2rem)]"
          >
            <span className="text-[13px] font-medium truncate">
              {undoToast.kind === 'delete'
                ? `Removed ${undoToast.sub.name}`
                : undoToast.message}
            </span>
            <Button variant="primary" size="sm" onClick={handleUndo}>
              <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Undo</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sample Data Once-Only Prompt */}
      <AnimatePresence>
        {pendingDemoAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[3px] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-prompt-title"
            data-testid="demo-mode-prompt"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPendingDemoAction(null);
            }}
          >
            <motion.div
              ref={demoDialogRef}
              tabIndex={-1}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm rounded-2xl app-surface-elevated p-5 space-y-4"
            >
              <div>
                <h2
                  id="demo-prompt-title"
                  className="font-display text-lg font-bold tracking-[-0.015em] text-text-primary"
                >
                  Remove the sample subscriptions first?
                </h2>
                <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed">
                  Clear the sample items or keep them alongside yours.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleResolveDemoPrompt(true)}
                  className="flex-1"
                >
                  Remove
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => handleResolveDemoPrompt(false)}
                  className="flex-1"
                >
                  Keep both
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <SubscriptionEditorModal
        isOpen={editorOpen}
        editingSubscription={editingSubscription}
        prefillDraft={prefillDraft}
        defaultCurrency={settings.baseCurrency}
        onClose={() => {
          setEditorOpen(false);
          setPrefillDraft(null);
        }}
        onSave={handleSaveSubscription}
      />

      <RunwayCeilingModal
        isOpen={ceilingModalOpen}
        currentCeilingMinorUnits={settings.monthlyCeilingMinorUnits}
        activeMonthlyBaseMinorUnits={summary.activeMonthlyBaseMinorUnits}
        baseCurrency={settings.baseCurrency}
        onClose={() => setCeilingModalOpen(false)}
        onSave={(newCeiling) =>
          setSettings((prev) => ({ ...prev, monthlyCeilingMinorUnits: newCeiling }))
        }
      />

      <CancelKitModal
        subscription={cancelKitSubscription}
        onClose={() => setCancelKitSubId(null)}
        onArchiveSubscription={handleArchiveSubscription}
      />

      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        initialShowKeyInput={upgradeInitialShowKey}
        contextMessage={upgradeContextMessage}
        onClose={() => {
          setUpgradeSheetOpen(false);
          setUpgradeContextMessage(null);
          setPendingUpgradeAction(null);
        }}
        onUnlocked={handleLicenseUnlocked}
      />
    </div>
  );
};

export default App;
