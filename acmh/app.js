// Public-facing application JavaScript
let charts = {};

let KOFI_URL = "https://ko-fi.com/ginolitway"; // default; overridden by Firestore gameInfo.kofiUrl

// Raw data stored globally so month filter can re-render without re-fetching
let allTimeEntries = [];
let allExpenses = [];
let allVibeChecks = [];
let allScreenshots = [];
let allUpdates = [];
let allMilestoneItems = [];


// Custom Chart.js plugin: alternating month bands + solid boundary lines + pill labels.
// Only activates on charts with a time-based x-axis.
const monthBoundaryPlugin = {
  id: 'monthBoundaries',

  // Alternating shaded bands drawn BEHIND the chart data
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!scales.x || scales.x.type !== 'time') return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bandColor = isDark ? 'rgba(0, 212, 255, 0.055)' : 'rgba(0, 0, 0, 0.035)';

    const xScale = scales.x;
    const { top, bottom } = chartArea;

    const cursor = new Date(xScale.min);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);

    let shade = false;
    while (cursor.getTime() <= xScale.max) {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + 1);

      if (shade) {
        const x1 = Math.max(xScale.getPixelForValue(cursor.getTime()), chartArea.left);
        const x2 = Math.min(xScale.getPixelForValue(next.getTime()), chartArea.right);
        ctx.fillStyle = bandColor;
        ctx.fillRect(x1, top, x2 - x1, bottom - top);
      }

      shade = !shade;
      cursor.setMonth(cursor.getMonth() + 1);
    }
  },

  // Boundary lines + pill labels drawn ON TOP of the chart data
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!scales.x || scales.x.type !== 'time') return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const lineColor  = isDark ? 'rgba(0, 212, 255, 0.6)'  : 'rgba(0, 0, 0, 0.22)';
    const pillBg     = isDark ? 'rgba(0, 212, 255, 0.18)' : 'rgba(0, 0, 0, 0.09)';
    const pillText   = isDark ? 'rgba(0, 212, 255, 1)'    : 'rgba(30, 30, 30, 0.75)';

    const xScale = scales.x;
    const { top, bottom } = chartArea;

    const current = new Date(xScale.min);
    current.setDate(1);
    current.setHours(0, 0, 0, 0);
    current.setMonth(current.getMonth() + 1);

    ctx.save();

    while (current.getTime() <= xScale.max) {
      const x = xScale.getPixelForValue(current.getTime());

      // Solid vertical line
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      // Pill label
      const monthLabel = current.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      const tw = ctx.measureText(monthLabel).width;
      const ph = 18, px = 7, py = 3;
      const pillX = x - tw / 2 - px;
      const pillY = top + 5;

      ctx.fillStyle = pillBg;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, tw + px * 2, ph, 4);
      ctx.fill();

      ctx.fillStyle = pillText;
      ctx.textAlign = 'center';
      ctx.fillText(monthLabel, x, pillY + ph - py);

      current.setMonth(current.getMonth() + 1);
    }

    ctx.restore();
  },
};

// Resolved after DOM is ready so CSS variables are accessible
let CHART_COLORS;

// ---- Theme management ----

function applyChartTheme(isDark) {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = isDark ? '#7b8db0' : '#5a5a5a';
  Chart.defaults.borderColor = isDark
    ? 'rgba(0, 212, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.08)';
}

function updateThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '☀ Light' : '🌙 Dark';
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('acmh-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('acmh-theme', 'dark');
  }
  applyChartTheme(!isDark);
  updateThemeToggle();
}

function initTheme() {
  const isDark = localStorage.getItem('acmh-theme') === 'dark';
  // data-theme may already be set by the anti-FOUC inline script
  applyChartTheme(isDark);
  updateThemeToggle();
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initializeApp();
});

async function initializeApp() {
  // Read chart colours from CSS variables
  const cs = getComputedStyle(document.documentElement);
  CHART_COLORS = {
    primary: cs.getPropertyValue('--chart-primary').trim(),
    primaryBg: cs.getPropertyValue('--chart-primary-bg').trim(),
    spending: cs.getPropertyValue('--chart-spending').trim(),
    spendingBg: cs.getPropertyValue('--chart-spending-bg').trim(),
    vibeGreen: cs.getPropertyValue('--chart-vibe-green').trim(),
    vibeAmber: cs.getPropertyValue('--chart-vibe-amber').trim(),
    vibeRed: cs.getPropertyValue('--chart-vibe-red').trim(),
    palette: [1,2,3,4,5,6,7].map(i => cs.getPropertyValue(`--chart-palette-${i}`).trim()),
  };

  try {
    // Load all data
    await Promise.all([
      loadGameInfo(),
      loadMetrics(),
      loadUpdates(),
      loadScreenshots(),
      loadBudget(),
      loadYouTubePlaylist(),
      loadMilestones(),
    ]);

    buildTimeline();
    setupEventListeners();
  } catch (error) {
    console.error("Error initializing app:", error);
  }
}

