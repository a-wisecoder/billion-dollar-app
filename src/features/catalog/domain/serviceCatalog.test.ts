import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CATEGORIES, CATEGORY_LIST } from '../../cashflow/domain/subscription';
import {
  detectCurrencyFromLocale,
  detectDefaultDateOrder,
} from '../../onboarding/domain/localeCurrency';
import {
  SERVICE_CATALOG,
  inferCategoryFromMerchantName,
  matchCatalogByMerchant,
  searchServiceCatalog,
} from './serviceCatalog';

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastOnWhite(hex: string): number {
  return (1 + 0.05) / (relativeLuminance(hex) + 0.05);
}

test('serviceCatalog includes human-check comment, ~100 unique entries, and required global + Pakistani providers', () => {
  const filePath = path.resolve(
    process.cwd(),
    'src/features/catalog/domain/serviceCatalog.ts',
  );
  const source = fs.readFileSync(filePath, 'utf8');
  assert.ok(
    source.startsWith('// Prices and cancel links must be checked by a human before launch.'),
    'Catalog file must start with the required human-check comment',
  );

  assert.ok(
    SERVICE_CATALOG.length >= 90,
    `Expected ~100 catalog entries, got ${SERVICE_CATALOG.length}`,
  );

  const ids = new Set<string>();
  for (const entry of SERVICE_CATALOG) {
    assert.ok(!ids.has(entry.id), `Duplicate catalog id: ${entry.id}`);
    ids.add(entry.id);
    assert.equal(entry.lastChecked, undefined, `lastChecked must be undefined for ${entry.id}`);
    assert.equal(entry.cancelSteps, undefined, `cancelSteps must not be invented for ${entry.id}`);
  }

  const requiredIds = [
    'netflix',
    'spotify',
    'youtube-premium',
    'amazon-prime',
    'disney-plus',
    'apple-one',
    'icloud-plus',
    'google-one',
    'microsoft-365',
    'adobe-creative-cloud',
    'canva-pro',
    'chatgpt-plus',
    'claude-pro',
    'gemini',
    'github-copilot',
    'cursor',
    'notion',
    'figma',
    'dropbox',
    'linkedin-premium',
    'duolingo',
    'xbox-game-pass',
    'playstation-plus',
    'ptcl',
    'stormfiber',
    'nayatel',
    'jazz',
    'zong',
    'telenor',
    'ufone',
  ];

  for (const id of requiredIds) {
    assert.ok(ids.has(id), `Missing required service in catalog: ${id}`);
  }
});

test('every catalog cancelUrl is HTTPS and stays on the service own official domain', () => {
  const forbiddenThirdPartyHosts = [
    'rocketmoney.com',
    'truebill.com',
    'donotpay.com',
    'trim.com',
    'wikihow.com',
    'wikipedia.org',
    'google.com', // checked specifically below for Google-owned services only
  ];

  const googleOwnedIds = new Set([
    'google-one',
    'gemini',
    'nest-aware',
    'youtube-premium',
    'youtube-music',
  ]);

  for (const entry of SERVICE_CATALOG) {
    if (!entry.cancelUrl) continue;
    const url = new URL(entry.cancelUrl);
    assert.equal(url.protocol, 'https:', `cancelUrl must be HTTPS for ${entry.id}`);
    const host = url.hostname.toLowerCase();

    for (const bad of forbiddenThirdPartyHosts) {
      if (bad === 'google.com' && googleOwnedIds.has(entry.id)) continue;
      assert.ok(
        !host.endsWith(bad),
        `cancelUrl for ${entry.id} must not point to third-party host ${host}`,
      );
    }
  }
});

test('all 14 categories have valid distinct colors with at least 3:1 contrast on white and unknown merchants infer other', () => {
  assert.equal(CATEGORY_LIST.length, 14);
  const seenColors = new Set<string>();
  for (const cat of CATEGORY_LIST) {
    const meta = CATEGORIES[cat];
    assert.ok(meta, `Missing metadata for category ${cat}`);
    assert.ok(!seenColors.has(meta.color.toUpperCase()), `Duplicate color for ${cat}`);
    seenColors.add(meta.color.toUpperCase());
    const ratio = contrastOnWhite(meta.color);
    assert.ok(ratio >= 3, `Category ${cat} (${meta.color}) has low contrast on white: ${ratio}`);
  }

  assert.equal(inferCategoryFromMerchantName('Acme Mystery Club'), 'other');
  assert.equal(inferCategoryFromMerchantName('SPOTIFY USA'), 'music');
  assert.equal(inferCategoryFromMerchantName('PTCL Flash Fiber'), 'phoneInternet');
  assert.equal(matchCatalogByMerchant('OPENAI *CHATGPT SUBSCR')?.id, 'chatgpt-plus');
  assert.ok(searchServiceCatalog('storm').some((s) => s.id === 'stormfiber'));
});

test('detectCurrencyFromLocale and detectDefaultDateOrder map timezones and locales accurately', () => {
  assert.equal(detectCurrencyFromLocale('Asia/Karachi', 'en-PK'), 'PKR');
  assert.equal(detectCurrencyFromLocale('Asia/Dubai', 'en-AE'), 'AED');
  assert.equal(detectCurrencyFromLocale('Europe/London', 'en-GB'), 'GBP');
  assert.equal(detectCurrencyFromLocale('Europe/Berlin', 'de-DE'), 'EUR');
  assert.equal(detectCurrencyFromLocale('Europe/Paris', 'fr-FR'), 'EUR');
  assert.equal(detectCurrencyFromLocale('America/New_York', 'en-US'), 'USD');
  assert.equal(detectDefaultDateOrder('en-US'), 'MDY');
  assert.equal(detectDefaultDateOrder('en-GB'), 'DMY');
  assert.equal(detectDefaultDateOrder('en-PK'), 'DMY');
});
