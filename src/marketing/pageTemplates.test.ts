import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SERVICE_CATALOG } from '../features/catalog/domain/serviceCatalog';
import {
  buildAppHtml,
  buildCancelPageHtml,
  buildCloudflareHeaders,
  buildLandingPageHtml,
  buildPlanComparisonRows,
  buildPricingPageHtml,
  buildPrivacyPageHtml,
  buildRefundsPageHtml,
  buildRobotsTxt,
  buildSitemapXml,
  buildTermsPageHtml,
  escapeHtml,
  getCancelGuideServices,
  normalizeSiteUrl,
} from './pageTemplates';

function assertSeoConstraints(html: string, label: string): void {
  const h1Matches = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? [];
  assert.equal(h1Matches.length, 1, `${label}: expected exactly 1 <h1>, found ${h1Matches.length}`);

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  assert.ok(titleMatch, `${label}: missing <title>`);
  const titleText = titleMatch[1].replace(/&amp;/g, '&').trim();
  assert.ok(
    titleText.length > 0 && titleText.length <= 60,
    `${label}: title "${titleText}" exceeds 60 chars (${titleText.length})`,
  );

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  assert.ok(descMatch, `${label}: missing meta description`);
  const descText = descMatch[1].replace(/&amp;/g, '&').trim();
  assert.ok(
    descText.length > 0 && descText.length <= 155,
    `${label}: meta description exceeds 155 chars (${descText.length})`,
  );

  assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/[^"]+"/i, `${label}: missing canonical`);
  assert.match(html, /property="og:image"\s+content="https:\/\/[^"]+\/og-image\.png"/i, `${label}: missing og:image`);
  assert.match(html, /name="twitter:card"\s+content="summary_large_image"/i, `${label}: missing twitter card`);
}

describe('static public website & SEO templates', () => {
  const siteUrl = normalizeSiteUrl('https://vaultflow.app/');

  it('normalizes SITE_URL safely and builds all static pages with valid SEO metadata', () => {
    assert.equal(siteUrl, 'https://vaultflow.app');
    assert.equal(normalizeSiteUrl(''), 'https://vaultflow.app');

    const landing = buildLandingPageHtml(siteUrl);
    assertSeoConstraints(landing, 'landing');
    assert.match(landing, /"@type":"SoftwareApplication"/);
    assert.match(landing, /Find every subscription you pay for — without connecting your bank\./);
    assert.match(landing, /\/screens\/1\.png/);
    assert.match(landing, /\/screens\/2\.png/);
    assert.match(landing, /\/screens\/3\.png/);

    assertSeoConstraints(buildPricingPageHtml(siteUrl), 'pricing');
    assertSeoConstraints(buildPrivacyPageHtml(siteUrl), 'privacy');
    assertSeoConstraints(buildTermsPageHtml(siteUrl), 'terms');
    assertSeoConstraints(buildRefundsPageHtml(siteUrl), 'refunds');

    const appHtml = buildAppHtml(siteUrl);
    assert.match(appHtml, /<title>[^<]+<\/title>/);
    assert.match(appHtml, /rel="canonical" href="https:\/\/vaultflow\.app\/app\/"/);
  });

  it('generates cancel pages only for services with cancelUrl or cancelSteps and enforces SEO limits on every single one', () => {
    const cancelServices = getCancelGuideServices(SERVICE_CATALOG);
    assert.ok(cancelServices.length > 50, 'expected substantial catalog cancel guide coverage');

    for (const service of cancelServices) {
      assert.ok(
        Boolean(service.cancelUrl || (service.cancelSteps && service.cancelSteps.length > 0)),
        `${service.id} should not be included without cancelUrl or cancelSteps`,
      );
      const html = buildCancelPageHtml(service, siteUrl, cancelServices);
      assertSeoConstraints(html, `cancel/${service.id}`);
      const escapedName = escapeHtml(service.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(html, new RegExp(`How to cancel ${escapedName}`));
      assert.match(html, /Track all your subscriptions free/);

      if (service.lastChecked) {
        assert.match(html, /Last checked:/);
      } else {
        assert.doesNotMatch(html, /Last checked:/);
      }
    }

    // Verify lastChecked renders when present
    const sampleWithChecked = {
      ...cancelServices[0],
      lastChecked: '2026-11-20',
    };
    const checkedHtml = buildCancelPageHtml(sampleWithChecked, siteUrl, cancelServices);
    assert.match(checkedHtml, /Last checked: 2026-11-20/);
  });

  it('derives Free vs Pro comparison rows from entitlements and omits forbidden jargon', () => {
    const rows = buildPlanComparisonRows();
    assert.ok(rows.some((r) => r.free.includes('Up to 8 active') && r.pro === 'Unlimited'));

    const allStatic = [
      buildLandingPageHtml(siteUrl),
      buildPricingPageHtml(siteUrl),
      buildPrivacyPageHtml(siteUrl),
      buildTermsPageHtml(siteUrl),
      buildRefundsPageHtml(siteUrl),
    ].join('\n');

    for (const banned of [/\bburn\b/i, /\brunway\b/i, /\bleak\b/i, /\bradar\b/i, /\bceiling\b/i]) {
      assert.doesNotMatch(allStatic, banned, `Forbidden jargon matched: ${banned}`);
    }
  });

  it('builds sitemap.xml, robots.txt, and CSP _headers with optional analytics origin', () => {
    const cancelServices = getCancelGuideServices(SERVICE_CATALOG);
    const sitemap = buildSitemapXml(siteUrl, cancelServices);
    assert.match(sitemap, /<loc>https:\/\/vaultflow\.app\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/vaultflow\.app\/pricing\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/vaultflow\.app\/cancel\/netflix\/<\/loc>/);

    const robots = buildRobotsTxt(siteUrl);
    assert.match(robots, /Sitemap: https:\/\/vaultflow\.app\/sitemap\.xml/);

    const defaultHeaders = buildCloudflareHeaders();
    assert.match(
      defaultHeaders,
      /Content-Security-Policy: default-src 'self'; connect-src 'self' https:\/\/open\.er-api\.com https:\/\/api\.polar\.sh; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'/,
    );
    assert.match(defaultHeaders, /Referrer-Policy: strict-origin-when-cross-origin/);
    assert.match(defaultHeaders, /X-Content-Type-Options: nosniff/);
    assert.match(defaultHeaders, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)/);

    const analyticsHeaders = buildCloudflareHeaders(
      'https://plausible.io/js/script.js',
      'vaultflow.app',
    );
    assert.match(analyticsHeaders, /script-src 'self' https:\/\/plausible\.io;/);
    assert.match(
      analyticsHeaders,
      /connect-src 'self' https:\/\/open\.er-api\.com https:\/\/api\.polar\.sh https:\/\/plausible\.io;/,
    );
  });
});
