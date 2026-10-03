# Codex project instructions

## Goal
Build and maintain a mobile-compatible Obsidian finance tracker for monthly income, investments, and expenses.

## Product principles
- Keep financial data as ordinary Markdown files with YAML frontmatter; the plugin must not create a proprietary data store.
- Support both desktop and mobile Obsidian. Do not use Node.js or Electron APIs in runtime plugin code.
- Prefer Obsidian's public Plugin/Vault/UI APIs.
- Keep the MVP local-only. Do not add network calls, analytics, telemetry, or external AI dependencies.
- Amounts are positive values. Transaction type determines whether they count toward income, investment, or expense totals.
- The dashboard must calculate totals from source transaction notes rather than persisting derived totals.

## Data model
Each transaction is a Markdown file under:
`Finance/Transactions/YYYY/MM/`

Frontmatter:
```yaml
---
type: finance-transaction
date: 2026-09-28
transaction_type: expense
category: Dining
amount: 45
description: Dinner
---
```

## Commands
- `npm install`
- `npm run dev` — watch build
- `npm run build` — type-check and production bundle
- `npm run lint`

## Definition of done
Before considering a change complete:
1. `npm run build` passes.
2. `npm run lint` passes or any lint exception is explained.
3. Mobile compatibility is preserved (`isDesktopOnly: false`).
4. Existing transaction notes remain readable and no migration is required unless explicitly documented.

## Near-term backlog
1. Edit and delete transactions.
2. Clickable category drill-down.
3. Month-over-month trend chart without adding a heavy chart dependency.
4. Optional budget targets per category.
5. Export monthly summary to CSV.
6. Tests for transaction parsing and monthly aggregation.
