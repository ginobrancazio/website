// ============================================
// GLOBAL STATE & INITIALIZATION
// ============================================

let currentFilter = 'all';
let flowCanvas, flowCtx;
let flowNodes = [];
let flowConnections = [];
let flowZoom = 1;
let flowPanX = 0;
let flowPanY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  try {
    // Load all data
    await Promise.all([
      loadGameInfo(),
      loadMetrics(),
      loadTimeEntries(),
      loadExpenses(),
      loadPlannedExpenses(),
      loadTasks(),
      loadScreenshots(),
      loadDevUpdates(),
      loadGameFlow(),
      loadYouTubePlaylist()
    ]);

    // Initialize charts
    initializeCharts();
    
    // Initialize flow canvas
    initializeFlowCanvas();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing app:', error);
  }
}

// ============================================
// GAME INFO
// ============================================

async function loadGameInfo() {
  try {
    const snapshot = await db.collection('gameInfo')
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      
      document.getElementById('gameDescription').textContent = 
        data.description || 'An exciting adventure awaits...';
      
      document.getElementById('projectDescription').textContent = 
        data.projectDescription || 'Building something amazing...';
      
      const linkedinUrl = data.linkedinUrl || 
        'https://www.linkedin.com/in/ginobrancazio/';
      document.getElementById('linkedinLink').href = linkedinUrl;
      document.getElementById('footerLinkedin').href = linkedinUrl;
      
      if (data.wishlistUrl) {
        document.getElementById('wishlistBtn').href = data.wishlistUrl;
      }
    }
  } catch (error) {
    console.error('Error loading game info:', error);
  }
}

// ============================================
// METRICS DASHBOARD
// ============================================

async function loadMetrics() {
  try {
    // Get all time entries
    const timeSnapshot = await db.collection('timeEntries')
      .orderBy('date', 'asc')
      .get();
    
    // Get all expenses
    const expenseSnapshot = await db.collection('expenses')
      .orderBy('date', 'asc')
      .get();
    
    // Calculate metrics
    let totalHours = 0;
    let totalSpent = 0;
    const timeEntries = [];
    const expenses = [];
    
    timeSnapshot.forEach(doc => {
      const data = doc.data();
      totalHours += data.hours || 0;
      timeEntries.push(data);
    });
    
    expenseSnapshot.forEach(doc => {
      const data = doc.data();
      totalSpent += data.amount || 0;
      expenses.push(data);
    });
    
    // Calculate project duration
    const projectStart = timeEntries[0]?.date?.toDate() || new Date();
    const now = new Date();
    const daysActive = Math.floor(
      (now - projectStart) / (1000 * 60 * 60 * 24)
    );
    const weeksActive = Math.max(daysActive / 7, 1);
    
    const avgHoursPerWeek = (totalHours / weeksActive).toFixed(1);
    
    // Update display
    document.getElementById('totalHours').textContent = 
      totalHours.toFixed(1);
    document.getElementById('totalSpent').textContent = 
      `£${totalSpent.toFixed(2)}`;
    document.getElementById('daysActive').textContent = daysActive;
    document.getElementById('avgHours').textContent = avgHoursPerWeek;
    
  } catch (error) {
    console.error('Error loading metrics:', error);
  }
}

// ============================================
// CHARTS
// ============================================

let timeChart, budgetChart, timeCategoryChart, budgetCategoryChart;

async function initializeCharts() {
  await loadTimeChart();
  await loadBudgetChart();
  await loadCategoryCharts();
}

async function loadTimeChart() {
  try {
    const snapshot = await db.collection('timeEntries')
      .orderBy('date', 'asc')
      .get();
    
    const dataPoints = [];
    let cumulative = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      cumulative += data.hours || 0;
      dataPoints.push({
        x: data.date.toDate(),
        y: cumulative
      });
    });
    
    const ctx = document.getElementById('timeChart').getContext('2d');
    timeChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Cumulative Hours',
          data: dataPoints,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM d'
              }
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Total Hours'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading time chart:', error);
  }
}

