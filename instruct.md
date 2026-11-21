# VaultFlow — Master Engineering & Product Specification

## 1. Mission & Product Vision
Build **VaultFlow**, a production-grade, privacy-first, offline-first **Recurring Cashflow, Subscription & Free-Trial Radar** mobile app in **Flutter & Dart**.

Users quietly lose money to forgotten subscriptions, mistimed auto-renewals, and uncancelled free trials—and distrust apps that demand bank logins. VaultFlow solves this locally on-device with zero mandatory cloud accounts, instant tactile speed, and an ultra-interactive financial UI.

**Quality Bar:** Senior Principal Mobile Engineer (20 years experience). Zero toy placeholders, zero dead buttons, zero `TODO` stubs, zero analyzer warnings, and 100% real persistence, real math, and real interactions.

---

## 2. Strict Architecture & Tech Stack

### Required Packages
- **State Management:** `flutter_riverpod` (Use modern `Notifier` / `AsyncNotifier` + `NotifierProvider` / `AsyncNotifierProvider` ONLY. Never use legacy `StateProvider` or `ChangeNotifier`.)
- **Local Database (Offline-First):** `drift`, `drift_flutter`, `path_provider` (dev: `drift_dev`, `build_runner`) for real relational SQLite persistence.
- **Lightweight Settings:** `shared_preferences` (base currency, budget ceiling, notification preferences, onboarding state).
- **Local Alerts:** `flutter_local_notifications`, `timezone` (real scheduled renewal & free-trial warning notifications).
- **Date Formatting:** `intl` (for localized calendar headers & due dates only; currency math must remain custom integer-based).
- **Testing:** `flutter_test`, `drift` in-memory `NativeDatabase.memory()`.

### Folder Structure (Feature-First Clean Architecture)
Enforce strict layer separation. `domain/` MUST remain **100% pure Dart** (zero `package:flutter/...` imports).

```text
lib/
├── main.dart
├── app.dart
├── core/
│   ├── theme/
│   │   ├── app_theme.dart              # OLED dark ThemeData + VaultColors ThemeExtension
│   │   └── category_visuals.dart       # Maps pure Domain categories -> Flutter Color & IconData
│   ├── utils/
│   │   ├── money_formatter.dart        # Exact minor-unit integer currency formatter
│   │   ├── currency_converter.dart     # Multi-currency normalization (USD, PKR, EUR, GBP, AED)
│   │   └── date_math.dart              # Next renewal advancement, calendar-day diffs
│   ├── database/
│   │   └── app_database.dart           # Drift SQLite database + DAOs + generated .g.dart
│   └── services/
│       ├── notification_service.dart   # Local notification scheduling & cancellation
│       └── backup_service.dart         # JSON export/import serialization & schema validation
└── features/
    ├── shell/
    │   └── presentation/
    │       └── main_shell.dart         # Floating glass bottom navigation (Radar, Timeline, Vault)
    ├── cashflow/                       # Feature 1: Interactive Burn Radar & Subscriptions
    │   ├── domain/
    │   │   ├── entities/subscription.dart
    │   │   └── repositories/cashflow_repository.dart
    │   ├── data/
    │   │   └── repositories/drift_cashflow_repository.dart
    │   └── presentation/
    │       ├── controllers/cashflow_controller.dart
    │       ├── screens/radar_dashboard_screen.dart
    │       └── widgets/
    │           ├── interactive_burn_dial.dart
    │           ├── runway_ceiling_card.dart
    │           ├── what_if_savings_banner.dart
    │           ├── subscription_card.dart
    │           └── subscription_editor_sheet.dart
    ├── timeline/                       # Feature 2: Interactive Cashflow Calendar
    │   └── presentation/
    │       ├── controllers/timeline_controller.dart
    │       ├── screens/timeline_screen.dart
    │       └── widgets/
    │           ├── interactive_month_grid.dart
    │           └── day_charge_drawer.dart
    └── vault_settings/                 # Feature 3: Currency, Alerts & Data Ownership
        └── presentation/
            ├── controllers/settings_controller.dart
            └── screens/vault_settings_screen.dart
```

---

## 3. Non-Negotiable Engineering Invariants

