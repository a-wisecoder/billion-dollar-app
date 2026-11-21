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
  const [name, setName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [previousAmountInput, setPreviousAmountInput] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [category, setCategory] = useState<SubscriptionCategory>('aiAndCloud');
  const [usageFrequency, setUsageFrequency] = useState<UsageFrequency>('weekly');
  const [nextBillingDate, setNextBillingDate] = useState(addDaysIso(getTodayIso(), 7));
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingSubscription) {
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
      setIsFreeTrial(editingSubscription.isFreeTrial);
      setNotes(editingSubscription.notes);
    } else {
      setName(prefillDraft?.name ?? '');
      setAmountInput('');
      setPreviousAmountInput('');
      setCurrency(defaultCurrency);
      setCycle('monthly');
      setCategory(prefillDraft?.category ?? 'aiAndCloud');
      setUsageFrequency('weekly');
      setNextBillingDate(addDaysIso(getTodayIso(), 7));
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

    let previousAmountMinorUnits: number | undefined;
    if (previousAmountInput.trim()) {
      const parsedPrev = parseDecimalToMinorUnits(previousAmountInput);
      if (parsedPrev === null) {
        setError('Prior price must be a valid positive number or left blank.');
        return;
      }
      previousAmountMinorUnits = parsedPrev;
    }

    if (!parseIsoDate(nextBillingDate)) {
      setError('Please select a valid next renewal date.');
      return;
    }

    const saved: Subscription = {
      id: editingSubscription?.id ?? `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      amountMinorUnits,
      ...(previousAmountMinorUnits !== undefined ? { previousAmountMinorUnits } : {}),
      currency,
      cycle,
      category,
      nextBillingDate,
      isFreeTrial,
      isSimulatedPaused: editingSubscription?.isSimulatedPaused ?? false,
      isArchived: editingSubscription?.isArchived ?? false,
      usageFrequency,
      ...(editingSubscription?.cancelUrl ? { cancelUrl: editingSubscription.cancelUrl } : {}),
      notes: notes.trim(),
    };

    onSave(saved);
    onClose();
  };

  const todayIso = getTodayIso();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#17211E]/40 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white border border-[#E4E7E1] p-5 sm:p-6 shadow-xl">
        <div className="w-10 h-1 rounded-full bg-[#DCE1D9] mx-auto mb-4 sm:hidden" aria-hidden="true" />

        <div className="flex items-center justify-between gap-4">
          <h2 id="sub-editor-title" className="text-lg font-bold text-[#17211E]">
            {editingSubscription ? 'Edit Recurring Bill' : 'Add Recurring Bill'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bill editor"
            className="min-h-[38px] min-w-[38px] rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] text-[#5B6662] hover:text-[#17211E] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {!editingSubscription && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#5B6662] mb-2">Quick-fill presets</p>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {SERVICE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-medium text-[#17211E] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
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
              className="rounded-xl bg-[#FCEEEE] border border-[#EBCACA] px-3.5 py-2.5 text-xs font-medium text-[#A63535]"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="sub-name" className="block text-xs font-semibold text-[#5B6662] mb-1.5">
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
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] text-sm text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="sub-amount" className="block text-xs font-semibold text-[#5B6662] mb-1.5">
                Current Price
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
                className="w-full h-11 px-3 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] font-mono tabular-nums text-sm text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
              />
            </div>

            <div>
              <label htmlFor="sub-prev-amount" className="block text-xs font-semibold text-[#5B6662] mb-1.5">
                Prior Price <span className="font-normal text-[#85918C]">(opt.)</span>
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
                placeholder="15.99"
                className="w-full h-11 px-3 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] font-mono tabular-nums text-sm text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
              />
            </div>

            <div>
              <label htmlFor="sub-currency" className="block text-xs font-semibold text-[#5B6662] mb-1.5">
                Currency
              </label>
              <select
                id="sub-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full h-11 px-3 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] text-sm font-medium text-[#17211E] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
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
              <span className="block text-xs font-semibold text-[#5B6662] mb-1.5">
                Billing Cycle
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#EEF1EC] border border-[#E4E7E1]">
                {BILLING_CYCLE_LIST.map((itemCycle) => {
                  const selected = cycle === itemCycle;
                  return (
                    <button
                      key={itemCycle}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCycle(itemCycle)}
                      className={`min-h-[34px] rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        selected
                          ? 'bg-white text-[#17211E] shadow-xs'
                          : 'text-[#5B6662] hover:text-[#17211E]'
                      }`}
                    >
                      {BILLING_CYCLES[itemCycle].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#5B6662] mb-1.5">
                How Often Do You Use It?
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#EEF1EC] border border-[#E4E7E1]">
                {USAGE_FREQUENCY_LIST.map((freq) => {
                  const selected = usageFrequency === freq;
                  return (
                    <button
                      key={freq}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setUsageFrequency(freq)}
                      className={`min-h-[34px] rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        selected
                          ? 'bg-white text-[#17211E] shadow-xs'
                          : 'text-[#5B6662] hover:text-[#17211E]'
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
            <span className="block text-xs font-semibold text-[#5B6662] mb-1.5">
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
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
                      selected
                        ? 'text-[#17211E]'
                        : 'bg-[#F5F6F3] border-[#E4E7E1] text-[#5B6662] hover:text-[#17211E]'
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: visual.color,
                            backgroundColor: `${visual.color}16`,
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="sub-date" className="text-xs font-semibold text-[#5B6662]">
                Next Renewal Date
              </label>
              <div className="flex items-center gap-1.5">
                {[2, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setNextBillingDate(addDaysIso(todayIso, d))}
                    className="px-2 py-0.5 rounded bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-[11px] font-mono text-[#5B6662] hover:text-[#17211E] cursor-pointer"
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
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] font-mono text-sm text-[#17211E] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
            />
          </div>

          <div className="rounded-xl bg-[#FDF9F3] border border-[#EED9BD] p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[#B86A14] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-[#17211E]">Free Trial Guard</p>
                <p className="text-[11px] text-[#5B6662]">
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
              className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                isFreeTrial ? 'bg-[#C97E24]' : 'bg-[#D5DBD2]'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  isFreeTrial ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="sub-notes" className="block text-xs font-semibold text-[#5B6662] mb-1.5">
              Notes (optional)
            </label>
            <input
              id="sub-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Plan details, seat count, or account email"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] text-sm text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
            />
          </div>

          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#CFD6CC] text-sm font-semibold text-[#17211E] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] h-11 rounded-xl bg-[#1E6B58] hover:bg-[#175747] text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {editingSubscription ? 'Save Changes' : 'Add to Overview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
