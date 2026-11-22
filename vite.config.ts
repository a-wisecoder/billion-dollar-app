import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')) as {
  version: string;
};

function collectMultiPageInputs(): Record<string, string> {
  const inputs: Record<string, string> = {
    main: path.resolve(ROOT_DIR, 'index.html'),
    app: path.resolve(ROOT_DIR, 'app/index.html'),
    pricing: path.resolve(ROOT_DIR, 'pricing/index.html'),
    privacy: path.resolve(ROOT_DIR, 'privacy/index.html'),
    terms: path.resolve(ROOT_DIR, 'terms/index.html'),
    refunds: path.resolve(ROOT_DIR, 'refunds/index.html'),
  };

  const cancelDir = path.resolve(ROOT_DIR, 'cancel');
  if (fs.existsSync(cancelDir)) {
    for (const entry of fs.readdirSync(cancelDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const htmlPath = path.join(cancelDir, entry.name, 'index.html');
      if (fs.existsSync(htmlPath)) {
        inputs[`cancel-${entry.name}`] = htmlPath;
      }
    }
  }

  return inputs;
}

/**
 * Mirrors Cloudflare Pages /app/* -> /app/index.html and trailing-slash directory
 * routing during local Vite dev and preview servers.
 */
function multiPageRoutingPlugin(): Plugin {
  const rewriteAppSubpaths = (req: { url?: string }) => {
    if (!req.url) return;
    const [pathname, query = ''] = req.url.split('?');
    const suffix = query ? `?${query}` : '';

    if (pathname === '/app') {
      req.url = `/app/index.html${suffix}`;
      return;
    }

    if (pathname.startsWith('/app/') && !path.extname(pathname)) {
      req.url = `/app/index.html${suffix}`;
    }
  };

  return {
    name: 'vaultflow-multipage-routing',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteAppSubpaths(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteAppSubpaths(req);
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    multiPageRoutingPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'theme-init.js',
        'og-image.png',
        'icons/icon.svg',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-512-maskable.png',
      ],
      manifest: {
        id: '/app/',
        name: 'VaultFlow',
        short_name: 'VaultFlow',
        description:
          'Find every subscription you pay for without connecting your bank, and get reminded before every renewal.',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#F6F7F5',
        theme_color: '#0F6B54',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['cancel/**', 'screens/**', 'og-image.png'],
        navigateFallback: '/app/index.html',
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/open\.er-api\.com\/v6\/latest\/USD/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'exchange-rates-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 86400,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: collectMultiPageInputs(),
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('/motion/') || id.includes('/framer-motion/')) {
            return 'vendor-motion';
          }
          if (id.includes('/@radix-ui/')) {
            return 'vendor-radix';
          }
          if (id.includes('/lucide-react/')) {
            return 'vendor-icons';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
