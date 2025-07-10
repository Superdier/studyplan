// Firebase configuration and initialization
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// App Variables
let currentWeekStart = new Date("2025-07-07");
const totalWeeks = 21;

// DOM Elements
const tabs = document.querySelectorAll(".tab");
const prevWeekBtn = document.getElementById("prev-week");
const nextWeekBtn = document.getElementById("next-week");
const startStudyBtn = document.getElementById("start-study-btn");
const countdownModal = document.getElementById("countdown-modal");

// Chart instances
let progressChart, timeDistributionChart, skillRadarChart;

// ----------------------------
// MAIN FUNCTIONS
// ----------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadCurrentWeek();
  initTabEvents();
  initTimer();
});

function initTabEvents() {
  tabs.forEach(tab => {
    tab.addEventListener("click", async () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const tabContent = document.getElementById(`${tab.dataset.tab}-tab`);
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tabContent.classList.add("active");
      
      if (tab.dataset.tab === "stats") {
        await initCharts();
      }
    });
  });
}

// ----------------------------
// WEEKLY SCHEDULE FUNCTIONS
// ----------------------------

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
  
  document.getElementById("current-week-display").innerHTML = `
    Tuần ${weekIndex}: ${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}
    <span class="phase-badge">Củng cố N2</span>
  `;
}

