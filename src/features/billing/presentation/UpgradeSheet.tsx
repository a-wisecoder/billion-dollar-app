import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, KeyRound, Loader2, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { trackEvent } from '../../../core/analytics/analytics';
import { useDialogA11y } from '../../../core/hooks/useDialogA11y';
import { Button, MoneyFigure } from '../../../core/ui/primitives';
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

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const keyInputRef = useRef<HTMLInputElement | null>(null);

  const launchPrice = isLaunchPriceEnabled();
  const morName = getMerchantOfRecordName();

  useDialogA11y({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: initialShowKeyInput ? keyInputRef : closeButtonRef,
    onClose,
  });

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

    return () => {
      active = false;
    };
  }, [isOpen, initialShowKeyInput]);

  useEffect(() => {
    if (isOpen && showKeyForm) {
      const frame = window.requestAnimationFrame(() => {
        keyInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [isOpen, showKeyForm]);

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="upgrade-sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[3px] p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-sheet-title"
          data-testid="upgrade-sheet"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl app-surface-elevated p-5 sm:p-6 space-y-5"
          >
            <div
              className="w-10 h-1 rounded-full bg-border-strong mx-auto sm:hidden"
              aria-hidden="true"
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-brand-text text-[13px] font-bold">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>VaultFlow Pro</span>
                </div>
                <h2
                  id="upgrade-sheet-title"
                  className="mt-1 font-display text-[22px] font-bold tracking-[-0.02em] text-text-primary leading-snug"
                >
                  Track every subscription without limits
                </h2>
                {contextMessage && (
                  <p
                    data-testid="upgrade-context-message"
                    className="mt-1.5 text-[13px] font-medium text-brand-text leading-relaxed"
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
                className="min-h-[40px] min-w-[40px] rounded-xl bg-subtle/80 border border-border text-text-secondary hover:text-text-primary flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Four Pro Benefits */}
            <ul className="space-y-2.5" aria-label="Pro features">
              {PRO_BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-2.5 text-[14px] text-text-primary leading-snug"
                >
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
                className="rounded-2xl bg-subtle/60 border border-border p-4 flex flex-col justify-between gap-4"
              >
                <div>
                  <p className="text-[13px] font-bold text-text-secondary">Yearly</p>
                  <p className="mt-1.5">
                    <MoneyFigure
                      value="$19"
                      suffix="/year"
                      className="text-2xl font-bold text-text-primary"
                    />
                  </p>
                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                    All Pro features, renew yearly or cancel any time.
                  </p>
                </div>
                {yearlyCheckoutUrl && (
                  <a
                    href={yearlyCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('checkout_clicked')}
                    data-testid="checkout-yearly-link"
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-card border border-border hover:border-border-strong hover:bg-subtle/60 text-[14px] font-semibold text-text-primary inline-flex items-center justify-center gap-1.5 transition-colors shadow-[0_1px_2px_rgba(15,26,23,0.04)]"
                  >
                    <span>Choose Yearly</span>
                    <ExternalLink className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div
                data-testid="plan-card-lifetime"
                className="relative overflow-hidden rounded-2xl bg-brand-soft/80 border border-brand-border p-4 flex flex-col justify-between gap-4"
              >
                <div
                  className="absolute inset-x-0 top-0 h-[3px] bg-brand"
                  aria-hidden="true"
                />
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-brand-text">Lifetime</p>
                    {launchPrice && (
                      <span
                        data-testid="launch-price-badge"
                        className="text-xs font-mono font-bold text-brand-text tabular-nums"
                      >
                        Launch price $29
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 flex items-baseline gap-1.5">
                    {launchPrice ? (
                      <>
                        <MoneyFigure
                          value="$29"
                          className="text-2xl font-bold text-text-primary"
                        />
                        <span className="font-mono text-sm font-semibold text-text-secondary line-through">
                          $39
                        </span>
                      </>
                    ) : (
                      <MoneyFigure value="$39" className="text-2xl font-bold text-text-primary" />
                    )}
                    <span className="text-[13px] font-medium text-text-secondary">once</span>
                  </p>
                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                    Pay once, keep Pro on your devices with no recurring bill.
                  </p>
                </div>
                {lifetimeCheckoutUrl && (
                  <a
                    href={lifetimeCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('checkout_clicked')}
                    data-testid="checkout-lifetime-link"
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-[14px] font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors shadow-[0_1px_2px_rgba(11,86,67,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]"
                  >
                    <span>Choose Lifetime</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>

            {/* Restore purchase / I have a license key */}
            <div className="pt-3 border-t border-border space-y-3">
              {!showKeyForm ? (
                <button
                  type="button"
                  onClick={() => setShowKeyForm(true)}
                  data-testid="toggle-license-key-form"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl text-[13px] font-semibold text-brand-text hover:bg-brand-soft/70 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                      className="flex-1 h-11 px-3.5 rounded-xl bg-subtle/80 border border-border font-mono text-[14px] text-text-primary placeholder:font-sans placeholder:text-text-secondary focus:bg-card focus:border-brand transition-colors"
                    />
                    <Button
                      variant="primary"
                      size="md"
                      type="submit"
                      disabled={submitting || !keyInput.trim()}
                      data-testid="activate-license-button"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                      <span>{submitting ? 'Checking...' : 'Unlock Pro'}</span>
                    </Button>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
