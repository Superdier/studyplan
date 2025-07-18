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
let progressChart = null;
let timeDistributionChart = null;
let skillRadarChart = null;

// Global Variables for Timer
let countdownInterval;
let timeLeft;
let isPaused = false;
let isStudyPhase = true; // true: học, false: nghỉ
let sessionStartTime = null;
let sessionTimers = {};

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
const startStudyBtn = document.getElementById("start-study-btn");
const countdownModal = document.getElementById("countdown-modal");
const closeCountdownModal = document.getElementById("close-countdown-modal");
const breakModal = document.getElementById('break-modal');
const closeBreakModalBtn = document.getElementById('close-break-modal');
const startBreakBtn = document.getElementById('start-break-btn');
const timerDisplay = document.getElementById('timer-display');
const timerStatus = document.getElementById('timer-status');
const studyMinutesInput = document.getElementById('study-minutes');
const breakMinutesInput = document.getElementById('break-minutes');
const startTimerBtn = document.getElementById('start-timer');
const pauseTimerBtn = document.getElementById('pause-timer');
const stopTimerBtn = document.getElementById('stop-timer');

function showModal(modalElement) {
  if (modalElement) {
    modalElement.style.display = 'flex'; // Hoặc 'block' tùy CSS của bạn
    // Nếu bạn dùng class 'active' thay vì display: modalElement.classList.add('active');
  }
}

function hideModal(modalElement) {
  if (modalElement) {
    modalElement.style.display = 'none';
    // Nếu bạn dùng class 'active' thay vì display: modalElement.classList.remove('active');
  }
}

function hideBreakModal() {
  if (breakModal) {
    breakModal.style.display = 'none';
  }
}

// Weekly schedule functions
function getWeekRange(startDate) {
  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    result.push(formatDate(d));
  }
  return result;
}

// Hàm tính ngày đầu tuần (Thứ 2)
function getStartOfWeek(date = new Date()) {
  const day = date.getDay(); // 0 (Chủ nhật) đến 6 (Thứ 7)
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Chỉnh để Thứ 2 là đầu tuần
  return new Date(date.setDate(diff));
}

function loadCurrentWeek() {
  const dates = getWeekRange(currentWeekStart);
  updateWeekHeader(dates);
  loadSchedule(dates);
  updateProgress();
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
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
      showModal(editDayModal);
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
      hideModal(editDayModal);
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
  // Chỉ tính toán lại thay vì tải toàn bộ
  const allTasks = document.querySelectorAll('.study-item');
  const completedTasks = document.querySelectorAll('.study-item.done');

  const total = allTasks.length;
  const completed = completedTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Cập nhật thanh progress
  const progressFill = document.getElementById('progress-fill');
  const weekProgress = document.getElementById("week-progress");

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
    progressFill.style.transition = 'width 0.5s ease';
  }

  if (weekProgress) weekProgress.textContent = progress + '%';

  // Cập nhật số liệu
  const completedCount = document.getElementById('completed-count');
  if (completedCount) completedCount.textContent = completed;
  const totalCount = document.getElementById('total-tasks');
  if (totalCount >= completedCount) totalCount.textContent = total;
}

// ----------------------------
// STATISTICS & CHARTS FUNCTIONS
// ----------------------------

