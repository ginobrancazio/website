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

      // Update Discord button
      const discordBtn = document.getElementById("discordBtn");
      if (discordBtn && data.discordUrl) {
        discordBtn.href = data.discordUrl;
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

    // Load vibe checks
    const vibeSnapshot = await db
      .collection("vibeChecks")
      .orderBy("date")
      .get();
    const vibeChecks = [];
    vibeSnapshot.forEach((doc) => vibeChecks.push(doc.data()));

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
    createVibeChart(vibeChecks);
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
    data: {
      datasets: [
        {
          label: "Cumulative Hours",
          data: dataPoints,
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
        x: {
          type: 'time',
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
    data: {
      datasets: [
        {
          label: "Cumulative Spending (£)",
          data: dataPoints,
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
        x: {
          type: 'time',
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
    if (v.status === "Green") return "rgba(46, 204, 113, 0.8)";
    if (v.status === "Amber") return "rgba(243, 156, 18, 0.8)";
    return "rgba(232, 69, 69, 0.8)";
  });

  if (charts.vibeChart) charts.vibeChart.destroy();

  charts.vibeChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Vibe Check",
          data: dataPoints,
          borderColor: "rgb(124, 58, 237)",
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

// Load Budget Data
async function loadBudget() {
  try {
    // Load ALL income
    const allIncomeSnapshot = await db.collection("income").get();

    // Load recent income for table display
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

    // Calculate total from ALL income
    allIncomeSnapshot.forEach((doc) => {
      const income = doc.data();
      totalIncome += income.amount;
    });

    // Populate income table
    if (recentIncomeSnapshot.empty) {
      incomeTable.innerHTML =
        '<tr><td colspan="4" class="empty-state">No income recorded yet.</td></tr>';
    } else {
      recentIncomeSnapshot.forEach((doc) => {
        const income = doc.data();
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="mono">${new Date(income.date).toLocaleDateString("en-GB")}</td>
          <td><span class="category-badge">${income.source}</span></td>
          <td>${income.description}</td>
          <td class="mono">£${income.amount.toFixed(2)}</td>
        `;
        incomeTable.appendChild(row);
      });
    }

    // Load ALL expenses
    const allExpensesSnapshot = await db.collection("expenses").get();

    // Load recent expenses for table display
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

    // Calculate total from ALL expenses
    allExpensesSnapshot.forEach((doc) => {
      const expense = doc.data();
      totalSpent += expense.amount;
    });

    // Populate expenses table
    if (recentExpensesSnapshot.empty) {
      expensesTable.innerHTML =
        '<tr><td colspan="4" class="empty-state">No expenses recorded yet.</td></tr>';
    } else {
      recentExpensesSnapshot.forEach((doc) => {
        const expense = doc.data();
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

     // Load planned expenses (updated)
const plannedSnapshot = await db
  .collection("plannedExpenses")
  .where("isPurchased", "==", false)
  .get();

// Load active recurring costs
const recurringSnapshot = await db
  .collection("recurringCosts")
  .where("isActive", "==", true)
  .get();

const plannedTable = document
  .getElementById("plannedTable")
  .querySelector("tbody");

plannedTable.innerHTML = "";

// If both empty
if (plannedSnapshot.empty && recurringSnapshot.empty) {
  plannedTable.innerHTML =
    '<tr><td colspan="4" class="empty-state">No planned expenses.</td></tr>';
} else {

  
// Normal planned expenses
plannedSnapshot.forEach((doc) => {
  const planned = doc.data();
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${planned.item}</td>
    <td><span class="category-badge">${planned.category}</span></td>
    <td class="mono">£${planned.estimatedCost.toFixed(2)}</td>
    <td>${planned.description || "-"}</td>
    <td>
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

// Recurring expenses
recurringSnapshot.forEach((doc) => {
  const recurring = doc.data();
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>
      ${recurring.item}
      <span class="recurring-badge">RECURRING</span>
    </td>
    <td><span class="category-badge">${recurring.category}</span></td>
    <td class="mono">£${recurring.amount.toFixed(2)} / month</td>
    <td>${recurring.description || "-"}</td>
    <td>
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
        // Remove any existing listeners to prevent duplicates
        plannedTableElement.replaceWith(plannedTableElement.cloneNode(true));
        
        // Get the fresh table reference
        const freshTable = document.getElementById("plannedTable");
        
        // Add the click listener
        freshTable.addEventListener("click", (e) => {
          if (e.target.classList.contains("btn-contribute")) {
            const itemId = e.target.dataset.itemId;
            const itemName = e.target.dataset.itemName;
            const itemCost = parseFloat(e.target.dataset.itemCost);
            
            contributeToItem(itemId, itemName, itemCost);
          }
        });
      }
}

    // Calculate profit/loss
    const profitLoss = totalIncome - totalSpent;
    const profitLossElement = document.getElementById("budgetProfitLoss");

    // Update budget summary
    document.getElementById("budgetIncome").textContent =
      `£${totalIncome.toFixed(2)}`;
    document.getElementById("budgetSpent").textContent =
      `£${totalSpent.toFixed(2)}`;
    profitLossElement.textContent = `£${profitLoss.toFixed(2)}`;

    // Add profit/loss color class
    profitLossElement.classList.remove("profit", "loss");
    if (profitLoss >= 0) {
      profitLossElement.classList.add("profit");
    } else {
      profitLossElement.classList.add("loss");
    }
    
  } catch (error) {
    console.error("Error loading budget:", error);
    document.getElementById("budgetIncome").textContent = "Error";
    document.getElementById("budgetSpent").textContent = "Error";
    document.getElementById("budgetProfitLoss").textContent = "Error";
  }
}

// contribute function
window.contributeToItem = async function(itemId, itemName, amount) {
  console.log('Contribute clicked:', { itemId, itemName, amount });
  
  try {
    // Log to Firestore for tracking
    const docRef = await firebase.firestore().collection('contributionClicks').add({
      itemId: itemId,
      itemName: itemName,
      amount: amount,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Contribution logged successfully with ID:', docRef.id);
    
    // Open Ko-fi page
    window.open('https://ko-fi.com/ginolitway', '_blank');
  } catch (error) {
    console.error('Error logging contribution click:', error);
    alert('Error logging contribution: ' + error.message);
  
    // Still open Ko-fi even if logging fails
    window.open('https://ko-fi.com/ginolitway', '_blank');
  }
};

function showMessage(message, type = "success") {
  alert(message); // Simple implementation for now
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
  const accordion = document.querySelector(".accordion");
  const header = document.querySelector(".accordion-header");

  if (accordion && header) {
    header.addEventListener("click", () => {
      accordion.classList.toggle("open");
    });
  }
});
