// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAm9LVPsnm93gDB6MR8ereMzVuCwrGrxfk",
  authDomain: "tt-studyplan.firebaseapp.com",
  databaseURL: "https://tt-studyplan-default-rtdb.firebaseio.com",
  projectId: "tt-studyplan",
  storageBucket: "tt-studyplan.appspot.com",
  messagingSenderId: "215005132642",
  appId: "1:215005132642:web:a38b8c32e6b2a1a7755e3b",
  measurementId: "G-WSPEP52PRG"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// App Variables
let currentWeekStart = new Date("2025-07-07");
let currentEditingDay = null;

// Chart instances
let progressChart, timeDistributionChart, skillRadarChart;

// DOM Elements
const editDayModal = document.getElementById("edit-day-modal");
const closeEditModal = document.getElementById("close-edit-modal");
const tasksContainer = document.getElementById("tasks-container");
const addTaskBtn = document.getElementById("add-task-btn");
const saveDayBtn = document.getElementById("save-day-btn");
const studyDurationInput = document.getElementById("study-duration");
const modalDate = document.getElementById("modal-date");
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  loadCurrentWeek();
  setupEventListeners();
  setupTabNavigation();
});

function setupTabNavigation() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab
      tab.classList.add('active');

      // Show corresponding content
      const tabId = tab.getAttribute('data-tab') + '-tab';
      document.getElementById(tabId).classList.add('active');

      if (tabId === 'stats-tab') {
        initCharts();
      }
    });
  });
}

function setupEventListeners() {
  // Navigation buttons
  document.getElementById("prev-week")?.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadCurrentWeek();
  });

  document.getElementById("next-week")?.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadCurrentWeek();
  });

  // Edit modal buttons
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", addNewTask);
  }

  if (saveDayBtn) {
    saveDayBtn.addEventListener("click", saveDayData);
  }

  if (closeEditModal) {
    closeEditModal.addEventListener("click", () => {
      editDayModal.classList.remove("active");
    });
  }

  // Task interaction
  document.addEventListener("click", (e) => {
    // Open edit modal
    if (e.target.closest(".add-task-btn")) {
      e.preventDefault();
      const card = e.target.closest(".day-card");
      if (card) {
        const date = card.getAttribute("data-date");
        if (date) {
          openEditDayModal(date);
        }
      }
    }

    // Open edit modal via edit button
    if (e.target.closest(".edit-task-btn")) {
      const card = e.target.closest(".day-card");
      if (card) {
        const date = card.getAttribute("data-date");
        if (date) openEditDayModal(date);
      }
    }
  });

  // Task container events
  if (tasksContainer) {
    tasksContainer.addEventListener("click", (e) => {
      if (e.target.closest(".delete-task")) {
        e.target.closest(".task-item")?.remove();
      }
    });
  }
}

// Weekly schedule functions
function loadCurrentWeek() {
  const dates = getWeekRange(currentWeekStart);
  updateWeekHeader(dates);
  loadSchedule(dates);
}

function getWeekRange(startDate) {
  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    result.push(formatDate(d));
  }
  return result;
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function updateWeekHeader(dates) {
  const start = new Date(dates[0]);
  const end = new Date(dates[6]);
  const weekIndex = Math.floor((start - new Date("2025-07-07")) / (7 * 86400000)) + 1;

  const weekDisplay = document.getElementById("current-week-display");
  if (weekDisplay) {
    weekDisplay.innerHTML = `
            Tuần ${weekIndex}: ${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}
            <span class="phase-badge" style="margin-left: 10px;">Củng cố N2</span>
        `;
  }
}

async function loadSchedule(dates) {
  const grid = document.getElementById("weekly-schedule");
  if (!grid) return;

  grid.innerHTML = "";

  const promises = dates.map(date =>
    db.ref(`schedule/${date}`).once("value").then(snapshot => {
      const data = snapshot.val() || { time: "0 phút", tasks: [] };
      return generateDayCardHTML(date, data);
    })
  );

  const cards = await Promise.all(promises);
  grid.innerHTML = cards.join("");
  updateProgress();
}

