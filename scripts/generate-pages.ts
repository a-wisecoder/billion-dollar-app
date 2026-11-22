import fs from 'node:fs';
import path from 'node:path';
import {
  buildAppHtml,
  buildCancelPageHtml,
  buildCloudflareHeaders,
  buildLandingPageHtml,
  buildPricingPageHtml,
  buildPrivacyPageHtml,
  buildRefundsPageHtml,
  buildRobotsTxt,
  buildSitemapXml,
  buildTermsPageHtml,
  getCancelGuideServices,
  normalizeSiteUrl,
} from '../src/marketing/pageTemplates';

const ROOT_DIR = process.cwd();
const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);

function writeFileEnsured(relPath: string, content: string): void {
  const absPath = path.join(ROOT_DIR, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
}

function main(): void {
  const cancelServices = getCancelGuideServices();

  // Core static pages + app entry canonical sync
  writeFileEnsured('index.html', buildLandingPageHtml(SITE_URL));
  writeFileEnsured('app/index.html', buildAppHtml(SITE_URL));
  writeFileEnsured('pricing/index.html', buildPricingPageHtml(SITE_URL));
  writeFileEnsured('privacy/index.html', buildPrivacyPageHtml(SITE_URL));
  writeFileEnsured('terms/index.html', buildTermsPageHtml(SITE_URL));
  writeFileEnsured('refunds/index.html', buildRefundsPageHtml(SITE_URL));

  // Clean and regenerate /cancel/<service-id>/ pages
  const cancelRoot = path.join(ROOT_DIR, 'cancel');
  if (fs.existsSync(cancelRoot)) {
    fs.rmSync(cancelRoot, { recursive: true, force: true });
  }
  for (const service of cancelServices) {
    writeFileEnsured(
      path.join('cancel', service.id, 'index.html'),
      buildCancelPageHtml(service, SITE_URL, cancelServices),
    );
  }

  // SEO discovery files & Cloudflare edge headers
  writeFileEnsured('public/sitemap.xml', buildSitemapXml(SITE_URL, cancelServices));
  writeFileEnsured('public/robots.txt', buildRobotsTxt(SITE_URL));
  writeFileEnsured(
    'public/_headers',
    buildCloudflareHeaders(
      process.env.VITE_ANALYTICS_SRC,
      process.env.VITE_ANALYTICS_DOMAIN,
    ),
  );

  console.log(
    `[generate-pages] Generated static pages + ${cancelServices.length} cancel guides for ${SITE_URL}`,
  );
}

main();
