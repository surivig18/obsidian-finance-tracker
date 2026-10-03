import {
  App,
  DropdownComponent,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
} from "obsidian";

const VIEW_TYPE_FINANCE = "finance-dashboard";

type TransactionType = "income" | "investment" | "expense";

interface FinanceTransaction {
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
}

interface FinanceSettings {
  folder: string;
  currency: string;
  categories: Record<TransactionType, string[]>;
}

interface CategorySummary {
  type: TransactionType;
  category: string;
  amount: number;
}

const DEFAULT_SETTINGS: FinanceSettings = {
  folder: "Finance",
  currency: "SGD",
  categories: {
    income: ["Salary", "Bonus", "Interest", "Other"],
    investment: ["ETF", "Stocks", "Bonds", "Other"],
    expense: [
      "Mortgage",
      "Groceries",
      "Dining",
      "Transport",
      "Utilities",
      "Shopping",
      "Travel",
      "Other",
    ],
  },
};

export default class FinanceTrackerPlugin extends Plugin {
  settings!: FinanceSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_FINANCE,
      (leaf) => new FinanceDashboardView(leaf, this),
    );

    this.addRibbonIcon("wallet", "Finance tracker", () => {
      void this.openDashboard();
    });

    this.addCommand({
      id: "add-transaction",
      name: "Finance: Add transaction",
      callback: () => {
        new TransactionModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "open-dashboard",
      name: "Finance: Open monthly dashboard",
      callback: () => {
        void this.openDashboard();
      },
    });

    this.addSettingTab(new FinanceSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        const transactionFolder = `${this.settings.folder}/Transactions/`;
        if (file.path.startsWith(transactionFolder) && file.path.endsWith(".md")) {
          void this.refreshDashboard();
        }
      }),
    );
  }

  async openDashboard(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_FINANCE);
    let leaf: WorkspaceLeaf;

    if (existing.length > 0 && existing[0]) {
      leaf = existing[0];
    } else {
      leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({
        type: VIEW_TYPE_FINANCE,
        active: true,
      });
    }

    await this.app.workspace.revealLeaf(leaf);
  }

  async refreshDashboard(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FINANCE);

    for (const leaf of leaves) {
      if (leaf.view instanceof FinanceDashboardView) {
        await leaf.view.render();
      }
    }
  }

  async saveTransaction(transaction: FinanceTransaction): Promise<void> {
    const [year, month] = transaction.date.split("-");
    if (!year || !month) {
      new Notice("Invalid transaction date.");
      return;
    }

    const folder = `${this.settings.folder}/Transactions/${year}/${month}`;
    await ensureFolder(this.app, folder);

    const filename = `${transaction.date}-${Date.now()}.md`;
    const path = `${folder}/${filename}`;
    const content = `---
type: finance-transaction
date: ${transaction.date}
transaction_type: ${transaction.type}
category: ${JSON.stringify(transaction.category)}
amount: ${transaction.amount}
description: ${JSON.stringify(transaction.description)}
---

# ${transaction.category}

${transaction.description}
`;

    await this.app.vault.create(path, content);

    new Notice(
      `Added ${transaction.category}: ${formatMoney(
        transaction.amount,
        this.settings.currency,
      )}`,
    );

    await this.refreshDashboard();
  }

  async getTransactionsForMonth(
  month: string,
): Promise<FinanceTransaction[]> {
  const [year, monthNumber] = month.split("-");

  if (!year || !monthNumber) {
    return [];
  }

  const prefix =
    `${this.settings.folder}/Transactions/${year}/${monthNumber}/`;

  const files = this.app.vault
    .getMarkdownFiles()
    .filter((file) => file.path.startsWith(prefix));

  const transactions: FinanceTransaction[] = [];

  for (const file of files) {
    // Important: read the actual file instead of cachedRead()
    const text = await this.app.vault.read(file);

    const parsed = parseTransaction(text);

    if (!parsed) {
      continue;
    }

    if (!parsed.date.startsWith(month)) {
      continue;
    }

    // Create a separate object for every transaction
    transactions.push({
      date: parsed.date,
      type: parsed.type,
      category: parsed.category,
      amount: Number(parsed.amount),
      description: parsed.description,
    });
  }

  return transactions.sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

   


  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<FinanceSettings> | null;

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      categories: {
        ...DEFAULT_SETTINGS.categories,
        ...(loaded?.categories ?? {}),
      },
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class TransactionModal extends Modal {
  private readonly plugin: FinanceTrackerPlugin;
  private type: TransactionType = "expense";
  private category = "";
  private amount = 0;
  private date = localDate();
  private description = "";

  constructor(app: App, plugin: FinanceTrackerPlugin) {
    super(app);
    this.plugin = plugin;
    this.category = plugin.settings.categories.expense[0] ?? "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("finance-transaction-modal");
    contentEl.createEl("h2", { text: "Add transaction" });

    new Setting(contentEl).setName("Date").addText((text) => {
      text.setValue(this.date);
      text.inputEl.type = "date";
      text.onChange((value) => {
        this.date = value;
      });
    });

    const categorySetting = new Setting(contentEl).setName("Category");
    let categoryDropdown: DropdownComponent | undefined;

    new Setting(contentEl).setName("Type").addDropdown((dropdown) => {
      dropdown.addOptions({
        income: "Income",
        investment: "Investment",
        expense: "Expense",
      });
      dropdown.setValue(this.type);
      dropdown.onChange((value) => {
        this.type = value as TransactionType;
        const categories = this.plugin.settings.categories[this.type];
        this.category = categories[0] ?? "";
        if (categoryDropdown) {
          updateCategoryDropdown(categoryDropdown, categories);
        }
      });
    });

    categorySetting.addDropdown((dropdown) => {
      categoryDropdown = dropdown;
      updateCategoryDropdown(dropdown, this.plugin.settings.categories[this.type]);
      dropdown.onChange((value) => {
        this.category = value;
      });
    });

    new Setting(contentEl).setName("Amount").addText((text) => {
      text.setPlaceholder("0.00");
      text.inputEl.type = "number";
      text.inputEl.step = "0.01";
      text.onChange((value) => {
        this.amount = Number(value);
      });
    });

    new Setting(contentEl).setName("Description").addText((text) => {
      text.setPlaceholder("Optional note");
      text.onChange((value) => {
        this.description = value;
      });
    });

    const buttons = contentEl.createDiv({ cls: "finance-modal-buttons" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();

    const save = buttons.createEl("button", {
      text: "Add",
      cls: "mod-cta",
    });

    save.onclick = () => {
      void this.handleSave();
    };
  }

  private async handleSave(): Promise<void> {
    if (!this.date) {
      new Notice("Please select a date.");
      return;
    }

    if (!this.category) {
      new Notice("Please select a category.");
      return;
    }

    if (!Number.isFinite(this.amount) || this.amount <= 0) {
      new Notice("Please enter a valid amount.");
      return;
    }

    await this.plugin.saveTransaction({
      date: this.date,
      type: this.type,
      category: this.category,
      amount: this.amount,
      description: this.description.trim(),
    });

    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class FinanceDashboardView extends ItemView {
  private readonly plugin: FinanceTrackerPlugin;
  private month = localDate().substring(0, 7);
  private renderVersion = 0;

  constructor(leaf: WorkspaceLeaf, plugin: FinanceTrackerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_FINANCE;
  }

  getDisplayText(): string {
    return "Finance";
  }

  getIcon(): string {
    return "wallet";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const renderVersion = ++this.renderVersion;
    const container = this.contentEl;
    container.empty();
    container.addClass("finance-dashboard");

    const header = container.createDiv({ cls: "finance-header" });
    header.createEl("h2", { text: "Finance" });

    const controls = header.createDiv({ cls: "finance-header-controls" });
    const monthInput = controls.createEl("input");
    monthInput.type = "month";
    monthInput.value = this.month;
    monthInput.onchange = () => {
      this.month = monthInput.value;
      void this.render();
    };

    const addButton = controls.createEl("button", {
      text: "+ Add transaction",
      cls: "mod-cta",
    });
    addButton.onclick = () => {
      new TransactionModal(this.app, this.plugin).open();
    };

    const transactions = await this.plugin.getTransactionsForMonth(this.month);
    if (renderVersion !== this.renderVersion) {
      return;
    }
    const income = sumByType(transactions, "income");
    const investments = sumByType(transactions, "investment");
    const expenses = sumByType(transactions, "expense");
    const remaining = income - investments - expenses;

    const cards = container.createDiv({ cls: "finance-cards" });
    createCard(cards, "Income", income, this.plugin.settings.currency);
    createCard(cards, "Invested", investments, this.plugin.settings.currency);
    createCard(cards, "Expenses", expenses, this.plugin.settings.currency);
    createCard(cards, "Remaining", remaining, this.plugin.settings.currency);

    container.createEl("h3", { text: "Breakdown" });
    const breakdown = groupByCategory(transactions);

    if (breakdown.length === 0) {
      container.createEl("p", {
        text: "No category totals for this month.",
        cls: "finance-empty",
      });
    } else {
      const breakdownTable = container.createEl("table");
      const breakdownHead = breakdownTable.createEl("thead").createEl("tr");
      for (const name of ["Type", "Category", "Amount"]) {
        breakdownHead.createEl("th", { text: name });
      }

      const breakdownBody = breakdownTable.createEl("tbody");
      for (const item of breakdown) {
        const row = breakdownBody.createEl("tr");
        row.createEl("td", { text: capitalise(item.type) });
        row.createEl("td", { text: item.category });
        row.createEl("td", {
          text: formatMoney(item.amount, this.plugin.settings.currency),
        });
      }
    }

    container.createEl("h3", { text: "Transactions" });
    if (transactions.length === 0) {
      container.createEl("p", {
        text: "No transactions for this month.",
        cls: "finance-empty",
      });
      return;
    }

    const table = container.createEl("table");
    const headingRow = table.createEl("thead").createEl("tr");
    for (const heading of ["Date", "Type", "Category", "Description", "Amount"]) {
      headingRow.createEl("th", { text: heading });
    }

    const tbody = table.createEl("tbody");
    for (const transaction of transactions) {
      const row = tbody.createEl("tr");
      row.createEl("td", { text: transaction.date });
      row.createEl("td", { text: capitalise(transaction.type) });
      row.createEl("td", { text: transaction.category });
      row.createEl("td", { text: transaction.description });
      row.createEl("td", {
        text: formatMoney(transaction.amount, this.plugin.settings.currency),
      });
    }
  }
}

class FinanceSettingTab extends PluginSettingTab {
  private readonly financePlugin: FinanceTrackerPlugin;

  constructor(app: App, plugin: FinanceTrackerPlugin) {
    super(app, plugin);
    this.financePlugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Finance Tracker" });

    new Setting(containerEl)
      .setName("Finance folder")
      .setDesc("Folder used to store transaction notes.")
      .addText((text) => {
        text.setValue(this.financePlugin.settings.folder);
        text.onChange((value) => {
          this.financePlugin.settings.folder = value.trim() || "Finance";
          void this.financePlugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Currency")
      .setDesc("ISO currency code, for example SGD, USD or INR.")
      .addText((text) => {
        text.setValue(this.financePlugin.settings.currency);
        text.onChange((value) => {
          this.financePlugin.settings.currency = value.trim().toUpperCase() || "SGD";
          void this.financePlugin.saveSettings();
        });
      });

    this.addCategorySetting(containerEl, "income", "Income categories");
    this.addCategorySetting(containerEl, "investment", "Investment categories");
    this.addCategorySetting(containerEl, "expense", "Expense categories");
  }

  private addCategorySetting(
    container: HTMLElement,
    type: TransactionType,
    title: string,
  ): void {
    new Setting(container)
      .setName(title)
      .setDesc("Separate categories with commas.")
      .addTextArea((text) => {
        text.setValue(this.financePlugin.settings.categories[type].join(", "));
        text.inputEl.rows = 3;
        text.onChange((value) => {
          const categories = value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

          this.financePlugin.settings.categories[type] = categories;
          void this.financePlugin.saveSettings();
        });
      });
  }
}

function parseTransaction(text: string): FinanceTransaction | null {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match?.[1]) return null;

  const values: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;

    const key = line.substring(0, separator).trim();
    const value = unquoteYamlScalar(line.substring(separator + 1).trim());
    values[key] = value;
  }

  if (values.type !== "finance-transaction") return null;
  if (!isTransactionType(values.transaction_type)) return null;
  if (!values.date || !values.category) return null;

  const amount = Number(values.amount);
  if (!Number.isFinite(amount)) return null;

  return {
    date: values.date,
    type: values.transaction_type,
    category: values.category,
    amount,
    description: values.description ?? "",
  };
}

function unquoteYamlScalar(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "string" ? parsed : value;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function isTransactionType(value: string | undefined): value is TransactionType {
  return value === "income" || value === "investment" || value === "expense";
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  let current = "";

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

function updateCategoryDropdown(
  dropdown: DropdownComponent,
  categories: string[],
): void {
  dropdown.selectEl.empty();

  for (const category of categories) {
    dropdown.addOption(category, category);
  }

  if (categories[0]) {
    dropdown.setValue(categories[0]);
  }
}

function sumByType(
  transactions: FinanceTransaction[],
  type: TransactionType,
): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function groupByCategory(transactions: FinanceTransaction[]): CategorySummary[] {
  const result = new Map<string, CategorySummary>();

  for (const transaction of transactions) {
    const key = `${transaction.type}:${transaction.category}`;
    const existing = result.get(key);

    if (existing) {
      existing.amount += transaction.amount;
    } else {
      result.set(key, {
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
      });
    }
  }

  return Array.from(result.values()).sort((a, b) => b.amount - a.amount);
}

function createCard(
  parent: HTMLElement,
  label: string,
  amount: number,
  currency: string,
): void {
  const card = parent.createDiv({ cls: "finance-card" });
  card.createDiv({ text: label, cls: "finance-card-label" });
  card.createDiv({
    text: formatMoney(amount, currency),
    cls: "finance-card-value",
  });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function localDate(): string {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().substring(0, 10);
}