async function loadBudgetChart() {
  try {
    const snapshot = await db.collection('expenses')
      .orderBy('date', 'asc')
      .get();
    
    const dataPoints = [];
    let cumulative = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      cumulative += data.amount || 0;
      dataPoints.push({
        x: data.date.toDate(),
        y: cumulative
      });
    });
    
    const ctx = document.getElementById('budgetChart').getContext('2d');
    budgetChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Cumulative Spending',
          data: dataPoints,
          borderColor: '#e84545',
          backgroundColor: 'rgba(232, 69, 69, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM d'
              }
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Total Spent (£)'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading budget chart:', error);
  }
}

async function loadCategoryCharts() {
  try {
    // Time by category
    const timeSnapshot = await db.collection('timeEntries').get();
    const timeByCategory = {};
    
    timeSnapshot.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'Other';
      timeByCategory[category] = (timeByCategory[category] || 0) + 
        (data.hours || 0);
    });
    
    const timeCtx = document.getElementById('timeCategoryChart')
      .getContext('2d');
    timeCategoryChart = new Chart(timeCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(timeByCategory),
        datasets: [{
          data: Object.values(timeByCategory),
          backgroundColor: [
            '#2563eb', '#a855f7', '#4ecdc4', 
            '#c44569', '#e84545', '#2ecc71'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
    
    // Expenses by category
    const expenseSnapshot = await db.collection('expenses').get();
    const expenseByCategory = {};
    
    expenseSnapshot.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'Other';
      expenseByCategory[category] = (expenseByCategory[category] || 0) + 
        (data.amount || 0);
    });
    
    const budgetCtx = document.getElementById('budgetCategoryChart')
      .getContext('2d');
    budgetCategoryChart = new Chart(budgetCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(expenseByCategory),
        datasets: [{
          data: Object.values(expenseByCategory),
          backgroundColor: [
            '#e84545', '#f39c12', '#c44569', 
            '#4ecdc4', '#2563eb', '#a855f7'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error loading category charts:', error);
  }
}

// ============================================
// TIME ENTRIES
// ============================================

async function loadTimeEntries() {
  // Data already loaded in loadMetrics
  // This function exists for future detailed time display if needed
}

// ============================================
// EXPENSES & BUDGET
// ============================================

async function loadExpenses() {
  try {
    const snapshot = await db.collection('expenses')
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    
    const tbody = document.querySelector('#expensesTable tbody');
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="4">No expenses recorded yet</td></tr>';
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const row = tbody.insertRow();
      
      row.innerHTML = `
        <td>${formatDate(data.date.toDate())}</td>
        <td>${data.category || 'Other'}</td>
        <td>${data.description || ''}</td>
        <td style="font-weight: 600;">£${data.amount.toFixed(2)}</td>
      `;
    });
    
  } catch (error) {
    console.error('Error loading expenses:', error);
  }
}

async function loadPlannedExpenses() {
  try {
    const snapshot = await db.collection('plannedExpenses')
      .orderBy('priority', 'asc')
      .orderBy('order', 'asc')
      .get();
    
    const tbody = document.querySelector('#plannedTable tbody');
    tbody.innerHTML = '';
    
    let totalPlanned = 0;
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="4">No planned expenses</td></tr>';
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.completed) {
          totalPlanned += data.estimatedCost || 0;
          
          const row = tbody.insertRow();
          row.innerHTML = `
            <td class="priority-${data.priority.toLowerCase()}">
              ${data.priority}
            </td>
            <td>${data.item}</td>
            <td>${data.category || ''}</td>
            <td style="font-weight: 600;">£${data.estimatedCost.toFixed(2)}</td>
          `;
        }
      });
    }
    
    // Update budget summary
    const expenseSnapshot = await db.collection('expenses').get();
    let totalSpent = 0;
    expenseSnapshot.forEach(doc => {
      totalSpent += doc.data().amount || 0;
    });
    
    document.getElementById('budgetSpent').textContent = 
      `£${totalSpent.toFixed(2)}`;
    document.getElementById('budgetPlanned').textContent = 
      `£${totalPlanned.toFixed(2)}`;
    document.getElementById('budgetTotal').textContent = 
      `£${(totalSpent + totalPlanned).toFixed(2)}`;
    
  } catch (error) {
    console.error('Error loading planned expenses:', error);
  }
}

