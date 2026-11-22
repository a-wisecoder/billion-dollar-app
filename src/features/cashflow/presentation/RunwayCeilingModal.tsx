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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultCeiling = CURRENCIES[baseCurrency].defaultMonthlyCeilingMinorUnits;
  const minSlider = Math.max(1000, Math.round(defaultCeiling * 0.25));
  const maxSlider = Math.max(
    defaultCeiling * 5,
    activeMonthlyBaseMinorUnits * 2,
    currentCeilingMinorUnits * 2,
  );
  const stepSlider = Math.max(500, Math.round(defaultCeiling * 0.05));

  const parsedMinor = parseDecimalToMinorUnits(inputVal) ?? currentCeilingMinorUnits;
  const previewRatio =
    parsedMinor > 0 ? Math.round((activeMonthlyBaseMinorUnits / parsedMinor) * 100) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = parseDecimalToMinorUnits(inputVal);
    if (minor === null) {
      setError('Enter a valid positive monthly budget.');
      return;
    }
    onSave(minor);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="budget-modal-title" className="text-lg font-bold text-text-primary">
            Monthly budget
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close budget editor"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-subtle border border-border text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-red-text">
              {error}
            </p>
          )}

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="budget-input" className="text-[13px] font-semibold text-text-secondary">
                Monthly limit ({baseCurrency})
              </label>
              <span className="text-[13px] tabular-nums text-text-secondary">
                Current spend: {previewRatio}%
              </span>
            </div>

            <input
              id="budget-input"
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
              className="w-full h-12 px-4 rounded-xl bg-subtle border border-border tabular-nums text-lg font-bold text-text-primary focus:bg-card focus:border-brand"
            />
          </div>

          <div>
            <input
              type="range"
              aria-label="Adjust monthly budget slider"
              min={minSlider}
              max={maxSlider}
              step={stepSlider}
              value={Math.min(maxSlider, Math.max(minSlider, parsedMinor))}
              onChange={(e) => {
                setInputVal(minorUnitsToInputString(Number(e.target.value)));
                if (error) setError(null);
              }}
              className="w-full app-slider"
            />
            <div className="mt-1.5 flex justify-between tabular-nums text-xs text-text-secondary">
              <span>{formatMinorUnits(minSlider, baseCurrency, { showDecimals: false })}</span>
              <span>{formatMinorUnits(maxSlider, baseCurrency, { showDecimals: false })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-xl bg-subtle border border-border text-[15px] font-semibold text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] min-h-[44px] rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white cursor-pointer"
            >
              Save budget
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
