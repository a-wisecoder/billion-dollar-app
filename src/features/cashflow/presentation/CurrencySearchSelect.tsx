import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  CURRENCIES,
  CURRENCY_CODES,
  type CurrencyCode,
} from '../domain/subscription';

interface CurrencySearchSelectProps {
  readonly id?: string;
  readonly value: CurrencyCode;
  readonly onChange: (code: CurrencyCode) => void;
  readonly label?: string;
  readonly testId?: string;
}

export const CurrencySearchSelect: React.FC<CurrencySearchSelectProps> = ({
  id = 'currency-search-select',
  value,
  onChange,
  label = 'Main currency',
  testId = 'currency-search-select',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedMeta = CURRENCIES[value];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCY_CODES;
    return CURRENCY_CODES.filter((code) => {
      const meta = CURRENCIES[code];
      return (
        meta.code.toLowerCase().includes(q) ||
        meta.name.toLowerCase().includes(q) ||
        meta.symbol.trim().toLowerCase().includes(q)
      );
    });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelect = (code: CurrencyCode) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selectedMeta.code} ${selectedMeta.name}`}
        data-testid={`${testId}-trigger`}
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-subtle border border-border hover:border-brand flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center text-[14px] font-bold text-text-primary shrink-0">
            {selectedMeta.symbol.trim()}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-text-primary leading-tight">
              {selectedMeta.code}
            </span>
            <span className="block text-[13px] text-text-secondary truncate">
              {selectedMeta.name}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-secondary shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-card border border-border shadow-lg overflow-hidden z-20 relative">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search
                className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search currency (PKR, INR, SAR, USD...)"
                aria-label="Search currencies"
                data-testid={`${testId}-input`}
                className="w-full h-10 pl-9 pr-9 rounded-lg bg-subtle border border-border text-[14px] text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear currency search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <ul
            role="listbox"
            aria-label={label}
            className="max-h-60 overflow-y-auto divide-y divide-border/60"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-[13px] text-text-secondary">
                No matching currencies.
              </li>
            ) : (
              filtered.map((code) => {
                const meta = CURRENCIES[code];
                const isSelected = code === value;
                return (
                  <li key={code} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      data-testid={`${testId}-option-${code}`}
                      onClick={() => handleSelect(code)}
                      className={`w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-brand-soft text-brand-text'
                          : 'hover:bg-subtle text-text-primary'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 text-center text-[13px] font-bold text-text-secondary shrink-0">
                          {meta.symbol.trim()}
                        </span>
                        <span className="text-[14px] font-bold shrink-0">{meta.code}</span>
                        <span className="text-[13px] text-text-secondary truncate">
                          {meta.name}
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-brand-text shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
