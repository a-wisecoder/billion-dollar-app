import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, KeyRound, Loader2, Sparkles, X } from 'lucide-react';
import {
  getLicenseProvider,
  getMerchantOfRecordName,
  isLaunchPriceEnabled,
  verifyAndActivateLicense,
} from '../data/licenseProvider';
import type { LicenseRecord } from '../domain/entitlements';

interface UpgradeSheetProps {
  readonly isOpen: boolean;
  readonly initialShowKeyInput?: boolean;
  readonly contextMessage?: string | null;
  readonly onClose: () => void;
  readonly onUnlocked: (record: LicenseRecord) => void;
}

const PRO_BENEFITS: readonly string[] = [
  'Unlimited active subscriptions (Free includes up to 8)',
  'One-click bank statement import for every detected subscription',
  'CSV export ready for Excel and Google Sheets',
  'Custom offline exchange rates and foreign-currency card markup',
];

export const UpgradeSheet: React.FC<UpgradeSheetProps> = ({
  isOpen,
  initialShowKeyInput = false,
  contextMessage = null,
  onClose,
  onUnlocked,
}) => {
  const [showKeyForm, setShowKeyForm] = useState(initialShowKeyInput);
  const [keyInput, setKeyInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yearlyCheckoutUrl, setYearlyCheckoutUrl] = useState('');
  const [lifetimeCheckoutUrl, setLifetimeCheckoutUrl] = useState('');

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const keyInputRef = useRef<HTMLInputElement | null>(null);

  const launchPrice = isLaunchPriceEnabled();
  const morName = getMerchantOfRecordName();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError(null);
    setKeyInput('');
    setSubmitting(false);

    void getLicenseProvider().then((provider) => {
      if (!active) return;
      const yearly = provider.checkoutUrl('yearly');
      const lifetime = provider.checkoutUrl('lifetime');
      setYearlyCheckoutUrl(yearly);
      setLifetimeCheckoutUrl(lifetime);
      setShowKeyForm(initialShowKeyInput || (!yearly && !lifetime));
    });

    const frame = window.requestAnimationFrame(() => {
      if (initialShowKeyInput && keyInputRef.current) {
        keyInputRef.current.focus();
      } else {
        closeButtonRef.current?.focus();
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, initialShowKeyInput, onClose]);

  useEffect(() => {
    if (isOpen && showKeyForm) {
      const frame = window.requestAnimationFrame(() => {
        keyInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [isOpen, showKeyForm]);

  if (!isOpen) return null;

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const provider = await getLicenseProvider();
      const outcome = await verifyAndActivateLicense(provider, keyInput);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      onUnlocked(outcome.record);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-sheet-title"
      data-testid="upgrade-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-xl space-y-5">
        <div className="w-10 h-1 rounded-full bg-border mx-auto sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-brand-text text-[13px] font-bold">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>VaultFlow Pro</span>
            </div>
            <h2
              id="upgrade-sheet-title"
              className="mt-1 text-xl font-extrabold tracking-tight text-text-primary"
            >
              Track every subscription without limits
            </h2>
            {contextMessage && (
              <p
                data-testid="upgrade-context-message"
                className="mt-1.5 text-[13px] font-medium text-brand-text"
              >
                {contextMessage}
              </p>
            )}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close upgrade sheet"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-subtle border border-border text-text-secondary hover:text-text-primary flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Four Pro Benefits */}
        <ul className="space-y-2.5" aria-label="Pro features">
          {PRO_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5 text-[14px] text-text-primary">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-soft text-brand-text flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Plan Options: Yearly $19 & Lifetime $39 (or Launch price $29) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            data-testid="plan-card-yearly"
            className="rounded-2xl bg-subtle border border-border p-4 flex flex-col justify-between gap-3"
          >
            <div>
              <p className="text-[13px] font-bold text-text-secondary">Yearly</p>
              <p className="mt-1 text-2xl font-extrabold text-text-primary tabular-nums">
                $19
                <span className="text-[13px] font-semibold text-text-secondary">/year</span>
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                All Pro features, renew yearly or cancel any time.
              </p>
            </div>
            {yearlyCheckoutUrl && (
              <a
                href={yearlyCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="checkout-yearly-link"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-card border border-border hover:border-brand text-[14px] font-semibold text-text-primary inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Choose Yearly</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
              </a>
            )}
          </div>

          <div
            data-testid="plan-card-lifetime"
            className="rounded-2xl bg-brand-soft border border-brand-border p-4 flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-bold text-brand-text">Lifetime</p>
                {launchPrice && (
                  <span
                    data-testid="launch-price-badge"
                    className="px-2 py-0.5 rounded-md bg-brand text-white text-xs font-bold tabular-nums"
                  >
                    Launch price $29
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-extrabold text-text-primary tabular-nums">
                {launchPrice ? (
                  <>
                    <span>$29</span>{' '}
                    <span className="text-sm font-semibold text-text-secondary line-through">
                      $39
                    </span>
                  </>
                ) : (
                  <span>$39</span>
                )}
                <span className="text-[13px] font-semibold text-text-secondary"> once</span>
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Pay once, keep Pro on your devices with no recurring bill.
              </p>
            </div>
            {lifetimeCheckoutUrl && (
              <a
                href={lifetimeCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="checkout-lifetime-link"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-[14px] font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Choose Lifetime</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {/* Restore purchase / I have a license key */}
        <div className="pt-2 border-t border-border space-y-3">
          {!showKeyForm ? (
            <button
              type="button"
              onClick={() => setShowKeyForm(true)}
              data-testid="toggle-license-key-form"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl text-[13px] font-semibold text-brand-text hover:bg-brand-soft inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              <span>Restore purchase / I have a license key</span>
            </button>
          ) : (
            <form onSubmit={handleActivateKey} className="space-y-3" noValidate>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="upgrade-license-key"
                  className="text-[13px] font-semibold text-text-primary inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4 text-brand-text" aria-hidden="true" />
                  <span>Restore purchase / I have a license key</span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  ref={keyInputRef}
                  id="upgrade-license-key"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your license key"
                  data-testid="license-key-input"
                  className="flex-1 h-11 px-3.5 rounded-xl bg-subtle border border-border text-[15px] text-text-primary placeholder:text-text-secondary focus:bg-card focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={submitting || !keyInput.trim()}
                  data-testid="activate-license-button"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-45 text-[14px] font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  <span>{submitting ? 'Checking...' : 'Unlock Pro'}</span>
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  data-testid="license-key-error"
                  className="rounded-xl bg-red-soft border border-red-border px-3.5 py-2 text-[13px] font-medium text-red-text"
                >
                  {error}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Small Print */}
        <p className="text-xs text-text-secondary leading-relaxed">
          Payments are processed by {morName}, our reseller. Prices may include tax.
        </p>
      </div>
    </div>
  );
};
