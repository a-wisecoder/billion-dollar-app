import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Plus, Radar, ShieldCheck, Undo2 } from 'lucide-react';
import {
  loadVaultState,
  saveSettings,
  saveSubscriptions,
} from './features/cashflow/data/localStorageRepository';
import { computeCashflowSummary } from './features/cashflow/domain/cashflowEngine';
import { createSeedSubscriptions } from './features/cashflow/domain/presets';
import type {
  Subscription,
  SubscriptionCategory,
  VaultSettings,
} from './features/cashflow/domain/subscription';
import { RadarDashboardView } from './features/cashflow/presentation/RadarDashboardView';
import { RunwayCeilingModal } from './features/cashflow/presentation/RunwayCeilingModal';
import { SubscriptionEditorModal } from './features/cashflow/presentation/SubscriptionEditorModal';
import { TimelineView } from './features/timeline/presentation/TimelineView';
import { VaultSettingsView } from './features/vault/presentation/VaultSettingsView';

type TabId = 'radar' | 'timeline' | 'vault';

const NAV_TABS: readonly {
  readonly id: TabId;
  readonly label: string;
  readonly Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}[] = [
  { id: 'radar', label: 'Radar', Icon: Radar },
  { id: 'timeline', label: 'Timeline', Icon: CalendarDays },
  { id: 'vault', label: 'Vault', Icon: ShieldCheck },
];

export const App: React.FC = () => {
  const initial = useMemo(() => loadVaultState(), []);

  const [activeTab, setActiveTab] = useState<TabId>('radar');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initial.subscriptions);
  const [settings, setSettings] = useState<VaultSettings>(initial.settings);

  const [selectedCategory, setSelectedCategory] = useState<SubscriptionCategory | null>(null);
  const [showAnnual, setShowAnnual] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ceilingModalOpen, setCeilingModalOpen] = useState(false);

  const [undoToast, setUndoToast] = useState<{ readonly sub: Subscription } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    saveSubscriptions(subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const summary = useMemo(
    () =>
      computeCashflowSummary(subscriptions, settings, {
        selectedCategory,
        showAnnual,
        searchQuery,
      }),
    [subscriptions, settings, selectedCategory, showAnnual, searchQuery],
  );

  // Clear selected category if all active bills in that category were deleted/archived
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

  const openAddModal = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEditModal = (id: string) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const handleSaveSubscription = (saved: Subscription) => {
    setSubscriptions((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      if (exists) {
        return prev.map((item) => (item.id === saved.id ? saved : item));
      }
      return [...prev, saved];
    });
  };

  const handleToggleSimulate = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isSimulatedPaused: !item.isSimulatedPaused }
          : item,
      ),
    );
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
  };

  const handleRestoreArchived = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isArchived: false } : item)),
    );
  };

  const handleDeleteSubscription = (id: string) => {
    const target = subscriptions.find((item) => item.id === id);
    if (!target) return;

    setSubscriptions((prev) => prev.filter((item) => item.id !== id));
    setUndoToast({ sub: target });
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast(null);
    }, 6000);
  };

  const handleUndoDelete = () => {
    if (!undoToast) return;
    const restored = undoToast.sub;
    setSubscriptions((prev) =>
      prev.some((s) => s.id === restored.id) ? prev : [...prev, restored],
    );
    setUndoToast(null);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#080B12]/90 backdrop-blur-md border-b border-[#232D42]">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#radar"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('radar');
            }}
            className="text-lg font-extrabold tracking-tight text-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            VaultFlow
          </a>

          {/* Zone 2: Clean Single-Line Navigation Links (Desktop) */}
          <nav
            className="hidden md:flex items-center gap-7"
            aria-label="Primary navigation"
          >
            {NAV_TABS.map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveTab(id)}
                  className={`relative py-1 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6366F1] ${
                    active
                      ? 'text-[#F8FAFC]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute left-0 right-0 -bottom-[21px] h-0.5 bg-[#6366F1]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5558E6] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Bill</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
        {activeTab === 'radar' && (
          <RadarDashboardView
            summary={summary}
            settings={settings}
            selectedCategory={selectedCategory}
            showAnnual={showAnnual}
            searchQuery={searchQuery}
            onSelectCategory={setSelectedCategory}
            onToggleAnnual={setShowAnnual}
            onSearchChange={setSearchQuery}
            onToggleSimulate={handleToggleSimulate}
            onResetSimulations={handleResetSimulations}
            onCommitSimulations={handleCommitSimulations}
            onRestoreArchived={handleRestoreArchived}
            onAddClick={openAddModal}
            onEditClick={openEditModal}
            onDeleteClick={handleDeleteSubscription}
            onEditCeilingClick={() => setCeilingModalOpen(true)}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            subscriptions={subscriptions}
            settings={settings}
            onEditSubscription={openEditModal}
          />
        )}

        {activeTab === 'vault' && (
          <VaultSettingsView
            subscriptions={subscriptions}
            settings={settings}
            onUpdateSettings={setSettings}
            onImportVault={(nextSubs, nextSettings) => {
              setSubscriptions(nextSubs);
              setSettings(nextSettings);
              setSelectedCategory(null);
            }}
            onSeedDemoData={() => {
              setSubscriptions(createSeedSubscriptions());
              setSelectedCategory(null);
            }}
            onClearAllData={() => {
              setSubscriptions([]);
              setSelectedCategory(null);
            }}
          />
        )}
      </main>

      {/* Mobile Fixed Thumb-Zone Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#0B101B]/95 backdrop-blur-md border-t border-[#232D42] grid grid-cols-3 items-center px-2"
      >
        {NAV_TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setActiveTab(id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
                active ? 'text-[#6366F1]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden={true} />
              <span className="text-[11px] font-semibold tracking-tight">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Undo Delete Toast */}
      {undoToast && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="undo-toast"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-xl bg-[#1A2234] border border-[#334155] px-4 py-3 shadow-2xl flex items-center gap-4"
        >
          <span className="text-xs font-medium text-[#F8FAFC]">
            Removed {undoToast.sub.name}
          </span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#6366F1] hover:bg-[#5558E6] text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <SubscriptionEditorModal
        isOpen={editorOpen}
        editingSubscription={editingSubscription}
        defaultCurrency={settings.baseCurrency}
        onClose={() => setEditorOpen(false)}
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
    </div>
  );
};

export default App;
