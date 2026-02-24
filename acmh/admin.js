// Admin Panel JavaScript
let currentUser = null;
let unsubscribeAuth = null;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Set today's date as default for all date inputs
  const today = new Date().toISOString().split("T")[0];
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = today;
  });

  // Setup auth state observer
  setupAuthObserver();

  // Setup event listeners
  setupEventListeners();
});

// Auth State Observer
function setupAuthObserver() {
  unsubscribeAuth = firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      showAdminDashboard();
      loadGameInfo();
    } else {
      currentUser = null;
      showLoginScreen();
    }
  });
}

function showLoginScreen() {
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("adminDashboard").style.display = "none";
}

function showAdminDashboard() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminDashboard").style.display = "block";
  document.getElementById("userEmail").textContent = currentUser.email;
}

// Event Listeners Setup
function setupEventListeners() {
  // Login form
document
    .getElementById("loginForm")
    .addEventListener("submit", handleLogin);

document
  .getElementById("vibeForm")
  .addEventListener("submit", handleVibeSubmit);
  
  // Logout button
  document
    .getElementById("logoutBtn")
    .addEventListener("click", handleLogout);
  
  
  // Tab navigation
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Form submissions
  document
    .getElementById("gameInfoForm")
    .addEventListener("submit", handleGameInfoSubmit);
  document
    .getElementById("expenseForm")
    .addEventListener("submit", handleExpenseSubmit);
  document
    .getElementById("incomeForm")
    .addEventListener("submit", handleIncomeSubmit);
  document
    .getElementById("timeForm")
    .addEventListener("submit", handleTimeSubmit);
  document
    .getElementById("plannedForm")
    .addEventListener("submit", handlePlannedSubmit);
  document
    .getElementById("taskForm")
    .addEventListener("submit", handleTaskSubmit);
  document
    .getElementById("screenshotForm")
    .addEventListener("submit", handleScreenshotSubmit);
  document
    .getElementById("updateForm")
    .addEventListener("submit", handleUpdateSubmit);

  // recurring expenses form
  document
  .getElementById("recurringForm")
  .addEventListener("submit", handleRecurringSubmit);

  
// File upload preview
const fileInput = document.getElementById("screenshotFile");
const uploadDiv = document.getElementById("screenshotUpload");

fileInput.addEventListener("change", handleFilePreview);

uploadDiv.addEventListener("click", (e) => {
  // Only trigger if clicking the div itself, not the input
  if (e.target === uploadDiv || e.target.closest('.upload-icon, .upload-text')) {
    fileInput.click();
  }
});

// Prevent default drag behavior
uploadDiv.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadDiv.style.borderColor = "var(--gradient-start)";
});

uploadDiv.addEventListener("dragleave", (e) => {
  e.preventDefault();
  uploadDiv.style.borderColor = "";
});
}

// Authentication Handlers
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const errorDiv = document.getElementById("loginError");

  console.log("Attempting login with:", email);

  try {
    const result = await firebase
      .auth()
      .signInWithEmailAndPassword(email, password);
    console.log("Login successful:", result.user);
    errorDiv.style.display = "none";
  } catch (error) {
    console.error("Login error:", error);
    errorDiv.textContent = error.message;
    errorDiv.style.display = "block";
  }
}

async function handleLogout(e) {
  e.preventDefault();
  try {
    await firebase.auth().signOut();
  } catch (error) {
    showMessage("Error signing out: " + error.message, "error");
  }
}

// Tab Switching
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
    if (tab.dataset.tab === tabName) {
      tab.classList.add("active");
    }
  });

  // Update tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add("active");
  } else {
    console.error(`Tab content not found: ${tabName}`);
    return;
  }

  // Hide any messages
  const messageDiv = document.getElementById("formMessage");
  if (messageDiv) {
    messageDiv.style.display = "none";
  }

  // Load relevant data when switching tabs
  switch (tabName) {
    case "expenses":
      loadAdminExpenses();
      break;
    case "income":
      loadAdminIncome();
      break;
    case "time":
      loadAdminTime();
      break;
    case "planned":
      loadAdminPlanned();
      break;
    case "vibes":
      loadAdminVibes();
      break;
  }
}

