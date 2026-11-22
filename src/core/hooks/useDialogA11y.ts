import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export interface UseDialogA11yOptions {
  readonly isOpen: boolean;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  /** Skip restoring focus if the caller handles custom focus restoration (e.g. virtualized/keyed row). */
  readonly restoreFocus?: boolean;
}

/**
 * Shared accessibility hook for modal dialogs & sheets:
 * - Moves focus inside the dialog on open
 * - Traps Tab / Shift+Tab inside the dialog container
 * - Closes on Escape
 * - Restores focus to the previously active element on close
 */
export function useDialogA11y({
  isOpen,
  containerRef,
  initialFocusRef,
  onClose,
  restoreFocus = true,
}: UseDialogA11yOptions): void {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFrame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      if (initialFocusRef?.current && container.contains(initialFocusRef.current)) {
        initialFocusRef.current.focus();
        return;
      }
      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreFocus && previouslyFocused && previouslyFocused.isConnected) {
        window.requestAnimationFrame(() => {
          previouslyFocused.focus();
        });
      }
    };
  }, [isOpen, containerRef, initialFocusRef, onClose, restoreFocus]);
}