async function getStudyStatistics() {
  try {
    const scheduleSnapshot = await db.ref('schedule').once('value');
    const scheduleData = scheduleSnapshot.val() || {};

    // Tạo bản đồ tiến độ tuần
    const weekProgressMap = new Map();

    // Tạo bản đồ đánh giá kỹ năng
    const skillAssessment = {
      vocabulary: 0,
      grammar: 0,
      kanji: 0,
      reading: 0,
      listening: 0
    };

    // Tạo bản đồ phân loại bài tập
    const taskCategories = {
      vocabulary: { completed: 0, total: 0 },
      grammar: { completed: 0, total: 0 },
      kanji: { completed: 0, total: 0 },
      reading: { completed: 0, total: 0 },
      listening: { completed: 0, total: 0 }
    };

    // Biến tổng
    let totalStudyTime = 0;
    let totalTasks = 0;
    let completedTasks = 0;

    // Duyệt qua dữ liệu lịch học
    Object.entries(scheduleData).forEach(([date, dayData]) => {
      if (!dayData.tasks) return;

      const weekNumber = dayData.weekNumber || 1;

      // Khởi tạo dữ liệu tuần nếu chưa có
      if (!weekProgressMap.has(weekNumber)) {
        weekProgressMap.set(weekNumber, {
          completedTasks: 0,
          totalTasks: 0,
          studyTime: 0
        });
      }

      const weekData = weekProgressMap.get(weekNumber);

      // Xử lý từng nhiệm vụ
      dayData.tasks.forEach(task => {
        // Cập nhật tổng
        totalTasks++;
        weekData.totalTasks++;

        // Cập nhật nhiệm vụ hoàn thành
        if (task.done) {
          completedTasks++;
          weekData.completedTasks++;

          // Cập nhật thời gian học
          const duration = task.duration || 0;
          totalStudyTime += duration;
          weekData.studyTime += duration;
        }

        // Cập nhật kỹ năng
        if (task.type && skillAssessment[task.type] !== undefined) {
          skillAssessment[task.type] += task.duration || 0;
        }

        // Cập nhật phân loại bài tập
        if (task.type && taskCategories[task.type]) {
          taskCategories[task.type].total++;
          if (task.done) taskCategories[task.type].completed++;
        }
      });
    });

    // Tạo mảng tiến độ tuần
    const weeklyProgress = [];
    for (let week = 1; week <= 21; week++) {
      const weekData = weekProgressMap.get(week) || {
        completedTasks: 0,
        totalTasks: 0,
        studyTime: 0
      };

      weeklyProgress.push({
        week,
        progress: weekData.totalTasks > 0 ?
          Math.round((weekData.completedTasks / weekData.totalTasks) * 100) : 0,
        studyTime: weekData.studyTime
      });
    }

    // Chuyển đánh giá kỹ năng sang phần trăm
    const totalSkillTime = Object.values(skillAssessment).reduce((sum, val) => sum + val, 0);
    if (totalSkillTime > 0) {
      Object.keys(skillAssessment).forEach(skill => {
        skillAssessment[skill] = Math.round((skillAssessment[skill] / totalSkillTime) * 100);
      });
    }

    const streakInfo = await calculateStreak();

    return {
      weeklyProgress,
      timeDistribution: skillAssessment,
      skillAssessment,
      taskCategories,
      totalStudyTime,
      totalTasks,
      completedTasks,
      streakDays: streakInfo.current,
      maxStreak: streakInfo.max,
    };
  } catch (error) {
    console.error("Lỗi khi tải thống kê:", error);
    return {
      weeklyProgress: [],
      timeDistribution: {
        vocabulary: 0,
        grammar: 0,
        kanji: 0,
        reading: 0,
        listening: 0
      },
      skillAssessment: {
        vocabulary: 0,
        grammar: 0,
        kanji: 0,
        reading: 0,
        listening: 0
      },
      taskCategories: {
        vocabulary: { completed: 0, total: 0 },
        grammar: { completed: 0, total: 0 },
        kanji: { completed: 0, total: 0 },
        reading: { completed: 0, total: 0 },
        listening: { completed: 0, total: 0 }
      },
      totalStudyTime: 0,
      totalTasks: 0,
      completedTasks: 0,
      streakDays: 0,
      maxStreak: 0,
    };
  }
}

async function updateStatsCards(stats) {
  const streak = await calculateStreak();
  document.getElementById('total-hours').textContent = Math.floor(stats.totalStudyTime / 60);
  document.getElementById('completion-rate').textContent =
    `${Math.round((stats.completedTasks / stats.totalTasks) * 100 || 0)}%`;
  document.getElementById('streak-days').textContent = streak.current;
  document.getElementById('lessons-learned').textContent = stats.completedTasks;

  document.getElementById('max-streak').textContent = streak.max;

  // Thêm thông tin thời gian học
  document.getElementById('daily-study-time').textContent =
    `${Math.floor(stats.dailyStudyTime / 60)}h${stats.dailyStudyTime % 60}m`;
  document.getElementById('weekly-study-time').textContent =
    `${Math.floor(stats.weeklyStudyTime / 60)}h`;
}

