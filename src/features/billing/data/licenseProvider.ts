import type { LicenseRecord } from '../domain/entitlements';

export type LicensePlanOption = 'yearly' | 'lifetime';

export interface LicenseValidationResult {
  readonly valid: boolean;
  readonly expiresAt: string | null;
  readonly requiresActivation?: boolean;
  readonly reason?: string;
}

export interface LicenseActivationResult {
  readonly activationId: string;
  readonly expiresAt?: string | null;
}

export interface LicenseProvider {
  checkoutUrl(plan: LicensePlanOption): string;
  validate(key: string, activationId?: string): Promise<LicenseValidationResult>;
  activate?(key: string, label: string): Promise<LicenseActivationResult>;
  deactivate?(key: string, activationId: string): Promise<void>;
}

export const LICENSE_ERROR_UNRECOGNISED = "That key wasn't recognised.";
export const LICENSE_ERROR_OFFLINE = "No internet. Try again when you're online.";
export const LICENSE_PROXY_HEADER = 'X-VaultFlow-License-Proxy';

const POLAR_API_BASE = 'https://api.polar.sh/v1/customer-portal/license-keys';

export function sanitizeHttpsUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function getMerchantOfRecordName(): string {
  const configured =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_MOR_NAME as string | undefined)
      : undefined;
  return configured && configured.trim() ? configured.trim() : 'Polar';
}

export function isLaunchPriceEnabled(): boolean {
  if (typeof import.meta === 'undefined' || !import.meta.env) return false;
  return import.meta.env.VITE_LAUNCH_PRICE === '1';
}

export function detectDeviceLabel(userAgent?: string): string {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : '');

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let os = 'Desktop';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
}

export interface PolarLicenseProviderConfig {
  readonly orgId: string;
  readonly checkoutYearlyUrl: string;
  readonly checkoutLifetimeUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly isOnlineFn?: () => boolean;
  readonly proxyBasePath?: string;
}

interface PolarValidatePayload {
  readonly status?: string;
  readonly expires_at?: string | null;
  readonly limit_activations?: number | null;
  readonly activation?: { readonly id?: string } | null;
  readonly detail?: unknown;
}

interface PolarActivatePayload {
  readonly id?: string;
  readonly license_key?: {
    readonly status?: string;
    readonly expires_at?: string | null;
  };
}

function defaultIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export class PolarLicenseProvider implements LicenseProvider {
  private readonly orgId: string;
  private readonly checkoutYearlyUrl: string;
  private readonly checkoutLifetimeUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly isOnlineFn: () => boolean;
  private readonly proxyBasePath: string;

  constructor(config: PolarLicenseProviderConfig) {
    this.orgId = config.orgId.trim();
    this.checkoutYearlyUrl = sanitizeHttpsUrl(config.checkoutYearlyUrl);
    this.checkoutLifetimeUrl = sanitizeHttpsUrl(config.checkoutLifetimeUrl);
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
    this.isOnlineFn = config.isOnlineFn ?? defaultIsOnline;
    this.proxyBasePath = config.proxyBasePath ?? '/api/license';
  }

  checkoutUrl(plan: LicensePlanOption): string {
    return plan === 'yearly' ? this.checkoutYearlyUrl : this.checkoutLifetimeUrl;
  }

  private async postPolar(
    action: 'validate' | 'activate' | 'deactivate',
    body: Record<string, string>,
  ): Promise<Response> {
    if (!this.isOnlineFn()) {
      throw new Error(LICENSE_ERROR_OFFLINE);
    }

    const directUrl = `${POLAR_API_BASE}/${action}`;
    const proxyUrl = `${this.proxyBasePath}/${action}`;
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    };

    try {
      return await this.fetchImpl(directUrl, init);
    } catch (directErr) {
      if (!this.isOnlineFn()) {
        throw new Error(LICENSE_ERROR_OFFLINE);
      }
      // Browser CORS blocks surface as TypeError on fetch; fall back to local proxy function.
      if (directErr instanceof TypeError) {
        try {
          const proxyResponse = await this.fetchImpl(proxyUrl, init);
          const isLicenseProxy = proxyResponse.headers.get(LICENSE_PROXY_HEADER) === '1';
          if (proxyResponse.status >= 500 || (proxyResponse.status === 404 && !isLicenseProxy)) {
            throw new Error(LICENSE_ERROR_OFFLINE);
          }
          return proxyResponse;
        } catch {
          throw new Error(LICENSE_ERROR_OFFLINE);
        }
      }
      throw new Error(LICENSE_ERROR_OFFLINE);
    }
  }

  async validate(key: string, activationId?: string): Promise<LicenseValidationResult> {
    const trimmedKey = key.trim();
    if (!trimmedKey || !this.orgId) {
      return {
        valid: false,
        expiresAt: null,
        reason: LICENSE_ERROR_UNRECOGNISED,
      };
    }

    const body: Record<string, string> = {
      key: trimmedKey,
      organization_id: this.orgId,
      ...(activationId ? { activation_id: activationId } : {}),
    };

    const res = await this.postPolar('validate', body);

    if (res.status === 404 || res.status === 400 || res.status === 422) {
      let detailText = '';
      try {
        const errJson = (await res.json()) as PolarValidatePayload;
        detailText = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail ?? '');
      } catch {
        // Ignore unparseable error body
      }
      if (!activationId && /activation/i.test(detailText)) {
        return {
          valid: false,
          expiresAt: null,
          requiresActivation: true,
        };
      }
      return {
        valid: false,
        expiresAt: null,
        reason: LICENSE_ERROR_UNRECOGNISED,
      };
    }

    if (!res.ok) {
      throw new Error(LICENSE_ERROR_OFFLINE);
    }

    const data = (await res.json()) as PolarValidatePayload;
    const expiresAt = typeof data.expires_at === 'string' ? data.expires_at : null;
    const isNotExpired = expiresAt === null || Date.parse(expiresAt) > Date.now();
    const isGranted = data.status === 'granted' && isNotExpired;

    if (!isGranted) {
      return {
        valid: false,
        expiresAt,
        reason: LICENSE_ERROR_UNRECOGNISED,
      };
    }

    const hasActivationLimit =
      typeof data.limit_activations === 'number' && data.limit_activations > 0;
    const needsActivation = hasActivationLimit && !activationId && !data.activation?.id;

    return {
      valid: true,
      expiresAt,
      ...(needsActivation ? { requiresActivation: true } : {}),
    };
  }

  async activate(key: string, label: string): Promise<LicenseActivationResult> {
    const trimmedKey = key.trim();
    if (!trimmedKey || !this.orgId) {
      throw new Error(LICENSE_ERROR_UNRECOGNISED);
    }

    const res = await this.postPolar('activate', {
      key: trimmedKey,
      organization_id: this.orgId,
      label: label.trim() || detectDeviceLabel(),
    });

    if (res.status === 404 || res.status === 400 || res.status === 403 || res.status === 422) {
      throw new Error(LICENSE_ERROR_UNRECOGNISED);
    }

    if (!res.ok) {
      throw new Error(LICENSE_ERROR_OFFLINE);
    }

    const data = (await res.json()) as PolarActivatePayload;
    if (!data.id || typeof data.id !== 'string') {
      throw new Error(LICENSE_ERROR_UNRECOGNISED);
    }

    const expiresAt =
      data.license_key && typeof data.license_key.expires_at === 'string'
        ? data.license_key.expires_at
        : null;

    return {
      activationId: data.id,
      expiresAt,
    };
  }

  async deactivate(key: string, activationId: string): Promise<void> {
    const trimmedKey = key.trim();
    if (!trimmedKey || !activationId.trim() || !this.orgId) return;

    const res = await this.postPolar('deactivate', {
      key: trimmedKey,
      organization_id: this.orgId,
      activation_id: activationId.trim(),
    });

    if (res.status === 204 || res.ok || res.status === 404) {
      return;
    }

    throw new Error(LICENSE_ERROR_OFFLINE);
  }
}

