# VaultFlow Billing & License Setup

VaultFlow never handles card numbers or user accounts. Payments are processed off-site by a Merchant of Record (default: **Polar**), and the browser unlocks Pro features using a license key.

## 1. Create Products & License-Key Benefit in Polar

1. Sign in to [Polar](https://polar.sh) (or [Polar Sandbox](https://sandbox.polar.sh) for testing) and open your Organization dashboard.
2. Go to **Products** and create two products:
   - **VaultFlow Pro (Yearly)** — Recurring, `$19` / year.
   - **VaultFlow Pro (Lifetime)** — One-time purchase, `$39` (or `$29` while running launch pricing with `VITE_LAUNCH_PRICE=1`).
3. Create a **License Keys** benefit (e.g., `VaultFlow Pro License`) and attach it to both products:
   - Set a clear prefix if desired (e.g. `VF-`).
   - Optionally set an **Activation Limit** (e.g. `5` devices). VaultFlow automatically activates the device on first unlock and allows deactivating from **Settings > Plan**.
   - Leave expiration synced to subscription status for the Yearly product and unlimited for the Lifetime product.

## 2. Copy Organization ID & Checkout Links

1. **Organization ID (`VITE_POLAR_ORG_ID`)**:
   - In Polar, open **Settings > General** and copy the Organization UUID.
   - This value is public (used by Polar's Customer Portal license endpoints). Never put a private Polar Organization Access Token in any `VITE_*` variable.
2. **Checkout Links (`VITE_POLAR_CHECKOUT_YEARLY` and `VITE_POLAR_CHECKOUT_LIFETIME`)**:
   - Open **Products > Checkout Links** and create one link for the Yearly product and one link for the Lifetime product.
   - Copy both `https://buy.polar.sh/...` URLs into your deployment environment variables.
3. Optional flags:
   - `VITE_LICENSE_PROVIDER=polar` (default in production; set `dev` locally to test `DEV-PRO-*` keys in `vite dev`).
   - `VITE_LAUNCH_PRICE=1` displays the `"Launch price $29"` callout on the Lifetime card.
   - `VITE_MOR_NAME=Polar` controls the reseller name shown in the Upgrade sheet small print.

## 3. CORS & Cloudflare Pages Proxy

VaultFlow calls Polar's public Customer Portal endpoints directly from the browser first:

- `POST https://api.polar.sh/v1/customer-portal/license-keys/validate`
- `POST https://api.polar.sh/v1/customer-portal/license-keys/activate`
- `POST https://api.polar.sh/v1/customer-portal/license-keys/deactivate`

If a browser blocks cross-origin requests to Polar, the client automatically falls back to same-origin proxy endpoints included in this repo for Cloudflare Pages:

- `functions/api/license/validate.ts` -> `/api/license/validate`
- `functions/api/license/activate.ts` -> `/api/license/activate`
- `functions/api/license/deactivate.ts` -> `/api/license/deactivate`

Each function validates required JSON fields and forwards strictly to the fixed Polar Customer Portal URLs with `Cache-Control: no-store`.

## 4. Testing in Polar Sandbox

1. Create the same two products and a License Keys benefit in [Polar Sandbox](https://sandbox.polar.sh).
2. Complete a test checkout using Polar's sandbox test card to generate a real license key.
3. For local UI testing without hitting Polar at all, run the dev server with `VITE_LICENSE_PROVIDER=dev` in `.env.local` and enter any key starting with `DEV-PRO-` (for example `DEV-PRO-123`). The development provider is gated behind `import.meta.env.DEV` and stripped completely from production builds.

## 5. Switching to Paddle Later

VaultFlow's UI and entitlement checks depend only on the `LicenseProvider` interface in `src/features/billing/data/licenseProvider.ts`.

Unlike Polar, **Paddle does not provide a built-in customer-portal license key API**. Switching to Paddle requires a small backend service (for example Cloudflare Workers + KV/D1):

1. Receive Paddle webhooks (`transaction.completed`, `subscription.canceled`, `subscription.past_due`) and verify the `Paddle-Signature` header server-side.
2. Generate and store a signed license key (plus expiration/revocation status and optional device activation count) in server-side storage, then email or display the key on your checkout confirmation page.
3. Expose `/api/license/validate`, `/api/license/activate`, and `/api/license/deactivate` endpoints backed by that store.
4. Implement a `PaddleLicenseProvider` adhering to `LicenseProvider` and set `VITE_MOR_NAME=Paddle`.

That backend is intentionally not built here because Polar already provides hosted license validation without running a database.