// Load Game Info (Hero section and About)
async function loadGameInfo() {
  try {
    const doc = await db.collection("settings").doc("gameInfo").get();

    if (doc.exists) {
      const data = doc.data();

      // Update hero description
      const gameDesc = document.getElementById("gameDescription");
      if (gameDesc) {
        gameDesc.textContent =
          data.gameDescription || "A unique gaming experience.";
      }

      // Update about section
      const projectDesc = document.getElementById("projectDescription");
      if (projectDesc) {
        projectDesc.textContent =
          data.projectDescription ||
          "Follow along as I build this game from scratch.";
      }

      // Update wishlist button
      const wishlistBtn = document.getElementById("wishlistBtn");
      if (wishlistBtn && data.wishlistUrl) {
        wishlistBtn.href = data.wishlistUrl;
      }

      // Update LinkedIn links
      const linkedinLink = document.getElementById("linkedinLink");
      const footerLinkedin = document.getElementById("footerLinkedin");
      if (data.linkedinUrl) {
        if (linkedinLink) linkedinLink.href = data.linkedinUrl;
        if (footerLinkedin) footerLinkedin.href = data.linkedinUrl;
      }

      // Store playlist ID for later
      if (data.youtubePlaylistId) {
        window.youtubePlaylistId = data.youtubePlaylistId;
      }

      // Update Discord button
      const discordBtn = document.getElementById("discordBtn");
      if (discordBtn && data.discordUrl) {
        discordBtn.href = data.discordUrl;
      }

      // Update Ko-fi URL
      if (data.kofiUrl) {
        KOFI_URL = data.kofiUrl;
      }

      // Store newsletter config
      if (data.newsletterEnabled !== undefined) {
        window.newsletterEnabled = data.newsletterEnabled;
      }
    }
  } catch (error) {
    console.error("Error loading game info:", error);
  }
}

// Add newsletter handler
async function handleNewsletterSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("newsletterEmail").value;
  const statusDiv = document.getElementById("newsletterStatus");

  try {
    // Save to Firestore
    await db.collection("newsletterSubscribers").add({
      email: email,
      subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: true,
    });

    statusDiv.textContent = "✓ Successfully subscribed!";
    statusDiv.style.color = "#2ecc71";
    e.target.reset();

    setTimeout(() => {
      statusDiv.textContent = "";
    }, 5000);
  } catch (error) {
    console.error("Newsletter error:", error);
    statusDiv.textContent = "Error subscribing. Please try again.";
    statusDiv.style.color = "#e84545";
  }
}

// Load Metrics and Charts
async function loadMetrics() {
  try {
    const [timeSnapshot, expenseSnapshot, vibeSnapshot] = await Promise.all([
      db.collection("timeEntries").orderBy("date").get(),
      db.collection("expenses").orderBy("date").get(),
      db.collection("vibeChecks").orderBy("date").get(),
    ]);

    allTimeEntries = [];
    allExpenses = [];
    allVibeChecks = [];
    timeSnapshot.forEach((doc) => allTimeEntries.push(doc.data()));
    expenseSnapshot.forEach((doc) => allExpenses.push(doc.data()));
    vibeSnapshot.forEach((doc) => allVibeChecks.push(doc.data()));

    updateStatsBarTime(allTimeEntries);
    renderVibeStrip(allVibeChecks);
    buildMonthFilter();
    renderMetrics(allTimeEntries, allExpenses, allVibeChecks);
  } catch (error) {
    console.error("Error loading metrics:", error);
  }
}

// Render stat cards + all charts for a given (possibly filtered) dataset
function renderMetrics(timeEntries, expenses, vibeChecks) {
  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const uniqueDates = new Set([
    ...timeEntries.map((e) => e.date),
    ...expenses.map((e) => e.date),
  ]);
  const daysActive = uniqueDates.size;
  const weeks = daysActive / 7;
  const avgHours = weeks > 0 ? (totalHours / weeks).toFixed(1) : 0;

  document.getElementById("totalHours").textContent = totalHours.toFixed(1);
  document.getElementById("totalSpent").textContent = `£${totalSpent.toFixed(2)}`;
  document.getElementById("daysActive").textContent = daysActive;
  document.getElementById("avgHours").textContent = avgHours;

  createTimeChart(timeEntries);
  createBudgetChart(expenses);
  createTimeCategoryChart(timeEntries);
  createBudgetCategoryChart(expenses);
  createVibeChart(vibeChecks);
}

