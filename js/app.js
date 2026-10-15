const settings = loadSettings();
const state = {
  ledger: loadLedger(settings.currency),
  period: "month",
  from: "",
  to: "",
  search: "",
  filterType: "all",
  filterCategory: "all",
  filterAccount: "all",
  editingId: null,
  view: "summary",
  threadDay: null,
};

const form = document.getElementById("transaction-form");
const periodSelect = document.getElementById("period");
const currencySelect = document.getElementById("currency");
const typeInputs = form.querySelectorAll('input[name="type"]');
const categorySelect = document.getElementById("category");
const accountSelect = document.getElementById("account");
const targetSelect = document.getElementById("target-account");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const idInput = document.getElementById("transaction-id");
const errorBox = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-btn");
const submitBtn = document.getElementById("submit-btn");
const listBody = document.getElementById("transaction-list");

function motionOff() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function todayIso() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthStamp(offset = 0) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(offset) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function rateOf(code) {
  if (code === "UZS") return 1;
  const value = Number(state.ledger.rates[code]);
  return value > 0 ? value : 1;
}

function toDisplay(amount, currency) {
  return amount * rateOf(currency) / rateOf(settings.currency);
}

function formatIn(amount, currency) {
  const whole = ["UZS", "KZT", "RUB"].includes(currency);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

function formatMoney(amount) {
  return formatIn(amount, settings.currency);
}

function accountById(id) {
  return state.ledger.accounts.find((item) => item.id === id);
}

function categoryById(id) {
  return state.ledger.categories.find((item) => item.id === id);
}

function categoryLabel(category) {
  if (!category) return "Без категории";
  const parent = categoryById(category.parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function currentType() {
  return form.querySelector('input[name="type"]:checked').value;
}

function activeCategories(type) {
  return state.ledger.categories.filter((item) => item.type === type && !item.archived);
}

function fillSelect(select, options, placeholder) {
  const current = select.value;
  select.innerHTML = `${placeholder || ""}${options.join("")}`;
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function fillAccounts(select, selected) {
  fillSelect(select, state.ledger.accounts.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${item.currency}</option>`));
  if (selected) select.value = selected;
}

function fillCategories(selected) {
  const type = currentType();
  const field = document.getElementById("category-field");
  const target = document.getElementById("target-field");
  const transfer = type === "transfer";
  field.hidden = transfer;
  categorySelect.required = !transfer;
  target.hidden = !transfer;
  if (!transfer) {
    fillSelect(categorySelect, activeCategories(type).map((item) => `<option value="${item.id}">${escapeHtml(categoryLabel(item))}</option>`));
    if (selected) categorySelect.value = selected;
  }
  updateAmountLabel();
}

function updateAmountLabel() {
  const account = accountById(accountSelect.value);
  document.getElementById("amount-label").textContent = `Сумма, ${account?.currency || settings.currency}`;
}

function inCurrentMonth(transaction, offset) {
  return transaction.date.startsWith(monthStamp(offset));
}

function inPeriod(transaction) {
  if (state.period === "all") return true;
  if (state.period === "custom") {
    if (state.from && transaction.date < state.from) return false;
    if (state.to && transaction.date > state.to) return false;
    return true;
  }
  return inCurrentMonth(transaction, 0);
}

function matchesList(transaction) {
  if (!inPeriod(transaction)) return false;
  if (state.filterType !== "all" && transaction.type !== state.filterType) return false;
  if (state.filterCategory !== "all" && transaction.categoryId !== state.filterCategory) return false;
  if (state.filterAccount !== "all" && transaction.accountId !== state.filterAccount && transaction.toAccountId !== state.filterAccount) return false;
  const query = state.search.trim().toLowerCase();
  if (!query) return true;
  const text = `${transaction.note} ${categoryLabel(categoryById(transaction.categoryId))}`.toLowerCase();
  return text.includes(query);
}

function sortTransactions(items) {
  return items.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function analyticsItems() {
  return sortTransactions(state.ledger.transactions.filter(inPeriod).filter((item) => item.type !== "transfer"))
    .map((item) => ({
      ...item,
      amount: toDisplay(item.amount, accountById(item.accountId)?.currency || "UZS"),
      category: categoryLabel(categoryById(item.categoryId)),
    }));
}

function totals(items) {
  const income = items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  return { income, expense, balance: income - expense };
}

function accountBalance(account) {
  let sum = Number(account.opening) || 0;
  state.ledger.transactions.forEach((item) => {
    if (item.accountId === account.id) {
      if (item.type === "income") sum += item.amount;
      if (item.type === "expense" || item.type === "transfer") sum -= item.amount;
    }
    if (item.type === "transfer" && item.toAccountId === account.id) {
      const source = accountById(item.accountId);
      sum += item.amount * rateOf(source?.currency || account.currency) / rateOf(account.currency);
    }
  });
  return sum;
}

function showError(message) {
  errorBox.hidden = !message;
  errorBox.textContent = message || "";
}

function animateValue(element, next, signed) {
  const from = Number(element.dataset.value || 0);
  if (signed) {
    element.classList.toggle("is-negative", next < 0);
    element.classList.toggle("is-positive", next > 0);
  }
  if (motionOff() || from === next) {
    element.dataset.value = String(next);
    element.textContent = formatMoney(next);
    return;
  }
  const started = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / 520);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = formatMoney(from + (next - from) * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else element.dataset.value = String(next);
  };
  requestAnimationFrame(tick);
}

function resetForm() {
  state.editingId = null;
  form.reset();
  idInput.value = "";
  dateInput.value = todayIso();
  fillAccounts(accountSelect);
  fillAccounts(targetSelect);
  fillCategories();
  document.getElementById("form-title").textContent = "Новая операция";
  submitBtn.textContent = "Добавить";
  cancelBtn.hidden = true;
  showError("");
}

function typeTitle(type) {
  if (type === "income") return "Доход";
  if (type === "transfer") return "Перевод";
  return "Расход";
}

function transactionRow(item, compact, display) {
  const account = accountById(item.accountId);
  const target = accountById(item.toAccountId);
  const sign = item.type === "expense" ? "−" : "+";
  const money = display
    ? formatMoney(item.amount)
    : formatIn(item.amount, account?.currency || settings.currency);
  const title = item.type === "transfer"
    ? `${account?.name || "Счёт"} → ${target?.name || "Счёт"}`
    : categoryLabel(categoryById(item.categoryId));
  const badge = compact ? "" : `<span class="badge ${item.type}">${typeTitle(item.type)}</span>`;
  const actions = compact
    ? ""
    : `<div><button type="button" class="btn-text" data-edit="${item.id}">Изменить</button><button type="button" class="btn-text danger" data-delete="${item.id}">Удалить</button></div>`;
  return `
    <li class="tx-row">
      <div>
        <span class="tx-cat">${escapeHtml(title)}</span>
        <span class="tx-note">${escapeHtml(item.note || account?.name || "Без комментария")}</span>
        ${badge}
      </div>
      <div>
        <time class="tx-date">${new Date(`${item.date}T00:00:00`).toLocaleDateString("ru-RU")}</time>
        <div class="amount ${item.type}">${item.type === "transfer" ? "" : sign}${money}</div>
      </div>
      ${actions}
    </li>`;
}

function periodCaption() {
  if (state.period === "month") return "текущий месяц";
  if (state.period === "custom") return "выбранные даты";
  return "всё время";
}

function renderSummary(items) {
  const sum = totals(items);
  animateValue(document.getElementById("income-total"), sum.income);
  animateValue(document.getElementById("expense-total"), sum.expense);
  animateValue(document.getElementById("balance-total"), sum.balance, true);
  document.getElementById("overview-title").textContent = state.period === "month" ? monthName(0) : periodCaption();
  document.getElementById("bar-caption").textContent = state.period === "all" ? "По месяцам" : "По дням выбранного периода";
  document.getElementById("list-caption").textContent = `За ${periodCaption()}`;
  document.getElementById("overview-caption").textContent = `Суммы пересчитаны в ${settings.currency}`;
  renderThread();
}

function renderThread() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const stamp = monthStamp(0);
  const byDay = Array.from({ length: days }, () => ({ income: 0, expense: 0 }));
  state.ledger.transactions
    .filter((item) => item.date.startsWith(stamp) && item.type !== "transfer")
    .forEach((item) => {
      const index = Number(item.date.slice(8, 10)) - 1;
      const amount = toDisplay(item.amount, accountById(item.accountId)?.currency || "UZS");
      if (byDay[index] && item.type === "income") byDay[index].income += amount;
      if (byDay[index] && item.type === "expense") byDay[index].expense += amount;
    });
  const income = byDay.reduce((sum, day) => sum + day.income, 0);
  const expense = byDay.reduce((sum, day) => sum + day.expense, 0);
  const spent = byDay.slice(0, today).reduce((sum, day) => sum + day.expense, 0);
  const upcoming = state.ledger.recurring
    .filter((item) => item.active && item.type === "expense" && Number(item.day) > today)
    .filter((item) => !state.ledger.transactions.some((tx) => tx.recurringId === item.id && tx.date.startsWith(stamp)))
    .reduce((sum, item) => sum + toDisplay(item.amount, accountById(item.accountId)?.currency || "UZS"), 0);
  const pool = income - expense - upcoming;
  const daysLeft = days - today + 1;
  const allowance = pool / daysLeft;
  const after = days - today;
  if (!state.threadDay || state.threadDay < 1 || state.threadDay > days) {
    let best = today;
    let bestValue = -1;
    byDay.forEach((day, index) => {
      if (day.expense > bestValue) {
        bestValue = day.expense;
        best = index + 1;
      }
    });
    state.threadDay = bestValue > 0 ? best : today;
  }
  const picked = state.threadDay;
  const pickedSpend = byDay[picked - 1].expense;
  const replayEnd = pool - pickedSpend * after;
  const pace = today ? spent / today : 0;
  const paceEnd = pool - pace * after;
  const peak = Math.max(1, ...byDay.map((day) => Math.max(day.income, day.expense)));
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const blanks = Array.from({ length: offset }, () => `<span class="knot-blank"></span>`).join("");
  const bar = (value) => `${value > 0 ? Math.max(8, Math.round((value / peak) * 22)) : 0}px`;
  document.getElementById("thread-title").textContent = monthName(0);
  const todayNode = document.getElementById("thread-today");
  todayNode.textContent = formatMoney(allowance);
  todayNode.classList.toggle("is-negative", allowance < 0);
  document.getElementById("thread-hint").textContent = upcoming
    ? `После трат и ещё ${formatMoney(upcoming)} повторов, на ${daysLeft} дн.`
    : `Остаток месяца делится на ${daysLeft} дн.`;
  const replayNode = document.getElementById("thread-replay");
  const paceNode = document.getElementById("thread-pace");
  replayNode.textContent = formatMoney(replayEnd);
  paceNode.textContent = formatMoney(paceEnd);
  replayNode.classList.toggle("is-negative", replayEnd < 0);
  paceNode.classList.toggle("is-negative", paceEnd < 0);
  document.getElementById("thread-strip").innerHTML = blanks + byDay.map((day, index) => {
    const number = index + 1;
    const future = number > today;
    return `
      <button type="button" class="knot${number === today ? " is-today" : ""}${number === picked ? " is-picked" : ""}${future ? " is-future" : ""}" data-thread-day="${number}" role="option" aria-selected="${number === picked}">
        <span class="knot-plot" aria-hidden="true">
          <span class="knot-in" style="height:${bar(day.income)}"></span>
          <span class="knot-out" style="height:${bar(day.expense)}"></span>
        </span>
        <span class="knot-num">${number}</span>
      </button>`;
  }).join("");
  const when = new Date(year, month, picked).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  document.getElementById("thread-story").textContent = after
    ? `${when}: расход ${formatMoney(pickedSpend)}. Так до конца месяца — цифра слева. Средний день до сегодня — цифра справа.`
    : "Сегодня последний день месяца. Нить уже дошла до края.";
}

function renderLists() {
  const items = sortTransactions(state.ledger.transactions.filter(matchesList));
  listBody.innerHTML = items.map((item) => transactionRow(item, false)).join("");
  document.getElementById("list-empty").hidden = items.length > 0;
  fillSelect(document.getElementById("filter-category"), [
    `<option value="all">Все категории</option>`,
    ...state.ledger.categories.map((item) => `<option value="${item.id}">${escapeHtml(categoryLabel(item))}</option>`),
  ]);
  document.getElementById("filter-category").value = state.filterCategory;
  fillSelect(document.getElementById("filter-account"), [
    `<option value="all">Все счета</option>`,
    ...state.ledger.accounts.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`),
  ]);
  document.getElementById("filter-account").value = state.filterAccount;
}

function deltaInfo(current, previous, invert) {
  if (!previous) return { text: "Нет данных за прошлый месяц", tone: "neutral" };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { text: "Без изменений к прошлому месяцу", tone: "neutral" };
  const better = invert ? percent < 0 : percent > 0;
  const sign = percent > 0 ? "+" : "";
  return { text: `${sign}${percent}% к прошлому месяцу`, tone: better ? "good" : "bad" };
}

function statCard(label, value, delta) {
  return `
    <article class="card">
      <p class="card-label">${label}</p>
      <p class="card-value ${value < 0 ? "is-negative" : ""}">${formatMoney(value)}</p>
      <p class="delta ${delta.tone}">${delta.text}</p>
    </article>`;
}

function monthAnalytics(offset) {
  return state.ledger.transactions
    .filter((item) => inCurrentMonth(item, offset) && item.type !== "transfer")
    .map((item) => ({
      ...item,
      amount: toDisplay(item.amount, accountById(item.accountId)?.currency || "UZS"),
      category: categoryLabel(categoryById(item.categoryId)),
    }));
}

function renderReport() {
  const currentItems = monthAnalytics(0);
  const previousItems = monthAnalytics(-1);
  const current = totals(currentItems);
  const previous = totals(previousItems);
  const day = Math.max(1, new Date().getDate());
  const savings = current.income ? Math.round((current.balance / current.income) * 100) : null;
  document.getElementById("report-title").textContent = `Отчёт · ${monthName(0)}`;
  document.getElementById("report-lead").textContent = savings === null
    ? "В этом месяце ещё нет доходов"
    : `Норма сбережений ${savings}% · в среднем ${formatMoney(current.expense / day)} расходов в день`;
  document.getElementById("report-stats").innerHTML = [
    statCard("Доходы", current.income, deltaInfo(current.income, previous.income, false)),
    statCard("Расходы", current.expense, deltaInfo(current.expense, previous.expense, true)),
    statCard("Баланс", current.balance, deltaInfo(current.balance, previous.balance, false)),
  ].join("");

  const categories = new Map();
  currentItems.filter((item) => item.type === "expense").forEach((item) => {
    categories.set(item.category, (categories.get(item.category) || 0) + item.amount);
  });
  const ranked = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  const max = ranked[0]?.[1] || 1;
  document.getElementById("category-report").innerHTML = ranked.map(([name, amount]) => `
    <li>
      <div class="meter-label"><span>${escapeHtml(name)}</span><strong>${formatMoney(amount)}</strong></div>
      <div class="meter-track"><span style="width:${Math.max(6, (amount / max) * 100)}%"></span></div>
    </li>`).join("");
  document.getElementById("category-empty").hidden = ranked.length > 0;
  const largest = currentItems.filter((item) => item.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
  document.getElementById("largest-list").innerHTML = largest.map((item) => transactionRow(item, true, true)).join("");
  document.getElementById("largest-empty").hidden = largest.length > 0;
}

function renderAccounts() {
  document.getElementById("account-list").innerHTML = state.ledger.accounts.map((account) => `
    <li class="tx-row">
      <div>
        <span class="tx-cat">${escapeHtml(account.name)}</span>
        <span class="tx-note">${account.currency}</span>
      </div>
      <div class="amount">${formatIn(accountBalance(account), account.currency)}</div>
      <button type="button" class="btn-text danger" data-delete-account="${account.id}">Удалить</button>
    </li>`).join("");
  fillSelect(document.getElementById("account-currency"), CURRENCIES.map((item) => `<option value="${item.code}">${item.label}</option>`));
}

function renderBudget() {
  const month = monthStamp(0);
  document.getElementById("budget-caption").textContent = `${monthName(0)} · план в ${settings.currency}`;
  const spent = new Map();
  monthAnalytics(0).filter((item) => item.type === "expense").forEach((item) => {
    const id = state.ledger.transactions.find((tx) => tx.id === item.id)?.categoryId;
    if (id) spent.set(id, (spent.get(id) || 0) + item.amount);
  });
  document.getElementById("budget-list").innerHTML = state.ledger.categories
    .filter((item) => item.type === "expense" && !item.archived)
    .map((category) => {
      const plan = state.ledger.budgets.find((item) => item.categoryId === category.id && item.month === month);
      const planned = plan ? toDisplay(plan.amount, plan.currency) : 0;
      const actual = spent.get(category.id) || 0;
      const width = planned > 0 ? Math.min(100, (actual / planned) * 100) : (actual > 0 ? 100 : 0);
      return `
        <li>
          <div class="budget-line">
            <span>${escapeHtml(categoryLabel(category))}</span>
            <input type="number" min="0" step="0.01" data-budget="${category.id}" value="${planned ? String(Math.round(planned)) : ""}" placeholder="План">
          </div>
          <div class="meter-label"><span>${formatMoney(actual)}</span><strong>${planned ? formatMoney(planned) : "без плана"}</strong></div>
          <div class="meter-track"><span style="width:${width}%"></span></div>
        </li>`;
    }).join("");
}

function isDue(item) {
  if (!item.active) return false;
  const today = new Date();
  if (today.getDate() < Number(item.day)) return false;
  return !state.ledger.transactions.some((tx) => tx.recurringId === item.id && tx.date.startsWith(monthStamp(0)));
}

function renderRecurring() {
  fillSelect(document.getElementById("recurring-category"), activeCategories(document.getElementById("recurring-type").value)
    .map((item) => `<option value="${item.id}">${escapeHtml(categoryLabel(item))}</option>`));
  fillAccounts(document.getElementById("recurring-account"));
  document.getElementById("recurring-list").innerHTML = state.ledger.recurring.map((item) => `
    <li class="tx-row">
      <div>
        <span class="tx-cat">${escapeHtml(categoryLabel(categoryById(item.categoryId)))}</span>
        <span class="tx-note">${item.day} числа · ${escapeHtml(item.note || accountById(item.accountId)?.name || "")}</span>
      </div>
      <div class="amount ${item.type}">${formatIn(item.amount, accountById(item.accountId)?.currency || settings.currency)}</div>
      <div>
        ${isDue(item) ? `<button type="button" class="btn-text" data-post="${item.id}">Провести</button>` : ""}
        <button type="button" class="btn-text danger" data-delete-recurring="${item.id}">Удалить</button>
      </div>
    </li>`).join("");
  const due = state.ledger.recurring.filter(isDue);
  const banner = document.getElementById("due-banner");
  banner.hidden = due.length === 0;
  banner.innerHTML = due.length
    ? `Пора провести ${due.length} повтор. <button type="button" id="post-due">Провести все</button>`
    : "";
}

function renderGoals() {
  fillSelect(document.getElementById("goal-currency"), CURRENCIES.map((item) => `<option value="${item.code}">${item.label}</option>`));
  document.getElementById("goal-list").innerHTML = state.ledger.goals.map((goal) => {
    const width = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
    return `
      <li class="tx-row">
        <div>
          <span class="tx-cat">${escapeHtml(goal.name)}</span>
          <span class="tx-note">${formatIn(goal.saved, goal.currency)} из ${formatIn(goal.target, goal.currency)}</span>
          <div class="meter-track"><span style="width:${width}%"></span></div>
        </div>
        <input type="number" min="0.01" step="0.01" data-goal-amount="${goal.id}" placeholder="Сумма">
        <button type="button" class="btn-text" data-fund="${goal.id}">Внести</button>
      </li>`;
  }).join("");
}

function renderCategories() {
  const type = document.getElementById("category-type").value;
  fillSelect(document.getElementById("category-parent"), [
    `<option value="">Без родителя</option>`,
    ...state.ledger.categories.filter((item) => item.type === type && !item.parentId && !item.archived)
      .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`),
  ]);
  document.getElementById("category-list").innerHTML = state.ledger.categories.map((item) => `
    <li class="tx-row">
      <div>
        <span class="tx-cat">${escapeHtml(categoryLabel(item))}</span>
        <span class="tx-note">${item.type === "income" ? "Доход" : "Расход"}${item.archived ? " · в архиве" : ""}</span>
      </div>
      <button type="button" class="btn-text" data-archive="${item.id}">${item.archived ? "Вернуть" : "В архив"}</button>
    </li>`).join("");
}

function renderRates() {
  document.getElementById("rates-form").innerHTML = CURRENCIES.filter((item) => item.code !== "UZS").map((item) => `
    <label class="field">
      <span>1 ${item.code}</span>
      <input type="number" min="0.0001" step="0.01" data-rate="${item.code}" value="${state.ledger.rates[item.code] || ""}">
    </label>`).join("") + `<button type="submit" class="btn btn-primary">Сохранить курсы</button>`;
}

function paint() {
  const items = analyticsItems();
  renderSummary(items);
  renderLists();
  renderReport();
  renderAccounts();
  renderBudget();
  renderRecurring();
  renderGoals();
  renderCategories();
  renderRates();
  if (state.view === "flow") ChartBoard.renderBar(items, state.period === "all" ? "all" : state.period);
  if (state.view === "categories") ChartBoard.renderDonut(items);
  if (state.view === "flow" || state.view === "categories") requestAnimationFrame(() => ChartBoard.resize());
  saveLedger(state.ledger);
}

let viewLock = false;

function showView(view) {
  if (!view || view === state.view || viewLock) return;
  const current = document.querySelector(`[data-view-panel="${state.view}"]`);
  const next = document.querySelector(`[data-view-panel="${view}"]`);
  if (!next || !current) return;
  const order = ["summary", "flow", "categories", "transactions", "accounts", "budget", "recurring", "goals", "report", "data"];
  const dir = order.indexOf(view) > order.indexOf(state.view) ? "forward" : "back";
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.getElementById("more-sheet").hidden = true;
  document.getElementById("more-open").classList.toggle("is-active", !["summary", "transactions", "budget", "report"].includes(view));
  const reveal = () => {
    current.classList.remove("is-active", "is-leaving");
    current.setAttribute("aria-hidden", "true");
    next.classList.add("is-active");
    next.setAttribute("aria-hidden", "false");
    paint();
  };
  if (motionOff()) {
    reveal();
    return;
  }
  viewLock = true;
  next.dataset.dir = dir;
  current.dataset.dir = dir;
  next.classList.add("is-active");
  next.setAttribute("aria-hidden", "false");
  current.classList.remove("is-active");
  current.classList.add("is-leaving");
  paint();
  const finish = (event) => {
    if (event && event.target !== current) return;
    current.classList.remove("is-leaving");
    current.setAttribute("aria-hidden", "true");
    viewLock = false;
    if (state.view === "flow" || state.view === "categories") ChartBoard.resize();
  };
  current.addEventListener("animationend", finish);
  window.setTimeout(() => {
    if (!viewLock) return;
    current.removeEventListener("animationend", finish);
    finish();
  }, 520);
}

function applyTheme(theme) {
  settings.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.themeChoice === theme);
  });
  saveSettings(settings);
  requestAnimationFrame(() => ChartBoard.syncTheme());
}

function fillCurrency() {
  currencySelect.innerHTML = CURRENCIES.map((item) => `<option value="${item.code}">${item.label}</option>`).join("");
  currencySelect.value = settings.currency;
}

function startEdit(id) {
  const item = state.ledger.transactions.find((entry) => entry.id === id);
  if (!item) return;
  showView("transactions");
  state.editingId = id;
  idInput.value = id;
  form.querySelector(`input[name="type"][value="${item.type}"]`).checked = true;
  fillAccounts(accountSelect, item.accountId);
  fillAccounts(targetSelect, item.toAccountId);
  fillCategories(item.categoryId);
  amountInput.value = String(item.amount);
  dateInput.value = item.date;
  noteInput.value = item.note || "";
  document.getElementById("form-title").textContent = "Изменить операцию";
  submitBtn.textContent = "Сохранить";
  cancelBtn.hidden = false;
  showError("");
}

function removeTransaction(id) {
  const item = state.ledger.transactions.find((entry) => entry.id === id);
  if (!item) return;
  if (!window.confirm("Удалить операцию?")) return;
  state.ledger.transactions = state.ledger.transactions.filter((entry) => entry.id !== id);
  if (state.editingId === id) resetForm();
  paint();
}

function postRecurring(item) {
  state.ledger.transactions.push({
    id: createId(),
    type: item.type,
    amount: item.amount,
    categoryId: item.categoryId,
    accountId: item.accountId,
    toAccountId: "",
    date: todayIso(),
    note: item.note,
    recurringId: item.id,
  });
}

function download(filename, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(amountInput.value);
  const type = currentType();
  const accountId = accountSelect.value;
  const toAccountId = targetSelect.value;
  if (!Number.isFinite(amount) || amount <= 0) {
    showError("Укажите сумму больше нуля");
    return;
  }
  if (!dateInput.value) {
    showError("Укажите дату");
    return;
  }
  if (!accountId) {
    showError("Выберите счёт");
    return;
  }
  if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
    showError("Выберите другой счёт для перевода");
    return;
  }
  if (type !== "transfer" && !categorySelect.value) {
    showError("Выберите категорию");
    return;
  }
  const payload = {
    id: state.editingId || createId(),
    type,
    amount,
    categoryId: type === "transfer" ? "" : categorySelect.value,
    accountId,
    toAccountId: type === "transfer" ? toAccountId : "",
    date: dateInput.value,
    note: noteInput.value.trim(),
    recurringId: "",
  };
  if (state.editingId) {
    state.ledger.transactions = state.ledger.transactions.map((item) => (item.id === state.editingId ? payload : item));
  } else {
    state.ledger.transactions.push(payload);
  }
  resetForm();
  paint();
});

document.getElementById("category-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("category-name").value.trim();
  if (!name) return;
  state.ledger.categories.push({
    id: createId(),
    name,
    type: document.getElementById("category-type").value,
    parentId: document.getElementById("category-parent").value,
    archived: false,
  });
  event.currentTarget.reset();
  paint();
});

document.getElementById("account-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.ledger.accounts.push({
    id: createId(),
    name: document.getElementById("account-name").value.trim(),
    currency: document.getElementById("account-currency").value,
    opening: Number(document.getElementById("account-opening").value) || 0,
  });
  event.currentTarget.reset();
  paint();
});

document.getElementById("recurring-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.ledger.recurring.push({
    id: createId(),
    type: document.getElementById("recurring-type").value,
    amount: Number(document.getElementById("recurring-amount").value),
    categoryId: document.getElementById("recurring-category").value,
    accountId: document.getElementById("recurring-account").value,
    note: document.getElementById("recurring-note").value.trim(),
    day: Number(document.getElementById("recurring-day").value),
    active: true,
  });
  event.currentTarget.reset();
  paint();
});

document.getElementById("goal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.ledger.goals.push({
    id: createId(),
    name: document.getElementById("goal-name").value.trim(),
    target: Number(document.getElementById("goal-target").value),
    saved: 0,
    currency: document.getElementById("goal-currency").value,
  });
  event.currentTarget.reset();
  paint();
});

document.getElementById("rates-form").addEventListener("submit", (event) => {
  event.preventDefault();
  event.currentTarget.querySelectorAll("[data-rate]").forEach((input) => {
    const value = Number(input.value);
    if (value > 0) state.ledger.rates[input.dataset.rate] = value;
  });
  paint();
});

typeInputs.forEach((input) => input.addEventListener("change", () => fillCategories()));
accountSelect.addEventListener("change", updateAmountLabel);
document.getElementById("recurring-type").addEventListener("change", renderRecurring);
document.getElementById("category-type").addEventListener("change", renderCategories);

periodSelect.addEventListener("change", () => {
  state.period = periodSelect.value;
  const custom = state.period === "custom";
  document.getElementById("custom-from").hidden = !custom;
  document.getElementById("custom-to").hidden = !custom;
  if (custom && !state.from) {
    state.from = `${monthStamp(0)}-01`;
    state.to = todayIso();
    document.getElementById("date-from").value = state.from;
    document.getElementById("date-to").value = state.to;
  }
  paint();
});

document.getElementById("date-from").addEventListener("change", (event) => {
  state.from = event.target.value;
  paint();
});
document.getElementById("date-to").addEventListener("change", (event) => {
  state.to = event.target.value;
  paint();
});
document.getElementById("search").addEventListener("input", (event) => {
  state.search = event.target.value;
  renderLists();
});
document.getElementById("filter-type").addEventListener("change", (event) => {
  state.filterType = event.target.value;
  renderLists();
});
document.getElementById("filter-category").addEventListener("change", (event) => {
  state.filterCategory = event.target.value;
  renderLists();
});
document.getElementById("filter-account").addEventListener("change", (event) => {
  state.filterAccount = event.target.value;
  renderLists();
});

currencySelect.addEventListener("change", () => {
  settings.currency = currencySelect.value;
  saveSettings(settings);
  document.querySelectorAll(".card-value").forEach((element) => {
    element.dataset.value = "0";
  });
  paint();
});
cancelBtn.addEventListener("click", resetForm);

document.getElementById("theme-switch").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-theme-choice]")?.dataset.themeChoice;
  if (choice) applyTheme(choice);
});
document.querySelector(".tabs").addEventListener("click", (event) => {
  const view = event.target.closest("[data-view]")?.dataset.view;
  if (view) showView(view);
});
document.querySelector(".side-links").addEventListener("click", (event) => {
  const view = event.target.closest("[data-view]")?.dataset.view;
  if (view) showView(view);
});
document.querySelector(".dock").addEventListener("click", (event) => {
  const view = event.target.closest("[data-view]")?.dataset.view;
  if (view) showView(view);
});
document.getElementById("more-open").addEventListener("click", () => {
  document.getElementById("more-sheet").hidden = false;
});
document.getElementById("more-sheet").addEventListener("click", (event) => {
  if (event.target.id === "more-close" || event.target.id === "more-sheet") {
    document.getElementById("more-sheet").hidden = true;
    return;
  }
  const view = event.target.closest("[data-view]")?.dataset.view;
  if (view) showView(view);
});
document.getElementById("thread-strip").addEventListener("click", (event) => {
  const day = event.target.closest("[data-thread-day]")?.dataset.threadDay;
  if (!day) return;
  state.threadDay = Number(day);
  renderThread();
});

listBody.addEventListener("click", (event) => {
  const editId = event.target.closest("[data-edit]")?.dataset.edit;
  const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
  if (editId) startEdit(editId);
  if (deleteId) removeTransaction(deleteId);
});

document.getElementById("category-list").addEventListener("click", (event) => {
  const id = event.target.closest("[data-archive]")?.dataset.archive;
  const category = categoryById(id);
  if (!category) return;
  category.archived = !category.archived;
  paint();
});

document.getElementById("account-list").addEventListener("click", (event) => {
  const id = event.target.closest("[data-delete-account]")?.dataset.deleteAccount;
  if (!id) return;
  const used = state.ledger.transactions.some((item) => item.accountId === id || item.toAccountId === id);
  if (used || state.ledger.accounts.length === 1) {
    window.alert("Счёт с операциями или последний счёт удалить нельзя");
    return;
  }
  state.ledger.accounts = state.ledger.accounts.filter((item) => item.id !== id);
  paint();
});

document.getElementById("budget-list").addEventListener("change", (event) => {
  const input = event.target.closest("[data-budget]");
  if (!input) return;
  const month = monthStamp(0);
  const amount = Number(input.value) || 0;
  const existing = state.ledger.budgets.find((item) => item.categoryId === input.dataset.budget && item.month === month);
  if (existing) {
    existing.amount = amount;
    existing.currency = settings.currency;
  } else if (amount > 0) {
    state.ledger.budgets.push({
      id: createId(),
      categoryId: input.dataset.budget,
      month,
      amount,
      currency: settings.currency,
    });
  }
  paint();
});

document.getElementById("recurring-list").addEventListener("click", (event) => {
  const postId = event.target.closest("[data-post]")?.dataset.post;
  const deleteId = event.target.closest("[data-delete-recurring]")?.dataset.deleteRecurring;
  if (postId) postRecurring(state.ledger.recurring.find((item) => item.id === postId));
  if (deleteId) state.ledger.recurring = state.ledger.recurring.filter((item) => item.id !== deleteId);
  if (postId || deleteId) paint();
});

document.getElementById("due-banner").addEventListener("click", (event) => {
  if (event.target.id !== "post-due") return;
  state.ledger.recurring.filter(isDue).forEach(postRecurring);
  paint();
});

document.getElementById("goal-list").addEventListener("click", (event) => {
  const id = event.target.closest("[data-fund]")?.dataset.fund;
  if (!id) return;
  const goal = state.ledger.goals.find((item) => item.id === id);
  const input = document.querySelector(`[data-goal-amount="${id}"]`);
  const amount = Number(input?.value);
  if (!goal || !amount || amount <= 0) return;
  goal.saved += amount;
  input.value = "";
  paint();
});

document.getElementById("export-csv").addEventListener("click", () => {
  const header = "date,type,amount,currency,category,account,toAccount,note";
  const rows = state.ledger.transactions.map((item) => [
    item.date,
    item.type,
    item.amount,
    accountById(item.accountId)?.currency || "",
    categoryLabel(categoryById(item.categoryId)),
    accountById(item.accountId)?.name || "",
    accountById(item.toAccountId)?.name || "",
    item.note || "",
  ].map(csvEscape).join(","));
  download("finance.csv", [header, ...rows].join("\n"), "text/csv");
});

document.getElementById("export-json").addEventListener("click", () => {
  download("finance.json", JSON.stringify(state.ledger, null, 2), "application/json");
});

document.getElementById("import-csv").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const account = state.ledger.accounts[0];
  lines.slice(1).forEach((line) => {
    const cells = line.split(",");
    const [date, type, amount, , categoryName, , , note] = cells;
    if (!date || !amount) return;
    const kind = type === "income" || type === "transfer" ? type : "expense";
    let category = state.ledger.categories.find((item) => item.name === categoryName && item.type === kind);
    if (!category && kind !== "transfer") {
      category = { id: createId(), name: categoryName || "Импорт", type: kind, parentId: "", archived: false };
      state.ledger.categories.push(category);
    }
    state.ledger.transactions.push({
      id: createId(),
      type: kind,
      amount: Number(amount),
      categoryId: category?.id || "",
      accountId: account.id,
      toAccountId: "",
      date,
      note: note || "",
      recurringId: "",
    });
  });
  event.target.value = "";
  paint();
});

document.getElementById("import-json").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!window.confirm("Заменить текущий учёт данными из файла?")) return;
    state.ledger = normalizeLedger(parsed, settings.currency);
    paint();
  } catch {
    document.getElementById("import-message").hidden = false;
    document.getElementById("import-message").textContent = "Файл JSON не удалось прочитать";
  }
  event.target.value = "";
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (settings.theme === "auto") ChartBoard.syncTheme();
});

ChartBoard.setFormatter(formatMoney);
applyTheme(settings.theme);
fillCurrency();
dateInput.value = todayIso();
fillAccounts(accountSelect);
fillAccounts(targetSelect);
fillCategories();
paint();
