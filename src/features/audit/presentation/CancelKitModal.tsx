import React, { useEffect, useRef, useState } from 'react';
import { Archive, Check, Copy, ExternalLink, Mail, X } from 'lucide-react';
import { formatShortDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { BILLING_CYCLES, type Subscription } from '../../cashflow/domain/subscription';
import {
  getCatalogEntryById,
  matchCatalogByMerchant,
} from '../../catalog/domain/serviceCatalog';
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subscription, onClose]);

  if (!subscription) return null;

  const script = generateActionScript(subscription, mode);
  const fullEmail = `Subject: ${script.subject}\n\n${script.body}`;
  const priceLabel = formatMinorUnits(subscription.amountMinorUnits, subscription.currency, {
    showDecimals: subscription.currency !== 'PKR',
  });
  const catalogEntry =
    (subscription.catalogId ? getCatalogEntryById(subscription.catalogId) : undefined) ??
    matchCatalogByMerchant(subscription.name) ??
    undefined;
  const effectiveCancelUrl = subscription.cancelUrl ?? catalogEntry?.cancelUrl;

  const handleCopy = async () => {
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--vf-backdrop)] backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-cancel-title"
      data-testid="how-to-cancel-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-xl">
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" aria-hidden="true" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-brand-text">How to cancel</p>
            <h2 id="how-to-cancel-title" className="mt-0.5 text-lg font-bold text-text-primary">
              {subscription.name}
            </h2>
            <p className="mt-0.5 text-[13px] text-text-secondary tabular-nums">
              {priceLabel}
              {BILLING_CYCLES[subscription.cycle].shortSuffix} · Renews{' '}
              {formatShortDate(subscription.nextBillingDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close how to cancel helper"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-subtle border border-border text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Segmented Toggle */}
        <div
          className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-subtle border border-border"
          role="tablist"
          aria-label="Choose email type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cancel'}
            onClick={() => {
              setMode('cancel');
              setCopied(false);
              setCopyError(null);
            }}
            className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
              mode === 'cancel'
                ? 'bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Cancel plan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'negotiate'}
            onClick={() => {
              setMode('negotiate');
              setCopied(false);
              setCopyError(null);
            }}
            className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
              mode === 'negotiate'
                ? 'bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Ask for a lower rate
          </button>
        </div>

        {/* Live Copyable Email Preview */}
        <div
          ref={previewRef}
          className="mt-4 rounded-xl bg-subtle border border-border p-4 space-y-2.5 select-text"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-border text-[13px]">
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
          <button
            type="button"
            onClick={handleCopy}
            data-testid="copy-action-script"
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
          </button>

          {effectiveCancelUrl && (
            <a
              href={effectiveCancelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-subtle border border-border hover:border-brand text-[13px] font-semibold text-text-primary flex items-center gap-1.5 transition-colors"
            >
              <span>Billing portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
          <span className="text-[13px] text-text-secondary">Already cancelled it?</span>
          <button
            type="button"
            onClick={() => {
              onArchiveSubscription(subscription.id);
              onClose();
            }}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-subtle border border-border hover:border-brand text-[13px] font-semibold text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
            <span>Mark as cancelled</span>
          </button>
        </div>
      </div>
    </div>
  );
};
