import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  formatMinorUnits,
  minorUnitsToInputString,
  parseDecimalToMinorUnits,
} from '../../../core/utils/moneyFormatter';
import { CURRENCIES, type CurrencyCode } from '../domain/subscription';

interface RunwayCeilingModalProps {
  readonly isOpen: boolean;
  readonly currentCeilingMinorUnits: number;
  readonly activeMonthlyBaseMinorUnits: number;
  readonly baseCurrency: CurrencyCode;
  readonly onClose: () => void;
  readonly onSave: (newCeilingMinorUnits: number) => void;
}

export const RunwayCeilingModal: React.FC<RunwayCeilingModalProps> = ({
  isOpen,
  currentCeilingMinorUnits,
  activeMonthlyBaseMinorUnits,
  baseCurrency,
  onClose,
  onSave,
}) => {
  const [inputVal, setInputVal] = useState(minorUnitsToInputString(currentCeilingMinorUnits));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setInputVal(minorUnitsToInputString(currentCeilingMinorUnits));
    setError(null);
  }, [isOpen, currentCeilingMinorUnits]);

  if (!isOpen) return null;

  const defaultCeiling = CURRENCIES[baseCurrency].defaultMonthlyCeilingMinorUnits;
  const minSlider = Math.max(1000, Math.round(defaultCeiling * 0.25));
  const maxSlider = Math.max(defaultCeiling * 5, activeMonthlyBaseMinorUnits * 2, currentCeilingMinorUnits * 2);
  const stepSlider = Math.max(500, Math.round(defaultCeiling * 0.05));

  const parsedMinor = parseDecimalToMinorUnits(inputVal) ?? currentCeilingMinorUnits;
  const previewRatio = parsedMinor > 0 ? Math.round((activeMonthlyBaseMinorUnits / parsedMinor) * 100) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = parseDecimalToMinorUnits(inputVal);
    if (minor === null) {
      setError('Enter a valid positive monthly ceiling.');
      return;
    }
    onSave(minor);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ceiling-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-[#111623] border border-[#232D42] p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="ceiling-modal-title" className="text-lg font-bold text-[#F8FAFC]">
            Monthly Runway Ceiling
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ceiling editor"
            className="min-h-[40px] min-w-[40px] rounded-lg bg-[#1A2234] border border-[#232D42] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
          {error && (
            <p role="alert" className="text-xs font-medium text-[#FCA5A5]">
              {error}
            </p>
          )}

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="ceiling-input" className="text-xs font-semibold text-[#94A3B8]">
                Target monthly limit ({baseCurrency})
              </label>
              <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
                Current burn: {previewRatio}%
              </span>
            </div>

            <input
              id="ceiling-input"
              type="text"
              inputMode="decimal"
              value={inputVal}
              onChange={(e) => {
                const v = e.target.value;
                if (/^[0-9,]*\.?[0-9]{0,2}$/.test(v)) {
                  setInputVal(v);
                  if (error) setError(null);
                }
              }}
              className="w-full h-12 px-4 rounded-xl bg-[#1A2234] border border-[#232D42] font-mono tabular-nums text-lg font-bold text-[#F8FAFC] focus:outline-none focus:border-[#6366F1]"
            />
          </div>

          <div>
            <input
              type="range"
              aria-label="Adjust monthly runway ceiling slider"
              min={minSlider}
              max={maxSlider}
              step={stepSlider}
              value={Math.min(maxSlider, Math.max(minSlider, parsedMinor))}
              onChange={(e) => {
                setInputVal(minorUnitsToInputString(Number(e.target.value)));
                if (error) setError(null);
              }}
              className="w-full vault-slider"
            />
            <div className="mt-1.5 flex justify-between font-mono tabular-nums text-[11px] text-[#94A3B8]">
              <span>{formatMinorUnits(minSlider, baseCurrency, { showDecimals: false })}</span>
              <span>{formatMinorUnits(maxSlider, baseCurrency, { showDecimals: false })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-[#1A2234] border border-[#232D42] text-sm font-semibold text-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] h-11 rounded-xl bg-[#6366F1] hover:bg-[#5558E6] text-sm font-semibold text-white cursor-pointer"
            >
              Save Ceiling
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