1. **NO Floating-Point Money:** Store ALL prices, budgets, and totals as integer minor units (`int amountMinorUnits`, e.g., `$19.99` = `1999`). Convert text input to integer minor units immediately at the UI boundary.
2. **Tabular Numerals Everywhere:** Every price, countdown, percentage, and animated counter MUST use `fontFeatures: [FontFeature.tabularFigures()]` to prevent horizontal jitter during animations.
3. **Modern Flutter APIs Only (Zero Deprecations):**
   - Use `.withValues(alpha: x)` — NEVER `.withOpacity(x)`.
   - Use `CardThemeData`, `DialogThemeData`, `TabBarThemeData` — NEVER deprecated `*Theme` constructors.
   - Use `PopScope` — NEVER `WillPopScope`.
   - Use `MediaQuery.viewInsetsOf(context)` / `MediaQuery.sizeOf(context)` — NEVER `MediaQuery.of(context)`.
4. **Pure Domain Layer:** `domain/entities/` and `domain/repositories/` must contain zero `material.dart` or `widgets.dart` imports. UI colors/icons live in `core/theme/category_visuals.dart`.
5. **Resource Safety:** Every `AnimationController`, `TextEditingController`, `FocusNode`, `ScrollController`, and `StreamSubscription` MUST be properly disposed.
6. **Accurate Renewal Date Math:** Always normalize dates to local midnight (`DateTime(y, m, d)`) before computing `daysUntilRenewal`. Automatically advance past `nextBillingDate` entries forward by their `BillingCycle` on app launch (unless marked paused/trial-expired) so the app stays accurate over months of real use.
7. **CustomPainter Performance:** Never blindly return `true` from `shouldRepaint`. Always perform strict property & list equality checks (`listEquals`).

---

## 4. Visual & Interactive Design System ("Tactile OLED Precision")

### Color Tokens (`VaultColors` ThemeExtension)
- `surfaceBase`: `#080B12` (True deep OLED charcoal-navy)
- `surfaceCard`: `#111623`
- `surfaceElevated`: `#1A2234`
- `borderSubtle`: `#232D42` (1px hairline crisp borders on cards)
- `accentPrimary`: `#6366F1` (Electric Indigo)
- `accentEmerald`: `#10B981` (Savings / Healthy Runway)
- `accentAmber`: `#F59E0B` (Due Soon <= 3 days / Free Trial Warning)
- `accentDanger`: `#EF4444` (Over Budget / Destructive Action)
- `textPrimary`: `#F8FAFC`
- `textSecondary`: `#94A3B8`

### Haptic & Motion Vocabulary
Every primary interaction must feel physical:
- **Scrubbing dial / moving slider / switching filter chip:** `HapticFeedback.selectionClick()`
- **Pressing subscription card:** `AnimatedScale(scale: 0.97)` on pointer down + crisp spring release.
- **Toggling "What-If" Simulation / Saving record:** `HapticFeedback.mediumImpact()`
- **Deleting subscription:** `HapticFeedback.heavyImpact()` + immediate `Undo` SnackBar restoring the exact database record.
- **Animated Numbers:** Use `TweenAnimationBuilder<double>` with `Curves.easeOutCubic` whenever burn totals or savings figures change.

---

## 5. Complete Feature Requirements

### Feature A: Interactive Burn Radar (`radar_dashboard_screen.dart`)
1. **Interactive Radial Burn-Rate Dial (`interactive_burn_dial.dart`):**
   - Custom-painted multi-segment ring with subtle neon ambient glow (`MaskFilter.blur`).
   - **Touch & Drag Scrubbing:** Dragging a finger anywhere around the ring calculates the clockwise angle (`atan2`) from 12 o'clock, expands the active arc outward in radius and stroke width, triggers `HapticFeedback.selectionClick()` on segment boundary crossings, filters the list below to that category, and updates the center readout with category cost + percentage of total spend.
   - **Center Tap:** If filtered, resets filter to "All". If unfiltered, smoothly flips between **Monthly Burn** and **Annualized Burn**.
   - **Zero-Data State:** If all items are deleted or paused, renders a calm empty track with a clear CTA instead of crashing or dividing by zero.
2. **"What-If" Interactive Savings Simulator:**
   - Swipe right on any card (`Dismissible` with `confirmDismiss: false` so it springs back) OR tap the card's simulation toggle to **Simulate Cancelling/Pausing** it.
   - Immediately updates the radial dial, rolls down total burn, and animates in an emerald **"What-If Savings Unlocked: +[Currency][Amount]/yr"** banner with two actions: **Reset** (unpause all) and **Commit** (permanently pause/archive them if user chooses).