// Message Display
function showMessage(message, type = "success") {
  const messageDiv = document.getElementById("formMessage");
  messageDiv.className =
    type === "success" ? "success-message" : "error-message";
  messageDiv.textContent = message;
  messageDiv.style.display = "block";

  // Scroll to top to show message
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Hide after 5 seconds
  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 5000);
}

// Game Info Handlers
async function loadGameInfo() {
  try {
    const doc = await firebase
      .firestore()
      .collection("settings")
      .doc("gameInfo")
      .get();

    if (doc.exists) {
      const data = doc.data();
      document.getElementById("gameDescription").value =
        data.gameDescription || "";
      document.getElementById("projectDescription").value =
        data.projectDescription || "";
      document.getElementById("youtubePlaylistId").value =
        data.youtubePlaylistId || "";
      document.getElementById("linkedinUrl").value = data.linkedinUrl || "";
      document.getElementById("wishlistUrl").value = data.wishlistUrl || "";
    }
  } catch (error) {
    console.error("Error loading game info:", error);
  }
}

async function handleGameInfoSubmit(e) {
  e.preventDefault();

  try {
    const gameInfo = {
      gameDescription: document.getElementById("gameDescription").value,
      projectDescription: document.getElementById("projectDescription").value,
      youtubePlaylistId: document.getElementById("youtubePlaylistId").value,
      linkedinUrl: document.getElementById("linkedinUrl").value,
      wishlistUrl: document.getElementById("wishlistUrl").value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase
      .firestore()
      .collection("settings")
      .doc("gameInfo")
      .set(gameInfo, { merge: true });

    showMessage("Game information saved successfully!");
  } catch (error) {
    showMessage("Error saving game info: " + error.message, "error");
  }
}

// Expense Handler
async function handleExpenseSubmit(e) {
  e.preventDefault();

  try {
    const expense = {
      date: document.getElementById("expenseDate").value,
      category: document.getElementById("expenseCategory").value,
      amount: parseFloat(document.getElementById("expenseAmount").value),
      description: document.getElementById("expenseDescription").value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("expenses").add(expense);

    showMessage("Expense added successfully!");
    e.target.reset();
    document.getElementById("expenseDate").value = new Date()
      .toISOString()
      .split("T")[0];

    loadAdminExpenses();
  } catch (error) {
    showMessage("Error adding expense: " + error.message, "error");
  }
}

// vibe handler
async function handleVibeSubmit(e) {
  e.preventDefault();

  try {
    const vibeCheck = {
      date: document.getElementById("vibeDate").value,
      status: document.getElementById("vibeStatus").value,
      notes: document.getElementById("vibeNotes").value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("vibeChecks").add(vibeCheck);

    showMessage("Vibe check logged successfully!");
    e.target.reset();
    document.getElementById("vibeDate").value = new Date()
      .toISOString()
      .split("T")[0];

    loadAdminVibes();
  } catch (error) {
    showMessage("Error logging vibe check: " + error.message, "error");
  }
}

// Income Handler
async function handleIncomeSubmit(e) {
  e.preventDefault();

  try {
    const income = {
      date: document.getElementById("incomeDate").value,
      source: document.getElementById("incomeSource").value,
      amount: parseFloat(document.getElementById("incomeAmount").value),
      description: document.getElementById("incomeDescription").value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("income").add(income);

    showMessage("Income added successfully!");
    e.target.reset();
    document.getElementById("incomeDate").value = new Date()
      .toISOString()
      .split("T")[0];

    loadAdminIncome();
  } catch (error) {
    showMessage("Error adding income: " + error.message, "error");
  }
}

// Time Log Handler
async function handleTimeSubmit(e) {
  e.preventDefault();

  try {
    const timeEntry = {
      date: document.getElementById("timeDate").value,
      category: document.getElementById("timeCategory").value,
      hours: parseFloat(document.getElementById("timeHours").value),
      description: document.getElementById("timeDescription").value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("timeEntries").add(timeEntry);

    showMessage("Time entry logged successfully!");
    e.target.reset();
    document.getElementById("timeDate").value = new Date()
      .toISOString()
      .split("T")[0];

    loadAdminTime();
  } catch (error) {
    showMessage("Error logging time: " + error.message, "error");
  }
}

// Planned expense Handler
async function handlePlannedSubmit(e) {
  e.preventDefault();

  try {
    const planned = {
      item: document.getElementById("plannedItem").value,
      category: document.getElementById("plannedCategory").value,
      estimatedCost: parseFloat(document.getElementById("plannedCost").value),
      description: document.getElementById("plannedDescription").value || "",
      isPurchased: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("plannedExpenses").add(planned);

    showMessage("Planned expense added successfully!");
    e.target.reset();

    loadAdminPlanned();
  } catch (error) {
    showMessage("Error adding planned expense: " + error.message, "error");
  }
}

// Task Handler
async function handleTaskSubmit(e) {
  e.preventDefault();

  try {
    const task = {
      title: document.getElementById("taskTitle").value,
      description: document.getElementById("taskDescription").value,
      category: document.getElementById("taskCategory").value,
      status: document.getElementById("taskStatus").value,
      priority: document.getElementById("taskPriority").value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
    };

    await firebase.firestore().collection("tasks").add(task);

    showMessage("Task added successfully!");
    e.target.reset();
  } catch (error) {
    showMessage("Error adding task: " + error.message, "error");
  }
}

// Screenshot Handler
function handleFilePreview(e) {
  const file = e.target.files[0];
  console.log("File selected:", file);
  
  if (file) {
    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      showMessage("Please select a valid image file", "error");
      e.target.value = '';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage("File size must be less than 5MB", "error");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("screenshotPreview");
      preview.src = e.target.result;
      preview.style.display = "block";
      
      // Update the upload text
      const uploadText = document.querySelector(".upload-text");
      if (uploadText) {
        uploadText.textContent = file.name;
      }
    };
    reader.readAsDataURL(file);
  }
}

async function handleScreenshotSubmit(e) {
  e.preventDefault();

  const file = document.getElementById("screenshotFile").files[0];
  if (!file) {
    showMessage("Please select an image file", "error");
    return;
  }

  const uploadBtn = document.getElementById("uploadBtnText");
  const originalText = uploadBtn.textContent;
  uploadBtn.textContent = "Uploading...";

  try {
    console.log("Starting upload for file:", file.name);

    // Create a unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Upload to Firebase Storage
    const storageRef = firebase
      .storage()
      .ref()
      .child(`screenshots/${filename}`);
    
    console.log("Uploading to:", `screenshots/${filename}`);
    
    const snapshot = await storageRef.put(file);
    console.log("Upload complete, getting download URL...");
    
    const imageUrl = await snapshot.ref.getDownloadURL();
    console.log("Download URL:", imageUrl);

    // Save to Firestore
    const screenshot = {
      imageUrl,
      filename,
      title: document.getElementById("screenshotTitle").value,
      description: document.getElementById("screenshotDescription").value,
      category: document.getElementById("screenshotCategory").value,
      date: document.getElementById("screenshotDate").value,
      isBeforeAfter: document.getElementById("screenshotBeforeAfter").checked,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("screenshots").add(screenshot);
    console.log("Screenshot saved to Firestore");

    showMessage("Screenshot uploaded successfully!");
    
    // Reset form
    e.target.reset();
    document.getElementById("screenshotPreview").style.display = "none";
    document.getElementById("screenshotDate").value = new Date()
      .toISOString()
      .split("T")[0];
    
    // Reset upload text
    const uploadText = document.querySelector(".upload-text");
    if (uploadText) {
      uploadText.textContent = "Click to upload image";
    }
  } catch (error) {
    console.error("Error uploading screenshot:", error);
    showMessage("Error uploading screenshot: " + error.message, "error");
  } finally {
    uploadBtn.textContent = originalText;
  }
}

// Dev Update Handler
async function handleUpdateSubmit(e) {
  e.preventDefault();

  try {
    const tagsInput = document.getElementById("updateTags").value;
    const tags = tagsInput
      ? tagsInput.split(",").map((tag) => tag.trim())
      : [];

    const update = {
      title: document.getElementById("updateTitle").value,
      summary: document.getElementById("updateSummary").value,
      content: document.getElementById("updateContent").value,
      date: document.getElementById("updateDate").value,
      tags,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("updates").add(update);

    showMessage("Development update posted successfully!");
    e.target.reset();
    document.getElementById("updateDate").value = new Date()
      .toISOString()
      .split("T")[0];
  } catch (error) {
    showMessage("Error posting update: " + error.message, "error");
  }
}

// Load previous entries for admin view
async function loadAdminExpenses() {
  try {
    const snapshot = await firebase
      .firestore()
      .collection("expenses")
      .orderBy("date", "desc")
      .limit(20)
      .get();

    const tbody = document.getElementById("adminExpensesList");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No expenses yet.</td></tr>';
      return;
    }

    snapshot.forEach((doc) => {
      const expense = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="mono">${new Date(expense.date).toLocaleDateString(
          "en-GB"
        )}</td>
        <td><span class="category-badge">${expense.category}</span></td>
        <td>${expense.description}</td>
        <td class="mono">£${expense.amount.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading admin expenses:", error);
  }
}

async function loadAdminIncome() {
  try {
    const snapshot = await firebase
      .firestore()
      .collection("income")
      .orderBy("date", "desc")
      .limit(20)
      .get();

    const tbody = document.getElementById("adminIncomeList");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No income yet.</td></tr>';
      return;
    }

    snapshot.forEach((doc) => {
      const income = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="mono">${new Date(income.date).toLocaleDateString(
          "en-GB"
        )}</td>
        <td><span class="category-badge">${income.source}</span></td>
        <td>${income.description}</td>
        <td class="mono">£${income.amount.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading admin income:", error);
  }
}

async function loadAdminTime() {
  try {
    const snapshot = await firebase
      .firestore()
      .collection("timeEntries")
      .orderBy("date", "desc")
      .limit(20)
      .get();

    const tbody = document.getElementById("adminTimeList");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No time entries yet.</td></tr>';
      return;
    }

    snapshot.forEach((doc) => {
      const entry = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="mono">${new Date(entry.date).toLocaleDateString(
          "en-GB"
        )}</td>
        <td><span class="category-badge">${entry.category}</span></td>
        <td class="mono">${entry.hours}h</td>
        <td>${entry.description || "-"}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading admin time:", error);
  }
}

async function loadAdminVibes() {
  try {
    const snapshot = await firebase
      .firestore()
      .collection("vibeChecks")
      .orderBy("date", "desc")
      .limit(20)
      .get();

    const tbody = document.getElementById("adminVibeList");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="empty-state">No vibe checks yet.</td></tr>';
      return;
    }

    snapshot.forEach((doc) => {
      const vibe = doc.data();
      const statusClass = vibe.status.toLowerCase();
      const emoji =
        vibe.status === "Green"
          ? "🟢"
          : vibe.status === "Amber"
            ? "🟡"
            : "🔴";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="mono">${new Date(vibe.date).toLocaleDateString("en-GB")}</td>
        <td><span class="vibe-badge ${statusClass}">${emoji} ${vibe.status}</span></td>
        <td>${vibe.notes}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading admin vibes:", error);
  }
}


async function loadAdminPlanned() {
  try {
    const snapshot = await firebase
      .firestore()
      .collection("plannedExpenses")
      .where("isPurchased", "==", false)
      .get();

    const tbody = document.getElementById("adminPlannedList");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No planned expenses.</td></tr>';
      return;
    }

    snapshot.forEach((doc) => {
      const item = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.item}</td>
        <td><span class="category-badge">${item.category}</span></td>
        <td class="mono">£${item.estimatedCost.toFixed(2)}</td>
        <td>
          <button class="btn btn-danger btn-small" onclick="deletePlannedExpense('${doc.id}')">
            Delete
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading admin planned:", error);
  }
}

async function deletePlannedExpense(id) {
  if (!confirm("Are you sure you want to delete this planned expense?"))
    return;

  try {
    await firebase.firestore().collection("plannedExpenses").doc(id).delete();
    showMessage("Planned expense deleted!");
    loadAdminPlanned();
  } catch (error) {
    showMessage("Error deleting: " + error.message, "error");
  }
}

// Make functions available globally
window.deletePlannedExpense = deletePlannedExpense;
