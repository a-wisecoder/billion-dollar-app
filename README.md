# VaultFlow (Billion Dollar App)

A privacy-first, offline-first **Recurring Cashflow, Subscription & Free-Trial Radar** built with strict integer minor-unit money math, an interactive SVG radial burn dial, a real-time "What-If" savings simulator, an interactive cashflow timeline calendar with heavy-week cluster detection, multi-currency offline normalization (`USD`, `PKR`, `EUR`, `GBP`, `AED`), and versioned JSON backup/restore.

## Features
- **Interactive Burn Rate Dial**: Drag around the glowing radial ring or click categories to filter and inspect spend shares; tap the center to flip between Monthly and Annualized burn rates.
- **"What-If" Savings Simulator**: Simulate pausing any subscription in place and immediately see unlocked annual savings (`Reset` or `Commit Pause` to archive).
- **Monthly Runway Ceiling**: Track active monthly spend against an editable ceiling with color-shifting progress status.
- **Free Trial Guard & Service Presets**: One-tap presets (Netflix, Spotify, ChatGPT Plus, Claude Pro, AWS, etc.) and trial deadline highlighting.
- **Cashflow Timeline Calendar**: Projects recurring weekly, monthly, quarterly, and yearly charges across months and detects heavy 7-day cashflow clusters (`> 40%` of monthly spend).
- **Vault & Portability**: 100% local on-device persistence (`localStorage`), editable offline exchange rates, and schema-validated JSON export/import.

## Quick Start
```bash
npm install
npm run dev
```

## Testing & Typecheck
```bash
npm test
npm run lint
npm run build
```

## Native Flutter Specification
The complete Flutter & Dart architecture and 6-phase implementation specification is preserved in [`instruct.md`](./instruct.md).