3. **Interactive Monthly Runway Ceiling (`runway_ceiling_card.dart`):**
   - Shows active monthly spend vs. user's monthly ceiling with color-shifting progress bar (Emerald -> Amber -> Red).
   - Tapping opens an interactive bottom sheet slider/input to edit the monthly ceiling in real time (persisted via `SharedPreferences`).
4. **Search & Category Chips:**
   - Quick search icon/bar to filter subscriptions by name or notes.
   - Synchronized category chips below the dial.
5. **Create & Edit Subscription Composer (`subscription_editor_sheet.dart`):**
   - Supports BOTH **Add New** and **Edit Existing** (tapping an edit button or long-pressing a card opens pre-filled editor).
   - **Quick-Fill Service Presets:** Horizontal row of 1-tap popular presets (Netflix, Spotify, ChatGPT Plus, Claude Pro, iCloud+, AWS, YouTube Premium, Gym, Fiber Wi-Fi) that auto-fill name, category, and typical billing cycle.
   - **Fields:** Name, Amount (validated decimal -> integer minor units), Currency (`USD`, `PKR`, `EUR`, `GBP`, `AED`), Billing Cycle (`Weekly`, `Monthly`, `Quarterly`, `Yearly`), Category, Next Renewal Date Picker, Optional Notes.
   - **Free Trial Guard Toggle:** Boolean toggle `isFreeTrial`. When enabled, highlights the card with an amber pulsing `"TRIAL ENDS IN Xd"` badge and schedules high-priority local notifications 48h and 24h before auto-charge.

### Feature B: Interactive Cashflow Timeline (`timeline_screen.dart`)
1. **Interactive Monthly Calendar Grid:**
   - Swipe left/right (or tap chevron controls) to navigate months.
   - Projects recurring bills across future months accurately based on each subscription's `BillingCycle` (`weekly`, `monthly`, `quarterly`, `yearly`).
   - Days with bills display glowing category-colored dots (up to 3 dots + `+N` indicator) and subtle intensity glow proportional to daily spend.
2. **Cluster / Heavy-Week Warning:**
   - Detects if > 40% of the user's monthly burn falls within a single 7-day window and displays an actionable insight pill (e.g., *"Heavy Cashflow Cluster: 4 bills due Nov 18–24"*).
3. **Day Inspector Drawer:**
   - Tapping any day selects it with haptic feedback and smoothly animates the list of exact bills charging on that date + total daily outflow.

### Feature C: Vault & Preferences (`vault_settings_screen.dart`)
1. **Base Display Currency & Offline Exchange Rates:**
   - User selects primary display currency (`USD`, `PKR`, `EUR`, `GBP`, `AED`).
   - All multi-currency subscriptions normalize cleanly into the user's base currency in the Burn Dial and Runway Ceiling, while still showing their original billed currency on the card subtitle (e.g., `$20.00/mo ≈ Rs 5,560`).
   - User can customize/update offline conversion rates directly in Settings (with sensible built-in defaults).
2. **Notification Engine Controls:**
   - Master toggle for renewal alerts + lead-time selector (`1 day`, `2 days`, `3 days` before renewal).
   - Graceful permission handling (never crashes on emulators/web/denied permissions).
   - Automatically reschedules alerts whenever a subscription is added, edited, deleted, or lead time changes.
3. **100% Local Data Ownership (JSON Backup & Restore):**
   - **Export Backup:** Generates a clean, versioned JSON snapshot (`schemaVersion: 1`) and copies to clipboard or triggers export sheet with confirmation feedback.
   - **Import Backup:** Validates JSON schema safely (rejecting malformed inputs with friendly error messages) and merges/restores into Drift SQLite.
4. **Seed Sample Data / Clear Vault:**
   - On very first launch, seed 5 realistic demo subscriptions (including 1 Free Trial) so the dial and calendar look immediately alive, plus a 1-tap "Clear Demo Data" option in Vault Settings.

---

## 6. Phased Execution Plan (Follow Strictly In Order)

Do NOT attempt to write the entire app in one giant unverified step. Complete and verify each phase before advancing:

### Phase 1: Foundation, Dependencies & Design System
- If `pubspec.yaml` does not exist yet, initialize the Flutter project in the repository root via `flutter create --org com.vaultflow --project-name vaultflow .` (preserving `README.md` and `instruct.md`).
- Update `pubspec.yaml` with all required packages (`flutter_riverpod`, `drift`, `drift_flutter`, `path_provider`, `shared_preferences`, `flutter_local_notifications`, `timezone`, `intl`, plus `drift_dev` and `build_runner` in `dev_dependencies`).
- Implement `core/theme/app_theme.dart`, `core/theme/category_visuals.dart`, `core/utils/money_formatter.dart`, `core/utils/currency_converter.dart`, and `core/utils/date_math.dart`.
- **Gate:** Run `flutter pub get` and `flutter analyze` (must be 0 issues).

