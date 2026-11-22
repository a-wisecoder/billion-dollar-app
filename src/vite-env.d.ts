/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_LICENSE_PROVIDER?: string;
  readonly VITE_POLAR_ORG_ID?: string;
  readonly VITE_POLAR_CHECKOUT_YEARLY?: string;
  readonly VITE_POLAR_CHECKOUT_LIFETIME?: string;
  readonly VITE_LAUNCH_PRICE?: string;
  readonly VITE_MOR_NAME?: string;
  readonly VITE_ANALYTICS_SRC?: string;
  readonly VITE_ANALYTICS_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
