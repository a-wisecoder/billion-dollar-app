/**
 * Tier 2 Google Maps Platform quota error detector.
 * Dispatches 'gmp-quota-exceeded' ONLY on explicit quota/rate-limit errors,
 * never on empty results (0 places) or generic network issues.
 */
export function isGoogleMapsQuotaError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object' && error !== null) {
    const maybeErr = error as { status?: unknown; code?: unknown; message?: unknown };
    if (maybeErr.status === 429 || maybeErr.code === 429) return true;
    const statusStr = String(maybeErr.status ?? '').toUpperCase();
    if (statusStr === 'RESOURCE_EXHAUSTED' || statusStr === 'OVER_QUERY_LIMIT') {
      return true;
    }
  }

  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OverQuotaMapError') ||
    text.includes('QuotaExceededError') ||
    /\b429\b/.test(text)
  );
}

export function notifyGoogleMapsQuotaExceeded(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}
