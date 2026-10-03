# Obsidian Finance Tracker

A small, mobile-compatible Obsidian plugin for recording and reviewing monthly **Income**, **Investment**, and **Expense** transactions.

## Features
- Add transactions from an Obsidian modal.
- Dynamic category dropdowns for Income, Investment, and Expense.
- Monthly dashboard with Income, Invested, Expenses, and Remaining totals.
- Category breakdown for the selected month.
- Configurable finance folder, currency, and categories.
- Stores every transaction as a normal Markdown file with YAML frontmatter.
- No cloud service, telemetry, or external API.

## Data layout

```text
Finance/
└── Transactions/
    └── 2026/
        └── 09/
            ├── 2026-09-28-....md
            └── 2026-09-29-....md
```

Example:

```yaml
---
type: finance-transaction
date: 2026-09-28
transaction_type: expense
category: "Dining"
amount: 45
description: "Dinner"
---
```

## Development with Codex

Open this folder as the Codex working directory. `AGENTS.md` contains the project-specific instructions, data model, commands, and backlog.

```bash
npm install
npm run build
npm run dev
```

For live plugin development, copy or symlink this project into your vault at:

```text
<Vault>/.obsidian/plugins/finance-tracker/
```

Obsidian needs these built files at runtime:

```text
main.js
manifest.json
styles.css
```

After a build, reload Obsidian and enable **Finance Tracker** under Community plugins.

## Commands in Obsidian

- `Finance: Add transaction`
- `Finance: Open monthly dashboard`

The wallet ribbon icon also opens the dashboard.

## Privacy
All finance data remains in your Obsidian vault. The plugin does not send data anywhere. Your existing vault sync mechanism determines how the files are synchronized between devices.
