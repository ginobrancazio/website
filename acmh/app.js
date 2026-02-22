// Public-facing application JavaScript
let charts = {};
let flowDiagram = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

// Constants
const CHART_COLORS = [
  "rgba(124, 58, 237, 0.8)",
  "rgba(59, 130, 246, 0.8)",
  "rgba(16, 185, 129, 0.8)",
  "rgba(245, 158, 11, 0.8)",
  "rgba(245, 101, 101, 0.8)",
  "rgba(139, 92, 246, 0.8)",
  "rgba(236, 72, 153, 0.8)",
];

const EMPTY_STATES = {
  updates: "No updates yet. Check back soon!",
  screenshots: "No screenshots yet. Check back soon!",
  expenses: "No expenses recorded yet.",
  plannedExpenses: "No planned expenses.",
  tasks: "No tasks yet.",
  flow: "No flow diagram yet",
  youtube: "YouTube playlist not configured yet.",
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SCALE_STEP = 0.1;

// Initialize Firebase (ensure this is called after Firebase scripts load)
let db;

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Firestore
  if (typeof firebase !== "undefined" && firebase.firestore) {
    db = firebase.firestore();
    initializeApp();
  } else {
    console.error("Firebase not initialized");
    showError("Failed to connect to database");
  }
});

async function initializeApp() {
  try {
    // Load game info first to get playlist ID
    const playlistId = await loadGameInfo();

    // Load all other data
    await Promise.all([
      loadMetrics(),
      loadUpdates(),
      loadScreenshots(),
      loadBudget(),
      loadTasks(),
      loadGameFlow(),
    ]);

    // Load YouTube with the playlist ID
    loadYouTubePlaylist(playlistId);

    // Setup event listeners
    setupEventListeners();

    // Setup image modal
    setupImageModal();
  } catch (error) {
    console.error("Error initializing app:", error);
    showError("Failed to load application data");
  }
}

// Utility Functions
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(message) {
  const existingToast = document.querySelector(".error-toast");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.className = "error-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f56565;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function showSuccess(message) {
  const existingToast = document.querySelector(".success-toast");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.className = "success-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function destroyChart(chartName) {
  if (charts[chartName]) {
    charts[chartName].destroy();
    charts[chartName] = null;
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
      if (gameDesc && data.gameDescription) {
        gameDesc.textContent = data.gameDescription;
      }

      // Update about section
      const projectDesc = document.getElementById("projectDescription");
      if (projectDesc && data.projectDescription) {
        projectDesc.textContent = data.projectDescription;
      }

      // Update wishlist button
      const wishlistBtn = document.getElementById("wishlistBtn");
      if (wishlistBtn && data.wishlistUrl) {
        wishlistBtn.href = data.wishlistUrl;
      }

      // Update LinkedIn links
      if (data.linkedinUrl) {
        const linkedinLink = document.getElementById("linkedinLink");
        const footerLinkedin = document.getElementById("footerLinkedin");
        if (linkedinLink) linkedinLink.href = data.linkedinUrl;
        if (footerLinkedin) footerLinkedin.href = data.linkedinUrl;
      }

      // Return playlist ID for later use
      return data.youtubePlaylistId || null;
    }

    return null;
  } catch (error) {
    console.error("Error loading game info:", error);
    return null;
  }
}

// Load Metrics and Charts
async function loadMetrics() {
  try {
    // Load time entries
    const timeSnapshot = await db
      .collection("timeEntries")
      .orderBy("date")
      .get();
    const timeEntries = [];
    timeSnapshot.forEach((doc) => timeEntries.push(doc.data()));

    // Load expenses
    const expenseSnapshot = await db
      .collection("expenses")
      .orderBy("date")
      .get();
    const expenses = [];
    expenseSnapshot.forEach((doc) => expenses.push(doc.data()));

    // Calculate metrics
    const totalHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Get unique dates for days active
    const uniqueDates = new Set([
      ...timeEntries.map((e) => e.date).filter(Boolean),
      ...expenses.map((e) => e.date).filter(Boolean),
    ]);
    const daysActive = uniqueDates.size;

    // Calculate average hours per week
    const weeks = daysActive / 7;
    const avgHours = weeks > 0 ? (totalHours / weeks).toFixed(1) : "0";

    // Update metric cards
    const totalHoursEl = document.getElementById("totalHours");
    const totalSpentEl = document.getElementById("totalSpent");
    const daysActiveEl = document.getElementById("daysActive");
    const avgHoursEl = document.getElementById("avgHours");

    if (totalHoursEl) totalHoursEl.textContent = totalHours.toFixed(1);
    if (totalSpentEl) totalSpentEl.textContent = `£${totalSpent.toFixed(2)}`;
    if (daysActiveEl) daysActiveEl.textContent = daysActive;
    if (avgHoursEl) avgHoursEl.textContent = avgHours;

    // Create charts
    createTimeChart(timeEntries);
    createBudgetChart(expenses);
    createTimeCategoryChart(timeEntries);
    createBudgetCategoryChart(expenses);
  } catch (error) {
    console.error("Error loading metrics:", error);
  }
}

