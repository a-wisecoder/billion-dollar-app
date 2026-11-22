import type {
  LicenseActivationResult,
  LicensePlanOption,
  LicenseProvider,
  LicenseValidationResult,
} from './licenseProvider';

const DEV_KEY_PREFIX = 'DEV-PRO-';

/**
 * Development-only license provider.
 * Imported exclusively behind `import.meta.env.DEV` so Vite strips this module
 * and its key prefix completely from production bundles.
 */
export class DevLicenseProvider implements LicenseProvider {
  checkoutUrl(_plan: LicensePlanOption): string {
    return '';
  }

  async validate(key: string): Promise<LicenseValidationResult> {
    const trimmed = key.trim();
    if (trimmed.startsWith(DEV_KEY_PREFIX) && trimmed.length > DEV_KEY_PREFIX.length) {
      return { valid: true, expiresAt: null };
    }
    return {
      valid: false,
      expiresAt: null,
      reason: "That key wasn't recognised.",
    };
  }

  async activate(key: string, _label: string): Promise<LicenseActivationResult> {
    const check = await this.validate(key);
    if (!check.valid) {
      throw new Error("That key wasn't recognised.");
    }
    return {
      activationId: `dev_act_${Date.now()}`,
      expiresAt: null,
    };
  }

  async deactivate(_key: string, _activationId: string): Promise<void> {
    // No remote state to clear in development mode.
  }
}