async function loadSchedule(dates) {
  const grid = document.getElementById("weekly-schedule");
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
  const displayDate = `${d.getDate()}/${d.getMonth()+1}`;
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
  const [weeklySnapshot, scheduleSnapshot] = await Promise.all([
    db.ref('weeklyProgress').once('value'),
    db.ref('schedule').once('value')
  ]);
  
  const weeklyData = weeklySnapshot.val() || {};
  const scheduleData = scheduleSnapshot.val() || {};
  
  // Weekly progress data
  const weeklyProgress = Array.from({length: totalWeeks}, (_, i) => {
    const weekNum = i + 1;
    const weekData = weeklyData[`week${weekNum}`] || { completedTasks: 0, targetTasks: 1, studyTime: 0 };
    return {
      week: weekNum,
      progress: Math.round((weekData.completedTasks / weekData.targetTasks) * 100),
      studyTime: weekData.studyTime
    };
  });
  
  // Time distribution data
  const timeDistribution = {
    'Nghe': 0,
    'Ngữ pháp': 0,
    'Từ vựng': 0,
    'Đọc hiểu': 0,
    'Khác': 0
  };
  
  Object.values(scheduleData).forEach(day => {
    day.tasks?.forEach(task => {
      const type = task.type === 'listening' ? 'Nghe' :
                  task.type === 'grammar' ? 'Ngữ pháp' :
                  task.type === 'vocabulary' ? 'Từ vựng' :
                  task.type === 'reading' ? 'Đọc hiểu' : 'Khác';
      timeDistribution[type] += task.duration || 30;
    });
  });
  
  // Skill assessment data (calculated from actual tasks)
  const skillScores = {
    'Nghe': 0,
    'Ngữ pháp': 0,
    'Từ vựng': 0,
    'Đọc hiểu': 0
  };
  
  let totalTasksBySkill = {
    'Nghe': 1,
    'Ngữ pháp': 1,
    'Từ vựng': 1,
    'Đọc hiểu': 1
  };
  
  Object.values(scheduleData).forEach(day => {
    day.tasks?.forEach(task => {
      const type = task.type === 'listening' ? 'Nghe' :
                  task.type === 'grammar' ? 'Ngữ pháp' :
                  task.type === 'vocabulary' ? 'Từ vựng' :
                  task.type === 'reading' ? 'Đọc hiểu' : null;
      
      if (type) {
        skillScores[type] += task.done ? 100 : 0;
        totalTasksBySkill[type]++;
      }
    });
  });
  
  const skillAssessment = {
    labels: ['Nghe', 'Ngữ pháp', 'Từ vựng', 'Đọc hiểu'],
    data: [
      Math.round(skillScores['Nghe'] / totalTasksBySkill['Nghe']),
      Math.round(skillScores['Ngữ pháp'] / totalTasksBySkill['Ngữ pháp']),
      Math.round(skillScores['Từ vựng'] / totalTasksBySkill['Từ vựng']),
      Math.round(skillScores['Đọc hiểu'] / totalTasksBySkill['Đọc hiểu'])
    ]
  };
  
  // Task categories data
  const taskCategories = {};
  Object.values(scheduleData).forEach(day => {
    day.tasks?.forEach(task => {
      const category = task.title.split(':')[0].trim() || 'Khác';
      if (!taskCategories[category]) {
        taskCategories[category] = { total: 0, completed: 0, time: 0 };
      }
      taskCategories[category].total++;
      if (task.done) taskCategories[category].completed++;
      taskCategories[category].time += task.duration || 30;
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
  
  timeDistributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(timeData),
      datasets: [{
        data: Object.values(timeData),
        backgroundColor: [
          '#1a2a6c', '#4caf50', '#fdbb2d', 
          '#b21f1f', '#9C27B0'
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
              return ` ${ctx.label}: ${hours}h${mins > 0 ? ` ${mins}p` : ''} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function initSkillRadarChart(skillData) {
  const ctx = document.getElementById('skillRadarChart').getContext('2d');
  
  skillRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: skillData.labels,
      datasets: [{
        label: 'Năng lực hiện tại',
        data: skillData.data,
        backgroundColor: 'rgba(26, 42, 108, 0.2)',
        borderColor: '#1a2a6c',
        borderWidth: 2,
        pointBackgroundColor: '#1a2a6c'
      }]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: { stepSize: 20 }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}/100`
          }
        }
      }
    }
  });
}

function displayTaskCategories(categories) {
  const container = document.getElementById('taskCategoryContainer');
  container.innerHTML = '';
  
  Object.entries(categories).forEach(([name, stats]) => {
    const progress = Math.round((stats.completed / stats.total) * 100) || 0;
    const hours = Math.floor(stats.time / 60);
    const minutes = stats.time % 60;
    
    const card = document.createElement('div');
    card.className = 'task-category-card';
    card.innerHTML = `
      <h4><i class="fas fa-book-open"></i> ${name}</h4>
      <div class="task-category-stats">
        <span>${stats.completed}/${stats.total} bài</span>
        <span>${hours}h${minutes > 0 ? ` ${minutes}p` : ''}</span>
      </div>
      <div class="task-category-progress">
        <div class="task-category-progress-bar" style="width: ${progress}%"></div>
      </div>
      <div class="task-category-stats">
        <small>Tỷ lệ hoàn thành</small>
        <span>${progress}%</span>
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
// EVENT LISTENERS
// ----------------------------

prevWeekBtn.addEventListener("click", () => {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  loadCurrentWeek();
});

nextWeekBtn.addEventListener("click", () => {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  loadCurrentWeek();
});

startStudyBtn.addEventListener("click", () => {
  countdownModal.style.display = "flex";
});

document.addEventListener("click", async (e) => {
  if (e.target.closest(".check-btn")) {
    const btn = e.target.closest(".check-btn");
    const item = btn.closest(".study-item");
    const card = btn.closest(".day-card");
    const date = card.getAttribute("data-date");
    const index = item.getAttribute("data-task-index");
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
      const snapshot = await db.ref(`schedule/${date}/tasks/${index}`).once("value");
      const task = snapshot.val();
      await db.ref(`schedule/${date}/tasks/${index}`).update({ done: !task.done });
      
      item.classList.toggle("done");
      btn.innerHTML = `<i class="fas fa-${!task.done ? 'check-' : ''}circle"></i>`;
      btn.classList.toggle("done");
      updateProgress();
    } catch (error) {
      console.error("Error updating task:", error);
      btn.innerHTML = `<i class="far fa-circle"></i>`;
    }
  }
});

function updateProgress() {
  const allTasks = document.querySelectorAll('.study-item');
  const completedTasks = document.querySelectorAll('.study-item.done');
  const total = allTasks.length;
  const completed = completedTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  document.getElementById('completed-count').textContent = completed;
  document.getElementById('total-tasks').textContent = total;
  document.getElementById('week-progress').textContent = `${progress}%`;
  document.getElementById('progress-fill').style.width = `${progress}%`;
  
  const progressFill = document.getElementById('progress-fill');
  progressFill.style.background = progress < 30 ? '#f44336' : 
                                 progress < 70 ? '#ff9800' : '#4caf50';
}

// ----------------------------
// HELPER FUNCTIONS
// ----------------------------

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}