// Build the month filter dropdown above the metrics section
function buildMonthFilter() {
  const container = document.getElementById("chart-filter");
  if (!container) return;

  // Collect all unique YYYY-MM strings across every dataset
  const monthSet = new Set();
  [...allTimeEntries, ...allExpenses, ...allVibeChecks].forEach((entry) => {
    if (entry.date) monthSet.add(entry.date.substring(0, 7));
  });
  const months = Array.from(monthSet).sort();

  container.innerHTML = "";

  const label = document.createElement("label");
  label.htmlFor = "month-select";
  label.className = "filter-label mono";
  label.textContent = "Period:";
  container.appendChild(label);

  const select = document.createElement("select");
  select.id = "month-select";
  select.className = "month-select";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Time";
  select.appendChild(allOption);

  months.forEach((month) => {
    const [year, mon] = month.split("-");
    const monthLabel = new Date(year, parseInt(mon) - 1, 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    const option = document.createElement("option");
    option.value = month;
    option.textContent = monthLabel;
    select.appendChild(option);
  });

  container.appendChild(select);

  select.addEventListener("change", () => {
    const month = select.value;
    if (month === "all") {
      renderMetrics(allTimeEntries, allExpenses, allVibeChecks);
    } else {
      renderMetrics(
        allTimeEntries.filter((e) => e.date && e.date.startsWith(month)),
        allExpenses.filter((e) => e.date && e.date.startsWith(month)),
        allVibeChecks.filter((e) => e.date && e.date.startsWith(month))
      );
    }
  });
}

// Create Time Over Time Chart
function createTimeChart(timeEntries) {
  const ctx = document.getElementById("timeChart");
  if (!ctx) return;

  // Group by date
  const dateMap = {};
  timeEntries.forEach((entry) => {
    if (!dateMap[entry.date]) {
      dateMap[entry.date] = 0;
    }
    dateMap[entry.date] += entry.hours;
  });

  const dates = Object.keys(dateMap).sort();
  
  // Calculate cumulative with actual date objects
  const dataPoints = [];
  let sum = 0;
  dates.forEach((date) => {
    sum += dateMap[date];
    dataPoints.push({
      x: new Date(date),
      y: sum
    });
  });

  if (charts.timeChart) charts.timeChart.destroy();

  charts.timeChart = new Chart(ctx, {
    type: "line",
    plugins: [monthBoundaryPlugin],
    data: {
      datasets: [
        {
          label: "Cumulative Hours",
          data: dataPoints,
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primaryBg,
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          type: 'time',
          max: new Date(),
          time: {
            unit: 'day',
            displayFormats: {
              day: 'dd/MM/yyyy'
            }
          },
          title: {
            display: true,
            text: 'Date'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours'
          }
        },
      },
    },
  });
}

// Create Budget Over Time Chart
function createBudgetChart(expenses) {
  const ctx = document.getElementById("budgetChart");
  if (!ctx) return;

  // Group by date
  const dateMap = {};
  expenses.forEach((expense) => {
    if (!dateMap[expense.date]) {
      dateMap[expense.date] = 0;
    }
    dateMap[expense.date] += expense.amount;
  });

  const dates = Object.keys(dateMap).sort();
  
  // Calculate cumulative with actual date objects
  const dataPoints = [];
  let sum = 0;
  dates.forEach((date) => {
    sum += dateMap[date];
    dataPoints.push({
      x: new Date(date),
      y: sum
    });
  });

  if (charts.budgetChart) charts.budgetChart.destroy();

  charts.budgetChart = new Chart(ctx, {
    type: "line",
    plugins: [monthBoundaryPlugin],
    data: {
      datasets: [
        {
          label: "Cumulative Spending (£)",
          data: dataPoints,
          borderColor: CHART_COLORS.spending,
          backgroundColor: CHART_COLORS.spendingBg,
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          type: 'time',
          max: new Date(),
          time: {
            unit: 'day',
            displayFormats: {
              day: 'dd/MM/yyyy'
            }
          },
          title: {
            display: true,
            text: 'Date'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Amount (£)'
          }
        },
      },
    },
  });
}

// Create Time by Category Chart
function createTimeCategoryChart(timeEntries) {
  const ctx = document.getElementById("timeCategoryChart");
  if (!ctx) return;

  // Group by category
  const categoryMap = {};
  timeEntries.forEach((entry) => {
    if (!categoryMap[entry.category]) {
      categoryMap[entry.category] = 0;
    }
    categoryMap[entry.category] += entry.hours;
  });

  const categories = Object.keys(categoryMap);
  const hours = categories.map((cat) => categoryMap[cat]);

  if (charts.timeCategoryChart) charts.timeCategoryChart.destroy();

  charts.timeCategoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [
        {
          data: hours,
          backgroundColor: CHART_COLORS.palette,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "right",
        },
      },
    },
  });
}

// Create Budget by Category Chart
function createBudgetCategoryChart(expenses) {
  const ctx = document.getElementById("budgetCategoryChart");
  if (!ctx) return;

  // Group by category
  const categoryMap = {};
  expenses.forEach((expense) => {
    if (!categoryMap[expense.category]) {
      categoryMap[expense.category] = 0;
    }
    categoryMap[expense.category] += expense.amount;
  });

  const categories = Object.keys(categoryMap);
  const amounts = categories.map((cat) => categoryMap[cat]);

  if (charts.budgetCategoryChart) charts.budgetCategoryChart.destroy();

  charts.budgetCategoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [
        {
          data: amounts,
          backgroundColor: CHART_COLORS.palette,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "right",
        },
      },
    },
  });
}


