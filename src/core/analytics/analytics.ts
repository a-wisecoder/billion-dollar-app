export const ANALYTICS_EVENTS = [
  'onboarding_completed',
  'subscription_added',
  'import_previewed',
  'import_completed',
  'paywall_viewed',
  'checkout_clicked',
  'license_activated',
  'calendar_exported',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const ALLOWED_EVENTS = new Set<string>(ANALYTICS_EVENTS);

export type AnalyticsProvider = 'plausible' | 'umami';

export interface AnalyticsConfig {
  readonly src: string;
  readonly domain: string;
  readonly origin: string;
  readonly provider: AnalyticsProvider;
}

declare global {
  interface Window {
    plausible?: (eventName: string) => void;
    umami?: {
      track?: (eventName: string) => void;
    };
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates and resolves cookie-less analytics config from env values.
 * Returns null unless BOTH src (valid https URL) and domain are set.
 */
export function parseAnalyticsConfig(
  rawSrc?: string,
  rawDomain?: string,
): AnalyticsConfig | null {
  const src = rawSrc?.trim() ?? '';
  const domain = rawDomain?.trim() ?? '';
  if (!src || !domain) return null;

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  const isUmami =
    /umami/i.test(parsed.hostname) ||
    /umami/i.test(parsed.pathname) ||
    UUID_PATTERN.test(domain);

  return {
    src: parsed.toString(),
    domain,
    origin: parsed.origin,
    provider: isUmami ? 'umami' : 'plausible',
  };
}

export function getAnalyticsConfigFromEnv(): AnalyticsConfig | null {
  if (typeof import.meta === 'undefined' || !import.meta.env) return null;
  return parseAnalyticsConfig(
    import.meta.env.VITE_ANALYTICS_SRC as string | undefined,
    import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined,
  );
}

const SCRIPT_MARKER_ATTR = 'data-vf-analytics';

/**
 * Loads the configured cookie-less analytics script at most once.
 * Does nothing unless both VITE_ANALYTICS_SRC and VITE_ANALYTICS_DOMAIN are set.
 */
export function initAnalytics(
  config: AnalyticsConfig | null = getAnalyticsConfigFromEnv(),
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): boolean {
  if (!config || !doc || !doc.head) return false;
  if (doc.head.querySelector(`script[${SCRIPT_MARKER_ATTR}="1"]`)) {
    return false;
  }

  const script = doc.createElement('script');
  script.defer = true;
  script.src = config.src;
  script.setAttribute(SCRIPT_MARKER_ATTR, '1');

  if (config.provider === 'umami') {
    script.setAttribute('data-website-id', config.domain);
  } else {
    script.setAttribute('data-domain', config.domain);
  }

  doc.head.appendChild(script);
  return true;
}

/**
 * Sends a privacy-safe event name with zero payload (no names, amounts, or free text).
 * Auto-detects Plausible or Umami at runtime; no-op when analytics is not loaded.
 */
export function trackEvent(
  event: AnalyticsEventName,
  win: Pick<Window, 'plausible' | 'umami'> | undefined =
    typeof window !== 'undefined' ? window : undefined,
): boolean {
  if (!ALLOWED_EVENTS.has(event) || !win) return false;

  try {
    if (typeof win.plausible === 'function') {
      win.plausible(event);
      return true;
    }
    if (win.umami && typeof win.umami.track === 'function') {
      win.umami.track(event);
      return true;
    }
  } catch {
    // Analytics must never interrupt user actions
  }
  return false;
}