// ============================================
// TASKS
// ============================================

async function loadTasks() {
  try {
    const snapshot = await db.collection('tasks')
      .orderBy('order', 'asc')
      .get();
    
    const todoContainer = document.getElementById('todoTasks');
    const inProgressContainer = document.getElementById('inProgressTasks');
    const doneContainer = document.getElementById('doneTasks');
    
    todoContainer.innerHTML = '';
    inProgressContainer.innerHTML = '';
    doneContainer.innerHTML = '';
    
    if (snapshot.empty) {
      todoContainer.innerHTML = '<div class="loading-state">No tasks yet</div>';
      inProgressContainer.innerHTML = '<div class="loading-state">No tasks yet</div>';
      doneContainer.innerHTML = '<div class="loading-state">No tasks yet</div>';
      return;
    }
    
    const tasks = { todo: [], inProgress: [], done: [] };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const status = data.status.toLowerCase().replace(' ', '');
      
      if (status === 'todo') tasks.todo.push(data);
      else if (status === 'inprogress') tasks.inProgress.push(data);
      else if (status === 'done') tasks.done.push(data);
    });
    
    // Render tasks
    renderTaskList(tasks.todo, todoContainer);
    renderTaskList(tasks.inProgress, inProgressContainer);
    renderTaskList(tasks.done, doneContainer);
    
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

function renderTaskList(tasks, container) {
  if (tasks.length === 0) {
    container.innerHTML = '<div class="loading-state">No tasks</div>';
    return;
  }
  
  tasks.forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item';
    taskEl.innerHTML = `
      <div class="task-title">${task.title}</div>
      ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
      <div class="task-meta">
        <span>${task.category || 'General'}</span>
        <span class="priority-${task.priority.toLowerCase()}">${task.priority}</span>
      </div>
    `;
    container.appendChild(taskEl);
  });
}

// ============================================
// SCREENSHOTS GALLERY
// ============================================

async function loadScreenshots() {
  try {
    const snapshot = await db.collection('screenshots')
      .orderBy('date', 'desc')
      .get();
    
    const grid = document.getElementById('screenshotsGrid');
    grid.innerHTML = '';
    
    if (snapshot.empty) {
      grid.innerHTML = '<div class="loading-state">No screenshots yet</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const card = createScreenshotCard(data);
      card.dataset.category = data.category || 'Other';
      card.dataset.isBeforeAfter = data.linkedScreenshotId ? 'true' : 'false';
      grid.appendChild(card);
    });
    
  } catch (error) {
    console.error('Error loading screenshots:', error);
  }
}

function createScreenshotCard(data) {
  const card = document.createElement('div');
  card.className = 'screenshot-card';
  
  card.innerHTML = `
    <img src="${data.imageUrl}" alt="${data.title}" class="screenshot-image" />
    <div class="screenshot-info">
      <h3 class="screenshot-title">${data.title}</h3>
      ${data.description ? `<p class="screenshot-description">${data.description}</p>` : ''}
      <div class="screenshot-meta">
        <span>${data.category || 'Other'}</span>
        ${data.linkedScreenshotId ? '<span class="before-after-badge">Before/After</span>' : ''}
      </div>
    </div>
  `;
  
  return card;
}

// Gallery filtering
function setupGalleryFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      filterScreenshots(filter);
    });
  });
}

function filterScreenshots(filter) {
  const cards = document.querySelectorAll('.screenshot-card');
  
  cards.forEach(card => {
    if (filter === 'all') {
      card.style.display = 'block';
    } else if (filter === 'before-after') {
      card.style.display = card.dataset.isBeforeAfter === 'true' ? 
        'block' : 'none';
    } else {
      card.style.display = card.dataset.category === filter ? 
        'block' : 'none';
    }
  });
}