async function calculateStreak() {
  try {
    const [scheduleSnapshot, sessionsSnapshot] = await Promise.all([
      db.ref('schedule').once('value'),
      db.ref('studySessions').once('value')
    ]);
    
    const scheduleData = scheduleSnapshot.val() || {};
    const sessionsData = sessionsSnapshot.val() || {};
    
    // Tạo mảng các ngày có hoạt động học tập
    const studyDates = [];
    
    // 1. Kiểm tra lịch học (chỉ tính ngày có ít nhất 1 nhiệm vụ hoàn thành)
    Object.entries(scheduleData).forEach(([date, dayData]) => {
      if (dayData.tasks && dayData.tasks.some(task => task.done)) {
        studyDates.push(date);
      }
    });
    
    // 2. Kiểm tra phiên học (chỉ tính phiên hoàn thành)
    Object.entries(sessionsData).forEach(([date, sessions]) => {
      const hasCompletedSession = Object.values(sessions).some(
        session => session.type === "completed" && (session.duration || 0) > 0
      );
      if (hasCompletedSession && !studyDates.includes(date)) {
        studyDates.push(date);
      }
    });
    
    // Sắp xếp theo ngày
    studyDates.sort();
    
    // Tính toán streak
    let currentStreak = 0;
    let maxStreak = 0;
    let prevDate = null;
    
    for (const date of studyDates) {
      const currentDate = new Date(date);
      
      if (prevDate === null) {
        currentStreak = 1;
      } else {
        const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 1; // Reset streak nếu khoảng cách > 1 ngày
        }
      }
      
      prevDate = currentDate;
      maxStreak = Math.max(maxStreak, currentStreak);
    }
    
    return {
      current: currentStreak,
      max: maxStreak
    };
  } catch (error) {
    console.error("Lỗi khi tính streak:", error);
    return { current: 0, max: 0 };
  }
}

function initProgressChart(weeklyData) {
  const ctx = document.getElementById('progressChart')?.getContext('2d');
  if (!ctx) return;

  if (progressChart) {
    progressChart.destroy();
  }

  progressChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeklyData.map(item => `Tuần ${item.week}`),
      datasets: [
        {
          label: 'Tỷ lệ hoàn thành (%)',
          data: weeklyData.map(item => item.progress),
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          yAxisID: 'y'
        },
        {
          label: 'Thời gian học (giờ)',
          data: weeklyData.map(item => Math.round(item.studyTime / 60)),
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Tỷ lệ %' },
          position: 'left'
        },
        y1: {
          beginAtZero: true,
          title: { display: true, text: 'Giờ học' },
          position: 'right',
          grid: { drawOnChartArea: false }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;

              if (context.datasetIndex === 0) {
                return `${label}: ${value}%`;
              } else {
                return `${label}: ${value} giờ`;
              }
            }
          }
        }
      }
    }
  });
}

