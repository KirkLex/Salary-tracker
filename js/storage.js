const STORAGE_KEY = "salary-tracker";
const SETTINGS_KEY = "salary-tracker-settings";
const LEDGER_KEY = "salary-tracker-ledger";

const CURRENCIES = [
  { code: "UZS", label: "UZS · сум" },
  { code: "USD", label: "USD · $" },
  { code: "EUR", label: "EUR · €" },
  { code: "RUB", label: "RUB · ₽" },
  { code: "KZT", label: "KZT · ₸" },
];

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInMonth(monthOffset, day) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + monthOffset);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return formatIsoDate(date);
}

function createId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultRates() {
  return { UZS: 1, USD: 12800, EUR: 14000, RUB: 140, KZT: 25 };
}

function defaultCategories() {
  return [
    { id: "inc-salary", name: "Зарплата", type: "income", parentId: "", archived: false },
    { id: "inc-side", name: "Подработка", type: "income", parentId: "", archived: false },
    { id: "inc-other", name: "Прочее доход", type: "income", parentId: "", archived: false },
    { id: "exp-food", name: "Еда", type: "expense", parentId: "", archived: false },
    { id: "exp-transport", name: "Транспорт", type: "expense", parentId: "", archived: false },
    { id: "exp-home", name: "Жильё", type: "expense", parentId: "", archived: false },
    { id: "exp-other", name: "Прочее", type: "expense", parentId: "", archived: false },
  ];
}

function categoryIdForName(name, type) {
  const found = defaultCategories().find((item) => item.type === type && item.name === name);
  if (found) return found.id;
  if (type === "income" && name === "Прочее") return "inc-other";
  return type === "income" ? "inc-other" : "exp-other";
}

function demoTransactions(accountId) {
  const row = (type, amount, category, dayOffset, note) => ({
    id: createId(),
    type,
    amount,
    categoryId: categoryIdForName(category, type),
    accountId,
    toAccountId: "",
    date: dateInMonth(dayOffset < 0 ? -1 : 0, Math.abs(dayOffset) > 31 ? 5 : Math.abs(dayOffset) || 5),
    note,
    recurringId: "",
  });
  return [
    { id: createId(), type: "income", amount: 8500000, categoryId: "inc-salary", accountId, toAccountId: "", date: dateInMonth(0, 5), note: "Оклад", recurringId: "" },
    { id: createId(), type: "income", amount: 1200000, categoryId: "inc-side", accountId, toAccountId: "", date: dateInMonth(0, 18), note: "Проект на выходных", recurringId: "" },
    { id: createId(), type: "expense", amount: 2800000, categoryId: "exp-home", accountId, toAccountId: "", date: dateInMonth(0, 3), note: "Аренда", recurringId: "" },
    { id: createId(), type: "expense", amount: 650000, categoryId: "exp-food", accountId, toAccountId: "", date: dateInMonth(0, 7), note: "Продукты", recurringId: "" },
    { id: createId(), type: "expense", amount: 180000, categoryId: "exp-transport", accountId, toAccountId: "", date: dateInMonth(0, 9), note: "Проездной", recurringId: "" },
    { id: createId(), type: "expense", amount: 420000, categoryId: "exp-food", accountId, toAccountId: "", date: dateInMonth(0, 16), note: "Кафе", recurringId: "" },
    { id: createId(), type: "expense", amount: 99000, categoryId: "exp-other", accountId, toAccountId: "", date: dateInMonth(0, 21), note: "Подписка", recurringId: "" },
    { id: createId(), type: "income", amount: 8000000, categoryId: "inc-salary", accountId, toAccountId: "", date: dateInMonth(-1, 5), note: "Оклад", recurringId: "" },
    { id: createId(), type: "expense", amount: 2800000, categoryId: "exp-home", accountId, toAccountId: "", date: dateInMonth(-1, 3), note: "Аренда", recurringId: "" },
    { id: createId(), type: "expense", amount: 720000, categoryId: "exp-food", accountId, toAccountId: "", date: dateInMonth(-1, 12), note: "Продукты", recurringId: "" },
    { id: createId(), type: "income", amount: 8000000, categoryId: "inc-salary", accountId, toAccountId: "", date: dateInMonth(-2, 5), note: "Оклад", recurringId: "" },
    { id: createId(), type: "expense", amount: 2700000, categoryId: "exp-home", accountId, toAccountId: "", date: dateInMonth(-2, 3), note: "Аренда", recurringId: "" },
    { id: createId(), type: "expense", amount: 210000, categoryId: "exp-transport", accountId, toAccountId: "", date: dateInMonth(-2, 14), note: "Такси", recurringId: "" },
  ];
}