function generateDayCardHTML(date, data) {
  const d = new Date(date);
  const dayName = d.toLocaleDateString("vi-VN", { weekday: "long" });
  const displayDate = `${d.getDate()}/${d.getMonth() + 1}`;
  const isWeekend = [0, 6].includes(d.getDay());

  const tasks = (data.tasks || []).map((task, i) => `
        <li class="study-item ${task.done ? "done" : ""}" data-task-index="${i}">
            <span>${task.title}</span>
            <div>
                <button class="edit-task-btn"><i class="fas fa-edit"></i></button>
                <button class="check-btn ${task.done ? "done" : ""}">
                    <i class="${task.done ? "fas fa-check-circle" : "far fa-circle"}"></i>
                </button>
            </div>
        </li>
    `).join("");

  return `
        <div class="day-card ${isWeekend ? "weekend" : ""}" data-date="${date}">
            <div class="day-header">
                <div class="day-name">${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</div>
                <div class="day-date">${displayDate}</div>
            </div>
            <div class="study-time">${data.time || "Thời gian: 0 phút"}</div>
            <ul class="study-items">${tasks}</ul>
            <button class="add-task-btn"><i class="fas fa-plus"></i> Thêm nhiệm vụ</button>
        </div>
    `;
}

// Task management functions
function openEditDayModal(date) {
  console.log("Opening modal for date:", date);
  currentEditingDay = date;
  const d = new Date(date);
  const dayName = d.toLocaleDateString("vi-VN", { weekday: "long" });

  if (modalDate) {
    modalDate.textContent = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${d.toLocaleDateString("vi-VN")}`;
  }

  db.ref(`schedule/${date}`).once("value").then(snapshot => {
    const data = snapshot.val() || { time: "0 phút", tasks: [] };

    if (studyDurationInput) {
      studyDurationInput.value = parseStudyTime(data.time);
    }

    renderTasksInModal(data.tasks);

    if (editDayModal) {
      console.log("Displaying modal");
      editDayModal.classList.add("active");
    }
  }).catch(error => {
    console.error("Error loading day data:", error);
  });
}

function parseStudyTime(timeStr) {
  if (!timeStr) return 0;

  const hoursMatch = timeStr.match(/(\d+) giờ/);
  const minsMatch = timeStr.match(/(\d+) phút/);

  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const mins = minsMatch ? parseInt(minsMatch[1]) : 0;

  return hours * 60 + mins;
}

function renderTasksInModal(tasks) {
  if (!tasksContainer) return;

  tasksContainer.innerHTML = "";
  let totalMinutes = 0;

  tasks.forEach((task, index) => {
    const duration = task.duration || 0;
    totalMinutes += duration;

    const taskEl = document.createElement("div");
    taskEl.className = "task-item";
    taskEl.innerHTML = `
            <select class="task-type" data-index="${index}">
                <option value="vocabulary" ${task.type === 'vocabulary' ? 'selected' : ''}>Từ vựng</option>
                <option value="grammar" ${task.type === 'grammar' ? 'selected' : ''}>Ngữ pháp</option>
                <option value="kanji" ${task.type === 'kanji' ? 'selected' : ''}>Kanji</option>
                <option value="reading" ${task.type === 'reading' ? 'selected' : ''}>Đọc hiểu</option>
                <option value="listening" ${task.type === 'listening' ? 'selected' : ''}>Nghe</option>
            </select>
            <input type="text" class="task-input" value="${task.title}" data-index="${index}">
            <input type="number" min="0" class="task-duration" value="${duration}" data-index="${index}" placeholder="Phút">
            <button class="btn-delete delete-task" data-index="${index}">
                <i class="fas fa-trash"></i>
            </button>
        `;
    tasksContainer.appendChild(taskEl);
  });

  // Thêm tổng thời gian
  const totalElement = document.createElement("div");
  totalElement.className = "total-duration";
  totalElement.innerHTML = `<strong>Tổng thời gian: ${totalMinutes} phút</strong>`;
  tasksContainer.appendChild(totalElement);
}

function addNewTask() {
  if (!tasksContainer) return;

  // Xóa tổng thời gian cũ
  const totalElement = tasksContainer.querySelector('.total-duration');
  if (totalElement) totalElement.remove();

  // Tính index mới
  const taskCount = tasksContainer.querySelectorAll('.task-item:not(.total-duration)').length;

  const taskEl = document.createElement("div");
  taskEl.className = "task-item";
  taskEl.innerHTML = `
        <select class="task-type" data-index="${taskCount}">
            <option value="vocabulary">Từ vựng</option>
            <option value="grammar">Ngữ pháp</option>
            <option value="kanji">Kanji</option>
            <option value="reading">Đọc hiểu</option>
            <option value="listening">Nghe</option>
        </select>
        <input type="text" class="task-input" placeholder="Nhập nhiệm vụ mới" data-index="${taskCount}">
        <input type="number" min="0" class="task-duration" value="30" placeholder="Phút" data-index="${taskCount}">
        <button class="btn-delete delete-task" data-index="${taskCount}">
            <i class="fas fa-trash"></i>
        </button>
    `;
  tasksContainer.appendChild(taskEl);
}

async function saveDayData() {
  // Đảm bảo các phần tử đã được load
  if (!studyDurationInput) studyDurationInput = document.getElementById("study-duration");
  if (!tasksContainer) tasksContainer = document.getElementById("tasks-container");

  if (!currentEditingDay || !studyDurationInput || !tasksContainer) return;

  const minutes = parseInt(studyDurationInput.value) || 0;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  const timeStr = hours > 0
    ? `Thời gian: ${hours} giờ ${remainingMins} phút`
    : `Thời gian: ${minutes} phút`;

  const tasks = [];
  const taskInputs = tasksContainer.querySelectorAll(".task-input");

  taskInputs.forEach((input, index) => {
    if (input.value.trim()) {
      // Sử dụng selector chính xác và kiểm tra null
      const typeSelect = tasksContainer.querySelector(`.task-type[data-index="${index}"]`);
      const durationInput = tasksContainer.querySelector(`.task-duration[data-index="${index}"]`);

      // Kiểm tra nếu phần tử tồn tại
      if (typeSelect && durationInput) {
        tasks.push({
          title: input.value.trim(),
          done: false,
          type: typeSelect.value,
          duration: parseInt(durationInput.value) || 0
        });
      }
    }
  });

  try {
    const weekNumber = Math.floor((new Date(currentEditingDay) - new Date("2025-07-07")) / (7 * 86400000)) + 1;

    await db.ref(`schedule/${currentEditingDay}`).set({
      time: timeStr,
      tasks: tasks,
      weekNumber: weekNumber  // Thêm tuần số vào dữ liệu
    });

    if (editDayModal) {
      editDayModal.classList.remove("active");
    }
    loadCurrentWeek();
  } catch (error) {
    console.error("Lỗi khi lưu dữ liệu:", error);
    alert("Có lỗi xảy ra khi lưu dữ liệu. Vui lòng thử lại!");
  }
}

function detectTaskType(title) {
  if (title.match(/nghe|listening|聴解/i)) return "listening";
  if (title.match(/ngữ pháp|grammar|文法/i)) return "grammar";
  if (title.match(/từ vựng|vocabulary|語彙/i)) return "vocabulary";
  if (title.match(/đọc|reading|読解/i)) return "reading";
  return "other";
}

function updateProgress() {
  const allTasks = document.querySelectorAll('.study-item');
  const completedTasks = document.querySelectorAll('.study-item.done');
  const total = allTasks.length;
  const completed = completedTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const completedCount = document.getElementById('completed-count');
  const totalTasks = document.getElementById('total-tasks');
  const weekProgress = document.getElementById('week-progress');
  const progressFill = document.getElementById('progress-fill');

  if (completedCount) completedCount.textContent = completed;
  if (totalTasks) totalTasks.textContent = total;
  if (weekProgress) weekProgress.textContent = `${progress}%`;
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
    progressFill.style.background = progress < 30 ? '#f44336' :
      progress < 70 ? '#ff9800' : '#4caf50';
  }
}

// ----------------------------
// STATISTICS & CHARTS FUNCTIONS
// ----------------------------

async function initCharts() {
  if (progressChart) progressChart.destroy();
  if (timeDistributionChart) timeDistributionChart.destroy();
  if (skillRadarChart) skillRadarChart.destroy();

  const stats = await getStudyStatistics();
  updateStatsCards(stats);
  initProgressChart(stats.weeklyProgress);
  initTimeDistributionChart(stats.timeDistribution);
  initSkillRadarChart(stats.skillAssessment);
  displayTaskCategories(stats.taskCategories);
}

async function getStudyStatistics() {
  try {
    const [weeklySnapshot, scheduleSnapshot] = await Promise.all([
      db.ref('weeklyProgress').once('value'),
      db.ref('schedule').once('value')
    ]);

    const weeklyData = weeklySnapshot.val() || {};
    const scheduleData = scheduleSnapshot.val() || {};

    // 1. Tiến độ tuần
    const weeklyProgress = [];
    const totalWeeks = 21;

    for (let week = 1; week <= totalWeeks; week++) {
      // Xử lý key dạng string với dấu ngoặc kép
      const weekKey = `"${week}"`;
      const weekData = weeklyData[weekKey] || { completedTasks: 0, targetTasks: 1, studyTime: 0 };

      weeklyProgress.push({
        week: week,
        progress: Math.round((weekData.completedTasks / weekData.targetTasks) * 100),
        studyTime: weekData.studyTime
      });
    }

    // 2. Phân bổ thời gian theo kỹ năng
    const timeDistribution = {
      'vocabulary': 0,
      'grammar': 0,
      'kanji': 0,
      'reading': 0,
      'listening': 0
    };

    Object.values(scheduleData).forEach(day => {
      day.tasks?.forEach(task => {
        const type = task.type || 'vocabulary';
        if (timeDistribution[type] !== undefined) {
          timeDistribution[type] += task.duration || 0;
        }
      });
    });

    // 3. Đánh giá kỹ năng (dựa trên tỉ lệ hoàn thành)
    const skillCompletion = {
      'vocabulary': { total: 0, completed: 0 },
      'grammar': { total: 0, completed: 0 },
      'kanji': { total: 0, completed: 0 },
      'reading': { total: 0, completed: 0 },
      'listening': { total: 0, completed: 0 }
    };

    Object.values(scheduleData).forEach(day => {
      day.tasks?.forEach(task => {
        const type = task.type || 'vocabulary';
        if (skillCompletion[type]) {
          skillCompletion[type].total++;
          if (task.done) skillCompletion[type].completed++;
        }
      });
    });

    const skillAssessment = {
      labels: Object.keys(skillCompletion),
      data: Object.values(skillCompletion).map(skill => {
        return skill.total > 0 ? Math.round((skill.completed / skill.total) * 100) : 0;
      })
    };

    // 4. Loại bài đã học
    const taskCategories = {};
    Object.values(scheduleData).forEach(day => {
      day.tasks?.forEach(task => {
        const type = task.type || 'vocabulary';
        if (!taskCategories[type]) {
          taskCategories[type] = { total: 0, completed: 0 };
        }
        taskCategories[type].total++;
        if (task.done) taskCategories[type].completed++;
      });
    });

    return {
      weeklyProgress,
      timeDistribution,
      skillAssessment,
      taskCategories,
      totalStudyTime: Object.values(timeDistribution).reduce((a, b) => a + b, 0),
      totalTasks: Object.values(taskCategories).reduce((sum, cat) => sum + cat.total, 0),
      completedTasks: Object.values(taskCategories).reduce((sum, cat) => sum + cat.completed, 0)
    };

  } catch (error) {
    console.error("Error loading statistics:", error);
    return {
      weeklyProgress: [],
      timeDistribution: {},
      skillAssessment: { labels: [], data: [] },
      taskCategories: {}
    };
  }
}

function updateStatsCards(stats) {
  document.getElementById('total-hours').textContent = Math.floor(stats.totalStudyTime / 60);
  document.getElementById('completion-rate').textContent =
    `${Math.round((stats.completedTasks / stats.totalTasks) * 100 || 0)}%`;
  document.getElementById('streak-days').textContent =
    calculateStreakDays(); // Implement this function based on your data
  document.getElementById('lessons-learned').textContent = stats.completedTasks;
}

function calculateStreakDays() {
  // Implement your streak calculation logic here
  return 7; // Placeholder
}

function initProgressChart(weeklyData) {
  const ctx = document.getElementById('progressChart').getContext('2d');

  progressChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeklyData.map(item => `Tuần ${item.week}`),
      datasets: [{
        label: 'Tỷ lệ hoàn thành',
        data: weeklyData.map(item => item.progress),
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        yAxisID: 'y'
      }, {
        label: 'Thời gian học (giờ)',
        data: weeklyData.map(item => Math.round(item.studyTime / 60)),
        borderColor: '#1a2a6c',
        backgroundColor: 'rgba(26, 42, 108, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        yAxisID: 'y1'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 14 },
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}${ctx.datasetIndex === 0 ? '%' : ' giờ'}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Tỷ lệ %' },
          ticks: { callback: value => `${value}%` }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: 'Giờ học' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function initTimeDistributionChart(timeData) {
  const ctx = document.getElementById('timeDistributionChart').getContext('2d');

  // Chuyển đổi labels sang tiếng Việt
  const labels = Object.keys(timeData).map(key => {
    const translations = {
      'vocabulary': 'Từ vựng',
      'grammar': 'Ngữ pháp',
      'kanji': 'Kanji',
      'reading': 'Đọc hiểu',
      'listening': 'Nghe'
    };
    return translations[key] || key;
  });

  const data = Object.values(timeData);

  timeDistributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#1a2a6c', // Từ vựng
          '#4caf50', // Ngữ pháp
          '#fdbb2d', // Kanji
          '#b21f1f', // Đọc hiểu
          '#9C27B0'  // Nghe
        ],
        borderWidth: 0,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 20,
            font: { size: 13 },
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b);
              const value = ctx.raw;
              const hours = Math.floor(value / 60);
              const mins = value % 60;
              const percentage = Math.round((value / total) * 100);
              return ` ${ctx.label}: ${hours > 0 ? `${hours} giờ ` : ''}${mins > 0 ? `${mins} phút` : ''} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function initSkillRadarChart(skillData) {
  const ctx = document.getElementById('skillRadarChart').getContext('2d');

  // Tạo mảng màu cho từng kỹ năng
  const backgroundColors = skillData.data.map((_, i) => {
    const opacity = 0.2 + (i * 0.15);
    return `rgba(26, 42, 108, ${opacity})`;
  });

  skillRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: skillData.labels.map(label => {
        // Chuyển đổi label sang tiếng Việt
        const translations = {
          'vocabulary': 'Từ vựng',
          'grammar': 'Ngữ pháp',
          'kanji': 'Kanji',
          'reading': 'Đọc hiểu',
          'listening': 'Nghe'
        };
        return translations[label] || label;
      }),
      datasets: [{
        label: 'Tỉ lệ hoàn thành',
        data: skillData.data,
        backgroundColor: backgroundColors,
        borderColor: '#1a2a6c',
        borderWidth: 2,
        pointBackgroundColor: '#1a2a6c',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#1a2a6c'
      }]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            callback: value => `${value}%`
          }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}%`
          }
        }
      }
    }
  });
}

function displayTaskCategories(categories) {
  const container = document.getElementById('taskCategoryContainer');
  container.innerHTML = '';

  const translations = {
    'vocabulary': 'Từ vựng',
    'grammar': 'Ngữ pháp',
    'kanji': 'Kanji',
    'reading': 'Đọc hiểu',
    'listening': 'Nghe'
  };

  Object.entries(categories).forEach(([name, stats]) => {
    const displayName = translations[name] || name;
    const progress = Math.round((stats.completed / stats.total) * 100) || 0;

    const card = document.createElement('div');
    card.className = 'task-category-card';
    card.innerHTML = `
            <h4><i class="fas fa-book-open"></i> ${displayName}</h4>
            <div class="task-category-stats">
                <span>${stats.completed}/${stats.total} bài</span>
                <span>${Math.round(stats.completed / stats.total * 100)}% hoàn thành</span>
            </div>
            <div class="task-category-progress">
                <div class="task-category-progress-bar" style="width: ${progress}%"></div>
            </div>
        `;
    container.appendChild(card);
  });
}

// ----------------------------
// TIMER FUNCTIONS
// ----------------------------

function initTimer() {
  // Timer implementation from your original code
  // ... (keep your existing timer functions)
}

// ----------------------------
// HELPER FUNCTIONS
// ----------------------------

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}