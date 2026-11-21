import React, { useEffect, useState } from 'react';
import { Archive, Check, Copy, ExternalLink, Mail, X } from 'lucide-react';
import { formatShortDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { BILLING_CYCLES, type Subscription } from '../../cashflow/domain/subscription';
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

  useEffect(() => {
    if (!subscription) return;
    setMode(
      subscription.previousAmountMinorUnits &&
        subscription.amountMinorUnits > subscription.previousAmountMinorUnits
        ? 'negotiate'
        : 'cancel',
    );
    setCopied(false);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#17211E]/40 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-kit-title"
      data-testid="cancel-kit-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white border border-[#E4E7E1] p-5 sm:p-6 shadow-xl">
        <div className="w-10 h-1 rounded-full bg-[#DCE1D9] mx-auto mb-4 sm:hidden" aria-hidden="true" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#1E6B58]">Action Script Kit</p>
            <h2 id="cancel-kit-title" className="mt-0.5 text-lg font-bold text-[#17211E]">
              {subscription.name}
            </h2>
            <p className="mt-0.5 text-xs text-[#5B6662] font-mono tabular-nums">
              {priceLabel}
              {BILLING_CYCLES[subscription.cycle].shortSuffix} · Renews{' '}
              {formatShortDate(subscription.nextBillingDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cancel and negotiate kit"
            className="min-h-[38px] min-w-[38px] rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] text-[#5B6662] hover:text-[#17211E] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Segmented Toggle */}
        <div
          className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#EEF1EC] border border-[#E4E7E1]"
          role="tablist"
          aria-label="Choose email script type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cancel'}
            onClick={() => {
              setMode('cancel');
              setCopied(false);
            }}
            className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'cancel'
                ? 'bg-white text-[#17211E] shadow-xs'
                : 'text-[#5B6662] hover:text-[#17211E]'
            }`}
          >
            Cancel Subscription
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'negotiate'}
            onClick={() => {
              setMode('negotiate');
              setCopied(false);
            }}
            className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'negotiate'
                ? 'bg-white text-[#17211E] shadow-xs'
                : 'text-[#5B6662] hover:text-[#17211E]'
            }`}
          >
            Negotiate Lower Rate
          </button>
        </div>

        {/* Live Copyable Email Preview */}
        <div className="mt-4 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] p-4 space-y-2.5">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E4E7E1] text-xs">
            <Mail className="w-3.5 h-3.5 text-[#5B6662] shrink-0" aria-hidden="true" />
            <span className="font-semibold text-[#5B6662]">Subject:</span>
            <span className="font-medium text-[#17211E] truncate">{script.subject}</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#2C3733]">
            {script.body}
          </pre>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            data-testid="copy-action-script"
            className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#1E6B58] hover:bg-[#175747] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy Email Script</span>
              </>
            )}
          </button>

          {subscription.cancelUrl && (
            <a
              href={subscription.cancelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-1.5 transition-colors"
            >
              <span>Billing Portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#5B6662]" aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-[#E4E7E1] flex items-center justify-between gap-3">
          <span className="text-xs text-[#5B6662]">Already cancelled with the provider?</span>
          <button
            type="button"
            onClick={() => {
              onArchiveSubscription(subscription.id);
              onClose();
            }}
            className="min-h-[34px] px-3 py-1 rounded-lg bg-[#FCEEEE] hover:bg-[#F8DFDF] text-xs font-semibold text-[#A63535] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Archive Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
};