// ============================================
// DEV UPDATES
// ============================================

async function loadDevUpdates() {
  try {
    const snapshot = await db.collection('devUpdates')
      .orderBy('date', 'desc')
      .limit(5)
      .get();
    
    const grid = document.getElementById('updatesGrid');
    grid.innerHTML = '';
    
    if (snapshot.empty) {
      grid.innerHTML = '<div class="loading-state">No updates yet</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const card = createUpdateCard(data);
      grid.appendChild(card);
    });
    
  } catch (error) {
    console.error('Error loading dev updates:', error);
  }
}

function createUpdateCard(data) {
  const card = document.createElement('div');
  card.className = 'update-card';
  
  card.innerHTML = `
    <div class="update-date">${formatDate(data.date.toDate())}</div>
    <h3 class="update-title">${data.title}</h3>
    <div class="update-content">${data.summary || data.content.substring(0, 200) + '...'}</div>
    ${data.tags && data.tags.length > 0 ? `
      <div class="update-tags">
        ${data.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
    ` : ''}
  `;
  
  return card;
}

// ============================================
// GAME FLOW DIAGRAM
// ============================================

async function loadGameFlow() {
  try {
    const nodesSnapshot = await db.collection('gameFlowNodes').get();
    const connectionsSnapshot = await db.collection('gameFlowConnections').get();
    
    flowNodes = [];
    flowConnections = [];
    
    nodesSnapshot.forEach(doc => {
      flowNodes.push({ id: doc.id, ...doc.data() });
    });
    
    connectionsSnapshot.forEach(doc => {
      flowConnections.push(doc.data());
    });
    
  } catch (error) {
    console.error('Error loading game flow:', error);
  }
}

function initializeFlowCanvas() {
  flowCanvas = document.getElementById('flowCanvas');
  if (!flowCanvas) return;
  
  flowCtx = flowCanvas.getContext('2d');
  
  // Set canvas size
  flowCanvas.width = flowCanvas.offsetWidth;
  flowCanvas.height = flowCanvas.offsetHeight;
  
  // Draw initial state
  drawGameFlow();
  
  // Setup canvas interactions
  flowCanvas.addEventListener('mousedown', handleFlowMouseDown);
  flowCanvas.addEventListener('mousemove', handleFlowMouseMove);
  flowCanvas.addEventListener('mouseup', handleFlowMouseUp);
  flowCanvas.addEventListener('wheel', handleFlowWheel);
  
  // Zoom controls
  document.getElementById('zoomIn')?.addEventListener('click', () => {
    flowZoom = Math.min(flowZoom * 1.2, 3);
    drawGameFlow();
  });
  
  document.getElementById('zoomOut')?.addEventListener('click', () => {
    flowZoom = Math.max(flowZoom / 1.2, 0.5);
    drawGameFlow();
  });
  
  document.getElementById('resetView')?.addEventListener('click', () => {
    flowZoom = 1;
    flowPanX = 0;
    flowPanY = 0;
    drawGameFlow();
  });
}

function drawGameFlow() {
  if (!flowCtx) return;
  
  flowCtx.clearRect(0, 0, flowCanvas.width, flowCanvas.height);
  flowCtx.save();
  
  // Apply transformations
  flowCtx.translate(flowPanX, flowPanY);
  flowCtx.scale(flowZoom, flowZoom);
  
  // Draw connections
  flowConnections.forEach(conn => {
    const fromNode = flowNodes.find(n => n.id === conn.from);
    const toNode = flowNodes.find(n => n.id === conn.to);
    
    if (fromNode && toNode) {
      flowCtx.beginPath();
      flowCtx.moveTo(fromNode.x, fromNode.y);
      flowCtx.lineTo(toNode.x, toNode.y);
      flowCtx.strokeStyle = '#d1d5db';
      flowCtx.lineWidth = 2;
      flowCtx.stroke();
      
      // Draw arrow
      drawArrow(flowCtx, fromNode.x, fromNode.y, toNode.x, toNode.y);
      
      // Draw label if exists
      if (conn.label) {
        const midX = (fromNode.x + toNode.x) / 2;
        const midY = (fromNode.y + toNode.y) / 2;
        flowCtx.fillStyle = '#5a5a5a';
        flowCtx.font = '12px Inter';
        flowCtx.textAlign = 'center';
        flowCtx.fillText(conn.label, midX, midY - 5);
      }
    }
  });
  
  // Draw nodes
  flowNodes.forEach(node => {
    flowCtx.fillStyle = node.color || '#2563eb';
    flowCtx.beginPath();
    flowCtx.roundRect(node.x - 60, node.y - 30, 120, 60, 8);
    flowCtx.fill();
    
    flowCtx.fillStyle = '#ffffff';
    flowCtx.font = '14px Inter';
    flowCtx.textAlign = 'center';
    flowCtx.textBaseline = 'middle';
    flowCtx.fillText(node.label, node.x, node.y);
  });
  
  flowCtx.restore();
}

function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headlen = 10;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headlen * Math.cos(angle - Math.PI / 6),
    toY - headlen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headlen * Math.cos(angle + Math.PI / 6),
    toY - headlen * Math.sin(angle + Math.PI / 6)
  );
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function handleFlowMouseDown(e) {
  isDragging = true;
  dragStartX = e.clientX - flowPanX;
  dragStartY = e.clientY - flowPanY;
}

