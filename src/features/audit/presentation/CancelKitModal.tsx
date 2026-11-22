import React, { useEffect, useRef, useState } from 'react';
import { Archive, Check, Copy, ExternalLink, Mail, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDialogA11y } from '../../../core/hooks/useDialogA11y';
import { Button, SegmentedControl } from '../../../core/ui/primitives';
import { formatShortDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import {
  BILLING_CYCLES,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type Subscription,
} from '../../cashflow/domain/subscription';
import {
  getCatalogEntryById,
  matchCatalogByMerchant,
} from '../../catalog/domain/serviceCatalog';
import { ServiceAvatar } from '../../catalog/presentation/ServiceAvatar';
import { generateActionScript } from '../domain/auditEngine';

interface CancelKitModalProps {
  readonly subscription: Subscription | null;
  readonly onClose: () => void;
  readonly onArchiveSubscription: (id: string) => void;
}

export const CancelKitModal: React.FC<CancelKitModalProps> = ({
  subscription,
  onClose,
  onArchiveSubscription,
}) => {
  const [mode, setMode] = useState<'cancel' | 'negotiate'>('cancel');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useDialogA11y({
    isOpen: Boolean(subscription),
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  useEffect(() => {
    if (!subscription) return;
    setMode(
      subscription.previousAmountMinorUnits &&
        subscription.amountMinorUnits > subscription.previousAmountMinorUnits
        ? 'negotiate'
        : 'cancel',
    );
    setCopied(false);
    setCopyError(null);
  }, [subscription]);

  const handleCopy = async (fullEmail: string) => {
    setCopyError(null);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
      if (previewRef.current && typeof window !== 'undefined' && window.getSelection) {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(previewRef.current);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      setCopyError("Couldn't copy. Text is selected; press Ctrl+C or long-press to copy.");
    }
  };

  return (
    <AnimatePresence>
      {subscription && (() => {
        const script = generateActionScript(subscription, mode);
        const fullEmail = `Subject: ${script.subject}\n\n${script.body}`;
        const priceLabel = formatMinorUnits(subscription.amountMinorUnits, subscription.currency, {
          showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(subscription.currency),
        });
        const catalogEntry =
          (subscription.catalogId ? getCatalogEntryById(subscription.catalogId) : undefined) ??
          matchCatalogByMerchant(subscription.name) ??
          undefined;
        const effectiveCancelUrl = subscription.cancelUrl ?? catalogEntry?.cancelUrl;

        return (
          <motion.div
            key="cancel-kit-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[3px] p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-cancel-title"
            data-testid="how-to-cancel-modal"
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
              className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl app-surface-elevated p-5 sm:p-6"
            >
              <div
                className="w-10 h-1 rounded-full bg-border-strong mx-auto mb-4 sm:hidden"
                aria-hidden="true"
              />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <ServiceAvatar
                    name={subscription.name}
                    category={subscription.category}
                    catalogId={subscription.catalogId}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-brand-text">How to cancel</p>
                    <h2
                      id="how-to-cancel-title"
                      title={subscription.name}
                      className="font-display text-lg font-bold tracking-[-0.015em] text-text-primary truncate"
                    >
                      {subscription.name}
                    </h2>
                    <p className="text-[13px] text-text-secondary font-mono tabular-nums truncate">
                      {priceLabel}
                      {BILLING_CYCLES[subscription.cycle].shortSuffix} · Renews{' '}
                      {formatShortDate(subscription.nextBillingDate)}
                    </p>
                  </div>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close how to cancel helper"
                  className="min-h-[40px] min-w-[40px] shrink-0 rounded-xl bg-subtle/80 border border-border text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Mode Segmented Toggle */}
              <div className="mt-4">
                <SegmentedControl
                  value={mode}
                  onChange={(next) => {
                    setMode(next);
                    setCopied(false);
                    setCopyError(null);
                  }}
                  ariaLabel="Choose email type"
                  layoutId="cancel-kit-mode"
                  fullWidth
                  options={[
                    { value: 'cancel', label: 'Cancel plan' },
                    { value: 'negotiate', label: 'Ask for a lower rate' },
                  ]}
                />
              </div>

              {/* Live Copyable Email Preview */}
              <div
                ref={previewRef}
                className="mt-4 rounded-xl bg-subtle/70 border border-border p-4 space-y-2.5 select-text"
              >
                <div className="flex items-center gap-2 pb-2.5 border-b border-border text-[13px]">
                  <Mail className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-text-secondary">Subject:</span>
                  <span className="font-medium text-text-primary truncate">{script.subject}</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-text-primary">
                  {script.body}
                </pre>
              </div>

              {copyError && (
                <p
                  role="alert"
                  data-testid="copy-error-message"
                  className="mt-3 rounded-xl bg-amber-soft border border-amber-border px-3.5 py-2.5 text-[13px] font-medium text-amber-text"
                >
                  {copyError}
                </p>
              )}

              {/* Primary & Secondary Actions */}
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleCopy(fullEmail)}
                  data-testid="copy-action-script"
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      <span>Copy email</span>
                    </>
                  )}
                </Button>

                {effectiveCancelUrl && (
                  <a
                    href={effectiveCancelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl bg-card border border-border hover:border-border-strong hover:bg-subtle/60 text-[13px] font-semibold text-text-primary inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Billing portal</span>
                    <ExternalLink className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-border flex items-center justify-between gap-3">
                <span className="text-[13px] text-text-secondary">Already cancelled it?</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onArchiveSubscription(subscription.id);
                    onClose();
                  }}
                >
                  <Archive className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                  <span>Mark as cancelled</span>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
};
