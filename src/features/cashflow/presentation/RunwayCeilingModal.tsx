import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDialogA11y } from '../../../core/hooks/useDialogA11y';
import { Button, MoneyFigure } from '../../../core/ui/primitives';
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useDialogA11y({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
    onClose,
  });

  useEffect(() => {
    if (!isOpen) return;
    setInputVal(minorUnitsToInputString(currentCeilingMinorUnits));
    setError(null);
  }, [isOpen, currentCeilingMinorUnits]);

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="budget-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[3px] p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl app-surface-elevated p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  id="budget-modal-title"
                  className="font-display text-xl font-bold tracking-[-0.015em] text-text-primary"
                >
                  Monthly budget
                </h2>
                <p className="mt-0.5 text-[13px] text-text-secondary">
                  Current active spend:{' '}
                  <MoneyFigure
                    value={formatMinorUnits(activeMonthlyBaseMinorUnits, baseCurrency, {
                      showDecimals: false,
                    })}
                    suffix="/mo"
                    className="font-semibold text-text-primary"
                  />
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close budget editor"
                className="min-h-[40px] min-w-[40px] rounded-xl bg-subtle/80 border border-border text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer transition-colors"
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
                  <label
                    htmlFor="budget-input"
                    className="text-[13px] font-semibold text-text-secondary"
                  >
                    Monthly limit ({baseCurrency})
                  </label>
                  <span
                    className={`text-[13px] font-mono font-semibold tabular-nums ${
                      previewRatio > 100
                        ? 'text-red-text'
                        : previewRatio >= 85
                          ? 'text-amber-text'
                          : 'text-brand-text'
                    }`}
                  >
                    {previewRatio}% used
                  </span>
                </div>

                <input
                  ref={inputRef}
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
                  className="w-full h-12 px-4 rounded-xl bg-subtle/80 border border-border font-mono tabular-nums text-lg font-bold text-text-primary focus:bg-card focus:border-brand transition-colors"
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
                    const intMinor = Number.parseInt(e.target.value, 10);
                    if (Number.isSafeInteger(intMinor) && intMinor > 0) {
                      setInputVal(minorUnitsToInputString(intMinor));
                    }
                    if (error) setError(null);
                  }}
                  className="w-full app-slider"
                />
                <div className="mt-2 flex justify-between font-mono tabular-nums text-xs text-text-secondary">
                  <span>{formatMinorUnits(minSlider, baseCurrency, { showDecimals: false })}</span>
                  <span>{formatMinorUnits(maxSlider, baseCurrency, { showDecimals: false })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <Button variant="secondary" size="md" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button variant="primary" size="md" type="submit" className="flex-[2]">
                  Save budget
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