export function createPolarLicenseProviderFromEnv(): PolarLicenseProvider {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
  return new PolarLicenseProvider({
    orgId: (env?.VITE_POLAR_ORG_ID as string | undefined) ?? '',
    checkoutYearlyUrl: (env?.VITE_POLAR_CHECKOUT_YEARLY as string | undefined) ?? '',
    checkoutLifetimeUrl: (env?.VITE_POLAR_CHECKOUT_LIFETIME as string | undefined) ?? '',
  });
}

let cachedProviderPromise: Promise<LicenseProvider> | null = null;

/**
 * Returns the active LicenseProvider.
 * `DevLicenseProvider` is strictly gated behind `import.meta.env.DEV` so Vite
 * eliminates the dev module and key prefix completely from production builds.
 */
export function getLicenseProvider(): Promise<LicenseProvider> {
  if (cachedProviderPromise) return cachedProviderPromise;

  if (import.meta.env.DEV && import.meta.env.VITE_LICENSE_PROVIDER === 'dev') {
    cachedProviderPromise = import('./devLicenseProvider').then(
      ({ DevLicenseProvider }) => new DevLicenseProvider(),
    );
    return cachedProviderPromise;
  }

  cachedProviderPromise = Promise.resolve(createPolarLicenseProviderFromEnv());
  return cachedProviderPromise;
}

export type VerifyLicenseOutcome =
  | { readonly ok: true; readonly record: LicenseRecord }
  | { readonly ok: false; readonly error: string };

/**
 * Validates a user-entered license key and activates this device when required
 * by the provider's activation limit.
 */
export async function verifyAndActivateLicense(
  provider: LicenseProvider,
  rawKey: string,
  existingActivationId?: string,
  nowIso: string = new Date().toISOString(),
): Promise<VerifyLicenseOutcome> {
  const trimmedKey = rawKey.trim();
  if (!trimmedKey) {
    return { ok: false, error: LICENSE_ERROR_UNRECOGNISED };
  }

  try {
    const result = await provider.validate(trimmedKey, existingActivationId);

    if (result.requiresActivation && provider.activate) {
      const activated = await provider.activate(trimmedKey, detectDeviceLabel());
      return {
        ok: true,
        record: {
          key: trimmedKey,
          plan: 'pro',
          expiresAt: activated.expiresAt ?? result.expiresAt ?? null,
          lastValidatedAt: nowIso,
          activationId: activated.activationId,
        },
      };
    }

    if (!result.valid) {
      return {
        ok: false,
        error: result.reason ?? LICENSE_ERROR_UNRECOGNISED,
      };
    }

    return {
      ok: true,
      record: {
        key: trimmedKey,
        plan: 'pro',
        expiresAt: result.expiresAt,
        lastValidatedAt: nowIso,
        ...(existingActivationId ? { activationId: existingActivationId } : {}),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : LICENSE_ERROR_OFFLINE;
    if (message === LICENSE_ERROR_UNRECOGNISED) {
      return { ok: false, error: LICENSE_ERROR_UNRECOGNISED };
    }
    return { ok: false, error: LICENSE_ERROR_OFFLINE };
  }
}
