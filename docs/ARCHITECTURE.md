# Architecture

## Components

- `FinanceTrackerPlugin`: plugin lifecycle, commands, settings, transaction persistence.
- `TransactionModal`: data-entry UI.
- `FinanceDashboardView`: monthly aggregation and presentation.
- `FinanceSettingTab`: folder, currency, and category configuration.

## Storage
Transaction notes are the source of truth. Derived totals are calculated when the dashboard renders.

## Monthly calculation
For selected month `YYYY-MM`:
- Income = sum of `amount` where `transaction_type=income`.
- Investment = sum where `transaction_type=investment`.
- Expense = sum where `transaction_type=expense`.
- Remaining = Income - Investment - Expense.

## Mobile compatibility
Runtime code uses Obsidian and browser-compatible APIs only. Avoid Node.js/Electron modules in `src/`.
