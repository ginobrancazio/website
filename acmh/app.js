// Public-facing application JavaScript
let charts = {};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

async function initializeApp() {
  try {
    // Load all data
    await Promise.all([
      loadGameInfo(),
      loadMetrics(),
      loadUpdates(),
      loadScreenshots(),
      loadBudget(),
      loadTasks(),
      loadGameFlow(),
      loadYouTubePlaylist(),
    ]);

    // Setup event listeners
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
    }
  } catch (error) {
    console.error("Error loading game info:", error);
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
    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Get unique dates for days active
    const uniqueDates = new Set([
      ...timeEntries.map((e) => e.date),
      ...expenses.map((e) => e.date),
    ]);
    const daysActive = uniqueDates.size;

    // Calculate average hours per week
    const weeks = daysActive / 7;
    const avgHours = weeks > 0 ? (totalHours / weeks).toFixed(1) : 0;

    // Update metric cards
    document.getElementById("totalHours").textContent =
      totalHours.toFixed(1);
    document.getElementById("totalSpent").textContent =
      `£${totalSpent.toFixed(2)}`;
    document.getElementById("daysActive").textContent = daysActive;
    document.getElementById("avgHours").textContent = avgHours;

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
    if (!dateMap[entry.date]) {
      dateMap[entry.date] = 0;
    }
    dateMap[entry.date] += entry.hours;
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

  if (charts.timeChart) charts.timeChart.destroy();

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
    if (!dateMap[expense.date]) {
      dateMap[expense.date] = 0;
    }
    dateMap[expense.date] += expense.amount;
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

  if (charts.budgetChart) charts.budgetChart.destroy();

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
          backgroundColor: [
            "rgba(124, 58, 237, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(245, 101, 101, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
          ],
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
          backgroundColor: [
            "rgba(124, 58, 237, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(245, 101, 101, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
          ],
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
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML =
        '<div class="empty-state">No updates yet. Check back soon!</div>';
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

    const grid = document.getElementById("screenshotsGrid");
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML =
        '<div class="empty-state">No screenshots yet. Check back soon!</div>';
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

// Load Budget Data
async function loadBudget() {
  try {
    // Load expenses
    const expensesSnapshot = await db
      .collection("expenses")
      .orderBy("date", "desc")
      .limit(20)
      .get();

    const expensesTable = document
      .getElementById("expensesTable")
      .querySelector("tbody");
    expensesTable.innerHTML = "";

    let totalSpent = 0;

    if (expensesSnapshot.empty) {
      expensesTable.innerHTML =
        '<tr><td colspan="4" class="empty-state">No expenses recorded yet.</td></tr>';
    } else {
      expensesSnapshot.forEach((doc) => {
        const expense = doc.data();
        totalSpent += expense.amount;

        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="mono">${new Date(expense.date).toLocaleDateString("en-GB")}</td>
          <td><span class="category-badge">${expense.category}</span></td>
          <td>${expense.description}</td>
          <td class="mono">£${expense.amount.toFixed(2)}</td>
        `;
        expensesTable.appendChild(row);
      });
    }

    // Load planned expenses
    const plannedSnapshot = await db
      .collection("plannedExpenses")
      .where("isPurchased", "==", false)
      .orderBy("createdAt", "desc")
      .get();

    const plannedTable = document
      .getElementById("plannedTable")
      .querySelector("tbody");
    plannedTable.innerHTML = "";

    let totalPlanned = 0;

    if (plannedSnapshot.empty) {
      plannedTable.innerHTML =
        '<tr><td colspan="4" class="empty-state">No planned expenses.</td></tr>';
    } else {
      plannedSnapshot.forEach((doc) => {
        const planned = doc.data();
        totalPlanned += planned.estimatedCost;

        const row = document.createElement("tr");
        row.innerHTML = `
          <td><span class="priority-badge ${planned.priority.toLowerCase()}">${planned.priority}</span></td>
          <td>${planned.item}</td>
          <td><span class="category-badge">${planned.category}</span></td>
          <td class="mono">£${planned.estimatedCost.toFixed(2)}</td>
        `;
        plannedTable.appendChild(row);
      });
    }

    // Update budget summary
    document.getElementById("budgetSpent").textContent =
      `£${totalSpent.toFixed(2)}`;
    document.getElementById("budgetPlanned").textContent =
      `£${totalPlanned.toFixed(2)}`;
    document.getElementById("budgetTotal").textContent =
      `£${(totalSpent + totalPlanned).toFixed(2)}`;
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

    todoList.innerHTML = "";
    inProgressList.innerHTML = "";
    doneList.innerHTML = "";

    if (snapshot.empty) {
      todoList.innerHTML = '<div class="empty-state">No tasks yet.</div>';
      return;
    }

    snapshot.forEach((doc) => {
      const task = doc.data();
      const card = createTaskCard(task);

      if (task.status === "To Do") {
        todoList.appendChild(card);
      } else if (task.status === "In Progress") {
        inProgressList.appendChild(card);
      } else if (task.status === "Done") {
        doneList.appendChild(card);
      }
    });
  } catch (error) {
    console.error("Error loading tasks:", error);
  }
}

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

  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 600;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (nodes.length === 0) {
    ctx.fillStyle = "#666";
    ctx.font = "16px Inter";
    ctx.textAlign = "center";
    ctx.fillText("No flow diagram yet", canvas.width / 2, canvas.height / 2);
    return;
  }

  // Draw connections
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 2;

  connections.forEach((conn) => {
    const fromNode = nodes.find((n) => n.id === conn.from);
    const toNode = nodes.find((n) => n.id === conn.to);

    if (fromNode && toNode) {
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
        ctx.fillText(conn.label, midX, midY + 4);
      }
    }
  });

  // Draw nodes
  nodes.forEach((node) => {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(node.x - 60, node.y - 30, 120, 60);
    ctx.strokeStyle = "#7c3aed";
    ctx.strokeRect(node.x - 60, node.y - 30, 120, 60);

    ctx.fillStyle = "#fff";
    ctx.font = "14px Inter";
    ctx.textAlign = "center";
    ctx.fillText(node.label, node.x, node.y - 5);
    ctx.font = "10px Inter";
    ctx.fillStyle = "#999";
    ctx.fillText(node.type, node.x, node.y + 10);
  });
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

// Newsletter Handler
async function handleNewsletterSubmit(e) {
  e.preventDefault();

  const email = document.getElementById("newsletterEmail").value;
  const status = document.getElementById("newsletterStatus");

  try {
    await db.collection("newsletter").add({
      email,
      subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    status.textContent = "✅ Successfully subscribed!";
    status.style.color = "#10b981";
    e.target.reset();

    setTimeout(() => {
      status.textContent = "";
    }, 5000);
  } catch (error) {
    status.textContent = "❌ Error subscribing. Please try again.";
    status.style.color = "#f56565";
  }
}

// Add this to your setupEventListeners function or at the end of app.js

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

// Call this in your initializeApp function
setupImageModal();
