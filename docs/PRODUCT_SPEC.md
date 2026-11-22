# VaultFlow — product spec (web)

## Product
Promise: "Find every subscription you pay for — without connecting your bank — and get reminded before every renewal."
Users: everyday people and freelancers worldwide, with a strong Pakistan/South Asia segment, paying for 5–25 subscriptions in mixed currencies (e.g. USD subscriptions paid from a PKR card).
Business model: Free (up to 8 active subscriptions) and Pro (unlimited, statement import, CSV export, custom rates + card markup). Pro = $19/year or $39 lifetime, sold through a merchant-of-record checkout and unlocked with a license key.
Privacy promise: subscription data stays in the browser (localStorage). No bank logins, no ad or tracking scripts. The only network calls allowed: daily exchange rates, license validation, and cookie-less analytics that never includes names, amounts or text.

## Architecture (keep it)
- src/core/utils: moneyFormatter, currencyConverter, dateMath, backupService — pure functions with unit tests.
- src/features/<feature>/{domain,data,presentation}: domain = pure TypeScript (no React imports); presentation = React components.
- Features after cleanup: cashflow (Home + subscriptions), timeline (Calendar), audit (Insights + statement import), vault (Settings), catalog, billing, reminders.
- App state lives in src/App.tsx and persists through src/features/cashflow/data/localStorageRepository.ts.

## Rules (non-negotiable)
1. Money is integer minor units (cents/paisa) everywhere. Never store or add floats. Convert user input with parseDecimalToMinorUnits at the UI boundary.
2. Dates are "YYYY-MM-DD" strings in the user's local calendar. Use src/core/utils/dateMath.ts. Never call new Date("YYYY-MM-DD") (it parses as UTC and shifts the day).
3. Every number on screen is computed from data. No hardcoded demo numbers in components.
4. No placeholder handlers, "coming soon", fake links or TODOs. If something can't work yet, don't render its button.
5. Anything that deletes or replaces user data needs a confirmation or an Undo.
6. Keep existing tests passing and add tests for every domain change. Never delete or weaken a test to make the build pass.
7. Accessibility: keyboard reachable, visible focus ring, aria-label on icon-only buttons, text contrast at least 4.5:1, touch targets at least 44px on mobile.
8. Mobile first: every screen works at 360px wide with no horizontal scrolling.
9. Plain English for non-finance people. Visible text must not use "burn", "runway", "leak", "radar", "ceiling" or "vault" (except inside the brand name).
10. Done means: (a) npm run lint, npm test and npm run build all pass (if you can't run commands, say so and check types by reading); (b) list every file created, changed or deleted; (c) list your assumptions; (d) go through the task's acceptance checks one by one, saying pass or fail for each.

## Design tokens
Font: Plus Jakarta Sans everywhere, with font-variant-numeric: tabular-nums for numbers. Monospace only inside code/JSON boxes.
Text: primary #17211E; secondary #5B6662 (never lighter for readable text); #85918C only for disabled or decorative elements.
Surfaces: page #F5F6F3, card #FFFFFF, border #E4E7E1. Brand green #1E6B58 (hover #175747). Amber #B86A14 for due soon and warnings. Red #C64545 only for delete and over budget.
Type sizes on mobile: body 15–16px, secondary 13px, never below 12px. Radius: cards 16px, controls 12px.
