import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_EVENTS,
  initAnalytics,
  parseAnalyticsConfig,
  trackEvent,
  type AnalyticsEventName,
} from './analytics';

describe('cookie-less analytics', () => {
  it('returns null unless both valid https src and domain are set', () => {
    assert.equal(parseAnalyticsConfig(undefined, undefined), null);
    assert.equal(parseAnalyticsConfig('https://plausible.io/js/script.js', ''), null);
    assert.equal(parseAnalyticsConfig('', 'vaultflow.app'), null);
    assert.equal(parseAnalyticsConfig('http://plausible.io/js/script.js', 'vaultflow.app'), null);
    assert.equal(parseAnalyticsConfig('not-a-url', 'vaultflow.app'), null);
  });

  it('auto-detects Plausible and Umami providers accurately', () => {
    const plausible = parseAnalyticsConfig(
      'https://plausible.io/js/script.js',
      'vaultflow.app',
    );
    assert.deepEqual(plausible, {
      src: 'https://plausible.io/js/script.js',
      domain: 'vaultflow.app',
      origin: 'https://plausible.io',
      provider: 'plausible',
    });

    const umamiByUuid = parseAnalyticsConfig(
      'https://analytics.example.com/script.js',
      '123e4567-e89b-12d3-a456-426614174000',
    );
    assert.equal(umamiByUuid?.provider, 'umami');

    const umamiByHost = parseAnalyticsConfig(
      'https://cloud.umami.is/script.js',
      'site-123',
    );
    assert.equal(umamiByHost?.provider, 'umami');
  });

  it('injects no script when config is null, and injects once with proper attribute when set', () => {
    const appended: Array<{
      defer: boolean;
      src: string;
      attrs: Record<string, string>;
    }> = [];

    const mockDoc = {
      head: {
        querySelector: () => (appended.length > 0 ? appended[0] : null),
        appendChild: (el: { defer: boolean; src: string; attrs: Record<string, string> }) => {
          appended.push(el);
          return el;
        },
      },
      createElement: () => {
        const el = {
          defer: false,
          src: '',
          attrs: {} as Record<string, string>,
          setAttribute(k: string, v: string) {
            this.attrs[k] = v;
          },
        };
        return el;
      },
    } as unknown as Document;

    assert.equal(initAnalytics(null, mockDoc), false);
    assert.equal(appended.length, 0);

    const cfg = parseAnalyticsConfig('https://plausible.io/js/script.js', 'vaultflow.app');
    assert.equal(initAnalytics(cfg, mockDoc), true);
    assert.equal(appended.length, 1);
    assert.equal(appended[0].defer, true);
    assert.equal(appended[0].src, 'https://plausible.io/js/script.js');
    assert.equal(appended[0].attrs['data-domain'], 'vaultflow.app');

    // Second call is idempotent
    assert.equal(initAnalytics(cfg, mockDoc), false);
    assert.equal(appended.length, 1);
  });

  it('dispatches only allowlisted event names with zero extra payload to Plausible or Umami', () => {
    const plausibleCalls: unknown[][] = [];
    const plausibleWin = {
      plausible: (...args: unknown[]) => {
        plausibleCalls.push(args);
      },
    };

    for (const evt of ANALYTICS_EVENTS) {
      assert.equal(trackEvent(evt, plausibleWin), true);
    }
    assert.equal(plausibleCalls.length, ANALYTICS_EVENTS.length);
    assert.ok(plausibleCalls.every((args) => args.length === 1));

    const umamiCalls: unknown[][] = [];
    const umamiWin = {
      umami: {
        track: (...args: unknown[]) => {
          umamiCalls.push(args);
        },
      },
    };
    assert.equal(trackEvent('calendar_exported', umamiWin), true);
    assert.deepEqual(umamiCalls, [['calendar_exported']]);

    // Unknown event rejected
    assert.equal(
      trackEvent('unknown_event' as AnalyticsEventName, plausibleWin),
      false,
    );
    // No provider loaded -> safe no-op
    assert.equal(trackEvent('subscription_added', {}), false);
  });
});