function initTimeDistributionChart(timeData) {
  const ctx = document.getElementById('timeDistributionChart')?.getContext('2d');
  if (!ctx || !timeData) {
    console.error("Canvas context or timeData not available");
    return;
  }

  const data = Object.values(timeData);
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

  if (timeDistributionChart) {
    timeDistributionChart.destroy();
  }

  timeDistributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#1a2a6c', '#4caf50', '#fdbb2d', '#b21f1f', '#9C27B0'
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
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const value = ctx.raw;
              const hours = Math.floor(value / 60);
              const mins = value % 60;
              const percentage = Math.round((value / total) * 100);
              return `${ctx.label}: ${hours > 0 ? `${hours} giờ ` : ''}${mins > 0 ? `${mins} phút` : ''} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

async function analyzeStudyPatterns() {
  try {
    const snapshot = await db.ref('studySessions').once('value');
    const sessionsData = snapshot.val() || {};

    let dailyStudyTime = 0;
    let weeklyStudyTime = 0;
    const hourlyStats = Array(24).fill(0);

    const todayKey = formatDate(new Date());
    const weekStart = getStartOfWeek(new Date());

    Object.entries(sessionsData).forEach(([date, sessions]) => {
      const isToday = date === todayKey;
      const isThisWeek = new Date(date) >= weekStart;

      Object.values(sessions).forEach(session => {
        if (session.type !== "completed") return;

        const duration = parseInt(session.duration) || 0;

        // Tính thời gian học hôm nay
        if (isToday) dailyStudyTime += duration;

        // Tính thời gian học tuần này
        if (isThisWeek) weeklyStudyTime += duration;

        // Tính thống kê theo giờ
        if (session.start) {
          const hour = new Date(session.start).getHours();
          hourlyStats[hour] += duration;
        }
      });
    });

    // Tìm giờ học hiệu quả nhất
    let maxHour = -1;
    let maxDuration = 0;
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyStats[hour] > maxDuration) {
        maxDuration = hourlyStats[hour];
        maxHour = hour;
      }
    }

    const bestTime = maxHour >= 0 ?
      { hour: `${maxHour}:00-${maxHour + 1}:00`, duration: maxDuration } :
      null;

    return {
      dailyStudyTime: dailyStudyTime || 0,
      weeklyStudyTime: weeklyStudyTime || 0,
      bestTime: bestTime || "Chưa có dữ liệu"
    };
  } catch (error) {
    console.error("Lỗi phân tích dữ liệu:", error);
    return {
      dailyStudyTime: 0,
      weeklyStudyTime: 0,
      bestTime: "Chưa có dữ liệu"
    };
  }
}

async function displayEffectiveStudyTime() {
  const dailyEl = document.getElementById('daily-study-time');
  const weeklyEl = document.getElementById('weekly-study-time');
  const bestTimeEl = document.getElementById('best-study-time');

  if (!dailyEl || !weeklyEl || !bestTimeEl) return;

  try {
    const analysis = await analyzeStudyPatterns();

    // Hiển thị thời gian học hôm nay
    const dailyMins = analysis.dailyStudyTime || 0;
    if (dailyMins > 0) {
      const hours = Math.floor(dailyMins / 60);
      const mins = dailyMins % 60;

      if (hours > 0) {
        dailyEl.textContent = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      } else {
        dailyEl.textContent = `${mins}m`;
      }
    } else {
      dailyEl.textContent = "0m";
    }

    // Hiển thị thời gian học tuần này
    const weeklyMins = analysis.weeklyStudyTime || 0;
    if (weeklyMins > 0) {
      const hours = Math.floor(weeklyMins / 60);
      const mins = weeklyMins % 60;

      if (hours > 0) {
        weeklyEl.textContent = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      } else {
        weeklyEl.textContent = `${mins}m`;
      }
    } else {
      weeklyEl.textContent = "0h";
    }

    // Hiển thị giờ học hiệu quả
    if (analysis.bestTime && analysis.bestTime.duration > 0) {
      bestTimeEl.textContent = analysis.bestTime.hour;
    } else {
      bestTimeEl.textContent = "Chưa có dữ liệu";
    }

  } catch (error) {
    console.error("Lỗi khi hiển thị thời gian học hiệu quả:", error);
    dailyEl.textContent = "0m";
    weeklyEl.textContent = "0h";
    bestTimeEl.textContent = "Chưa có dữ liệu";
  }
}

async function displayStudyAnalysis() {
  const analysis = await analyzeStudyPatterns();

  // Tạo HTML cho kết quả
  const analysisHTML = `
    <div class="analysis-card">
      <h3><i class="fas fa-chart-line"></i> Phân tích học tập</h3>
      <div class="stats-row">
        <div class="stat">
          <i class="fas fa-clock"></i>
          <div>Tổng thời gian: ${Math.floor(analysis.totalDuration / 60)}h${analysis.totalDuration % 60}m</div>
        </div>
        <div class="stat">
          <i class="fas fa-layer-group"></i>
          <div>Số phiên: ${analysis.sessionCount}</div>
        </div>
        <div class="stat">
          <i class="fas fa-arrows-alt-h"></i>
          <div>Trung bình: ${Math.round(analysis.avgDuration)} phút/phiên</div>
        </div>
      </div>
      
      <h4><i class="fas fa-chart-bar"></i> Thời gian học theo giờ</h4>
      <div class="hourly-chart">
        ${analysis.hourlyDistribution.map((duration, hour) => `
          <div class="hour-bar">
            <div class="bar-label">${hour}h</div>
            <div class="bar-container">
              <div class="bar" style="height: ${duration / analysis.totalDuration * 200}px;"></div>
            </div>
            <div class="duration">${duration}m</div>
          </div>
        `).join('')}
      </div>
      
      <div class="highlights">
        <div class="highlight-card">
          <i class="fas fa-crown"></i>
          <div>Giờ học hiệu quả: ${analysis.bestTime.hour}</div>
        </div>
        <div class="highlight-card">
          <i class="fas fa-trophy"></i>
          <div>Phiên dài nhất: ${analysis.longestSession.duration} phút</div>
        </div>
      </div>
    </div>
  `;

  // Chèn vào tab thống kê
  const statsTab = document.getElementById('stats-tab');
  if (statsTab) {
    statsTab.insertAdjacentHTML('beforeend', analysisHTML);
  }
}

// ----------------------------
// COUNTDOWN/TIMER FUNCTIONS
// ----------------------------

// Start the session
function startStudySession() {
  sessionStartTime = new Date();
  const sessionKey = `session_${Date.now()}`;
  const dateKey = formatDate(sessionStartTime);

  // Lưu thông tin session vào sessionTimers
  sessionTimers[sessionKey] = {
    start: sessionStartTime,
    end: null,
    duration: 0,
    type: "active"
  };

  // Lưu lên Firebase
  db.ref(`studySessions/${dateKey}/${sessionKey}`).set({
    start: sessionStartTime.getTime(),
    end: null,
    duration: 0,
    type: "active"
  });
}

// End the session
async function endStudySession() {
  if (!sessionStartTime) return;

  const endTime = new Date();
  const duration = Math.floor((endTime - sessionStartTime) / 60000); // phút
  const dateKey = formatDate(sessionStartTime);
  
  // Tạo sessionKey mới nếu không tìm thấy trong sessionTimers
  const sessionKey = `session_${Date.now()}`;

  try {
    // Cập nhật session
    await db.ref(`studySessions/${dateKey}/${sessionKey}`).update({
      end: endTime.getTime(),
      duration: duration,
      type: duration >= parseInt(studyMinutesInput.value) ? "completed" : "interrupted"
    });

    // Cập nhật thống kê
    await updateStudyStats(dateKey, duration);
  } catch (error) {
    console.error("Lỗi khi kết thúc phiên học:", error);
  }

  sessionStartTime = null;
}

// Cập nhật thống kê tổng
async function updateStudyStats(dateKey, duration) {
  const date = new Date(dateKey);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const weekNumber = getWeekNumber(date);
  const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

  // Cập nhật hàng ngày
  const dailyRef = db.ref(`userStats/daily/${monthKey}/${date.getDate()}`);
  const dailySnapshot = await dailyRef.once('value');
  const currentDaily = dailySnapshot.val() || 0;
  await dailyRef.set(currentDaily + duration);

  // Cập nhật hàng tuần
  const weeklyRef = db.ref(`userStats/weekly/${weekKey}`);
  const weeklySnapshot = await weeklyRef.once('value');
  const currentWeekly = weeklySnapshot.val() || 0;
  await weeklyRef.set(currentWeekly + duration);

  // Cập nhật hàng tháng
  const monthlyRef = db.ref(`userStats/monthly/${monthKey}`);
  const monthlySnapshot = await monthlyRef.once('value');
  const currentMonthly = monthlySnapshot.val() || 0;
  await monthlyRef.set(currentMonthly + duration);
}

// Number of weeks in a year
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function updateRemainingDays() {
  const examDate = new Date("2025-12-06");
  const today = new Date();
  
  // Tính số ngày còn lại (không tính ngày hiện tại)
  const diffTime = examDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  // Cập nhật lên giao diện
  const remainingDaysElement = document.querySelector('.stat-card:nth-child(3) .stat-value');
  if (remainingDaysElement) {
    remainingDaysElement.textContent = diffDays > 0 ? diffDays : "0";
  }
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

  if (startStudyBtn) {
    startStudyBtn.addEventListener("click", () => {
      showModal(countdownModal);
    });
  }

  if (countdownModal) {
    window.addEventListener('click', (event) => {
      if (event.target === countdownModal) {
        hideModal(countdownModal);
        stopTimer();
      }
    });
  }

  if (startTimerBtn) { startTimerBtn.addEventListener('click', startTimer); }
  if (pauseTimerBtn) { pauseTimerBtn.addEventListener('click', pauseTimer); }
  if (stopTimerBtn) { stopTimerBtn.addEventListener('click', stopTimer); }

  if (studyMinutesInput) {
    studyMinutesInput.addEventListener('change', () => {
      stopTimer(); // Dừng và reset timer khi thay đổi thời gian học
    });
  }
  if (breakMinutesInput) {
    // Tùy chỉnh: nếu bạn muốn reset hoặc thay đổi trạng thái khi break duration thay đổi
  }

  if (closeCountdownModal) {
    closeCountdownModal.addEventListener("click", () => {
      hideModal(countdownModal);
      stopTimer();
    });
  }

  if (closeBreakModalBtn) {
    closeBreakModalBtn.addEventListener("click", hideBreakModal);
  }

  if (startBreakBtn) { // Nút "Bắt đầu nghỉ ngơi"
    startBreakBtn.addEventListener("click", startBreakTimer); // Gọi hàm bắt đầu timer nghỉ
  }

  if (breakModal) { // Đảm bảo breakModal tồn tại
    window.addEventListener('click', (event) => {
      if (event.target === breakModal) {
        hideBreakModal();
        console.log('Người dùng đã click ra ngoài để đóng modal nghỉ ngơi.');
      }
    });
  }

  // Edit modal buttons
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", addNewTask);
  }

  if (saveDayBtn) {
    saveDayBtn.addEventListener("click", saveDayData);
  }

  if (closeEditModal) {
    closeEditModal.addEventListener("click", (e) => {
      e.preventDefault();
      editDayModal.classList.remove("active");
    });

    if (editDayModal) {
      window.addEventListener('click', (event) => {
        if (event.target === editDayModal) {
          hideModal(editDayModal);
        }
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
}

// Thay vì gắn sự kiện cho từng nút, dùng event delegation
document.addEventListener('click', (e) => {
  const checkBtn = e.target.closest('.check-btn');
  if (checkBtn) {
    e.preventDefault();
    const taskItem = checkBtn.closest('.study-item');
    const dayCard = checkBtn.closest('.day-card');
    if (taskItem && dayCard) {
      const taskIndex = taskItem.getAttribute('data-task-index');
      const date = dayCard.getAttribute('data-date');
      toggleTaskDone(date, taskIndex);
    }
  }
});

function initSkillRadarChart(skillData) {
  const ctx = document.getElementById('skillRadarChart')?.getContext('2d');
  if (!ctx) return;

  if (skillRadarChart) {
    skillRadarChart.destroy();
  }

  const labels = Object.keys(skillData).map(key => {
    const translations = {
      'vocabulary': 'Từ vựng',
      'grammar': 'Ngữ pháp',
      'kanji': 'Kanji',
      'reading': 'Đọc hiểu',
      'listening': 'Nghe'
    };
    return translations[key] || key;
  });

  skillRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tỷ lệ thời gian học',
        data: Object.values(skillData),
        backgroundColor: 'rgba(26, 42, 108, 0.2)',
        borderColor: 'rgba(26, 42, 108, 1)',
        pointBackgroundColor: 'rgba(26, 42, 108, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(26, 42, 108, 1)'
      }]
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            callback: value => `${value}%`
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => ` ${context.label}: ${context.raw}%`
          }
        }
      }
    }
  });
}

function displayTaskCategories(categories) {
  const container = document.getElementById('taskCategoryContainer');
  if (!container) return;

  container.innerHTML = '';

  const translations = {
    'vocabulary': 'Từ vựng',
    'grammar': 'Ngữ pháp',
    'kanji': 'Kanji',
    'reading': 'Đọc hiểu',
    'listening': 'Nghe'
  };

  Object.entries(categories).forEach(([type, stats]) => {
    const displayName = translations[type] || type;
    const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'task-category-card';
    card.innerHTML = `
      <h4><i class="fas fa-book"></i> ${displayName}</h4>
      <div class="task-category-stats">
        <span>${stats.completed}/${stats.total} bài</span>
        <span>${progress}% hoàn thành</span>
      </div>
      <div class="task-category-progress">
        <div class="task-category-progress-bar" style="width: ${progress}%"></div>
      </div>
    `;
    container.appendChild(card);
  });
}

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

startStudyBtn.addEventListener("click", () => {
  countdownModal.style.display = "flex";
});

// ----------------------------
// Display Rest Modal Function
// ----------------------------

function showBreakModal() {
  if (breakModal) {
    breakModal.style.display = 'flex'; // Sử dụng flex để căn giữa dễ dàng

  }
}

// Hàm ẩn modal nghỉ ngơi
function hideBreakModal() {
  if (breakModal) {
    breakModal.style.display = 'none';
  }
}

// Hàm bắt đầu đếm ngược thời gian nghỉ
let breakTimer;
const BREAK_DURATION = 5 * 60 * 1000; // 5 phút nghỉ ngơi (đổi ra miligiây)

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  if (timerDisplay) {
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

// Hàm bắt đầu/tiếp tục đếm ngược
function startTimer() {
  // Nếu đang tạm dừng thì tiếp tục
  if (isPaused) {
    isPaused = false;
    startTimerBtn.style.display = 'none';
    pauseTimerBtn.style.display = 'inline-block';
    countdownInterval = setInterval(updateTimer, 1000);
    return;
  }

  // Bắt đầu phiên học mới
  startStudySession();
  const studyDuration = parseInt(studyMinutesInput.value) * 60;
  const breakDuration = parseInt(breakMinutesInput.value) * 60;

  // Cập nhật thông báo nghỉ ngơi
  updateBreakMessage(studyMinutesInput.value, breakMinutesInput.value);

  // Reset thời gian
  isStudyPhase = true;
  timeLeft = studyDuration;
  if (timerStatus) timerStatus.textContent = 'Đang học...';

  // Cập nhật hiển thị
  updateTimerDisplay();
  startTimerBtn.style.display = 'none';
  pauseTimerBtn.style.display = 'inline-block';
  stopTimerBtn.style.display = 'inline-block';

  // Xóa interval cũ nếu có
  if (countdownInterval) clearInterval(countdownInterval);

  // Bắt đầu interval mới
  countdownInterval = setInterval(() => {
    if (!isPaused) {
      timeLeft--;
      updateTimerDisplay();

      if (timeLeft <= 0) {
        if (isStudyPhase) {
          // Hết giờ học, chuyển sang nghỉ
          isStudyPhase = false;
          timeLeft = breakDuration;
          if (timerStatus) timerStatus.textContent = 'Đang nghỉ...';
          showModal(breakModal);
        } else {
          // Hết giờ nghỉ, dừng hẳn
          hideModal(breakModal);
          stopTimer();
          if (timerStatus) timerStatus.textContent = 'Đã hoàn thành phiên học!';
        }
      }
    }
  }, 1000);
}

// Hàm tạm dừng đếm ngược
function pauseTimer() {
  isPaused = true;
  clearInterval(countdownInterval);
  if (timerStatus) timerStatus.textContent = isStudyPhase ? 'Đã tạm dừng học.' : 'Đã tạm dừng nghỉ.';
  startTimerBtn.style.display = 'inline-block';
  pauseTimerBtn.style.display = 'none';
}

// Hàm dừng và reset đếm ngược
function stopTimer() {
  endStudySession();
  clearInterval(countdownInterval);
  countdownInterval = null;
  isPaused = false;
  isStudyPhase = true;
  timeLeft = parseInt(studyMinutesInput.value) * 60;
  updateTimerDisplay();
  if (timerStatus) timerStatus.textContent = 'Sẵn sàng bắt đầu học...';
  startTimerBtn.style.display = 'inline-block';
  pauseTimerBtn.style.display = 'none';
  stopTimerBtn.style.display = 'none';
  
  // Xóa tất cả session timers
  sessionTimers = {};
}

function startBreakTimer() {
  hideModal(breakModal);
  isStudyPhase = false;
  timeLeft = parseInt(breakMinutesInput.value) * 60;
  if (timerStatus) timerStatus.textContent = 'Đang nghỉ...';
  updateTimerDisplay();
  startTimer(); // Bắt đầu đếm ngược thời gian nghỉ
}

function updateTimer() {
  if (!isPaused) {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      if (isStudyPhase) {
        // Hết giờ học, chuyển sang nghỉ
        isStudyPhase = false;
        timeLeft = parseInt(breakMinutesInput.value) * 60;
        if (timerStatus) timerStatus.textContent = 'Đang nghỉ...';
        showModal(breakModal);
      } else {
        // Hết giờ nghỉ, dừng hẳn
        stopTimer();
      }
    }
  }
}

function updateBreakMessage(studyMinutes, breakMinutes) {
  const breakMessage = document.getElementById('break-message');
  if (breakMessage) {
    breakMessage.textContent =
      `Bạn đã học liên tục ${studyMinutes} phút. Hãy nghỉ ngơi ${breakMinutes} phút để nạp năng lượng.`;
  }
}

async function toggleTaskDone(date, taskIndex) {
  try {
    const ref = db.ref(`schedule/${date}/tasks/${taskIndex}`);
    const snapshot = await ref.once('value');
    const currentDone = snapshot.val().done;

    // 1. Cập nhật trạng thái trên Firebase
    await ref.update({ done: !currentDone });

    // 2. Tìm và cập nhật trực tiếp phần tử DOM tương ứng
    const taskElement = document.querySelector(`.day-card[data-date="${date}"] .study-item[data-task-index="${taskIndex}"]`);
    if (taskElement) {
      taskElement.classList.toggle('done', !currentDone);
      const icon = taskElement.querySelector('.check-btn i');
      if (icon) {
        icon.className = !currentDone ? 'fas fa-check-circle' : 'far fa-circle';
      }
    }

    const newStreak = await calculateStreak();
    updateStreakDisplay(newStreak);

    // 3. Cập nhật progress bar mà không tải lại toàn bộ
    updateProgress();

    // 4. Cập nhật thống kê và biểu đồ khi chuyển tab
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'stats') {
      initCharts();
    }

  } catch (error) {
    console.error("Lỗi khi cập nhật nhiệm vụ:", error);
  }
}

function updateStreakDisplay(streakData) {
  const streakElement = document.getElementById('streak-days');
  if (streakElement) {
    streakElement.textContent = streakData.current;
  }
}

async function initCharts() {
  // Hủy biểu đồ cũ nếu tồn tại
  if (progressChart) {
    progressChart.destroy();
    progressChart = null;
  }
  if (timeDistributionChart) {
    timeDistributionChart.destroy();
    timeDistributionChart = null;
  }
  if (skillRadarChart) {
    skillRadarChart.destroy();
    skillRadarChart = null;
  }

  const stats = await getStudyStatistics();
  updateStatsCards(stats);
  initProgressChart(stats.weeklyProgress);
  initTimeDistributionChart(stats.timeDistribution);
  initSkillRadarChart(stats.skillAssessment);
  displayTaskCategories(stats.taskCategories);
  await displayEffectiveStudyTime();
}

async function showStudyReminder() {
  const analysis = await analyzeStudyPatterns();
  const now = new Date();
  const currentHour = now.getHours();
  const currentHourKey = `${currentHour}:00-${currentHour + 1}:00`;

  if (analysis.bestTime.hour === currentHourKey) {
    // Hiển thị thông báo
    showNotification(
      "Thời gian học tốt nhất!",
      `Đây là khoảng thời gian bạn học hiệu quả nhất (${analysis.bestTime.hour})`
    );
  }
}

// Gọi 1 lần mỗi giờ
setInterval(showStudyReminder, 3600000);

// Thêm listener để cập nhật streak khi dữ liệu thay đổi
function setupRealTimeListeners() {
  // Lắng nghe thay đổi trong schedule
  db.ref('schedule').on('value', async () => {
    const newStreak = await calculateStreak();
    updateStreakDisplay(newStreak);
  });
  
  // Lắng nghe thay đổi trong studySessions
  db.ref('studySessions').on('value', async () => {
    const newStreak = await calculateStreak();
    updateStreakDisplay(newStreak);
  });
}

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  currentWeekStart = getStartOfWeek();
  updateRemainingDays();
  loadCurrentWeek();
  setupEventListeners();
  setupTabNavigation();
  setupRealTimeListeners();
  if (studyMinutesInput) {
    timeLeft = parseInt(studyMinutesInput.value) * 60;
    updateTimerDisplay();
  }
});