function handleFlowMouseMove(e) {
  if (isDragging) {
    flowPanX = e.clientX - dragStartX;
    flowPanY = e.clientY - dragStartY;
    drawGameFlow();
  }
}

function handleFlowMouseUp() {
  isDragging = false;
}

function handleFlowWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  flowZoom = Math.max(0.5, Math.min(3, flowZoom * delta));
  drawGameFlow();
}

// ============================================
// YOUTUBE PLAYLIST
// ============================================

async function loadYouTubePlaylist() {
  try {
    const snapshot = await db.collection('gameInfo').limit(1).get();
    
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      const playlistId = data.youtubePlaylistId;
      
      if (playlistId) {
        const container = document.getElementById('youtubePlaylist');
        container.innerHTML = `
          <div class="video-embed">
            <iframe
              src="https://www.youtube.com/embed/videoseries?list=${playlistId}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        `;
      } else {
        document.getElementById('youtubePlaylist').innerHTML = 
          '<div class="loading-state">No playlist configured yet</div>';
      }
    }
  } catch (error) {
    console.error('Error loading YouTube playlist:', error);
  }
}

// ============================================
// NEWSLETTER
// ============================================

async function handleNewsletterSubmit(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById('newsletterEmail');
  const statusEl = document.getElementById('newsletterStatus');
  const email = emailInput.value.trim();
  
  if (!email) return;
  
  try {
    // Check if email already exists
    const existing = await db.collection('newsletter')
      .where('email', '==', email)
      .get();
    
    if (!existing.empty) {
      statusEl.textContent = 'You\'re already subscribed!';
      statusEl.style.color = '#f39c12';
      return;
    }
    
    // Add new subscriber
    await db.collection('newsletter').add({
      email: email,
      subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    });
    
    statusEl.textContent = '✅ Successfully subscribed!';
    statusEl.style.color = '#2ecc71';
    emailInput.value = '';
    
    setTimeout(() => {
      statusEl.textContent = '';
    }, 5000);
    
  } catch (error) {
    console.error('Error subscribing:', error);
    statusEl.textContent = '❌ Error subscribing. Please try again.';
    statusEl.style.color = '#e84545';
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

async function exportExpenses() {
  try {
    const snapshot = await db.collection('expenses')
      .orderBy('date', 'desc')
      .get();
    
    const data = [['Date', 'Category', 'Description', 'Amount']];
    
    snapshot.forEach(doc => {
      const expense = doc.data();
      data.push([
        formatDate(expense.date.toDate()),
        expense.category || '',
        expense.description || '',
        expense.amount.toFixed(2)
      ]);
    });
    
    downloadCSV(data, 'expenses.csv');
    
  } catch (error) {
    console.error('Error exporting expenses:', error);
    alert('Error exporting expenses');
  }
}

async function exportTimeLog() {
  try {
    const snapshot = await db.collection('timeEntries')
      .orderBy('date', 'desc')
      .get();
    
    const data = [['Date', 'Category', 'Description', 'Hours']];
    
    snapshot.forEach(doc => {
      const entry = doc.data();
      data.push([
        formatDate(entry.date.toDate()),
        entry.category || '',
        entry.description || '',
        entry.hours.toFixed(2)
      ]);
    });
    
    downloadCSV(data, 'time-log.csv');
    
  } catch (error) {
    console.error('Error exporting time log:', error);
    alert('Error exporting time log');
  }
}

async function exportTasks() {
  try {
    const snapshot = await db.collection('tasks')
      .orderBy('status', 'asc')
      .get();
    
    const data = [['Status', 'Title', 'Category', 'Priority', 'Description']];
    
    snapshot.forEach(doc => {
      const task = doc.data();
      data.push([
        task.status || '',
        task.title || '',
        task.category || '',
        task.priority || '',
        task.description || ''
      ]);
    });
    
    downloadCSV(data, 'tasks.csv');
    
  } catch (error) {
    console.error('Error exporting tasks:', error);
    alert('Error exporting tasks');
  }
}

async function generateFullReport() {
  try {
    const report = [];
    report.push('='.repeat(60));
    report.push('ANIMAL CITY MONSTER HUNTERS - DEVELOPMENT REPORT');
    report.push(`Generated: ${new Date().toLocaleDateString()}`);
    report.push('='.repeat(60));
    report.push('');
    
    // Get metrics
    const timeSnapshot = await db.collection('timeEntries').get();
    const expenseSnapshot = await db.collection('expenses').get();
    const taskSnapshot = await db.collection('tasks').get();
    
    let totalHours = 0;
    let totalSpent = 0;
    
    timeSnapshot.forEach(doc => {
      totalHours += doc.data().hours || 0;
    });
    
    expenseSnapshot.forEach(doc => {
      totalSpent += doc.data().amount || 0;
    });
    
    const completedTasks = taskSnapshot.docs.filter(
      doc => doc.data().status === 'Done'
    ).length;
    
    report.push('SUMMARY METRICS');
    report.push('-'.repeat(60));
    report.push(`Total Hours Invested: ${totalHours.toFixed(1)}`);
    report.push(`Total Money Spent: £${totalSpent.toFixed(2)}`);
    report.push(`Tasks Completed: ${completedTasks} / ${taskSnapshot.size}`);
    report.push('');
    
    // Recent expenses
    report.push('RECENT EXPENSES (Last 10)');
    report.push('-'.repeat(60));
    const recentExpenses = await db.collection('expenses')
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    
    recentExpenses.forEach(doc => {
      const e = doc.data();
      report.push(
        `${formatDate(e.date.toDate())} | ${e.category} | £${e.amount.toFixed(2)} | ${e.description}`
      );
    });
    
    const blob = new Blob([report.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dev-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Error generating report');
  }
}

function downloadCSV(data, filename) {
  const csv = data.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Newsletter form
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', handleNewsletterSubmit);
  }
  
  // Export buttons
  document.getElementById('exportExpenses')?.addEventListener(
    'click',
    exportExpenses
  );
  document.getElementById('exportTime')?.addEventListener(
    'click',
    exportTimeLog
  );
  document.getElementById('exportTasks')?.addEventListener(
    'click',
    exportTasks
  );
  document.getElementById('generateReport')?.addEventListener(
    'click',
    generateFullReport
  );
  
  // Gallery filters
  setupGalleryFilters();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(date) {
  if (!date) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

// Polyfill for roundRect if needed
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(
    x, y, width, height, radius
  ) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height
    );
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}