// Create Time Over Time Chart
function createTimeChart(timeEntries) {
  const ctx = document.getElementById("timeChart");
  if (!ctx) return;

  // Group by date
  const dateMap = {};
  timeEntries.forEach((entry) => {
    if (entry.date && entry.hours) {
      if (!dateMap[entry.date]) {
        dateMap[entry.date] = 0;
      }
      dateMap[entry.date] += entry.hours;
    }
  });

  const dates = Object.keys(dateMap).sort();
  const hours = dates.map((date) => dateMap[date]);

  // Calculate cumulative
  const cumulative = [];
  let sum = 0;
  hours.forEach((h) => {
    sum += h;
    cumulative.push(sum);
  });

  destroyChart("timeChart");

  charts.timeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Cumulative Hours",
          data: cumulative,
          borderColor: "rgb(124, 58, 237)",
          backgroundColor: "rgba(124, 58, 237, 0.1)",
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
        y: {
          beginAtZero: true,
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
    if (expense.date && expense.amount) {
      if (!dateMap[expense.date]) {
        dateMap[expense.date] = 0;
      }
      dateMap[expense.date] += expense.amount;
    }
  });

  const dates = Object.keys(dateMap).sort();
  const amounts = dates.map((date) => dateMap[date]);

  // Calculate cumulative
  const cumulative = [];
  let sum = 0;
  amounts.forEach((amount) => {
    sum += amount;
    cumulative.push(sum);
  });

  destroyChart("budgetChart");

  charts.budgetChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Cumulative Spending (£)",
          data: cumulative,
          borderColor: "rgb(245, 101, 101)",
          backgroundColor: "rgba(245, 101, 101, 0.1)",
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
        y: {
          beginAtZero: true,
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
    if (entry.category && entry.hours) {
      if (!categoryMap[entry.category]) {
        categoryMap[entry.category] = 0;
      }
      categoryMap[entry.category] += entry.hours;
    }
  });

  const categories = Object.keys(categoryMap);
  const hours = categories.map((cat) => categoryMap[cat]);

  if (categories.length === 0) {
    return;
  }

  destroyChart("timeCategoryChart");

  charts.timeCategoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [
        {
          data: hours,
          backgroundColor: CHART_COLORS,
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
    if (expense.category && expense.amount) {
      if (!categoryMap[expense.category]) {
        categoryMap[expense.category] = 0;
      }
      categoryMap[expense.category] += expense.amount;
    }
  });

  const categories = Object.keys(categoryMap);
  const amounts = categories.map((cat) => categoryMap[cat]);

  if (categories.length === 0) {
    return;
  }

  destroyChart("budgetCategoryChart");

  charts.budgetCategoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [
        {
          data: amounts,
          backgroundColor: CHART_COLORS,
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

// Load Development Updates
async function loadUpdates() {
  try {
    const snapshot = await db
      .collection("updates")
      .orderBy("date", "desc")
      .limit(10)
      .get();

    const grid = document.getElementById("updatesGrid");
    if (!grid) return;

    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-state">${EMPTY_STATES.updates}</div>`;
      return;
    }

    snapshot.forEach((doc) => {
      const update = doc.data();
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

  const date = update.date
    ? new Date(update.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No date";

  const tags = update.tags
    ? update.tags
        .map(
          (tag) => `<span class="update-tag">${escapeHtml(tag)}</span>`
        )
        .join("")
    : "";

  const title = escapeHtml(update.title || "Untitled");
  const summary = update.summary
    ? escapeHtml(update.summary)
    : update.content
      ? escapeHtml(update.content.substring(0, 150)) + "..."
      : "";

  card.innerHTML = `
    <div class="update-header">
      <h3 class="update-title">${title}</h3>
      <span class="update-date mono">${date}</span>
    </div>
    <p class="update-summary">${summary}</p>
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

    const grid = document.getElementById("screenshotsGrid");
    if (!grid) return;

    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-state">${EMPTY_STATES.screenshots}</div>`;
      return;
    }

    snapshot.forEach((doc) => {
      const screenshot = doc.data();
      const item = createScreenshotItem(screenshot);
      grid.appendChild(item);
    });

    // Setup filters
    setupGalleryFilters();
  } catch (error) {
    console.error("Error loading screenshots:", error);
  }
}

function createScreenshotItem(screenshot) {
  const item = document.createElement("div");
  item.className = "screenshot-item";
  item.dataset.category = screenshot.category || "other";

  if (screenshot.isBeforeAfter) {
    item.dataset.beforeAfter = "true";
  }

  const title = escapeHtml(screenshot.title || "Screenshot");
  const description = escapeHtml(screenshot.description || "");
  const category = escapeHtml(screenshot.category || "Other");

  item.innerHTML = `
    <img 
      src="${escapeHtml(screenshot.imageUrl)}" 
      alt="${title}" 
      loading="lazy" 
    />
    <div class="screenshot-overlay">
      <h4>${title}</h4>
      <p>${description}</p>
      <span class="screenshot-category">${category}</span>
    </div>
  `;

  return item;
}

function setupGalleryFilters() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  const items = document.querySelectorAll(".screenshot-item");

  if (filterBtns.length === 0) return;

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

// Load Budget Data
async function loadBudget() {
  try {
    // Load expenses
    const expensesSnapshot = await db
      .collection("expenses")
      .orderBy("date", "desc")
      .limit(20)
      .get();

    const expensesTable = document.getElementById("expensesTable");
    if (expensesTable) {
      const tbody = expensesTable.querySelector("tbody");
      if (tbody) {
        tbody.innerHTML = "";

        let totalSpent = 0;

        if (expensesSnapshot.empty) {
          tbody.innerHTML = `<tr><td colspan="4" class="empty-state">${EMPTY_STATES.expenses}</td></tr>`;
        } else {
          expensesSnapshot.forEach((doc) => {
            const expense = doc.data();
            totalSpent += expense.amount || 0;

            const row = document.createElement("tr");
            const date = expense.date
              ? new Date(expense.date).toLocaleDateString("en-GB")
              : "N/A";
            row.innerHTML = `
              <td class="mono">${date}</td>
              <td><span class="category-badge">${escapeHtml(expense.category || "Other")}</span></td>
              <td>${escapeHtml(expense.description || "")}</td>
              <td class="mono">£${(expense.amount || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(row);
          });
        }

        // Update budget spent
        const budgetSpent = document.getElementById("budgetSpent");
        if (budgetSpent) {
          budgetSpent.textContent = `£${totalSpent.toFixed(2)}`;
        }
      }
    }

    // Load planned expenses
    const plannedSnapshot = await db
      .collection("plannedExpenses")
      .where("isPurchased", "==", false)
      .orderBy("createdAt", "desc")
      .get();

    const plannedTable = document.getElementById("plannedTable");
    if (plannedTable) {
      const tbody = plannedTable.querySelector("tbody");
      if (tbody) {
        tbody.innerHTML = "";

        let totalPlanned = 0;

        if (plannedSnapshot.empty) {
          tbody.innerHTML = `<tr><td colspan="4" class="empty-state">${EMPTY_STATES.plannedExpenses}</td></tr>`;
        } else {
          plannedSnapshot.forEach((doc) => {
            const planned = doc.data();
            totalPlanned += planned.estimatedCost || 0;

            const row = document.createElement("tr");
            row.innerHTML = `
              <td><span class="priority-badge ${(planned.priority || "medium").toLowerCase()}">${escapeHtml(planned.priority || "Medium")}</span></td>
              <td>${escapeHtml(planned.item || "")}</td>
              <td><span class="category-badge">${escapeHtml(planned.category || "Other")}</span></td>
              <td class="mono">£${(planned.estimatedCost || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(row);
          });
        }

        // Update budget summary
        const budgetPlanned = document.getElementById("budgetPlanned");
        const budgetTotal = document.getElementById("budgetTotal");
        const budgetSpent = document.getElementById("budgetSpent");

        if (budgetPlanned) {
          budgetPlanned.textContent = `£${totalPlanned.toFixed(2)}`;
        }

        if (budgetTotal && budgetSpent) {
          const spent = parseFloat(
            budgetSpent.textContent.replace("£", "")
          );
          budgetTotal.textContent = `£${(spent + totalPlanned).toFixed(2)}`;
        }
      }
    }
  } catch (error) {
    console.error("Error loading budget:", error);
  }
}

// Load Tasks
async function loadTasks() {
  try {
    const snapshot = await db
      .collection("tasks")
      .orderBy("createdAt", "desc")
      .get();

    const todoList = document.getElementById("todoTasks");
    const inProgressList = document.getElementById("inProgressTasks");
    const doneList = document.getElementById("doneTasks");

    if (!todoList || !inProgressList || !doneList) return;

    todoList.innerHTML = "";
    inProgressList.innerHTML = "";
    doneList.innerHTML = "";

    if (snapshot.empty) {
      todoList.innerHTML = `<div class="empty-state">${EMPTY_STATES.tasks}</div>`;
      return;
    }

    let hasTodo = false;
    let hasInProgress = false;
    let hasDone = false;

    snapshot.forEach((doc) => {
      const task = doc.data();
      const card = createTaskCard(task);

      if (task.status === "To Do") {
        todoList.appendChild(card);
        hasTodo = true;
      } else if (task.status === "In Progress") {
        inProgressList.appendChild(card);
        hasInProgress = true;
      } else if (task.status === "Done") {
        doneList.appendChild(card);
        hasDone = true;
      }
    });

    // Add empty states for empty columns
    if (!hasTodo) {
      todoList.innerHTML = `<div class="empty-state">No tasks</div>`;
    }
    if (!hasInProgress) {
      inProgressList.innerHTML = `<div class="empty-state">No tasks</div>`;
    }
    if (!hasDone) {
      doneList.innerHTML = `<div class="empty-state">No tasks</div>`;
    }
  } catch (error) {
    console.error("Error loading tasks:", error);
  }
}

function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";

  const title = escapeHtml(task.title || "Untitled");
  const description = escapeHtml(task.description || "");
  const priority = escapeHtml(task.priority || "Medium");
  const category = escapeHtml(task.category || "Other");

  card.innerHTML = `
    <div class="task-header">
      <h4 class="task-title">${title}</h4>
      <span class="priority-badge ${priority.toLowerCase()}">${priority}</span>
    </div>
    <p class="task-description">${description}</p>
    <div class="task-footer">
      <span class="category-badge">${category}</span>
    </div>
  `;

  return card;
}

// Load Game Flow Diagram
async function loadGameFlow() {
  try {
    const nodesSnapshot = await db
      .collection("flowNodes")
      .orderBy("createdAt")
      .get();
    const connectionsSnapshot = await db
      .collection("flowConnections")
      .orderBy("createdAt")
      .get();

    const nodes = [];
    nodesSnapshot.forEach((doc) => {
      nodes.push({ id: doc.id, ...doc.data() });
    });

    const connections = [];
    connectionsSnapshot.forEach((doc) => {
      connections.push(doc.data());
    });

    drawFlowDiagram(nodes, connections);
  } catch (error) {
    console.error("Error loading game flow:", error);
  }
}

function drawFlowDiagram(nodes, connections) {
  const canvas = document.getElementById("flowCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 600 * dpr;
  canvas.style.width = rect.width + "px";
  canvas.style.height = "600px";

  // Scale for retina displays
  ctx.scale(dpr, dpr);

  // Apply zoom and pan
  ctx.save();
  ctx.translate(flowDiagram.offsetX, flowDiagram.offsetY);
  ctx.scale(flowDiagram.scale, flowDiagram.scale);

  // Clear canvas
  ctx.clearRect(
    -flowDiagram.offsetX / flowDiagram.scale,
    -flowDiagram.offsetY / flowDiagram.scale,
    rect.width / flowDiagram.scale,
    600 / flowDiagram.scale
  );

  if (nodes.length === 0) {
    ctx.restore();
    ctx.fillStyle = "#666";
    ctx.font = "16px Inter";
    ctx.textAlign = "center";
    ctx.fillText(EMPTY_STATES.flow, rect.width / 2 / dpr, 300);
    return;
  }

  // Draw connections
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 2;

  connections.forEach((conn) => {
    const fromNode = nodes.find((n) => n.id === conn.from);
    const toNode = nodes.find((n) => n.id === conn.to);

    if (fromNode && toNode && fromNode.x && fromNode.y && toNode.x && toNode.y) {
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(
        toNode.y - fromNode.y,
        toNode.x - fromNode.x
      );
      const arrowSize = 10;
      ctx.beginPath();
      ctx.moveTo(toNode.x, toNode.y);
      ctx.lineTo(
        toNode.x - arrowSize * Math.cos(angle - Math.PI / 6),
        toNode.y - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        toNode.x - arrowSize * Math.cos(angle + Math.PI / 6),
        toNode.y - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = "#7c3aed";
      ctx.fill();

      // Draw label if exists
      if (conn.label) {
        const midX = (fromNode.x + toNode.x) / 2;
        const midY = (fromNode.y + toNode.y) / 2;
        ctx.fillStyle = "#fff";
        ctx.fillRect(midX - 20, midY - 10, 40, 20);
        ctx.fillStyle = "#333";
        ctx.font = "12px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(conn.label, midX, midY);
      }
    }
  });

  // Draw nodes
  nodes.forEach((node) => {
    if (!node.x || !node.y) return;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(node.x - 60, node.y - 30, 120, 60);
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    ctx.strokeRect(node.x - 60, node.y - 30, 120, 60);

    ctx.fillStyle = "#fff";
    ctx.font = "14px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label || "Node", node.x, node.y - 5);

    ctx.font = "10px Inter";
    ctx.fillStyle = "#999";
    ctx.fillText(node.type || "", node.x, node.y + 10);
  });

  ctx.restore();
}

// Load YouTube Playlist
function loadYouTubePlaylist(playlistId) {
  const container = document.getElementById("youtubePlaylist");
  if (!container) return;

  if (!playlistId) {
    container.innerHTML = `<div class="empty-state">${EMPTY_STATES.youtube}</div>`;
    return;
  }

  container.innerHTML = `
    <iframe 
      width="100%" 
      height="600" 
      src="https://www.youtube.com/embed/videoseries?list=${escapeHtml(playlistId)}" 
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

  if (zoomIn) {
    zoomIn.addEventListener("click", () => {
      flowDiagram.scale = Math.min(flowDiagram.scale + SCALE_STEP, MAX_SCALE);
      loadGameFlow();
    });
  }

  if (zoomOut) {
    zoomOut.addEventListener("click", () => {
      flowDiagram.scale = Math.max(flowDiagram.scale - SCALE_STEP, MIN_SCALE);
      loadGameFlow();
    });
  }

  if (resetView) {
    resetView.addEventListener("click", () => {
      flowDiagram.scale = 1;
      flowDiagram.offsetX = 0;
      flowDiagram.offsetY = 0;
      loadGameFlow();
    });
  }

  // Window resize handler
  window.addEventListener(
    "resize",
    debounce(() => {
      loadGameFlow();
      // Redraw charts if needed
      Object.keys(charts).forEach((key) => {
        if (charts[key]) {
          charts[key].resize();
        }
      });
    }, 250)
  );
}

// Newsletter Handler
async function handleNewsletterSubmit(e) {
  e.preventDefault();

  const emailInput = document.getElementById("newsletterEmail");
  const email = emailInput.value.trim();
  const status = document.getElementById("newsletterStatus");

  if (!status) return;

  // Validate email
  if (!isValidEmail(email)) {
    status.textContent = "❌ Please enter a valid email address.";
    status.style.color = "#f56565";
    return;
  }

  try {
    await db.collection("newsletter").add({
      email,
      subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showSuccess("Successfully subscribed to newsletter!");
    e.target.reset();

    if (status) {
      status.textContent = "";
    }
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    showError("Error subscribing. Please try again.");
  }
}

// Image modal functionality
function setupImageModal() {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");

  if (!modal || !modalImg) return;

  // Add click handlers to all screenshot images
  document.addEventListener("click", (e) => {
    const screenshotItem = e.target.closest(
      ".screenshot-item, .screenshot-card"
    );
    if (screenshotItem) {
      const img = screenshotItem.querySelector("img");
      if (img) {
        modal.classList.add("active");
        modalImg.src = img.src;
        modalImg.alt = img.alt;
        document.body.style.overflow = "hidden";
      }
    }
  });

  // Close modal on click
  modal.addEventListener("click", () => {
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  });

  // Close on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      modal.classList.remove("active");
      document.body.style.overflow = "auto";
    }
  });
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  // Destroy all charts
  Object.keys(charts).forEach((key) => {
    destroyChart(key);
  });
});
