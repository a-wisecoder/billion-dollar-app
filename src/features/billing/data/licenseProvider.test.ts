import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DevLicenseProvider } from './devLicenseProvider';
import {
  LICENSE_ERROR_OFFLINE,
  LICENSE_ERROR_UNRECOGNISED,
  LICENSE_PROXY_HEADER,
  PolarLicenseProvider,
  detectDeviceLabel,
  sanitizeHttpsUrl,
  verifyAndActivateLicense,
} from './licenseProvider';

function jsonRes(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

describe('PolarLicenseProvider', () => {
  it('validates a granted lifetime key and returns valid=true', async () => {
    const calls: string[] = [];
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: 'https://buy.polar.sh/yearly',
      checkoutLifetimeUrl: 'https://buy.polar.sh/lifetime',
      isOnlineFn: () => true,
      fetchImpl: async (url) => {
        calls.push(String(url));
        return jsonRes({
          status: 'granted',
          expires_at: null,
          limit_activations: null,
        });
      },
    });

    assert.equal(provider.checkoutUrl('yearly'), 'https://buy.polar.sh/yearly');
    assert.equal(provider.checkoutUrl('lifetime'), 'https://buy.polar.sh/lifetime');

    const outcome = await verifyAndActivateLicense(
      provider,
      'POLAR-KEY-999',
      undefined,
      '2026-11-21T12:00:00.000Z',
    );
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.record.key, 'POLAR-KEY-999');
      assert.equal(outcome.record.plan, 'pro');
      assert.equal(outcome.record.expiresAt, null);
      assert.equal(outcome.record.lastValidatedAt, '2026-11-21T12:00:00.000Z');
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'https://api.polar.sh/v1/customer-portal/license-keys/validate');
  });

  it('activates device automatically when limit_activations is set and stores activationId', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async (url, init) => {
        const parsed = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        calls.push({ url: String(url), body: parsed });

        if (String(url).endsWith('/validate')) {
          return jsonRes({
            status: 'granted',
            expires_at: '2027-11-21T00:00:00.000Z',
            limit_activations: 3,
            activation: null,
          });
        }
        return jsonRes({
          id: 'act_abc_123',
          license_key: {
            status: 'granted',
            expires_at: '2027-11-21T00:00:00.000Z',
          },
        });
      },
    });

    const outcome = await verifyAndActivateLicense(
      provider,
      'POLAR-ACT-1',
      undefined,
      '2026-11-21T12:00:00.000Z',
    );
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.record.activationId, 'act_abc_123');
      assert.equal(outcome.record.expiresAt, '2027-11-21T00:00:00.000Z');
    }
    assert.equal(calls.length, 2);
    assert.ok(calls[1].url.endsWith('/activate'));
    assert.equal(typeof calls[1].body.label, 'string');
  });

  it('falls back to /api/license/validate when direct Polar request fails with CORS TypeError', async () => {
    const urls: string[] = [];
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async (url) => {
        const s = String(url);
        urls.push(s);
        if (s.startsWith('https://api.polar.sh')) {
          throw new TypeError('Failed to fetch');
        }
        return jsonRes({ status: 'granted', expires_at: null, limit_activations: null });
      },
    });

    const res = await provider.validate('POLAR-CORS-OK');
    assert.equal(res.valid, true);
    assert.deepEqual(urls, [
      'https://api.polar.sh/v1/customer-portal/license-keys/validate',
      '/api/license/validate',
    ]);
  });

  it('rejects revoked, expired, or 404 keys with plain-English error', async () => {
    const revokedProvider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async () => jsonRes({ status: 'revoked', expires_at: null }),
    });
    const revoked = await verifyAndActivateLicense(revokedProvider, 'REVOKED-KEY');
    assert.equal(revoked.ok, false);
    if (!revoked.ok) assert.equal(revoked.error, LICENSE_ERROR_UNRECOGNISED);

    const notFoundProvider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async () => jsonRes({ detail: 'Not found' }, 404),
    });
    const missing = await verifyAndActivateLicense(notFoundProvider, 'BAD-KEY');
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error, LICENSE_ERROR_UNRECOGNISED);
  });

  it('returns plain-English offline message when browser is offline', async () => {
    const offlineProvider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => false,
      fetchImpl: async () => {
        throw new Error('should not be called');
      },
    });

    const outcome = await verifyAndActivateLicense(offlineProvider, 'ANY-KEY');
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.error, LICENSE_ERROR_OFFLINE);
    }
  });

  it('deactivates an activation slot cleanly', async () => {
    let calledDeactivate = false;
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async (url) => {
        if (String(url).endsWith('/deactivate')) {
          calledDeactivate = true;
          return new Response(null, { status: 204 });
        }
        return jsonRes({}, 404);
      },
    });

    await provider.deactivate('POLAR-KEY', 'act_123');
    assert.equal(calledDeactivate, true);
  });

  it('returns unrecognised key error (not offline) when proxy forwards an upstream Polar 404', async () => {
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async (url) => {
        if (String(url).startsWith('https://api.polar.sh')) {
          throw new TypeError('Failed to fetch');
        }
        return jsonRes({ detail: 'License key not found.' }, 404, {
          [LICENSE_PROXY_HEADER]: '1',
        });
      },
    });

    const outcome = await verifyAndActivateLicense(provider, 'WRONG-KEY');
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.error, LICENSE_ERROR_UNRECOGNISED);
    }
  });

  it('returns offline error when proxy route itself is missing (non-proxy 404)', async () => {
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async (url) => {
        if (String(url).startsWith('https://api.polar.sh')) {
          throw new TypeError('Failed to fetch');
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    const outcome = await verifyAndActivateLicense(provider, 'ANY-KEY');
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.error, LICENSE_ERROR_OFFLINE);
    }
  });

  it('rejects a granted Polar key whose expires_at timestamp is already in the past', async () => {
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async () =>
        jsonRes({
          status: 'granted',
          expires_at: '2020-01-01T00:00:00.000Z',
          limit_activations: null,
        }),
    });

    const outcome = await verifyAndActivateLicense(provider, 'EXPIRED-GRANTED-KEY');
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.error, LICENSE_ERROR_UNRECOGNISED);
    }
  });

  it('triggers activate() when Polar validate returns 422 requiring activation', async () => {
    const calls: string[] = [];
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async (url) => {
        const s = String(url);
        calls.push(s);
        if (s.endsWith('/validate')) {
          return jsonRes({ detail: 'Activation is required for this license key.' }, 422);
        }
        return jsonRes({
          id: 'act_from_422',
          license_key: {
            status: 'granted',
            expires_at: null,
          },
        });
      },
    });

    const outcome = await verifyAndActivateLicense(
      provider,
      'POLAR-422-KEY',
      undefined,
      '2026-11-21T12:00:00.000Z',
    );
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.record.activationId, 'act_from_422');
      assert.equal(outcome.record.expiresAt, null);
    }
    assert.equal(calls.length, 2);
    assert.ok(calls[1].endsWith('/activate'));
  });

  it('returns offline retry error when Polar returns a 500 server error', async () => {
    const provider = new PolarLicenseProvider({
      orgId: 'org_test_123',
      checkoutYearlyUrl: '',
      checkoutLifetimeUrl: '',
      isOnlineFn: () => true,
      fetchImpl: async () => jsonRes({ detail: 'Internal Server Error' }, 500),
    });

    const outcome = await verifyAndActivateLicense(provider, 'SERVER-ERR-KEY');
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.error, LICENSE_ERROR_OFFLINE);
    }
  });
});

describe('DevLicenseProvider & helpers', () => {
  it('accepts DEV-PRO- keys and rejects others', async () => {
    const dev = new DevLicenseProvider();
    const ok = await verifyAndActivateLicense(dev, 'DEV-PRO-123');
    assert.equal(ok.ok, true);

    const bad = await verifyAndActivateLicense(dev, 'RANDOM-123');
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.error, LICENSE_ERROR_UNRECOGNISED);
  });

  it('rejects non-HTTPS checkout URLs and detects device labels', () => {
    assert.equal(sanitizeHttpsUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeHttpsUrl('http://example.com'), '');
    assert.equal(sanitizeHttpsUrl('https://buy.polar.sh/test'), 'https://buy.polar.sh/test');
    assert.equal(
      detectDeviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'),
      'Chrome on macOS',
    );
  });
});