// Create Vibe Check Chart
function createVibeChart(vibeChecks) {
  const ctx = document.getElementById("vibeChart");
  if (!ctx) return;

  const dataPoints = vibeChecks.map((v) => {
    let value = 1;
    if (v.status === "Green") value = 3;
    else if (v.status === "Amber") value = 2;
    
    return {
      x: new Date(v.date),
      y: value,
      status: v.status,
      notes: v.notes
    };
  });

  const colors = vibeChecks.map((v) => {
    if (v.status === "Green") return CHART_COLORS.vibeGreen;
    if (v.status === "Amber") return CHART_COLORS.vibeAmber;
    return CHART_COLORS.vibeRed;
  });

  if (charts.vibeChart) charts.vibeChart.destroy();

  charts.vibeChart = new Chart(ctx, {
    type: "line",
    plugins: [monthBoundaryPlugin],
    data: {
      datasets: [
        {
          label: "Vibe Check",
          data: dataPoints,
          borderColor: CHART_COLORS.primary,
          backgroundColor: colors,
          tension: 0.4,
          pointRadius: 8,
          pointHoverRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const point = context.raw;
              return [
                `Status: ${point.status}`,
                `Notes: ${point.notes}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          max: new Date(),
          time: {
            unit: 'day',
            displayFormats: {
              day: 'dd/MM/yyyy'
            }
          },
          title: {
            display: true,
            text: 'Date'
          }
        },
        y: {
          min: 0,
          max: 4,
          ticks: {
            stepSize: 1,
            callback: function (value) {
              if (value === 3) return "🟢 Green";
              if (value === 2) return "🟡 Amber";
              if (value === 1) return "🔴 Red";
              return "";
            },
          },
          title: {
            display: true,
            text: 'Status'
          }
        },
      },
    },
  });
}

// Load Development Updates
async function loadUpdates() {
  try {
    const snapshot = await db
      .collection("updates")
      .orderBy("date", "desc")
      .limit(20)
      .get();

    allUpdates = [];
    const grid = document.getElementById("updatesGrid");
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML =
        '<div class="empty-state">No updates yet. Check back soon!</div>';
      return;
    }

    snapshot.forEach((doc) => {
      const update = doc.data();
      allUpdates.push(update);
      const card = createUpdateCard(update);
      grid.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading updates:", error);
  }
}

function createUpdateCard(update) {
  const card = document.createElement("div");
  card.className = "update-card";

  const date = new Date(update.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const tags = update.tags
    ? update.tags
        .map((tag) => `<span class="update-tag">${tag}</span>`)
        .join("")
    : "";

  card.innerHTML = `
    ${update.screenshotUrl ? `<img src="${update.screenshotUrl}" class="update-thumb" loading="lazy" alt="${update.title}">` : ''}
    <div class="update-header">
      <h3 class="update-title">${update.title}</h3>
      <span class="update-date mono">${date}</span>
    </div>
    <p class="update-summary">${update.summary || update.content.substring(0, 150) + "..."}</p>
    <div class="update-footer">
      <div class="update-tags">${tags}</div>
    </div>
  `;

  return card;
}

// Load Screenshots
async function loadScreenshots() {
  try {
    const snapshot = await db
      .collection("screenshots")
      .orderBy("date", "desc")
      .get();

    allScreenshots = [];
    const grid = document.getElementById("screenshotsGrid");
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML =
        '<div class="empty-state">No screenshots yet. Check back soon!</div>';
      return;
    }

    snapshot.forEach((doc) => {
      const screenshot = doc.data();
      allScreenshots.push(screenshot);
      const item = createScreenshotItem(screenshot);
      grid.appendChild(item);
    });

    // Setup filters
    setupGalleryFilters();

    // Setup modal AFTER screenshots are loaded
    setupImageModal();

  } catch (error) {
    console.error("Error loading screenshots:", error);
  }
}

function createScreenshotItem(screenshot) {
  const item = document.createElement("div");
  item.className = "screenshot-item";
  item.dataset.category = screenshot.category;
  if (screenshot.isBeforeAfter) {
    item.dataset.beforeAfter = "true";
  }

  item.innerHTML = `
    <img src="${screenshot.imageUrl}" alt="${screenshot.title}" loading="lazy" />
    <div class="screenshot-overlay">
      <h4>${screenshot.title}</h4>
      <p>${screenshot.description || ""}</p>
      <span class="screenshot-category">${screenshot.category}</span>
    </div>
  `;

  return item;
}

function setupGalleryFilters() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  const items = document.querySelectorAll(".screenshot-item");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Update active button
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.dataset.filter;

      // Filter items
      items.forEach((item) => {
        if (filter === "all") {
          item.style.display = "block";
        } else if (filter === "before-after") {
          item.style.display = item.dataset.beforeAfter ? "block" : "none";
        } else {
          item.style.display =
            item.dataset.category === filter ? "block" : "none";
        }
      });
    });
  });
}

// Show a loading row inside a table body (accepts a CSS selector)
function setLoading(selector) {
  const el = document.querySelector(selector);
  if (el) el.innerHTML = '<tr><td colspan="10" class="loading-state">Loading...</td></tr>';
}

// ---- Budget helpers ----

async function loadIncomeSection() {
  setLoading('#incomeTable tbody');

  const allIncomeSnapshot = await db.collection("income").get();
  const recentIncomeSnapshot = await db
    .collection("income")
    .orderBy("date", "desc")
    .limit(20)
    .get();

  const incomeTable = document
    .getElementById("incomeTable")
    .querySelector("tbody");
  incomeTable.innerHTML = "";

  let totalIncome = 0;
  allIncomeSnapshot.forEach((doc) => {
    totalIncome += doc.data().amount;
  });

  if (recentIncomeSnapshot.empty) {
    incomeTable.innerHTML =
      '<tr><td colspan="4" class="empty-state">No income recorded yet.</td></tr>';
  } else {
    recentIncomeSnapshot.forEach((doc) => {
      const income = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td data-label="Date" class="mono">${new Date(income.date).toLocaleDateString("en-GB")}</td>
        <td data-label="Source"><span class="category-badge">${income.source}</span></td>
        <td data-label="Description">${income.description}</td>
        <td data-label="Amount" class="mono">£${income.amount.toFixed(2)}</td>
      `;
      incomeTable.appendChild(row);
    });
  }

  return totalIncome;
}

async function loadExpensesSection() {
  setLoading('#expensesTable tbody');

  const allExpensesSnapshot = await db.collection("expenses").get();
  const recentExpensesSnapshot = await db
    .collection("expenses")
    .orderBy("date", "desc")
    .limit(20)
    .get();

  const expensesTable = document
    .getElementById("expensesTable")
    .querySelector("tbody");
  expensesTable.innerHTML = "";

  let totalSpent = 0;
  allExpensesSnapshot.forEach((doc) => {
    totalSpent += doc.data().amount;
  });

  if (recentExpensesSnapshot.empty) {
    expensesTable.innerHTML =
      '<tr><td colspan="4" class="empty-state">No expenses recorded yet.</td></tr>';
  } else {
    recentExpensesSnapshot.forEach((doc) => {
      const expense = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td data-label="Date" class="mono">${new Date(expense.date).toLocaleDateString("en-GB")}</td>
        <td data-label="Category"><span class="category-badge">${expense.category}</span></td>
        <td data-label="Description">${expense.description}</td>
        <td data-label="Amount" class="mono">£${expense.amount.toFixed(2)}</td>
      `;
      expensesTable.appendChild(row);
    });
  }

  return totalSpent;
}

async function loadPlannedSection() {
  setLoading('#plannedTable tbody');

  const plannedSnapshot = await db
    .collection("plannedExpenses")
    .where("isPurchased", "==", false)
    .get();

  const recurringSnapshot = await db
    .collection("recurringCosts")
    .where("isActive", "==", true)
    .get();

  const plannedTable = document
    .getElementById("plannedTable")
    .querySelector("tbody");
  plannedTable.innerHTML = "";

  if (plannedSnapshot.empty && recurringSnapshot.empty) {
    plannedTable.innerHTML =
      '<tr><td colspan="4" class="empty-state">No planned expenses.</td></tr>';
  } else {
    plannedSnapshot.forEach((doc) => {
      const planned = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td data-label="Item">${planned.item}</td>
        <td data-label="Category"><span class="category-badge">${planned.category}</span></td>
        <td data-label="Est. Cost" class="mono">£${planned.estimatedCost.toFixed(2)}</td>
        <td data-label="Notes">${planned.notes || "-"}</td>
        <td data-label="Action">
          <button
            class="btn-contribute"
            data-item-id="${doc.id}"
            data-item-name="${planned.item}"
            data-item-cost="${planned.estimatedCost}"
          >
            💝 Contribute
          </button>
        </td>
      `;
      plannedTable.appendChild(row);
    });

    recurringSnapshot.forEach((doc) => {
      const recurring = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td data-label="Item">
          ${recurring.item}
          <span class="recurring-badge">RECURRING</span>
        </td>
        <td data-label="Category"><span class="category-badge">${recurring.category}</span></td>
        <td data-label="Cost" class="mono">£${recurring.amount.toFixed(2)} / month</td>
        <td data-label="Notes">${recurring.description || "-"}</td>
        <td data-label="Action">
          <button
            class="btn-contribute"
            data-item-id="${doc.id}"
            data-item-name="${recurring.item} (Monthly)"
            data-item-cost="${recurring.amount}"
          >
            💝 Contribute
          </button>
        </td>
      `;
      plannedTable.appendChild(row);
    });

    const plannedTableElement = document.getElementById("plannedTable");
    if (plannedTableElement) {
      const handleContribute = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest('.btn-contribute');
        if (button) {
          const itemId = button.dataset.itemId;
          const itemName = button.dataset.itemName;
          const itemCost = parseFloat(button.dataset.itemCost);
          contributeToItem(itemId, itemName, itemCost);
        }
      };
      plannedTableElement.addEventListener("click", handleContribute);
      plannedTableElement.addEventListener("touchend", handleContribute);
    }
  }
}

function updateBudgetSummary(income, spent) {
  const profitLoss = income - spent;
  const profitLossElement = document.getElementById("budgetProfitLoss");

  document.getElementById("budgetIncome").textContent = `£${income.toFixed(2)}`;
  document.getElementById("budgetSpent").textContent = `£${spent.toFixed(2)}`;
  profitLossElement.textContent = `£${profitLoss.toFixed(2)}`;

  profitLossElement.classList.remove("profit", "loss");
  profitLossElement.classList.add(profitLoss >= 0 ? "profit" : "loss");
}

// Load Budget Data
async function loadBudget() {
  try {
    const [totalIncome, totalSpent] = await Promise.all([
      loadIncomeSection(),
      loadExpensesSection(),
      loadPlannedSection(),
    ]);
    updateBudgetSummary(totalIncome, totalSpent);
  } catch (error) {
    console.error("Error loading budget:", error);
    document.getElementById("budgetIncome").textContent = "Error";
    document.getElementById("budgetSpent").textContent = "Error";
    document.getElementById("budgetProfitLoss").textContent = "Error";
  }
}

// contribute function
window.contributeToItem = async function (itemId, itemName, amount) {
  console.log("=== CONTRIBUTE FUNCTION CALLED ===");
  console.log("Contribute clicked:", { itemId, itemName, amount });

  // ⭐ Open Ko-fi IMMEDIATELY (before any async operations)
  // This must happen synchronously from the user click
  const kofiWindow = window.open(KOFI_URL, "_blank");
  
  if (!kofiWindow) {
    // Popup was blocked
    alert("Please allow popups for this site, or click OK to visit Ko-fi");
    window.location.href = KOFI_URL;
  }

  // Log to Firestore in the background (don't wait for it)
  try {
    console.log("Logging contribution to Firestore...");
    
    db.collection("contributionClicks").add({
      itemId: itemId,
      itemName: itemName,
      amount: amount,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    }).then((docRef) => {
      console.log("Contribution logged successfully with ID:", docRef.id);
    }).catch((error) => {
      console.error("Error logging contribution:", error);
      // Don't show error to user since Ko-fi already opened
    });
    
  } catch (error) {
    console.error("Error in contribution logging:", error);
    // Don't show error to user since Ko-fi already opened
  }
};



function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";

  card.innerHTML = `
    <div class="task-header">
      <h4 class="task-title">${task.title}</h4>
      <span class="priority-badge ${task.priority.toLowerCase()}">${task.priority}</span>
    </div>
    <p class="task-description">${task.description || ""}</p>
    <div class="task-footer">
      <span class="category-badge">${task.category}</span>
    </div>
  `;

  return card;
}

// Load YouTube Playlist
function loadYouTubePlaylist() {
  const container = document.getElementById("youtubePlaylist");
  if (!container) return;

  const playlistId = window.youtubePlaylistId;

  if (!playlistId) {
    container.innerHTML =
      '<div class="empty-state">YouTube playlist not configured yet.</div>';
    return;
  }

  container.innerHTML = `
    <iframe 
      width="100%" 
      height="600" 
      src="https://www.youtube.com/embed/videoseries?list=${playlistId}" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen
    ></iframe>
  `;
}

// Setup Event Listeners
function setupEventListeners() {
  // Newsletter form
  const newsletterForm = document.getElementById("newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", handleNewsletterSubmit);
  }


  // Flow diagram controls
  const zoomIn = document.getElementById("zoomIn");
  const zoomOut = document.getElementById("zoomOut");
  const resetView = document.getElementById("resetView");

  if (zoomIn) zoomIn.addEventListener("click", () => console.log("Zoom in"));
  if (zoomOut)
    zoomOut.addEventListener("click", () => console.log("Zoom out"));
  if (resetView)
    resetView.addEventListener("click", () => loadGameFlow());
}

// Image modal functionality
function setupImageModal() {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  
  if (!modal || !modalImg) return;
  
  // Add click handlers to all screenshot images
  document.addEventListener('click', (e) => {
    if (e.target.closest('.screenshot-item') || e.target.closest('.screenshot-card')) {
      const img = e.target.closest('.screenshot-item, .screenshot-card').querySelector('img');
      if (img) {
        modal.classList.add('active');
        modalImg.src = img.src;
        modalImg.alt = img.alt;
        document.body.style.overflow = 'hidden';
      }
    }
  });
  
  // Close modal on click
  modal.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  });
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".accordion").forEach(accordion => {
    const header = accordion.querySelector(".accordion-header");
    if (header) {
      header.addEventListener("click", () => {
        accordion.classList.toggle("open");
      });
    }
  });

  // Set stats bar position to sit flush below the nav
  const nav = document.querySelector('nav');
  if (nav) {
    const setNavHeight = () => {
      document.documentElement.style.setProperty('--nav-height', nav.offsetHeight + 'px');
    };
    setNavHeight();
    window.addEventListener('resize', setNavHeight);
  }
});

// ---- Milestones (public) ----

async function loadMilestones() {
  const section = document.getElementById('milestonesSection');
  if (!section) return;

  try {
    const snapshot = await firebase
      .firestore()
      .collection('milestones')
      .orderBy('startDate', 'asc')
      .get();

    if (snapshot.empty) {
      section.style.display = 'none';
      return;
    }

    const milestones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allMilestoneItems = milestones;
    const completed = milestones.filter(m => m.isCompleted);
    const activeList = milestones.filter(m => !m.isCompleted);

    // Update stats bar with first active milestone
    if (activeList.length > 0) {
      const milestoneItem = document.getElementById('statMilestoneItem');
      const milestoneName = document.getElementById('statMilestoneName');
      const milestoneDivider = document.getElementById('milestoneDivider');
      if (milestoneItem) milestoneItem.style.display = '';
      if (milestoneDivider) milestoneDivider.style.display = '';
      if (milestoneName) milestoneName.textContent = activeList[0].title;
      const bar = document.getElementById('statsBar');
      if (bar) bar.style.display = '';
    }

    section.style.display = '';

    // Active milestones
    const activeContainer = document.getElementById('activeMilestone');
    if (activeContainer) {
      if (activeList.length === 0) {
        activeContainer.innerHTML = '<p class="milestone-none">No active milestone set.</p>';
      } else {
        const today = new Date();
        activeContainer.innerHTML = activeList.map((active, i) => {
          const start = new Date(active.startDate);
          const days = Math.floor((today - start) / 86400000);
          const counterId = `milestoneDayCount-${i}`;
          return `
            <div class="milestone-active">
              <div class="milestone-active-label">${activeList.length > 1 ? 'Active Milestone' : 'Current Milestone'}</div>
              <div class="milestone-active-title">${active.title}</div>
              ${active.description ? `<p class="milestone-active-desc">${active.description}</p>` : ''}
              <div class="milestone-active-counter">
                <span class="milestone-days" id="${counterId}">${days}</span>
                <span class="milestone-days-label">day${days !== 1 ? 's' : ''} in progress</span>
              </div>
              <div class="milestone-active-since">Started ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          `;
        }).join('');

        // Update counters every minute
        activeList.forEach((active, i) => {
          const start = new Date(active.startDate);
          const counterId = `milestoneDayCount-${i}`;
          setInterval(() => {
            const d = Math.floor((new Date() - start) / 86400000);
            const el = document.getElementById(counterId);
            if (el) el.textContent = d;
          }, 60000);
        });
      }
    }

    // Completed milestones
    const completedContainer = document.getElementById('completedMilestones');
    if (completedContainer) {
      if (completed.length === 0) {
        completedContainer.innerHTML = '<p class="milestone-none">No completed milestones yet.</p>';
      } else {
        completedContainer.innerHTML = completed
          .slice()
          .reverse()
          .map(m => {
            const start = new Date(m.startDate);
            const end = new Date(m.endDate);
            const days = Math.round((end - start) / 86400000);
            return `
              <div class="milestone-card completed">
                <div class="milestone-card-header">
                  <span class="milestone-card-title">${m.title}</span>
                  <span class="milestone-card-duration">${days} day${days !== 1 ? 's' : ''}</span>
                </div>
                ${m.description ? `<p class="milestone-card-desc">${m.description}</p>` : ''}
                <div class="milestone-card-dates">
                  ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  &rarr;
                  ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            `;
          })
          .join('');
      }
    }
  } catch (error) {
    console.error('Error loading milestones:', error);
  }
}

// ---- Stats bar (items 1, 2, 6) ----

function calcStreak(timeEntries) {
  if (!timeEntries.length) return 0;
  const dateSet = new Set(timeEntries.map(e => e.date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let check = new Date(today);

  // If nothing logged today, start streak check from yesterday
  if (!dateSet.has(check.toISOString().split('T')[0])) {
    check.setDate(check.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const s = check.toISOString().split('T')[0];
    if (!dateSet.has(s)) break;
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function updateStatsBarTime(timeEntries) {
  if (!timeEntries.length) return;
  const bar = document.getElementById('statsBar');
  if (bar) bar.style.display = '';

  // Last active
  const sorted = [...timeEntries].sort((a, b) => a.date > b.date ? 1 : -1);
  const last = new Date(sorted[sorted.length - 1].date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastNorm = new Date(last); lastNorm.setHours(0, 0, 0, 0);
  const diff = Math.round((today - lastNorm) / 86400000);
  const lastStr = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff}d ago`;

  const lastEl = document.getElementById('statLastActive');
  if (lastEl) lastEl.textContent = lastStr;

  // Streak
  const streak = calcStreak(timeEntries);
  const streakEl = document.getElementById('statStreak');
  if (streakEl) streakEl.textContent = streak > 0 ? `${streak}d` : '—';

  // Total hours
  const totalHours = timeEntries.reduce((s, e) => s + (e.hours || 0), 0);
  const hoursEl = document.getElementById('statHoursBar');
  if (hoursEl) hoursEl.textContent = `${totalHours.toFixed(0)}h`;
}

// ---- Vibe strip (item 7) ----

function renderVibeStrip(vibeChecks) {
  const strip = document.getElementById('vibeStrip');
  if (!strip) return;
  if (!vibeChecks.length) {
    strip.closest('.vibe-strip-wrapper').style.display = 'none';
    return;
  }

  const sorted = [...vibeChecks].sort((a, b) => a.date > b.date ? 1 : -1).slice(-40);
  strip.innerHTML = sorted.map(v => {
    const cls = v.status === 'Green' ? 'vibe-dot-green' : v.status === 'Amber' ? 'vibe-dot-amber' : 'vibe-dot-red';
    const label = new Date(v.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const note = v.notes ? ` — ${v.notes.substring(0, 60)}` : '';
    return `<span class="vibe-dot ${cls}" title="${label}${note}"></span>`;
  }).join('');
}

// ---- Timeline (item 4) ----

function buildTimeline() {
  const container = document.getElementById('timelineContainer');
  if (!container) return;

  const items = [];

  allUpdates.forEach(u => {
    if (u.date) items.push({ type: 'update', date: u.date, data: u });
  });

  allMilestoneItems.forEach(m => {
    if (m.startDate) items.push({ type: 'milestone-start', date: m.startDate, data: m });
    if (m.isCompleted && m.endDate) items.push({ type: 'milestone-end', date: m.endDate, data: m });
  });

  allScreenshots.slice(0, 15).forEach(s => {
    if (s.date) items.push({ type: 'screenshot', date: s.date, data: s });
  });

  items.sort((a, b) => a.date > b.date ? -1 : 1);

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state">Nothing yet — check back soon!</div>';
    return;
  }

  container.innerHTML = '<div class="tl-list">' + items.map(renderTimelineItem).join('') + '</div>';
}

function renderTimelineItem(item) {
  const dateStr = new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const typeMap = {
    'update':           { icon: '📝', label: 'Update' },
    'milestone-start':  { icon: '🚀', label: 'Milestone Started' },
    'milestone-end':    { icon: '✅', label: 'Milestone Complete' },
    'screenshot':       { icon: '📸', label: item.data.category || 'Screenshot' },
  };
  const cfg = typeMap[item.type] || { icon: '•', label: '' };

  let body = '';
  switch (item.type) {
    case 'update':
      body = `
        <h4 class="tl-title">${item.data.title}</h4>
        <p class="tl-body">${item.data.summary || (item.data.content || '').substring(0, 140) + '...'}</p>
        ${item.data.screenshotUrl ? `<img src="${item.data.screenshotUrl}" class="tl-img" loading="lazy" alt="${item.data.title}">` : ''}
        ${item.data.tags && item.data.tags.length ? `<div class="tl-tags">${item.data.tags.map(t => `<span class="update-tag">${t}</span>`).join('')}</div>` : ''}
      `;
      break;
    case 'milestone-start':
    case 'milestone-end':
      body = `<h4 class="tl-title">${item.data.title}</h4>
        ${item.data.description ? `<p class="tl-body">${item.data.description}</p>` : ''}`;
      break;
    case 'screenshot':
      body = `
        <h4 class="tl-title">${item.data.title}</h4>
        <img src="${item.data.imageUrl}" class="tl-img" loading="lazy" alt="${item.data.title}">
        ${item.data.description ? `<p class="tl-body">${item.data.description}</p>` : ''}
      `;
      break;
  }

  return `
    <div class="tl-item tl-${item.type}">
      <div class="tl-indicator">
        <div class="tl-dot">${cfg.icon}</div>
      </div>
      <div class="tl-card">
        <div class="tl-meta">
          <span class="tl-date mono">${dateStr}</span>
          <span class="tl-badge tl-badge-${item.type}">${cfg.label}</span>
        </div>
        ${body}
      </div>
    </div>
  `;
}