function blankLedger(currency) {
  const accountId = createId();
  return {
    accounts: [{ id: accountId, name: "Основной", currency: currency || "UZS", opening: 0 }],
    categories: defaultCategories(),
    budgets: [],
    recurring: [{
      id: createId(),
      type: "expense",
      amount: 2800000,
      categoryId: "exp-home",
      accountId,
      note: "Аренда",
      day: 1,
      active: true,
    }],
    goals: [{ id: createId(), name: "Резерв", target: 10000000, saved: 2000000, currency: currency || "UZS" }],
    rates: defaultRates(),
    transactions: demoTransactions(accountId),
  };
}

function normalizeLedger(ledger, currency) {
  const base = blankLedger(currency);
  const next = ledger && typeof ledger === "object" ? ledger : {};
  return {
    accounts: Array.isArray(next.accounts) && next.accounts.length ? next.accounts : base.accounts,
    categories: Array.isArray(next.categories) && next.categories.length ? next.categories : base.categories,
    budgets: Array.isArray(next.budgets) ? next.budgets : [],
    recurring: Array.isArray(next.recurring) ? next.recurring : [],
    goals: Array.isArray(next.goals) ? next.goals : [],
    rates: { ...defaultRates(), ...(next.rates || {}) },
    transactions: Array.isArray(next.transactions) ? next.transactions.filter(isTransaction) : [],
  };
}

function isTransaction(item) {
  return (
    item &&
    typeof item.id === "string" &&
    (item.type === "income" || item.type === "expense" || item.type === "transfer") &&
    typeof item.amount === "number" &&
    item.amount > 0 &&
    typeof item.date === "string" &&
    typeof item.accountId === "string"
  );
}

function migrateOldTransactions(list, currency) {
  const ledger = blankLedger(currency);
  ledger.transactions = [];
  ledger.recurring = [];
  ledger.goals = [];
  const accountId = ledger.accounts[0].id;
  list.filter((item) => item && item.id && item.amount > 0 && item.date).forEach((item) => {
    const type = item.type === "income" ? "income" : "expense";
    ledger.transactions.push({
      id: item.id,
      type,
      amount: item.amount,
      categoryId: categoryIdForName(item.category, type),
      accountId,
      toAccountId: "",
      date: item.date,
      note: item.note || "",
      recurringId: "",
    });
  });
  return ledger;
}

function loadLedger(currency) {
  const saved = localStorage.getItem(LEDGER_KEY);
  if (saved) {
    try {
      return normalizeLedger(JSON.parse(saved), currency);
    } catch {
      return blankLedger(currency);
    }
  }
  const old = localStorage.getItem(STORAGE_KEY);
  if (old) {
    try {
      const parsed = JSON.parse(old);
      if (Array.isArray(parsed) && parsed.length) {
        const migrated = migrateOldTransactions(parsed, currency);
        saveLedger(migrated);
        return migrated;
      }
    } catch {
      /* seed below */
    }
  }
  const seeded = blankLedger(currency);
  saveLedger(seeded);
  return seeded;
}

function saveLedger(ledger) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

function loadSettings() {
  const defaults = { theme: "auto", currency: "UZS" };
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const theme = ["light", "dark", "auto"].includes(parsed.theme) ? parsed.theme : defaults.theme;
    const currency = CURRENCIES.some((item) => item.code === parsed.currency) ? parsed.currency : defaults.currency;
    return { theme, currency };
  } catch {
    return defaults;
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
