import {
  parseAnalyticsConfig,
} from '../core/analytics/analytics';
import { formatMinorUnits } from '../core/utils/moneyFormatter';
import {
  FREE_MAX_ACTIVE_SUBSCRIPTIONS,
  PLAN_LIMITS,
} from '../features/billing/domain/entitlements';
import {
  BILLING_CYCLES,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type CurrencyCode,
} from '../features/cashflow/domain/subscription';
import {
  SERVICE_CATALOG,
  type ServiceCatalogEntry,
} from '../features/catalog/domain/serviceCatalog';

export const DEFAULT_SITE_URL = 'https://vaultflow.app';

export function normalizeSiteUrl(raw?: string): string {
  const candidate = (raw ?? '').trim();
  if (!candidate) return DEFAULT_SITE_URL;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_SITE_URL;
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncateSeo(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const base = lastSpace > Math.floor(maxLength * 0.6) ? sliced.slice(0, lastSpace) : sliced;
  return `${base.replace(/[.,;:\-—\s]+$/, '')}…`;
}

export function hasCancelGuideData(entry: ServiceCatalogEntry): boolean {
  return Boolean(
    (entry.cancelUrl && entry.cancelUrl.trim().length > 0) ||
      (entry.cancelSteps && entry.cancelSteps.length > 0),
  );
}

export function getCancelGuideServices(
  catalog: readonly ServiceCatalogEntry[] = SERVICE_CATALOG,
): ServiceCatalogEntry[] {
  return catalog.filter(hasCancelGuideData);
}

export interface PlanComparisonRow {
  readonly feature: string;
  readonly free: string;
  readonly pro: string;
}

/**
 * Derives the public Free vs Pro comparison rows directly from entitlements.ts PLAN_LIMITS.
 */
export function buildPlanComparisonRows(): readonly PlanComparisonRow[] {
  const freeMax = PLAN_LIMITS.free.maxActiveSubscriptions;
  const proUnlimited = !Number.isFinite(PLAN_LIMITS.pro.maxActiveSubscriptions);
  return [
    {
      feature: 'Active subscriptions',
      free: `Up to ${freeMax} active`,
      pro: proUnlimited ? 'Unlimited' : `Up to ${PLAN_LIMITS.pro.maxActiveSubscriptions}`,
    },
    {
      feature: 'Bank statement import (CSV & card SMS)',
      free: PLAN_LIMITS.free.statementImport === 'preview' ? 'Full preview + add 1 by 1' : 'Full',
      pro: PLAN_LIMITS.pro.statementImport === 'full' ? 'One-click bulk import' : 'Preview',
    },
    {
      feature: 'Calendar export (.ics) & reminders',
      free: 'Included',
      pro: 'Included',
    },
    {
      feature: '16 currencies with daily exchange rates',
      free: 'Included',
      pro: 'Included',
    },
    {
      feature: 'CSV export for Excel & Google Sheets',
      free: PLAN_LIMITS.free.csvExport ? 'Included' : 'Not included',
      pro: PLAN_LIMITS.pro.csvExport ? 'Included' : 'Not included',
    },
    {
      feature: 'Custom exchange rates & card FX markup',
      free: PLAN_LIMITS.free.customRatesAndMarkup ? 'Included' : 'Not included',
      pro: PLAN_LIMITS.pro.customRatesAndMarkup ? 'Included' : 'Not included',
    },
    {
      feature: 'Local JSON backup & offline PWA',
      free: 'Included',
      pro: 'Included',
    },
  ];
}

function renderPlanComparisonTable(): string {
  const rows = buildPlanComparisonRows();
  return `
    <div class="overflow-x-auto rounded-2xl app-surface">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-border bg-subtle/60">
            <th scope="col" class="py-4 px-4 sm:px-6 text-xs font-semibold text-text-secondary">Feature</th>
            <th scope="col" class="py-4 px-4 sm:px-6 text-xs font-mono font-bold text-text-primary tabular-nums">Free · $0</th>
            <th scope="col" class="py-4 px-4 sm:px-6 text-xs font-mono font-bold text-brand-text tabular-nums bg-brand-soft/40">Pro · $19/yr or $39 once</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/80 text-[14px] sm:text-[15px]">
          ${rows
            .map(
              (row) => `
          <tr class="hover:bg-subtle/35 transition-colors">
            <td class="py-3.5 px-4 sm:px-6 font-medium text-text-primary">${escapeHtml(row.feature)}</td>
            <td class="py-3.5 px-4 sm:px-6 text-text-secondary tabular-nums">${escapeHtml(row.free)}</td>
            <td class="py-3.5 px-4 sm:px-6 font-semibold text-text-primary tabular-nums bg-brand-soft/25">${escapeHtml(row.pro)}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function renderBrandMark(): string {
  return `<span class="w-7 h-7 rounded-[9px] bg-brand text-white inline-flex items-center justify-center shadow-[0_1px_3px_rgba(15,107,84,0.3),inset_0_1px_0_rgba(255,255,255,0.22)] shrink-0" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2.5 4.25L8 12.75L13.5 4.25" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="4.25" r="1.4" fill="currentColor"/></svg></span>`;
}

function renderScreenFrame(
  src: string,
  alt: string,
  routeLabel: string,
  eager = false,
): string {
  return `
    <div class="rounded-2xl app-surface-elevated overflow-hidden">
      <div class="h-9 px-3.5 border-b border-border bg-subtle/60 flex items-center justify-between gap-2" aria-hidden="true">
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-border-strong/75"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-border-strong/75"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-border-strong/75"></span>
        </div>
        <span class="font-mono text-xs text-text-secondary truncate">${escapeHtml(routeLabel)}</span>
        <span class="w-10"></span>
      </div>
      <div class="p-1.5 sm:p-2 bg-page/60">
        <img
          src="${escapeHtml(src)}"
          alt="${escapeHtml(alt)}"
          width="1200"
          height="820"
          ${eager ? 'decoding="async" fetchpriority="high"' : 'loading="lazy" decoding="async"'}
          class="w-full h-auto rounded-xl border border-border/80 block bg-subtle"
        />
      </div>
    </div>`;
}

interface PageShellOptions {
  readonly siteUrl: string;
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly bodyHtml: string;
  readonly jsonLd?: Record<string, unknown>;
  readonly activeNav?: 'how' | 'pricing' | 'privacy' | 'faq' | 'none';
}

function renderHeader(activeNav: PageShellOptions['activeNav'] = 'none'): string {
  const navLinkClass = (active: boolean) =>
    `px-3 py-2 rounded-lg text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
      active
        ? 'text-text-primary underline underline-offset-[10px] decoration-2 decoration-brand'
        : 'text-text-secondary hover:text-text-primary hover:bg-subtle/60'
    }`;

  return `
  <header class="sticky top-0 z-30 bg-page/85 backdrop-blur-xl border-b border-border/80">
    <div class="max-w-5xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-6">
      <a href="/" class="inline-flex items-center gap-2.5 text-text-primary whitespace-nowrap shrink-0">
        ${renderBrandMark()}
        <span class="font-display text-[19px] font-bold tracking-[-0.025em]">VaultFlow</span>
      </a>

      <nav class="hidden md:flex items-center gap-1" aria-label="Primary navigation">
        <a href="/#how-it-works" class="${navLinkClass(activeNav === 'how')}">How it works</a>
        <a href="/pricing/" class="${navLinkClass(activeNav === 'pricing')}">Pricing</a>
        <a href="/privacy/" class="${navLinkClass(activeNav === 'privacy')}">Privacy</a>
        <a href="/#faq" class="${navLinkClass(activeNav === 'faq')}">FAQ</a>
      </nav>

      <div class="flex items-center shrink-0">
        <a
          href="/app/"
          class="min-h-[42px] px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-[14px] font-semibold text-white inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-colors shadow-[0_1px_2px_rgba(11,86,67,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]"
        >Start free</a>
      </div>
    </div>
  </header>`;
}

function renderFooter(): string {
  return `
  <footer class="border-t border-border bg-card mt-20">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      <div>
        <a href="/" class="inline-flex items-center gap-2 text-text-primary">
          ${renderBrandMark()}
          <span class="font-display text-base font-bold tracking-[-0.02em]">VaultFlow</span>
        </a>
        <p class="mt-2 text-[13px] text-text-secondary">
          Subscription tracking that stays on your device.
        </p>
      </div>
      <nav aria-label="Footer navigation" class="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] font-medium text-text-secondary">
        <a href="/pricing/" class="min-h-[44px] inline-flex items-center hover:text-text-primary transition-colors">Pricing</a>
        <a href="/privacy/" class="min-h-[44px] inline-flex items-center hover:text-text-primary transition-colors">Privacy</a>
        <a href="/terms/" class="min-h-[44px] inline-flex items-center hover:text-text-primary transition-colors">Terms</a>
        <a href="/refunds/" class="min-h-[44px] inline-flex items-center hover:text-text-primary transition-colors">Refunds</a>
        <a href="mailto:[CONTACT EMAIL]" class="min-h-[44px] inline-flex items-center hover:text-text-primary transition-colors">Contact</a>
      </nav>
    </div>
  </footer>`;
}

function renderDocument(opts: PageShellOptions): string {
  const safeTitle = truncateSeo(opts.title, 60);
  const safeDesc = truncateSeo(opts.description, 155);
  const canonicalPath = opts.path.startsWith('/') ? opts.path : `/${opts.path}`;
  const canonicalUrl = `${opts.siteUrl}${canonicalPath}`;
  const ogImageUrl = `${opts.siteUrl}/og-image.png`;
  const jsonLdTag = opts.jsonLd
    ? `\n    <script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(safeTitle)}</title>
    <meta name="description" content="${escapeHtml(safeDesc)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VaultFlow" />
    <meta property="og:title" content="${escapeHtml(safeTitle)}" />
    <meta property="og:description" content="${escapeHtml(safeDesc)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(safeTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(safeDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="theme-color" content="#0F6B54" />
    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
    <script src="/theme-init.js"></script>${jsonLdTag}
  </head>
  <body class="app-canvas text-text-primary antialiased selection:bg-brand/15 selection:text-text-primary min-h-screen flex flex-col">
    ${renderHeader(opts.activeNav)}
    <main class="flex-1 w-full">
      ${opts.bodyHtml}
    </main>
    ${renderFooter()}
    <script type="module" src="/src/marketing/site.ts"></script>
  </body>
</html>
`;
}

export function buildAppHtml(siteUrl: string): string {
  const canonicalUrl = `${siteUrl}/app/`;
  const ogImageUrl = `${siteUrl}/og-image.png`;
  const title = 'VaultFlow App — Your Subscriptions & Renewals';
  const description =
    'Track every subscription, convert currencies automatically, and get renewal reminders on your device without connecting your bank.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VaultFlow" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="theme-color" content="#0F6B54" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="VaultFlow" />
    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
    <script src="/theme-init.js"></script>
  </head>
  <body class="bg-page text-text-primary antialiased selection:bg-brand/15 selection:text-text-primary">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

export function buildLandingPageHtml(
  siteUrl: string,
  catalog: readonly ServiceCatalogEntry[] = SERVICE_CATALOG,
): string {
  const featuredIds = [
    'netflix',
    'spotify',
    'youtube-premium',
    'chatgpt-plus',
    'claude-pro',
    'amazon-prime',
    'icloud-plus',
    'adobe-creative-cloud',
    'ptcl',
    'stormfiber',
    'nayatel',
    'jazz',
  ];
  const cancelGuides = getCancelGuideServices(catalog);
  const featuredGuides = featuredIds
    .map((id) => cancelGuides.find((entry) => entry.id === id))
    .filter((entry): entry is ServiceCatalogEntry => Boolean(entry));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'VaultFlow',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, iOS, Android, macOS, Windows',
    url: `${siteUrl}/`,
    description:
      'Find every subscription you pay for without connecting your bank. Paste a statement or pick from 100+ services and get reminded before every renewal.',
    offers: [
      {
        '@type': 'Offer',
        name: 'VaultFlow Free',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'VaultFlow Pro (Yearly)',
        price: '19',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'VaultFlow Pro (Lifetime)',
        price: '39',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    ],
  };

  const bodyHtml = `
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 app-hero-grid opacity-70" aria-hidden="true"></div>
      <div class="relative max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-14 sm:pb-20">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div class="lg:col-span-6 space-y-6">
            <h1 class="font-display text-[2.2rem] sm:text-[3.05rem] leading-[1.06] font-bold tracking-[-0.03em] text-text-primary [text-wrap:balance]">
              Find every subscription you pay for — without connecting your bank.
            </h1>
            <p class="text-[16px] sm:text-[17px] leading-relaxed text-text-secondary max-w-xl">
              Paste a statement or pick from 100+ services. Get reminded before every renewal. Your data stays on your device.
            </p>
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="/app/"
                class="min-h-[48px] px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white inline-flex items-center justify-center whitespace-nowrap transition-colors shadow-[0_2px_8px_rgba(15,107,84,0.28),inset_0_1px_0_rgba(255,255,255,0.2)]"
              >Start free</a>
              <a
                href="#how-it-works"
                class="min-h-[48px] px-5 py-3 rounded-xl bg-card border border-border hover:border-border-strong hover:bg-subtle/60 text-[15px] font-semibold text-text-primary inline-flex items-center justify-center whitespace-nowrap transition-colors shadow-[0_1px_2px_rgba(15,26,23,0.04)]"
              >See how it works</a>
            </div>
            <p class="text-[13px] font-medium text-text-secondary">
              Free up to ${FREE_MAX_ACTIVE_SUBSCRIPTIONS} subscriptions · No account required · Works offline
            </p>
          </div>

          <div class="lg:col-span-6">
            ${renderScreenFrame(
              '/screens/1.png',
              'VaultFlow home screen showing monthly subscription totals, upcoming renewals, and multi-currency plans',
              'vaultflow.app/app/#home',
              true,
            )}
          </div>
        </div>
      </div>
    </section>

    <!-- 3 Steps -->
    <section id="how-it-works" class="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-t border-border">
      <div class="max-w-2xl">
        <h2 class="font-display text-2xl sm:text-[34px] font-bold tracking-[-0.025em] text-text-primary [text-wrap:balance] leading-tight">
          Set up in 60 seconds, stay ahead all year
        </h2>
        <p class="mt-3 text-[15px] sm:text-[16px] text-text-secondary leading-relaxed">
          No Plaid tokens, no bank credentials, and no spreadsheet maintenance.
        </p>
      </div>

      <div class="mt-12 space-y-16 sm:space-y-20">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div class="lg:col-span-5 space-y-3">
            <p class="font-mono text-xs font-bold text-brand-text tabular-nums">01 · ADD IN SECONDS</p>
            <h3 class="font-display text-xl sm:text-[26px] font-bold text-text-primary tracking-[-0.02em] leading-snug">
              Pick from 100+ services or paste a bank statement
            </h3>
            <p class="text-[15px] leading-relaxed text-text-secondary">
              Search Netflix, Spotify, ChatGPT, PTCL, StormFiber, Jazz, and dozens more — or drop in a CSV export or card SMS alert to spot recurring charges automatically.
            </p>
          </div>
          <div class="lg:col-span-7">
            ${renderScreenFrame(
              '/screens/2.png',
              'VaultFlow statement import and insights screen detecting recurring subscriptions locally in the browser',
              'vaultflow.app/app/#insights',
            )}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div class="lg:col-span-5 lg:order-2 space-y-3">
            <p class="font-mono text-xs font-bold text-brand-text tabular-nums">02 · MULTI-CURRENCY CLARITY</p>
            <h3 class="font-display text-xl sm:text-[26px] font-bold text-text-primary tracking-[-0.02em] leading-snug">
              See USD, EUR, GBP, and PKR together
            </h3>
            <p class="text-[15px] leading-relaxed text-text-secondary">
              Paying for USD software on a PKR or local card? VaultFlow converts 16 currencies using daily exchange rates, with optional custom rates and bank card markup in Pro.
            </p>
          </div>
          <div class="lg:col-span-7 lg:order-1">
            ${renderScreenFrame(
              '/screens/1.png',
              'VaultFlow subscription list displaying exact monthly averages, next 14 days due, and category breakdown',
              'vaultflow.app/app/#home',
            )}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div class="lg:col-span-5 space-y-3">
            <p class="font-mono text-xs font-bold text-brand-text tabular-nums">03 · PROACTIVE REMINDERS</p>
            <h3 class="font-display text-xl sm:text-[26px] font-bold text-text-primary tracking-[-0.02em] leading-snug">
              Reminders that actually reach your phone
            </h3>
            <p class="text-[15px] leading-relaxed text-text-secondary">
              Export your renewal schedule to Apple Calendar, Google Calendar, or Outlook (.ics) with alarms 1 to 3 days before every charge — plus free-trial warnings before you get billed.
            </p>
          </div>
          <div class="lg:col-span-7">
            ${renderScreenFrame(
              '/screens/3.png',
              'VaultFlow calendar view highlighting upcoming renewal dates and monthly due totals',
              'vaultflow.app/app/#calendar',
            )}
          </div>
        </div>
      </div>
    </section>

    <!-- Privacy Section: Asymmetric Bento Layout -->
    <section id="privacy-promise" class="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-t border-border">
      <div class="max-w-2xl">
        <h2 class="font-display text-2xl sm:text-[34px] font-bold tracking-[-0.025em] text-text-primary [text-wrap:balance] leading-tight">
          Why no bank login?
        </h2>
        <p class="mt-3 text-[15px] sm:text-[16px] text-text-secondary leading-relaxed">
          Most subscription trackers ask for your online banking password or read-only bank tokens — which often don’t work outside the US and put your entire transaction history on someone else’s server.
        </p>
      </div>

      <div class="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div class="lg:col-span-7 rounded-2xl app-surface p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div class="space-y-3">
            <p class="font-mono text-xs font-bold text-brand-text">LOCAL-FIRST ARCHITECTURE</p>
            <h3 class="font-display text-xl sm:text-2xl font-bold text-text-primary tracking-[-0.015em]">
              Stored only on your device
            </h3>
            <p class="text-[15px] leading-relaxed text-text-secondary">
              Every subscription, price, renewal date, and note lives in your browser’s local storage. There is no cloud account, no third-party bank aggregator, and no remote database holding your spending history.
            </p>
          </div>
          <div class="pt-5 border-t border-border grid grid-cols-2 gap-4">
            <div>
              <p class="font-mono text-2xl font-bold text-text-primary">0</p>
              <p class="text-xs text-text-secondary mt-0.5">Bank credentials requested</p>
            </div>
            <div>
              <p class="font-mono text-2xl font-bold text-brand-text">100%</p>
              <p class="text-xs text-text-secondary mt-0.5">Exportable JSON backup anytime</p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-5 flex flex-col gap-5">
          <div class="rounded-2xl app-surface p-6 space-y-2 flex-1">
            <h3 class="font-display text-[17px] font-bold text-text-primary">Statement parsing stays local</h3>
            <p class="text-[14px] leading-relaxed text-text-secondary">
              When you upload a CSV or paste card SMS alerts, parsing runs completely inside your browser tab. Your statement file is never uploaded anywhere.
            </p>
          </div>
          <div class="rounded-2xl app-surface p-6 space-y-2 flex-1">
            <h3 class="font-display text-[17px] font-bold text-text-primary">Only 3 minimal network calls</h3>
            <p class="text-[14px] leading-relaxed text-text-secondary">
              Daily public exchange rates, Pro license key checks if you upgrade, and optional cookie-less aggregate counts — never names, amounts, or notes.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Free vs Pro Table -->
    <section id="pricing" class="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-t border-border">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div class="max-w-2xl">
          <h2 class="font-display text-2xl sm:text-[34px] font-bold tracking-[-0.025em] text-text-primary [text-wrap:balance] leading-tight">
            Simple pricing — start free, upgrade only if you need more
          </h2>
          <p class="mt-2.5 text-[15px] text-text-secondary">
            No credit card to start. Pro is <span class="font-mono font-semibold text-text-primary">$19/year</span> or <span class="font-mono font-semibold text-text-primary">$39 lifetime</span> (one-time payment).
          </p>
        </div>
        <a
          href="/pricing/"
          class="min-h-[44px] inline-flex items-center text-[14px] font-semibold text-brand-text hover:underline whitespace-nowrap shrink-0"
        >Full pricing details &rarr;</a>
      </div>

      ${renderPlanComparisonTable()}

      <div class="mt-6 flex flex-wrap items-center gap-4">
        <a
          href="/app/"
          class="min-h-[48px] px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white inline-flex items-center justify-center whitespace-nowrap transition-colors shadow-[0_2px_8px_rgba(15,107,84,0.28),inset_0_1px_0_rgba(255,255,255,0.2)]"
        >Start free in /app/</a>
        <span class="text-[13px] text-text-secondary">14-day refund window on Pro · No countdown timers</span>
      </div>
    </section>

    <!-- Popular Cancellation Guides -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 py-14 border-t border-border">
      <div class="max-w-2xl">
        <h2 class="font-display text-xl sm:text-2xl font-bold tracking-[-0.02em] text-text-primary">
          Direct cancellation guides
        </h2>
        <p class="mt-1.5 text-[14px] text-text-secondary">
          Jump straight to the official account page for popular global and Pakistani services.
        </p>
      </div>
      <div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        ${featuredGuides
          .map(
            (service) =>
              `<a href="/cancel/${escapeHtml(service.id)}/" class="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-card border border-border hover:border-brand/70 text-[13px] sm:text-[14px] font-semibold text-text-primary flex items-center justify-between gap-2 transition-colors"><span class="truncate">Cancel ${escapeHtml(service.name)}</span><span class="text-text-secondary shrink-0" aria-hidden="true">&rarr;</span></a>`,
          )
          .join('\n        ')}
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-t border-border">
      <h2 class="font-display text-2xl sm:text-[34px] font-bold tracking-[-0.025em] text-text-primary leading-tight">
        Frequently asked questions
      </h2>

      <div class="mt-8 divide-y divide-border/80 rounded-2xl app-surface">
        <details class="group p-5 sm:p-6" open>
          <summary class="min-h-[44px] flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-bold text-text-primary">
            <span>Is it safe?</span>
            <span class="font-mono text-text-secondary text-lg group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
          </summary>
          <p class="mt-2.5 text-[15px] leading-relaxed text-text-secondary">
            Yes. VaultFlow never asks for bank logins, card numbers, or account passwords. Your subscription list stays in your browser’s local storage, and statement imports are parsed locally on your device.
          </p>
        </details>

        <details class="group p-5 sm:p-6">
          <summary class="min-h-[44px] flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-bold text-text-primary">
            <span>Does it work with PKR?</span>
            <span class="font-mono text-text-secondary text-lg group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
          </summary>
          <p class="mt-2.5 text-[15px] leading-relaxed text-text-secondary">
            Yes. You can set PKR (or USD, EUR, GBP, AED, INR, and 10 other currencies) as your home currency, track local providers like PTCL, StormFiber, Nayatel, and Jazz alongside USD subscriptions, and add your bank’s foreign-currency card markup percentage in Pro.
          </p>
        </details>

        <details class="group p-5 sm:p-6">
          <summary class="min-h-[44px] flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-bold text-text-primary">
            <span>How do reminders work?</span>
            <span class="font-mono text-text-secondary text-lg group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
          </summary>
          <p class="mt-2.5 text-[15px] leading-relaxed text-text-secondary">
            Export your renewal calendar (.ics) once into Apple Calendar, Google Calendar, or Outlook so your phone alerts you at 9:00 AM, 1 to 3 days before every charge. Free trials also get an extra day-before alert. You can also turn on in-browser alerts when you open VaultFlow.
          </p>
        </details>

        <details class="group p-5 sm:p-6">
          <summary class="min-h-[44px] flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-bold text-text-primary">
            <span>Refunds?</span>
            <span class="font-mono text-text-secondary text-lg group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
          </summary>
          <p class="mt-2.5 text-[15px] leading-relaxed text-text-secondary">
            Every Pro purchase includes a 14-day refund window handled by our payment reseller. See our <a href="/refunds/" class="text-brand-text font-semibold hover:underline">Refund policy</a> for full details.
          </p>
        </details>

        <details class="group p-5 sm:p-6">
          <summary class="min-h-[44px] flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-bold text-text-primary">
            <span>What happens to my data?</span>
            <span class="font-mono text-text-secondary text-lg group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
          </summary>
          <p class="mt-2.5 text-[15px] leading-relaxed text-text-secondary">
            It stays right in your browser until you export or delete it. You can download a full JSON backup anytime in Settings, restore it on another device, or wipe everything in one click. Even if a Pro license expires, none of your subscriptions are ever deleted.
          </p>
        </details>
      </div>
    </section>
  `;

  return renderDocument({
    siteUrl,
    path: '/',
    title: 'VaultFlow — Track Subscriptions Without Bank Logins',
    description:
      'Find every subscription you pay for without connecting your bank. Paste a statement or pick from 100+ services and get reminded before every renewal.',
    bodyHtml,
    jsonLd,
    activeNav: 'none',
  });
}

export function buildPricingPageHtml(siteUrl: string): string {
  const bodyHtml = `
    <section class="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 space-y-10">
      <div class="max-w-2xl space-y-3">
        <h1 class="font-display text-3xl sm:text-[42px] leading-[1.1] font-bold tracking-[-0.03em] text-text-primary [text-wrap:balance]">
          Honest pricing — Free to start, Pro when you need more
        </h1>
        <p class="text-[16px] text-text-secondary leading-relaxed">
          Track up to ${FREE_MAX_ACTIVE_SUBSCRIPTIONS} active subscriptions free forever with calendar reminders and daily exchange rates. Upgrade to Pro for unlimited subscriptions and one-click statement imports.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div class="rounded-2xl app-surface p-6 flex flex-col justify-between gap-6">
          <div class="space-y-2">
            <h2 class="text-sm font-bold text-text-secondary">Free</h2>
            <p class="font-mono text-3xl font-bold text-text-primary tabular-nums">$0</p>
            <p class="text-[14px] text-text-secondary leading-relaxed">
              Up to ${FREE_MAX_ACTIVE_SUBSCRIPTIONS} active subscriptions, calendar (.ics) export, and daily exchange rates.
            </p>
          </div>
          <a
            href="/app/"
            class="min-h-[44px] px-4 py-2.5 rounded-xl bg-subtle border border-border hover:border-border-strong text-[14px] font-semibold text-text-primary inline-flex items-center justify-center transition-colors"
          >Start free</a>
        </div>

        <div class="rounded-2xl app-surface p-6 flex flex-col justify-between gap-6">
          <div class="space-y-2">
            <h2 class="text-sm font-bold text-text-secondary">Pro Yearly</h2>
            <p class="font-mono text-3xl font-bold text-text-primary tabular-nums">$19<span class="font-sans text-sm font-semibold text-text-secondary">/year</span></p>
            <p class="text-[14px] text-text-secondary leading-relaxed">
              Unlimited subscriptions, bulk statement import, CSV export, and custom FX rates + card markup.
            </p>
          </div>
          <a
            href="/app/#settings"
            class="min-h-[44px] px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-[14px] font-semibold text-white inline-flex items-center justify-center transition-colors shadow-[0_1px_2px_rgba(11,86,67,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]"
          >Upgrade in app</a>
        </div>

        <div class="relative overflow-hidden rounded-2xl bg-brand-soft/80 border border-brand-border p-6 flex flex-col justify-between gap-6">
          <div class="absolute inset-x-0 top-0 h-[3px] bg-brand" aria-hidden="true"></div>
          <div class="space-y-2">
            <h2 class="text-sm font-bold text-brand-text">Pro Lifetime</h2>
            <p class="font-mono text-3xl font-bold text-text-primary tabular-nums">$39<span class="font-sans text-sm font-semibold text-text-secondary"> once</span></p>
            <p class="text-[14px] text-text-secondary leading-relaxed">
              Pay once and keep Pro unlocked for the life of the product with no recurring subscription of its own.
            </p>
          </div>
          <a
            href="/app/#settings"
            class="min-h-[44px] px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-[14px] font-semibold text-white inline-flex items-center justify-center transition-colors shadow-[0_1px_2px_rgba(11,86,67,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]"
          >Get Lifetime in app</a>
        </div>
      </div>

      <div class="space-y-4">
        <h2 class="font-display text-xl font-bold text-text-primary">Compare Free and Pro</h2>
        ${renderPlanComparisonTable()}
      </div>

      <div class="rounded-2xl app-surface p-5 text-[14px] text-text-secondary space-y-2">
        <p>
          Payments are processed by [MoR NAME], our reseller. Prices may include tax.
        </p>
        <p>
          Need a refund? Every Pro license is covered by our <a href="/refunds/" class="font-semibold text-brand-text hover:underline">14-day refund policy</a>.
        </p>
      </div>
    </section>
  `;

  return renderDocument({
    siteUrl,
    path: '/pricing/',
    title: 'Pricing — VaultFlow Subscription Tracker',
    description:
      'Start free with up to 8 active subscriptions, or unlock VaultFlow Pro for $19/year or $39 lifetime. No bank login required.',
    bodyHtml,
    activeNav: 'pricing',
  });
}

export function buildPrivacyPageHtml(siteUrl: string): string {
  const bodyHtml = `
    <article class="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 space-y-8">
      <header class="space-y-2">
        <h1 class="font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-text-primary">Privacy Policy</h1>
        <p class="text-[14px] text-text-secondary">Operator: [OWNER NAME] · Country: [COUNTRY]</p>
      </header>

      <section class="rounded-2xl app-surface p-6 sm:p-8 space-y-4 text-[15px] leading-relaxed text-text-secondary">
        <h2 class="font-display text-lg font-bold text-text-primary">1. Your data lives in your browser</h2>
        <p>
          VaultFlow stores your subscriptions, prices, renewal dates, notes, and settings locally in your browser’s <code class="font-mono text-[13px]">localStorage</code>. We do not require an account and we do not maintain a cloud database of your subscriptions.
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">2. No bank connections &amp; no selling data</h2>
        <p>
          VaultFlow never asks for your online banking credentials, card numbers, or read-only bank aggregator tokens. Bank statement CSV files and pasted SMS alerts are parsed entirely inside your browser tab and are never uploaded to our servers. We never sell, rent, or share personal data with advertisers or data brokers.
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">3. The only network requests VaultFlow makes</h2>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong class="text-text-primary">Daily exchange rates:</strong> Fetches public USD reference exchange rates from <code class="font-mono text-[13px]">open.er-api.com</code> at most once every 24 hours so multi-currency totals stay current.</li>
          <li><strong class="text-text-primary">Pro license verification:</strong> If you enter a Pro license key, VaultFlow verifies the key with [MoR NAME] (our merchant of record) to confirm your Pro status. Payment card details are handled exclusively by [MoR NAME] and never touch VaultFlow.</li>
          <li><strong class="text-text-primary">Cookie-less analytics (when enabled):</strong> Aggregate page counts and anonymous product milestones (such as completing setup or exporting a calendar). No cookies, no cross-site tracking, and never any subscription names, amounts, currencies, or notes.</li>
        </ul>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">4. Exporting and deleting your data</h2>
        <p>
          Because your data stays on your device, you have full control at any time. Open <a href="/app/#settings" class="font-semibold text-brand-text hover:underline">Settings</a> inside the app to download a JSON backup, export CSV (Pro), or permanently erase all stored data with <strong>Clear all data</strong>.
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">5. Contact</h2>
        <p>
          Questions or privacy requests can be sent to [OWNER NAME] at <a href="mailto:[CONTACT EMAIL]" class="font-semibold text-brand-text hover:underline">[CONTACT EMAIL]</a> ([COUNTRY]).
        </p>
      </section>
    </article>
  `;

  return renderDocument({
    siteUrl,
    path: '/privacy/',
    title: 'Privacy Policy — VaultFlow',
    description:
      'VaultFlow keeps your subscription data in your browser with no bank logins, no selling data, and only minimal network requests.',
    bodyHtml,
    activeNav: 'privacy',
  });
}

export function buildTermsPageHtml(siteUrl: string): string {
  const bodyHtml = `
    <article class="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 space-y-8">
      <header class="space-y-2">
        <h1 class="font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-text-primary">Terms of Service</h1>
        <p class="text-[14px] text-text-secondary">Operator: [OWNER NAME] · Jurisdiction: [COUNTRY]</p>
      </header>

      <section class="rounded-2xl app-surface p-6 sm:p-8 space-y-4 text-[15px] leading-relaxed text-text-secondary">
        <h2 class="font-display text-lg font-bold text-text-primary">1. Provided “as is”</h2>
        <p>
          VaultFlow is provided by [OWNER NAME] on an “as is” and “as available” basis without warranties of any kind. Because your records live locally in your browser, you are responsible for keeping backups (via Settings &rarr; Backup) before clearing browser data or switching devices.
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">2. Not financial advice</h2>
        <p>
          VaultFlow is a personal organization tool for tracking recurring expenses and renewal dates. Totals, currency conversions, and savings illustrations are estimates for informational purposes only and do not constitute financial, tax, or legal advice.
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">3. Pro licenses &amp; billing</h2>
        <p>
          Pro checkout, invoicing, and tax handling are processed by [MoR NAME], our merchant of record.
        </p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong class="text-text-primary">Yearly license:</strong> Renews annually until you cancel through [MoR NAME]’s customer portal before your next billing date.</li>
          <li><strong class="text-text-primary">Lifetime license:</strong> Grants access to VaultFlow Pro for the commercial life of the VaultFlow web product with no recurring renewal fee.</li>
          <li><strong class="text-text-primary">Expiration:</strong> If a license expires or is refunded, your local subscription records remain intact on your device and Free plan limits apply.</li>
        </ul>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">4. Acceptable use</h2>
        <p>
          You agree not to abuse license validation endpoints, redistribute paid license keys publicly, or interfere with the operation of the website.
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">5. Contact</h2>
        <p>
          These terms are governed by the laws of [COUNTRY]. For questions, contact [OWNER NAME] at <a href="mailto:[CONTACT EMAIL]" class="font-semibold text-brand-text hover:underline">[CONTACT EMAIL]</a>.
        </p>
      </section>
    </article>
  `;

  return renderDocument({
    siteUrl,
    path: '/terms/',
    title: 'Terms of Service — VaultFlow',
    description:
      'VaultFlow terms of service covering local software use, Yearly and Lifetime Pro licenses handled by our reseller, and acceptable use.',
    bodyHtml,
    activeNav: 'none',
  });
}

export function buildRefundsPageHtml(siteUrl: string): string {
  const bodyHtml = `
    <article class="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 space-y-8">
      <header class="space-y-2">
        <h1 class="font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-text-primary">Refund Policy</h1>
        <p class="text-[14px] text-text-secondary">Operator: [OWNER NAME] · Reseller: [MoR NAME]</p>
      </header>

      <section class="rounded-2xl app-surface p-6 sm:p-8 space-y-4 text-[15px] leading-relaxed text-text-secondary">
        <h2 class="font-display text-lg font-bold text-text-primary">14-day refund window</h2>
        <p>
          If VaultFlow Pro isn’t right for you, you can request a full refund within <strong class="text-text-primary">14 days</strong> of your purchase.
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">How refunds are processed</h2>
        <p>
          All Pro payments and refunds are handled directly by <strong class="text-text-primary">[MoR NAME]</strong>, our merchant of record. To request a refund, reply to your order receipt from [MoR NAME] or email us at <a href="mailto:[CONTACT EMAIL]" class="font-semibold text-brand-text hover:underline">[CONTACT EMAIL]</a> with your order number and we will arrange it promptly through [MoR NAME].
        </p>

        <h2 class="font-display text-lg font-bold text-text-primary pt-2">What happens to your subscriptions</h2>
        <p>
          When a refund is completed, your Pro license key is deactivated and the app returns to the Free plan. None of your local subscriptions are deleted — your first ${FREE_MAX_ACTIVE_SUBSCRIPTIONS} active subscriptions stay editable and the rest stay visible on your device.
        </p>

        <p class="pt-2 text-[14px]">
          Operator: [OWNER NAME] · [COUNTRY] · <a href="mailto:[CONTACT EMAIL]" class="font-semibold text-brand-text hover:underline">[CONTACT EMAIL]</a>
        </p>
      </section>
    </article>
  `;

  return renderDocument({
    siteUrl,
    path: '/refunds/',
    title: 'Refund Policy — VaultFlow',
    description:
      'VaultFlow Pro includes a 14-day refund window processed through our merchant of record with zero loss of your local subscription data.',
    bodyHtml,
    activeNav: 'none',
  });
}

function formatTypicalPrices(entry: ServiceCatalogEntry): string | null {
  const prices = entry.typicalPriceMinorUnits;
  if (!prices) return null;
  const preferredOrder: CurrencyCode[] = ['USD', 'PKR', 'GBP', 'EUR', 'AED', 'INR', 'CAD', 'AUD'];
  const entries = (Object.keys(prices) as CurrencyCode[])
    .filter((code) => typeof prices[code] === 'number' && (prices[code] as number) > 0)
    .sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  if (entries.length === 0) return null;
  const suffix = BILLING_CYCLES[entry.defaultCycle].shortSuffix;
  return entries
    .slice(0, 3)
    .map(
      (code) =>
        `${formatMinorUnits(prices[code] as number, code, {
          showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(code),
        })}${suffix}`,
    )
    .join(' · ');
}

export function buildCancelPageHtml(
  entry: ServiceCatalogEntry,
  siteUrl: string,
  allCancelServices: readonly ServiceCatalogEntry[] = getCancelGuideServices(),
): string {
  const typicalPriceText = formatTypicalPrices(entry);
  const title = truncateSeo(`How to cancel ${entry.name} — VaultFlow`, 60);
  const description = truncateSeo(
    `Cancel your ${entry.name} subscription quickly using the official account link${
      typicalPriceText ? ` (typical price ${typicalPriceText})` : ''
    }, and track renewals free with VaultFlow.`,
    155,
  );

  const stepsHtml =
    entry.cancelSteps && entry.cancelSteps.length > 0
      ? `
        <section class="rounded-2xl app-surface p-6 sm:p-8 space-y-3">
          <h2 class="font-display text-lg font-bold text-text-primary">Cancellation steps</h2>
          <ol class="list-decimal pl-5 space-y-2.5 text-[15px] leading-relaxed text-text-secondary">
            ${entry.cancelSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('\n            ')}
          </ol>
        </section>`
      : `
        <section class="rounded-2xl app-surface p-6 sm:p-8 space-y-3">
          <h2 class="font-display text-lg font-bold text-text-primary">Before you cancel</h2>
          <ol class="list-decimal pl-5 space-y-2.5 text-[15px] leading-relaxed text-text-secondary">
            <li>Open the official ${escapeHtml(entry.name)} account page below and sign in with the account that is billed.</li>
            <li>Go to your billing, membership, or plan management section and follow the prompt to cancel auto-renewal.</li>
            <li>Keep your confirmation email or screenshot and note the final day of access before your next billing date.</li>
          </ol>
        </section>`;

  const related = allCancelServices
    .filter((other) => other.id !== entry.id && other.category === entry.category)
    .slice(0, 6);

  const bodyHtml = `
    <article class="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 space-y-8">
      <nav aria-label="Breadcrumb" class="text-[13px] text-text-secondary">
        <a href="/" class="hover:text-text-primary">VaultFlow</a>
        <span class="mx-1.5" aria-hidden="true">/</span>
        <span>Cancel ${escapeHtml(entry.name)}</span>
      </nav>

      <header class="space-y-3">
        <h1 class="font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-text-primary [text-wrap:balance]">
          How to cancel ${escapeHtml(entry.name)}
        </h1>
        ${
          typicalPriceText
            ? `<p class="text-[15px] text-text-secondary tabular-nums">Typical price: <strong class="font-mono text-text-primary">${escapeHtml(typicalPriceText)}</strong></p>`
            : ''
        }
        ${
          entry.lastChecked
            ? `<p class="text-[13px] font-mono text-text-secondary tabular-nums">Last checked: ${escapeHtml(entry.lastChecked)}</p>`
            : ''
        }
      </header>

      ${
        entry.cancelUrl
          ? `
      <div>
        <a
          href="${escapeHtml(entry.cancelUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="min-h-[48px] px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-[15px] font-semibold text-white inline-flex items-center justify-center transition-colors shadow-[0_2px_8px_rgba(15,107,84,0.28),inset_0_1px_0_rgba(255,255,255,0.2)]"
        >Open ${escapeHtml(entry.name)} account page</a>
      </div>`
          : ''
      }

      ${stepsHtml}

      <aside class="rounded-2xl bg-brand-soft/80 border border-brand-border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="font-display text-lg font-bold text-text-primary">Track all your subscriptions free</h2>
          <p class="text-[14px] text-text-secondary">
            Get reminded before renewals hit your card — no bank login required.
          </p>
        </div>
        <a
          href="/app/"
          class="min-h-[44px] px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-[14px] font-semibold text-white inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-colors"
        >Open VaultFlow</a>
      </aside>

      ${
        related.length > 0
          ? `
      <section class="pt-5 border-t border-border space-y-3">
        <h2 class="font-display text-base font-bold text-text-primary">Other cancellation guides</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${related
            .map(
              (item) =>
                `<a href="/cancel/${escapeHtml(item.id)}/" class="min-h-[44px] px-4 py-2 rounded-xl bg-card border border-border hover:border-brand/70 text-[14px] font-medium text-text-primary flex items-center justify-between gap-2 transition-colors"><span class="truncate">Cancel ${escapeHtml(item.name)}</span><span class="text-text-secondary shrink-0" aria-hidden="true">&rarr;</span></a>`,
            )
            .join('\n          ')}
        </div>
      </section>`
          : ''
      }
    </article>
  `;

  return renderDocument({
    siteUrl,
    path: `/cancel/${entry.id}/`,
    title,
    description,
    bodyHtml,
    activeNav: 'none',
  });
}

export function buildSitemapXml(
  siteUrl: string,
  cancelServices: readonly ServiceCatalogEntry[] = getCancelGuideServices(),
): string {
  const staticPaths = ['/', '/pricing/', '/privacy/', '/terms/', '/refunds/'];
  const cancelPaths = cancelServices.map((s) => `/cancel/${s.id}/`);
  const allPaths = [...staticPaths, ...cancelPaths];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths.map((p) => `  <url>\n    <loc>${escapeHtml(`${siteUrl}${p}`)}</loc>\n  </url>`).join('\n')}
</urlset>
`;
}

export function buildRobotsTxt(siteUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

export function buildCloudflareHeaders(
  analyticsSrc?: string,
  analyticsDomain?: string,
): string {
  const analytics = parseAnalyticsConfig(analyticsSrc, analyticsDomain);
  const connectSources = [
    "'self'",
    'https://open.er-api.com',
    'https://api.polar.sh',
    ...(analytics ? [analytics.origin] : []),
  ].join(' ');

  const scriptDirective = analytics ? ` script-src 'self' ${analytics.origin};` : '';

  const csp = `default-src 'self';${scriptDirective} connect-src ${connectSources}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`;

  return `/*
  Content-Security-Policy: ${csp}
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;
}
