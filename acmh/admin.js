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
      loadNodes();
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
  document
    .getElementById("nodeForm")
    .addEventListener("submit", handleNodeSubmit);
  document
    .getElementById("connectionForm")
    .addEventListener("submit", handleConnectionSubmit);

  // File upload preview
  document
    .getElementById("screenshotFile")
    .addEventListener("change", handleFilePreview);
  document
    .getElementById("screenshotUpload")
    .addEventListener("click", () =>
      document.getElementById("screenshotFile").click()
    );
}

// Authentication Handlers
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const errorDiv = document.getElementById("loginError");

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    errorDiv.style.display = "none";
  } catch (error) {
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
  document.getElementById(tabName).classList.add("active");

  // Hide any messages
  document.getElementById("formMessage").style.display = "none";
}

// Message Display
function showMessage(message, type = "success") {
  const messageDiv = document.getElementById("formMessage");
  messageDiv.className = type === "success" ? "success-message" : "error-message";
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
  } catch (error) {
    showMessage("Error adding expense: " + error.message, "error");
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
  } catch (error) {
    showMessage("Error logging time: " + error.message, "error");
  }
}

// Planned Expense Handler
async function handlePlannedSubmit(e) {
  e.preventDefault();

  try {
    const planned = {
      item: document.getElementById("plannedItem").value,
      category: document.getElementById("plannedCategory").value,
      estimatedCost: parseFloat(
        document.getElementById("plannedCost").value
      ),
      priority: document.getElementById("plannedPriority").value,
      notes: document.getElementById("plannedNotes").value,
      isPurchased: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("plannedExpenses").add(planned);

    showMessage("Planned expense added successfully!");
    e.target.reset();
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
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("screenshotPreview");
      preview.src = e.target.result;
      preview.style.display = "block";
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
  uploadBtn.textContent = "Uploading...";

  try {
    // Upload to Firebase Storage
    const storageRef = firebase
      .storage()
      .ref()
      .child(`screenshots/${Date.now()}_${file.name}`);
    const snapshot = await storageRef.put(file);
    const imageUrl = await snapshot.ref.getDownloadURL();

    // Save to Firestore
    const screenshot = {
      imageUrl,
      title: document.getElementById("screenshotTitle").value,
      description: document.getElementById("screenshotDescription").value,
      category: document.getElementById("screenshotCategory").value,
      date: document.getElementById("screenshotDate").value,
      isBeforeAfter: document.getElementById("screenshotBeforeAfter")
        .checked,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("screenshots").add(screenshot);

    showMessage("Screenshot uploaded successfully!");
    e.target.reset();
    document.getElementById("screenshotPreview").style.display = "none";
    document.getElementById("screenshotDate").value = new Date()
      .toISOString()
      .split("T")[0];
  } catch (error) {
    showMessage("Error uploading screenshot: " + error.message, "error");
  } finally {
    uploadBtn.textContent = "Upload Screenshot";
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

// Game Flow Handlers
async function loadNodes() {
  try {
    const snapshot = await firebase
      .firestore()
      .collection("flowNodes")
      .orderBy("createdAt")
      .get();

    const nodeList = document.getElementById("nodeList");
    const fromSelect = document.getElementById("connectionFrom");
    const toSelect = document.getElementById("connectionTo");

    nodeList.innerHTML = "";
    fromSelect.innerHTML = '<option value="">Select node...</option>';
    toSelect.innerHTML = '<option value="">Select node...</option>';

    snapshot.forEach((doc) => {
      const node = doc.data();
      const nodeId = doc.id;

      // Add to list
      const nodeItem = document.createElement("div");
      nodeItem.className = "node-item";
      nodeItem.innerHTML = `
        <div class="node-info">
          <strong>${node.label}</strong>
          <span class="mono" style="color: var(--text-muted); margin-left: 1rem;">
            ${node.type} • (${node.x}, ${node.y})
          </span>
        </div>
        <button class="btn btn-danger btn-small" onclick="deleteNode('${nodeId}')">
          Delete
        </button>
      `;
      nodeList.appendChild(nodeItem);

      // Add to selects
      const option1 = document.createElement("option");
      option1.value = nodeId;
      option1.textContent = node.label;
      fromSelect.appendChild(option1);

      const option2 = document.createElement("option");
      option2.value = nodeId;
      option2.textContent = node.label;
      toSelect.appendChild(option2);
    });
  } catch (error) {
    console.error("Error loading nodes:", error);
  }
}

async function handleNodeSubmit(e) {
  e.preventDefault();

  try {
    const node = {
      label: document.getElementById("nodeLabel").value,
      type: document.getElementById("nodeType").value,
      x: parseInt(document.getElementById("nodeX").value),
      y: parseInt(document.getElementById("nodeY").value),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase.firestore().collection("flowNodes").add(node);

    showMessage("Node added successfully!");
    e.target.reset();
    loadNodes();
  } catch (error) {
    showMessage("Error adding node: " + error.message, "error");
  }
}

async function deleteNode(nodeId) {
  if (!confirm("Are you sure you want to delete this node?")) return;

  try {
    await firebase.firestore().collection("flowNodes").doc(nodeId).delete();

    // Also delete connections involving this node
    const connections = await firebase
      .firestore()
      .collection("flowConnections")
      .where("from", "==", nodeId)
      .get();
    connections.forEach((doc) => doc.ref.delete());

    const connections2 = await firebase
      .firestore()
      .collection("flowConnections")
      .where("to", "==", nodeId)
      .get();
    connections2.forEach((doc) => doc.ref.delete());

    showMessage("Node deleted successfully!");
    loadNodes();
  } catch (error) {
    showMessage("Error deleting node: " + error.message, "error");
  }
}

async function handleConnectionSubmit(e) {
  e.preventDefault();

  try {
    const connection = {
      from: document.getElementById("connectionFrom").value,
      to: document.getElementById("connectionTo").value,
      label: document.getElementById("connectionLabel").value || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await firebase
      .firestore()
      .collection("flowConnections")
      .add(connection);

    showMessage("Connection added successfully!");
    e.target.reset();
  } catch (error) {
    showMessage("Error adding connection: " + error.message, "error");
  }
}

// Make deleteNode available globally
window.deleteNode = deleteNode;