### Phase 2: Pure Domain & Drift SQLite Persistence
- Implement `features/cashflow/domain/entities/subscription.dart` (pure Dart, immutable, `copyWith`, equality, monthly/annual minor-unit projections, renewal projection helper for calendar months).
- Implement `features/cashflow/domain/repositories/cashflow_repository.dart`.
- Implement `core/database/app_database.dart` (Drift table `Subscriptions`, DAO methods: watchAll, upsert, deleteById, toggleSimulatedPaused, clearAll, bulkInsert).
- Run `dart run build_runner build --delete-conflicting-outputs` to generate Drift code cleanly.
- Implement `features/cashflow/data/repositories/drift_cashflow_repository.dart`.
- Write unit tests for `MoneyFormatter`, `CurrencyConverter`, `DateMath`, `Subscription` projections, and `AppDatabase` using `NativeDatabase.memory()`.
- **Gate:** Run `flutter analyze` and `flutter test` (100% pass).

### Phase 3: Services & Riverpod Controllers
- Implement `core/services/notification_service.dart` (safe initialization, schedule/cancel by subscription ID, graceful no-op fallback in test environments).
- Implement `core/services/backup_service.dart` (strict JSON export/import validation).
- Implement `settings_controller.dart`, `cashflow_controller.dart` (reactive stream from Drift + What-If calculations + currency normalization + auto-advancing overdue dates), and `timeline_controller.dart` (month projection engine + heavy-week cluster detector).
- **Gate:** Run `flutter analyze` and write controller unit tests using `ProviderContainer`.

### Phase 4: Interactive Radar Dashboard & Editor
- Build `interactive_burn_dial.dart`, `runway_ceiling_card.dart`, `what_if_savings_banner.dart`, `subscription_card.dart`, `subscription_editor_sheet.dart` (with quick-fill presets & Free Trial Guard), and `radar_dashboard_screen.dart`.
- Ensure smooth 60/120fps animations, haptics, swipe-to-simulate, swipe-to-delete with Undo, tap-to-edit, and search filtering.
- **Gate:** Run `flutter analyze`.

### Phase 5: Timeline Calendar, Vault Settings & Floating Shell
- Build `interactive_month_grid.dart`, `day_charge_drawer.dart`, `timeline_screen.dart`.
- Build `vault_settings_screen.dart` (currency picker, editable rates, alert settings, JSON export/import dialog, demo data reset).
- Build `main_shell.dart` with a sleek floating dark glass bottom navigation bar preserving tab state via `IndexedStack`.
- Wire `app.dart` and `main.dart` (status bar styling, DB/Preferences initialization via Riverpod provider overrides, first-run demo seeding).
- **Gate:** Run `flutter analyze`.

### Phase 6: Comprehensive Verification & Final Audit
- Write Widget Tests verifying:
  1. Dashboard renders dial and seeded subscriptions cleanly.
  2. Tapping/simulating pause updates What-If savings banner and lowers active burn.
  3. Adding a new subscription persists and appears in the list.
  4. Switching between Radar, Timeline, and Vault tabs works with zero overflow errors.
  5. JSON Backup export -> import round-trip preserves exact minor units and fields.
- Audit every file for:
  - Zero `print()` statements (use `debugPrint` only if needed).
  - Zero deprecated Flutter APIs.
  - Zero RenderFlex overflow warnings on compact screens (`360x780`).
- **Final Release Gate (ALL MUST PASS):**
  1. `flutter analyze` -> **0 issues found.**
  2. `flutter test` -> **All unit & widget tests pass.**
  3. `flutter build apk --debug` (if Android SDK is available in environment) -> **Build succeeds cleanly.**

---

## 7. Strictly Forbidden Anti-Patterns
- NEVER use `double` to store prices or totals.
- NEVER put database queries or business math directly inside `Widget.build()`.
- NEVER leave placeholder text like `"Coming soon"` or empty `onPressed: () {}` handlers.
- NEVER swallow exceptions silently without either handling gracefully or surfacing clear UI feedback.
- NEVER hardcode colors inside widgets—always read from `context.vaultColors` or `categoryVisuals`.
