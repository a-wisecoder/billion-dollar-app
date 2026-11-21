import React, { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { addDaysIso, getTodayIso, parseIsoDate } from '../../../core/utils/dateMath';
import {
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
import { SERVICE_PRESETS, type ServicePreset } from '../domain/presets';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LIST,
  CATEGORY_LIST,
  CURRENCY_CODES,
  type BillingCycle,
  type CurrencyCode,
  type Subscription,
  type SubscriptionCategory,
} from '../domain/subscription';

interface SubscriptionEditorModalProps {
  readonly isOpen: boolean;
  readonly editingSubscription: Subscription | null;
  readonly defaultCurrency: CurrencyCode;
  readonly onClose: () => void;
  readonly onSave: (sub: Subscription) => void;
}

export const SubscriptionEditorModal: React.FC<SubscriptionEditorModalProps> = ({
  isOpen,
  editingSubscription,
  defaultCurrency,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [category, setCategory] = useState<SubscriptionCategory>('aiAndCloud');
  const [nextBillingDate, setNextBillingDate] = useState(addDaysIso(getTodayIso(), 7));
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingSubscription) {
      setName(editingSubscription.name);
      setAmountInput(minorUnitsToInputString(editingSubscription.amountMinorUnits));
      setCurrency(editingSubscription.currency);
      setCycle(editingSubscription.cycle);
      setCategory(editingSubscription.category);
      setNextBillingDate(editingSubscription.nextBillingDate);
      setIsFreeTrial(editingSubscription.isFreeTrial);
      setNotes(editingSubscription.notes);
    } else {
      setName('');
      setAmountInput('');
      setCurrency(defaultCurrency);
      setCycle('monthly');
      setCategory('aiAndCloud');
      setNextBillingDate(addDaysIso(getTodayIso(), 7));
      setIsFreeTrial(false);
      setNotes('');
    }
    setError(null);
  }, [isOpen, editingSubscription, defaultCurrency]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const applyPreset = (preset: ServicePreset) => {
    setName(preset.name);
    setCategory(preset.category);
    setCycle(preset.cycle);
    setCurrency(preset.currency);
    setAmountInput(minorUnitsToInputString(preset.suggestedAmountMinorUnits));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a service or bill name.');
      return;
    }

    const amountMinorUnits = parseDecimalToMinorUnits(amountInput);
    if (amountMinorUnits === null) {
      setError('Please enter a valid positive amount (up to 2 decimal places).');
      return;
    }

    if (!parseIsoDate(nextBillingDate)) {
      setError('Please select a valid next renewal date.');
      return;
    }

    const saved: Subscription = {
      id: editingSubscription?.id ?? `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      amountMinorUnits,
      currency,
      cycle,
      category,
      nextBillingDate,
      isFreeTrial,
      isSimulatedPaused: editingSubscription?.isSimulatedPaused ?? false,
      isArchived: editingSubscription?.isArchived ?? false,
      notes: notes.trim(),
    };

    onSave(saved);
    onClose();
  };

  const todayIso = getTodayIso();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#111623] border border-[#232D42] p-5 sm:p-6 shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-[#232D42] mx-auto mb-4 sm:hidden" aria-hidden="true" />

        <div className="flex items-center justify-between gap-4">
          <h2 id="sub-editor-title" className="text-lg font-bold text-[#F8FAFC]">
            {editingSubscription ? 'Edit Recurring Bill' : 'Add Recurring Bill'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bill editor"
            className="min-h-[40px] min-w-[40px] rounded-lg bg-[#1A2234] border border-[#232D42] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6366F1]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* 1-tap Service Presets (Add mode) */}
        {!editingSubscription && (
          <div className="mt-4">
            <p className="text-xs font-medium text-[#94A3B8] mb-2">Quick-fill presets</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {SERVICE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-xs font-medium text-[#F8FAFC] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/40 px-3.5 py-2.5 text-xs font-medium text-[#FCA5A5]"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="sub-name" className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
              Service or Bill Name
            </label>
            <input
              id="sub-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. ChatGPT Plus, Spotify, Cloud VPS"
              className="w-full h-11 px-3.5 rounded-xl bg-[#1A2234] border border-[#232D42] text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#6366F1]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="sub-amount" className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                Amount
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
                className="w-full h-11 px-3.5 rounded-xl bg-[#1A2234] border border-[#232D42] font-mono tabular-nums text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            <div>
              <label htmlFor="sub-currency" className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                Currency
              </label>
              <select
                id="sub-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full h-11 px-3 rounded-xl bg-[#1A2234] border border-[#232D42] text-sm font-medium text-[#F8FAFC] focus:outline-none focus:border-[#6366F1]"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Billing Cycle Segmented Control */}
          <div>
            <span className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
              Billing Cycle
            </span>
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#0B101B] border border-[#232D42]">
              {BILLING_CYCLE_LIST.map((itemCycle) => {
                const selected = cycle === itemCycle;
                return (
                  <button
                    key={itemCycle}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCycle(itemCycle)}
                    className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      selected
                        ? 'bg-[#6366F1] text-white'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {BILLING_CYCLES[itemCycle].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <span className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
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
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
                      selected
                        ? 'text-[#F8FAFC]'
                        : 'bg-[#1A2234] border-[#232D42] text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: visual.color,
                            backgroundColor: `${visual.color}24`,
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

          {/* Next Renewal Date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="sub-date" className="text-xs font-semibold text-[#94A3B8]">
                Next Renewal Date
              </label>
              <div className="flex items-center gap-1.5">
                {[2, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setNextBillingDate(addDaysIso(todayIso, d))}
                    className="px-2 py-0.5 rounded bg-[#1A2234] border border-[#232D42] hover:border-[#6366F1] text-[11px] font-mono text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
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
              className="w-full h-11 px-3.5 rounded-xl bg-[#1A2234] border border-[#232D42] font-mono text-sm text-[#F8FAFC] focus:outline-none focus:border-[#6366F1]"
            />
          </div>

          {/* Free Trial Guard Toggle */}
          <div className="rounded-xl bg-[#1A2234]/70 border border-[#232D42] p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-[#F8FAFC]">Free Trial Guard</p>
                <p className="text-[11px] text-[#94A3B8]">
                  Highlights trial deadline and prioritizes renewal warning
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isFreeTrial}
              aria-label="Enable Free Trial Guard"
              onClick={() => setIsFreeTrial((v) => !v)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F59E0B] ${
                isFreeTrial ? 'bg-[#F59E0B]' : 'bg-[#232D42]'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  isFreeTrial ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Optional Notes */}
          <div>
            <label htmlFor="sub-notes" className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
              Notes (optional)
            </label>
            <input
              id="sub-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Plan details, cancel link reminder, or seat count"
              className="w-full h-11 px-3.5 rounded-xl bg-[#1A2234] border border-[#232D42] text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#6366F1]"
            />
          </div>

          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#94A3B8] text-sm font-semibold text-[#F8FAFC] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] h-11 rounded-xl bg-[#6366F1] hover:bg-[#5558E6] text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {editingSubscription ? 'Save Changes' : 'Add to Cashflow Radar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
