const ChartBoard = (() => {
  const palette = ["#e25b45", "#e3a008", "#3b82f6", "#14b8a6", "#a78bfa"];
  let barChart = null;
  let donutChart = null;
  let formatMoney = (value) => String(value);

  function colors() {
    const styles = getComputedStyle(document.documentElement);
    const pick = (name) => styles.getPropertyValue(name).trim();
    return {
      income: pick("--income"),
      expense: pick("--expense"),
      text: pick("--muted"),
      grid: pick("--line"),
      card: pick("--card"),
      ink: pick("--ink"),
    };
  }

  function motionOff() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function monthKey(date) {
    return date.slice(0, 7);
  }

  function monthLabel(key) {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("ru-RU", {
      month: "short",
      year: "2-digit",
    });
  }

  function buildSeries(transactions, period) {
    const monthKeys = [...new Set(transactions.map((item) => monthKey(item.date)))].sort();
    const customIsOneMonth = period === "custom" && monthKeys.length <= 1;
    if (period === "month" || customIsOneMonth) {
      const anchor = period === "month" || !transactions[0]
        ? new Date()
        : new Date(`${transactions[0].date}T00:00:00`);
      const now = anchor;
      const year = now.getFullYear();
      const month = now.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const labels = [];
      const income = Array(days).fill(0);
      const expense = Array(days).fill(0);

      for (let day = 1; day <= days; day += 1) labels.push(String(day));

      transactions.forEach((item) => {
        const date = new Date(`${item.date}T00:00:00`);
        if (date.getFullYear() !== year || date.getMonth() !== month) return;
        const index = date.getDate() - 1;
        if (item.type === "income") income[index] += item.amount;
        else if (item.type === "expense") expense[index] += item.amount;
      });

      return { labels, income, expense };
    }

    const keys = [...new Set(transactions.map((item) => monthKey(item.date)))].sort();
    const income = keys.map(() => 0);
    const expense = keys.map(() => 0);
    transactions.forEach((item) => {
      const index = keys.indexOf(monthKey(item.date));
      if (index < 0) return;
      if (item.type === "income") income[index] += item.amount;
      else if (item.type === "expense") expense[index] += item.amount;
    });
    return { labels: keys.map(monthLabel), income, expense };
  }

  function expenseByCategory(transactions) {
    const totals = new Map();
    transactions
      .filter((item) => item.type === "expense")
      .forEach((item) => {
        totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
      });
    return { labels: [...totals.keys()], values: [...totals.values()] };
  }

  function chartAnimation() {
    if (motionOff()) return false;
    return { duration: 700, easing: "easeOutQuart" };
  }

  function baseOptions(theme) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnimation(),
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: theme.text,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: "circle",
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: theme.ink,
          titleColor: theme.card,
          bodyColor: theme.card,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
        },
      },
    };
  }

  function renderBar(transactions, period) {
    const canvas = document.getElementById("bar-chart");
    const empty = document.getElementById("bar-empty");
    const series = buildSeries(transactions, period);
    const hasData = series.income.some((value) => value > 0) || series.expense.some((value) => value > 0);
    const theme = colors();

    canvas.hidden = !hasData;
    empty.hidden = hasData;
    if (!hasData) {
      if (barChart) barChart.destroy();
      barChart = null;
      return;
    }

    const data = {
      labels: series.labels,
      datasets: [
        {
          label: "Доходы",
          data: series.income,
          backgroundColor: theme.income,
          borderRadius: 6,
          maxBarThickness: period === "month" ? 18 : 42,
        },
        {
          label: "Расходы",
          data: series.expense,
          backgroundColor: theme.expense,
          borderRadius: 6,
          maxBarThickness: period === "month" ? 18 : 42,
        },
      ],
    };

    if (barChart) {
      barChart.data.labels = data.labels;
      barChart.data.datasets[0].data = series.income;
      barChart.data.datasets[0].backgroundColor = theme.income;
      barChart.data.datasets[1].data = series.expense;
      barChart.data.datasets[1].backgroundColor = theme.expense;
      applyFrame(barChart, theme);
      barChart.update();
      return;
    }

    barChart = new Chart(canvas, { type: "bar", data, options: barOptions(theme) });
  }

  function barOptions(theme) {
    const options = baseOptions(theme);
    options.plugins.tooltip.callbacks = {
      label: (item) => `${item.dataset.label}: ${formatMoney(item.parsed.y)}`,
    };
    options.scales = {
      x: {
        grid: { display: false },
        ticks: { color: theme.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
      },
      y: {
        beginAtZero: true,
        grid: { color: theme.grid },
        ticks: {
          color: theme.text,
          maxTicksLimit: 5,
          callback: (value) => formatMoney(value),
        },
      },
    };
    return options;
  }

  function renderDonut(transactions) {
    const canvas = document.getElementById("donut-chart");
    const empty = document.getElementById("donut-empty");
    const series = expenseByCategory(transactions);
    const hasData = series.values.length > 0;
    const theme = colors();

    canvas.hidden = !hasData;
    empty.hidden = hasData;
    if (!hasData) {
      if (donutChart) donutChart.destroy();
      donutChart = null;
      return;
    }

    const data = {
      labels: series.labels,
      datasets: [{
        data: series.values,
        backgroundColor: series.labels.map((_, index) => palette[index % palette.length]),
        borderColor: theme.card,
        borderWidth: 3,
        hoverOffset: 6,
      }],
    };

    if (donutChart) {
      donutChart.data.labels = data.labels;
      donutChart.data.datasets[0].data = series.values;
      donutChart.data.datasets[0].backgroundColor = data.datasets[0].backgroundColor;
      donutChart.data.datasets[0].borderColor = theme.card;
      applyFrame(donutChart, theme);
      donutChart.update();
      return;
    }

    donutChart = new Chart(canvas, { type: "doughnut", data, options: donutOptions(theme) });
  }

  function donutOptions(theme) {
    const options = baseOptions(theme);
    options.cutout = "68%";
    options.plugins.tooltip.callbacks = {
      label: (item) => `${item.label}: ${formatMoney(item.parsed)}`,
    };
    return options;
  }

  function applyFrame(chart, theme) {
    chart.options.plugins.legend.labels.color = theme.text;
    chart.options.plugins.tooltip.backgroundColor = theme.ink;
    chart.options.plugins.tooltip.titleColor = theme.card;
    chart.options.plugins.tooltip.bodyColor = theme.card;
    if (chart.options.scales?.x) {
      chart.options.scales.x.ticks.color = theme.text;
      chart.options.scales.y.ticks.color = theme.text;
      chart.options.scales.y.grid.color = theme.grid;
    }
  }

  function syncTheme() {
    const theme = colors();
    if (barChart) {
      barChart.data.datasets[0].backgroundColor = theme.income;
      barChart.data.datasets[1].backgroundColor = theme.expense;
      applyFrame(barChart, theme);
      barChart.update();
    }
    if (donutChart) {
      donutChart.data.datasets[0].borderColor = theme.card;
      applyFrame(donutChart, theme);
      donutChart.update();
    }
  }

  function resize() {
    barChart?.resize();
    donutChart?.resize();
  }

  function setFormatter(formatter) {
    formatMoney = formatter;
  }

  return { renderBar, renderDonut, syncTheme, resize, setFormatter };
})();
