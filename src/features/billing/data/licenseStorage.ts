import type { LicenseRecord } from '../domain/entitlements';

export const LICENSE_STORAGE_KEY = 'vaultflow_license_v1';

export function loadLicenseRecord(): LicenseRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    if (
      typeof record.key !== 'string' ||
      !record.key.trim() ||
      record.plan !== 'pro' ||
      typeof record.lastValidatedAt !== 'string'
    ) {
      return null;
    }

    const expiresAt =
      record.expiresAt === null || typeof record.expiresAt === 'string'
        ? record.expiresAt
        : null;
    const activationId =
      typeof record.activationId === 'string' && record.activationId.trim()
        ? record.activationId.trim()
        : undefined;

    return {
      key: record.key.trim(),
      plan: 'pro',
      expiresAt,
      lastValidatedAt: record.lastValidatedAt,
      ...(activationId ? { activationId } : {}),
    };
  } catch {
    return null;
  }
}

export function saveLicenseRecord(record: LicenseRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota / privacy mode write errors
  }
}

export function clearLicenseRecord(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
