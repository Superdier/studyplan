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
let notificationAudio = null;
let isManualClose = false;

// Chart instances
let progressChart = null;
let timeDistributionChart = null;
let skillRadarChart = null;
let subjectDistributionChart = null;

// Global Variables for Timer
let countdownInterval;
let timeLeft;
let isPaused = false;
let isStudyPhase = true;
let sessionStartTime = null;
let sessionTimers = {};
let timerStartTime = null;
let timerDuration = 0;
let currentSkillFilter = 'all';
let currentTimeFilter = 'all';
let resourcesData = {
  textbook: [],
  listening: [],
  website: []
};
let customTaskTypes = {
  it: [],
  other: []
};

// Subject và Task Type mapping
const subjectTaskTypes = {
  'language': [
    { value: 'vocabulary', label: 'Từ vựng' },
    { value: 'grammar', label: 'Ngữ pháp' },
    { value: 'kanji', label: 'Kanji' },
    { value: 'reading', label: 'Đọc hiểu' },
    { value: 'listening', label: 'Nghe hiểu' },
    { value: 'conversation', label: 'Hội thoại' },
    { value: 'other', label: 'Khác' }
  ],
  'it': [],
  'other': []
};

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

document.getElementById('skill-chart-filter')?.addEventListener('change', function (e) {
  currentSkillFilter = e.target.value;
  initCharts();
});

document.getElementById('time-chart-filter')?.addEventListener('change', function (e) {
  currentTimeFilter = e.target.value;
  initCharts();
});

// Custom alert function
function showCustomAlert(message) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.zIndex = '10001';
  modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; width: auto;">
            <h3 style="margin-top: 0; color: #1a2a6c;">
                <i class="fas fa-exclamation-triangle" style="color: #fdbb2d; margin-right: 10px;"></i>
                Thông báo
            </h3>
            <p style="margin: 20px 0; color: #333;">${message}</p>
            <div style="text-align: right;">
                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-check"></i> OK
                </button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);

  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 5000);
}

function showModal(modalElement) {
  if (!modalElement) return;

  if (modalElement) {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    modalElement.style.display = 'flex';
    modalElement.style.zIndex = '1000';
  }
}

function hideModal(modalElement) {
  if (modalElement) {
    modalElement.style.display = 'none';
    // Dừng âm thanh nếu là modal countdown hoặc break
    if (modalElement === countdownModal || modalElement === breakModal) {
      stopNotificationSound();
    }
    if (modalElement === breakModal) {
      isManualClose = true;
    }
  }
}

function hideBreakModal() {
  if (breakModal) {
    breakModal.style.display = 'none';
  }
}

// Weekly schedule functions
async function loadCustomTaskTypes() {
  try {
    const snapshot = await db.ref('customTaskTypes').once('value');
    const data = snapshot.val();

    if (data) {
      customTaskTypes = data;
    }
  } catch (error) {
    console.error('Lỗi khi tải custom task types:', error);
  }
}

async function saveCustomTaskTypes() {
  try {
    await db.ref('customTaskTypes').set(customTaskTypes);
  } catch (error) {
    console.error('Lỗi khi lưu custom task types:', error);
  }
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

function getStartOfWeek(date = new Date()) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
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
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');

      const tabId = tab.getAttribute('data-tab') + '-tab';
      const contentElement = document.getElementById(tabId);

      if (contentElement) {
        contentElement.classList.add('active');

        if (tabId === 'stats-tab') {
          initCharts();
        }
        else if (tabId === 'tools-tab') {
          initTools();
        }
      } else {
        console.error('Không tìm thấy nội dung cho tab:', tabId);
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

    renderTasksInModal(data.tasks || []);

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

// Cập nhật hàm renderTasksInModal để hỗ trợ subject dropdown và giữ trạng thái done
function renderTasksInModal(tasks) {
  if (!tasksContainer) return;

  tasksContainer.innerHTML = "";
  let totalMinutes = 0;

  tasks.forEach((task, index) => {
    const duration = task.duration || 0;
    const note = task.note || "";
    const subject = task.subject || 'language';
    const isDone = task.done || false; // Giữ trạng thái done
    totalMinutes += duration;

    const taskEl = document.createElement("div");
    taskEl.className = "task-item";
    taskEl.innerHTML = `
            <div class="task-row-extended">
                <select class="task-subject" data-index="${index}">
                    <option value="language" ${subject === 'language' ? 'selected' : ''}>Ngôn ngữ</option>
                    <option value="it" ${subject === 'it' ? 'selected' : ''}>IT</option>
                    <option value="other" ${subject === 'other' ? 'selected' : ''}>Khác</option>
                </select>
                ${renderTaskTypeField(index, subject, task.type)}
                <input type="text" class="task-input" value="${task.title}" data-index="${index}">
                <input type="number" min="0" class="task-duration" value="${duration}" data-index="${index}" placeholder="Phút">
                <button class="btn-delete delete-task" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="task-row">
                <textarea class="task-note" data-index="${index}" placeholder="Thêm ghi chú cho nhiệm vụ...">${note}</textarea>
            </div>
            <input type="hidden" class="task-done-status" data-index="${index}" value="${isDone}">
        `;
    tasksContainer.appendChild(taskEl);
  });

  // Thêm event listeners cho subject dropdowns
  document.querySelectorAll('.task-subject').forEach(select => {
    select.addEventListener('change', function () {
      const index = this.getAttribute('data-index');
      const subject = this.value;
      const taskTypeContainer = this.parentNode;
      const oldTaskType = taskTypeContainer.querySelector('.task-type, .task-type-input');

      // Tạo field mới cho task type
      const newTaskTypeField = createTaskTypeElement(index, subject, '');

      // Thay thế field cũ
      taskTypeContainer.replaceChild(newTaskTypeField, oldTaskType);
    });
  });

  // Thêm tổng thời gian
  const totalElement = document.createElement("div");
  totalElement.className = "total-duration";
  totalElement.innerHTML = `<strong>Tổng thời gian: ${totalMinutes} phút</strong>`;
  tasksContainer.appendChild(totalElement);
}

function renderTaskTypeField(index, subject, currentType = '') {
  if (subject === 'language') {
    const options = subjectTaskTypes.language.map(type =>
      `<option value="${type.value}" ${currentType === type.value ? 'selected' : ''}>${type.label}</option>`
    ).join('');
    return `<select class="task-type-select" data-index="${index}">${options}</select>`;
  } else {
    // Tạo input với datalist cho gợi ý
    const options = customTaskTypes[subject].map(type =>
      `<option value="${type}">${type}</option>`
    ).join('');

    return `<div class="task-type-container">
      <input type="text" class="task-type-input" 
             value="${currentType}" placeholder="Nhập loại nhiệm vụ" 
             data-index="${index}" data-subject="${subject}"
             autocomplete="off">
      <div class="task-type-suggestions" data-subject="${subject}"></div>
    </div>`;
  }
}

function createTaskTypeElement(index, subject, currentType = '') {
  if (subject === 'language') {
    const select = document.createElement('select');
    select.className = 'task-type-select';
    select.setAttribute('data-index', index);

    subjectTaskTypes.language.forEach(type => {
      const option = document.createElement('option');
      option.value = type.value;
      option.textContent = type.label;
      if (currentType === type.value) option.selected = true;
      select.appendChild(option);
    });

    return select;
  } else {
    const container = document.createElement('div');
    container.className = 'task-type-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-type-input';
    input.setAttribute('data-index', index);
    input.setAttribute('data-subject', subject);
    input.value = currentType;
    input.placeholder = 'Nhập loại nhiệm vụ';
    input.autocomplete = 'off';

    // Tạo dropdown suggestions
    const suggestionsDropdown = document.createElement('div');
    suggestionsDropdown.className = 'task-type-suggestions';
    suggestionsDropdown.setAttribute('data-subject', subject);

    container.appendChild(input);
    container.appendChild(suggestionsDropdown);

    // Chỉ giữ lại event listeners cho hiển thị gợi ý, XÓA phần tự động lưu
    input.addEventListener('focus', () => {
      showSuggestions(input, suggestionsDropdown, subject);
    });

    input.addEventListener('input', () => {
      showSuggestions(input, suggestionsDropdown, subject);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        suggestionsDropdown.style.display = 'none';
      }, 200);
    });

    input.addEventListener('keydown', (e) => {
      handleSuggestionNavigation(e, suggestionsDropdown, input);
    });

    // XÓA phần tự động lưu khi blur
    return container;
  }
}

function showSuggestions(input, dropdown, subject) {
  const value = input.value.toLowerCase();
  const suggestions = customTaskTypes[subject] || [];

  // Filter suggestions based on input
  const filteredSuggestions = value
    ? suggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(value))
    : suggestions;

  // Update dropdown content
  dropdown.innerHTML = '';

  if (filteredSuggestions.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  filteredSuggestions.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = 'task-type-suggestion-item';
    item.textContent = suggestion;
    item.addEventListener('mousedown', () => {
      input.value = suggestion;
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';
}

function handleSuggestionNavigation(e, dropdown, input) {
  const items = dropdown.querySelectorAll('.task-type-suggestion-item');
  if (items.length === 0) return;

  const currentHighlighted = dropdown.querySelector('.highlighted');
  let currentIndex = currentHighlighted ?
    Array.from(items).indexOf(currentHighlighted) : -1;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      currentIndex = (currentIndex + 1) % items.length;
      break;

    case 'ArrowUp':
      e.preventDefault();
      currentIndex = (currentIndex - 1 + items.length) % items.length;
      break;

    case 'Enter':
      e.preventDefault();
      if (currentHighlighted) {
        input.value = currentHighlighted.textContent;
        dropdown.style.display = 'none';
      }
      return;

    case 'Escape':
      dropdown.style.display = 'none';
      return;

    default:
      return;
  }

  // Update highlighting
  items.forEach(item => item.classList.remove('highlighted'));
  if (currentIndex >= 0) {
    items[currentIndex].classList.add('highlighted');
    items[currentIndex].scrollIntoView({ block: 'nearest' });
  }
}

function refreshSuggestions(subject) {
  const allContainers = document.querySelectorAll(`.task-type-container`);

  allContainers.forEach(container => {
    const input = container.querySelector('.task-type-input');
    const dropdown = container.querySelector('.task-type-suggestions');

    if (input && dropdown && input.getAttribute('data-subject') === subject) {
      // Suggestions will be updated on focus/input
    }
  });
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
    <div class="task-row-extended">
      <select class="task-subject" data-index="${taskCount}">
        <option value="language" selected>Ngôn ngữ</option>
        <option value="it">IT</option>
        <option value="other">Khác</option>
      </select>
      ${renderTaskTypeField(taskCount, 'language', '')}
      <input type="text" class="task-input" placeholder="Nhập nhiệm vụ mới" data-index="${taskCount}">
      <input type="number" min="0" class="task-duration" value="30" placeholder="Phút" data-index="${taskCount}">
      <button class="btn-delete delete-task" data-index="${taskCount}">
        <i class="fas fa-trash"></i>
      </button>
    </div>
    <div class="task-row">
      <textarea class="task-note" data-index="${taskCount}" placeholder="Ghi chú..."></textarea>
    </div>
    <input type="hidden" class="task-done-status" data-index="${taskCount}" value="false">
  `;
  tasksContainer.appendChild(taskEl);

  // Thêm event listener cho subject dropdown
  const newSubjectSelect = taskEl.querySelector('.task-subject');
  newSubjectSelect.addEventListener('change', function () {
    const index = this.getAttribute('data-index');
    const subject = this.value;
    const taskRow = this.closest('.task-row-extended');

    // Tìm phần tử task type hiện tại
    const oldTaskType = taskRow.querySelector('.task-type-select, .task-type-container');

    if (oldTaskType) {
      const newTaskTypeField = createTaskTypeElement(index, subject, '');
      taskRow.replaceChild(newTaskTypeField, oldTaskType);
    }
  });
}

async function saveDayData() {
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
  const newTaskTypes = []; // Lưu các task-type mới để thêm vào danh sách

  taskInputs.forEach((input, index) => {
    if (input.value.trim()) {
      const subjectSelect = tasksContainer.querySelector(`.task-subject[data-index="${index}"]`);
      const typeInput = tasksContainer.querySelector(`.task-type-input[data-index="${index}"]`);
      const typeSelect = tasksContainer.querySelector(`.task-type-select[data-index="${index}"]`);
      const durationInput = tasksContainer.querySelector(`.task-duration[data-index="${index}"]`);
      const noteInput = tasksContainer.querySelector(`.task-note[data-index="${index}"]`);
      const doneStatus = tasksContainer.querySelector(`.task-done-status[data-index="${index}"]`);

      if (subjectSelect && durationInput) {
        const subject = subjectSelect.value;
        let taskType = '';

        if (subject === 'language' && typeSelect) {
          taskType = typeSelect.value;
        } else if ((subject === 'it' || subject === 'other') && typeInput) {
          taskType = typeInput.value.trim();
          // Chỉ thêm vào danh sách chờ lưu, chưa lưu ngay
          if (taskType && !customTaskTypes[subject].includes(taskType.toLowerCase())) {
            newTaskTypes.push({ subject, taskType });
          }
        }

        tasks.push({
          title: input.value.trim(),
          done: doneStatus ? doneStatus.value === 'true' : false,
          subject: subject,
          type: taskType,
          duration: parseInt(durationInput.value) || 0,
          note: noteInput ? noteInput.value.trim() : ""
        });
      }
    }
  });

  try {
    const weekNumber = Math.floor((new Date(currentEditingDay) - new Date("2025-07-07")) / (7 * 86400000)) + 1;

    // Lưu dữ liệu nhiệm vụ trước
    await db.ref(`schedule/${currentEditingDay}`).set({
      time: timeStr,
      tasks: tasks,
      weekNumber: weekNumber
    });

    // Sau đó lưu các task-type mới vào customTaskTypes
    if (newTaskTypes.length > 0) {
      for (const { subject, taskType } of newTaskTypes) {
        const normalizedType = taskType.trim().toLowerCase();
        if (!customTaskTypes[subject].includes(normalizedType)) {
          customTaskTypes[subject].push(normalizedType);
          customTaskTypes[subject].sort();
        }
      }
      await saveCustomTaskTypes();
    }

    if (editDayModal) {
      hideModal(editDayModal);
    }
    loadCurrentWeek();
  } catch (error) {
    console.error("Lỗi khi lưu dữ liệu:", error);
    showCustomAlert("Có lỗi xảy ra khi lưu dữ liệu. Vui lòng thử lại!");
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

  const progressFill = document.getElementById('progress-fill');
  const weekProgress = document.getElementById("week-progress");

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
    progressFill.style.transition = 'width 0.5s ease';
  }

  if (weekProgress) weekProgress.textContent = progress + '%';

  const completedCount = document.getElementById('completed-count');
  if (completedCount) completedCount.textContent = completed;
  const totalCount = document.getElementById('total-tasks');
  if (totalCount >= completedCount) totalCount.textContent = total;
}

// ----------------------------
// STATISTICS & CHARTS FUNCTIONS - UPDATED
// ----------------------------

async function migrateOldDataToLanguageCategory() {
  try {
    const snapshot = await db.ref('schedule').once('value');
    const scheduleData = snapshot.val() || {};
    let needsUpdate = false;

    Object.entries(scheduleData).forEach(([date, dayData]) => {
      if (dayData.tasks) {
        dayData.tasks.forEach((task, index) => {
          // Nếu task không có subject nhưng có type thuộc ngôn ngữ
          if (!task.subject && task.type &&
            ['vocabulary', 'grammar', 'kanji', 'reading', 'listening', 'conversation', 'other'].includes(task.type)) {
            task.subject = 'language';
            needsUpdate = true;
          }
          // Nếu task không có subject và type, nhưng title chứa từ khóa ngôn ngữ
          else if (!task.subject && !task.type && task.title) {
            const title = task.title.toLowerCase();
            if (title.match(/nghe|listening|聴解|vocabulary|từ vựng|grammar|ngữ pháp|kanji|đọc|reading|読解|hội thoại|conversation/i)) {
              task.subject = 'language';
              if (!task.type) {
                task.type = detectTaskType(task.title);
              }
              needsUpdate = true;
            }
          }
        });

        if (needsUpdate) {
          db.ref(`schedule/${date}`).update({ tasks: dayData.tasks });
        }
      }
    });

    if (needsUpdate) {
      console.log('Đã cập nhật dữ liệu cũ sang category ngôn ngữ');
    }
  } catch (error) {
    console.error('Lỗi khi migrate dữ liệu:', error);
  }
}

async function getStudyStatistics() {
  try {
    const scheduleSnapshot = await db.ref('schedule').once('value');
    const scheduleData = scheduleSnapshot.val() || {};

    // Tạo bản đồ tiến độ tuần
    const weekProgressMap = new Map();

    // Tạo bản đồ theo subject
    const subjectDistribution = {
      language: 0,
      it: 0,
      other: 0
    };

    // Tạo bản đồ task type động
    const taskTypeDistribution = new Map();
    const taskCategories = new Map();

    // Tạo bản đồ đánh giá kỹ năng ngôn ngữ
    const languageSkills = {
      vocabulary: 0,
      grammar: 0,
      kanji: 0,
      reading: 0,
      listening: 0,
      conversation: 0,
      other: 0
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
        const subject = task.subject || 'other';
        const taskType = task.type || 'other';
        const duration = task.duration || 0;

        // Cập nhật tổng
        totalTasks++;
        weekData.totalTasks++;

        // Cập nhật subject distribution
        if (subjectDistribution[subject] !== undefined) {
          subjectDistribution[subject] += duration;
        }

        // Cập nhật task type distribution
        const key = `${subject}_${taskType}`;
        if (!taskTypeDistribution.has(key)) {
          taskTypeDistribution.set(key, { time: 0, completed: 0, total: 0, subject, type: taskType });
        }
        const taskTypeData = taskTypeDistribution.get(key);
        taskTypeData.time += duration;
        taskTypeData.total++;

        // Cập nhật task categories
        if (!taskCategories.has(taskType)) {
          taskCategories.set(taskType, { completed: 0, total: 0, subject });
        }
        const categoryData = taskCategories.get(taskType);
        categoryData.total++;

        // Cập nhật nhiệm vụ hoàn thành
        if (task.done) {
          completedTasks++;
          weekData.completedTasks++;
          totalStudyTime += duration;
          weekData.studyTime += duration;

          taskTypeData.completed++;
          categoryData.completed++;
        }

        // Cập nhật kỹ năng ngôn ngữ
        if (subject === 'language' && languageSkills[taskType] !== undefined) {
          languageSkills[taskType] += duration;
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

    // Chuyển đánh giá kỹ năng ngôn ngữ sang phần trăm
    const totalLanguageTime = Object.values(languageSkills).reduce((sum, val) => sum + val, 0);
    if (totalLanguageTime > 0) {
      Object.keys(languageSkills).forEach(skill => {
        languageSkills[skill] = Math.round((languageSkills[skill] / totalLanguageTime) * 100);
      });
    }

    // Chuyển subject distribution sang phần trăm
    const totalSubjectTime = Object.values(subjectDistribution).reduce((sum, val) => sum + val, 0);
    if (totalSubjectTime > 0) {
      Object.keys(subjectDistribution).forEach(subject => {
        subjectDistribution[subject] = Math.round((subjectDistribution[subject] / totalSubjectTime) * 100);
      });
    }

    const streakInfo = await calculateStreak();

    return {
      weeklyProgress,
      subjectDistribution,
      languageSkills,
      taskTypeDistribution: Array.from(taskTypeDistribution.values()),
      taskCategories: Array.from(taskCategories.entries()).map(([type, data]) => ({
        type,
        ...data
      })),
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
      subjectDistribution: { language: 0, it: 0, other: 0 },
      languageSkills: {
        vocabulary: 0,
        grammar: 0,
        kanji: 0,
        reading: 0,
        listening: 0,
        conversation: 0,
        other: 0
      },
      taskTypeDistribution: [],
      taskCategories: [],
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

  await displayEffectiveStudyTime();
}

async function calculateStreak() {
  try {
    const [scheduleSnapshot, sessionsSnapshot] = await Promise.all([
      db.ref('schedule').once('value'),
      db.ref('studySessions').once('value')
    ]);

    const scheduleData = scheduleSnapshot.val() || {};
    const sessionsData = sessionsSnapshot.val() || {};

    const studyDates = [];

    Object.entries(scheduleData).forEach(([date, dayData]) => {
      if (dayData.tasks && dayData.tasks.some(task => task.done)) {
        studyDates.push(date);
      }
    });

    Object.entries(sessionsData).forEach(([date, sessions]) => {
      const hasCompletedSession = Object.values(sessions).some(
        session => session.type === "completed" && (session.duration || 0) > 0
      );
      if (hasCompletedSession && !studyDates.includes(date)) {
        studyDates.push(date);
      }
    });

    studyDates.sort();

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
          currentStreak = 1;
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

// UPDATED CHART FUNCTIONS
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
          label: 'Thời gian học (giờ)',
          data: weeklyData.map(item => Math.round(item.studyTime / 60)),
          type: 'line',
          borderColor: 'rgba(253, 187, 45, 1)',
          backgroundColor: 'rgba(253, 187, 45, 0.2)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(253, 187, 45, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          yAxisID: 'y1'
        },
        {
          label: 'Tỷ lệ hoàn thành (%)',
          data: weeklyData.map(item => item.progress),
          backgroundColor: 'rgba(26, 42, 108, 0.8)',
          borderColor: 'rgba(26, 42, 108, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Tỷ lệ hoàn thành (%)' },
          position: 'left',
          grid: { color: 'rgba(0,0,0,0.1)' }
        },
        y1: {
          beginAtZero: true,
          title: { display: true, text: 'Giờ học' },
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: 'rgba(253, 187, 45, 1)' }
        },
        x: {
          grid: { color: 'rgba(0,0,0,0.1)' }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true }
        },
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

function initSubjectDistributionChart(distributionData) {
  const ctx = document.getElementById('timeDistributionChart')?.getContext('2d');
  if (!ctx || !distributionData) return;

  if (timeDistributionChart) {
    timeDistributionChart.destroy();
  }

  // Determine if we're showing subject distribution or task type distribution
  const isSubjectDistribution = currentTimeFilter === 'all';

  let labels, data, backgroundColor;

  if (isSubjectDistribution) {
    // Subject distribution (for 'all' filter)
    labels = Object.keys(distributionData).map(key => {
      const translations = {
        'language': 'Ngôn ngữ',
        'it': 'Công nghệ thông tin',
        'other': 'Khác'
      };
      return translations[key] || key;
    });

    data = Object.values(distributionData);
    backgroundColor = [
      '#1a2a6c',  // Language - Xanh đậm
      '#4caf50',  // IT - Xanh lá
      '#ff9800'   // Other - Cam
    ];
  } else {
    // Task type distribution (for specific subject filter)
    labels = Object.keys(distributionData).map(key => {
      const translations = {
        'vocabulary': 'Từ vựng',
        'grammar': 'Ngữ pháp',
        'kanji': 'Kanji',
        'reading': 'Đọc hiểu',
        'listening': 'Nghe hiểu',
        'conversation': 'Hội thoại',
        'other': 'Khác',
        // Add more translations for IT and Other task types as needed
      };
      return translations[key] || key;
    });

    data = Object.values(distributionData);

    // Generate colors for task types
    backgroundColor = generateColors(Object.keys(distributionData).length);
  }

  timeDistributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColor,
        borderWidth: 0,
        borderRadius: 8,
        hoverBorderWidth: 3,
        hoverBorderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            font: { size: 14 },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const value = ctx.raw;
              const percentage = Math.round((value / total) * 100);
              return `${ctx.label}: ${percentage}% thời gian`;
            }
          }
        }
      }
    }
  });
}

// Helper function to generate colors for task types
function generateColors(count) {
  const colors = [];
  const hueStep = 360 / count;

  for (let i = 0; i < count; i++) {
    const hue = i * hueStep;
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }

  return colors;
}

function initSkillRadarChart(chartData) {
  const ctx = document.getElementById('skillRadarChart')?.getContext('2d');
  if (!ctx) return;

  if (skillRadarChart) {
    skillRadarChart.destroy();
  }

  // Determine if we're showing subject distribution or skill distribution
  const isSubjectDistribution = currentSkillFilter === 'all';

  let labels, data;

  if (isSubjectDistribution) {
    // Show subject distribution when "all" is selected
    labels = Object.keys(chartData).map(key => {
      const translations = {
        'language': 'Ngôn ngữ',
        'it': 'Công nghệ thông tin',
        'other': 'Khác'
      };
      return translations[key] || key;
    });

    data = Object.values(chartData);
  } else {
    // Show skill distribution for specific subject
    labels = Object.keys(chartData).map(key => {
      const translations = {
        'vocabulary': 'Từ vựng',
        'grammar': 'Ngữ pháp',
        'kanji': 'Kanji',
        'reading': 'Đọc hiểu',
        'listening': 'Nghe hiểu',
        'conversation': 'Hội thoại',
        'other': 'Khác'
      };
      return translations[key] || key;
    });

    data = Object.values(chartData);
  }

  skillRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: isSubjectDistribution ? 'Phân bố thời gian theo môn (%)' : 'Phân bố thời gian theo kỹ năng (%)',
        data: data,
        backgroundColor: 'rgba(26, 42, 108, 0.2)',
        borderColor: 'rgba(26, 42, 108, 1)',
        pointBackgroundColor: 'rgba(253, 187, 45, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(26, 42, 108, 1)',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            callback: value => `${value}%`,
            font: { size: 11 }
          },
          grid: { color: 'rgba(0,0,0,0.1)' },
          angleLines: { color: 'rgba(0,0,0,0.1)' }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 } }
        },
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

  if (categories.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #666;">
        <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
        <p>Chưa có dữ liệu bài tập. Hãy hoàn thành một số nhiệm vụ để xem thống kê!</p>
      </div>
    `;
    return;
  }

  const translations = {
    'vocabulary': 'Từ vựng',
    'grammar': 'Ngữ pháp',
    'kanji': 'Kanji',
    'reading': 'Đọc hiểu',
    'listening': 'Nghe hiểu',
    'conversation': 'Hội thoại',
    'other': 'Khác'
  };

  const subjectIcons = {
    'language': 'fas fa-language',
    'it': 'fas fa-laptop-code',
    'other': 'fas fa-book'
  };

  categories.forEach(category => {
    const displayName = translations[category.type] || category.type;
    const progress = category.total > 0 ? Math.round((category.completed / category.total) * 100) : 0;
    const icon = subjectIcons[category.subject] || 'fas fa-book';

    const card = document.createElement('div');
    card.className = 'task-category-card';
    card.innerHTML = `
      <h4><i class="${icon}"></i> ${displayName}</h4>
      <div class="task-category-stats">
        <span>${category.completed}/${category.total} bài</span>
        <span>${progress}% hoàn thành</span>
      </div>
      <div class="task-category-progress">
        <div class="task-category-progress-bar" style="width: ${progress}%"></div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function displayEffectiveStudyTime() {
  const dailyTaskEl = document.getElementById('daily-study-time-task');
  const dailySessionEl = document.getElementById('daily-study-time-session');
  const weeklyTaskEl = document.getElementById('weekly-study-time-task');
  const weeklySessionEl = document.getElementById('weekly-study-time-session');

  if (!dailyTaskEl || !dailySessionEl || !weeklyTaskEl || !weeklySessionEl) return;

  try {
    const analysis = await analyzeStudyPatterns();

    const formatTime = (minutes) => {
      if (minutes === 0) return "0m";
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    dailyTaskEl.textContent = formatTime(analysis.dailyStudyTimeTask);
    dailySessionEl.textContent = formatTime(analysis.dailyStudyTimeSession);
    weeklyTaskEl.textContent = formatTime(analysis.weeklyStudyTimeTask);
    weeklySessionEl.textContent = formatTime(analysis.weeklyStudyTimeSession);
  } catch (error) {
    console.error("Lỗi khi hiển thị thời gian học hiệu quả:", error);
    dailyTaskEl.textContent = "0m";
    dailySessionEl.textContent = "0m";
    weeklyTaskEl.textContent = "0h";
    weeklySessionEl.textContent = "0h";
  }
}

async function analyzeStudyPatterns() {
  try {
    const [scheduleSnapshot, sessionsSnapshot] = await Promise.all([
      db.ref('schedule').once('value'),
      db.ref('studySessions').once('value')
    ]);

    const scheduleData = scheduleSnapshot.val() || {};
    const sessionsData = sessionsSnapshot.val() || {};

    let dailyStudyTimeTask = 0;
    let weeklyStudyTimeTask = 0;
    let dailyStudyTimeSession = 0;
    let weeklyStudyTimeSession = 0;

    const todayKey = formatDate(new Date());
    const weekStart = getStartOfWeek(new Date());

    // Tính từ completed tasks
    Object.entries(scheduleData).forEach(([date, dayData]) => {
      if (!dayData.tasks) return;

      const isToday = date === todayKey;
      const isThisWeek = new Date(date) >= weekStart;

      dayData.tasks.forEach(task => {
        if (task.done) {
          const duration = task.duration || 0;

          if (isToday) dailyStudyTimeTask += duration;
          if (isThisWeek) weeklyStudyTimeTask += duration;
        }
      });
    });

    // Tính từ study sessions
    Object.entries(sessionsData).forEach(([date, sessions]) => {
      const isToday = date === todayKey;
      const isThisWeek = new Date(date) >= weekStart;

      Object.values(sessions).forEach(session => {
        if (session.type === "completed") {
          const duration = parseInt(session.duration) || 0;

          if (isToday) dailyStudyTimeSession += duration;
          if (isThisWeek) weeklyStudyTimeSession += duration;
        }
      });
    });

    return {
      dailyStudyTimeTask,
      dailyStudyTimeSession,
      weeklyStudyTimeTask,
      weeklyStudyTimeSession,
      bestTime: "Chưa có dữ liệu"
    };
  } catch (error) {
    console.error("Lỗi phân tích dữ liệu:", error);
    return {
      dailyStudyTimeTask: 0,
      dailyStudyTimeSession: 0,
      weeklyStudyTimeTask: 0,
      weeklyStudyTimeSession: 0,
      bestTime: "Chưa có dữ liệu"
    };
  }
}

async function initCharts() {
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

  // Apply filters to charts
  const filteredStats = filterStatsBySubject(stats, currentSkillFilter, currentTimeFilter);

  // Determine which data to use for each chart
  const skillChartData = currentSkillFilter === 'all' ?
    filteredStats.subjectDistribution : filteredStats.languageSkills;

  const timeChartData = currentTimeFilter === 'all' ?
    filteredStats.subjectDistribution : filteredStats.subjectDistribution;

  initProgressChart(filteredStats.weeklyProgress);
  initSubjectDistributionChart(timeChartData);
  initSkillRadarChart(skillChartData);
  displayTaskCategories(filteredStats.taskCategories);
  await displayEffectiveStudyTime();
}

function filterStatsBySubject(stats, skillFilter, timeFilter) {
  const filtered = { ...stats };

  // Filter skill radar chart data
  if (skillFilter !== 'all') {
    // Keep only the selected subject's task types
    const subjectTasks = stats.taskCategories.filter(task => task.subject === skillFilter);
    const taskTypes = subjectTasks.map(task => task.type);

    // Filter language skills
    const filteredSkills = {};
    Object.keys(stats.languageSkills).forEach(skill => {
      if (taskTypes.includes(skill)) {
        filteredSkills[skill] = stats.languageSkills[skill];
      }
    });
    filtered.languageSkills = filteredSkills;

    // Filter task categories
    filtered.taskCategories = subjectTasks;
  }

  // Filter time distribution chart data
  if (timeFilter !== 'all') {
    // Calculate task type distribution for the selected subject
    const subjectTaskTypes = {};
    let totalSubjectTime = 0;

    // Calculate total time for the subject
    stats.taskTypeDistribution.forEach(item => {
      if (item.subject === timeFilter) {
        totalSubjectTime += item.time;
      }
    });

    // Calculate percentages for each task type
    stats.taskTypeDistribution.forEach(item => {
      if (item.subject === timeFilter) {
        subjectTaskTypes[item.type] = Math.round((item.time / totalSubjectTime) * 100);
      }
    });

    // For IT and Other subjects, use task type distribution
    if (timeFilter === 'it' || timeFilter === 'other') {
      filtered.subjectDistribution = subjectTaskTypes;
    }
    // For Language, use language skills distribution
    else if (timeFilter === 'language') {
      filtered.subjectDistribution = stats.languageSkills;
    }
  }

  return filtered;
}

// ----------------------------
// COUNTDOWN/TIMER FUNCTIONS
// ----------------------------

function startStudySession() {
  sessionStartTime = new Date();
  const sessionKey = `session_${Date.now()}`;
  const dateKey = formatDate(sessionStartTime);

  sessionTimers[sessionKey] = {
    start: sessionStartTime,
    end: null,
    duration: 0,
    type: "active"
  };

  db.ref(`studySessions/${dateKey}/${sessionKey}`).set({
    start: sessionStartTime.getTime(),
    end: null,
    duration: 0,
    type: "active"
  });
}

async function endStudySession() {
  if (!sessionStartTime) return;

  const endTime = new Date();
  const duration = Math.floor((endTime - sessionStartTime) / 60000);
  const dateKey = formatDate(sessionStartTime);

  const sessionKey = `session_${Date.now()}`;

  try {
    await db.ref(`studySessions/${dateKey}/${sessionKey}`).update({
      end: endTime.getTime(),
      duration: duration,
      type: duration >= parseInt(studyMinutesInput.value) ? "completed" : "interrupted"
    });

    await updateStudyStats(dateKey, duration);
  } catch (error) {
    console.error("Lỗi khi kết thúc phiên học:", error);
  }

  sessionStartTime = null;
}

async function updateStudyStats(dateKey, duration) {
  const date = new Date(dateKey);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const weekNumber = getWeekNumber(date);
  const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

  const dailyRef = db.ref(`userStats/daily/${monthKey}/${date.getDate()}`);
  const dailySnapshot = await dailyRef.once('value');
  const currentDaily = dailySnapshot.val() || 0;
  await dailyRef.set(currentDaily + duration);

  const weeklyRef = db.ref(`userStats/weekly/${weekKey}`);
  const weeklySnapshot = await weeklyRef.once('value');
  const currentWeekly = weeklySnapshot.val() || 0;
  await weeklyRef.set(currentWeekly + duration);

  const monthlyRef = db.ref(`userStats/monthly/${monthKey}`);
  const monthlySnapshot = await monthlyRef.once('value');
  const currentMonthly = monthlySnapshot.val() || 0;
  await monthlyRef.set(currentMonthly + duration);
}

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

  const diffTime = examDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const remainingDaysElement = document.querySelector('.stat-card:nth-child(3) .stat-value');
  if (remainingDaysElement) {
    remainingDaysElement.textContent = diffDays > 0 ? diffDays : "0";
  }
}

function setupEventListeners() {
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
      stopTimer();
    });
  }

  if (closeCountdownModal) {
    closeCountdownModal.addEventListener("click", () => {
      hideModal(countdownModal);
      stopTimer();
    });
  }

  if (closeBreakModalBtn) {
    closeBreakModalBtn.addEventListener('click', () => {
      hideModal(breakModal);
      stopNotificationSound();
    });
  }

  if (startBreakBtn) {
    startBreakBtn.addEventListener('click', () => {
      hideModal(breakModal);
      showModal(countdownModal);
      startBreakTimer();
    });
  }

  if (breakModal) {
    window.addEventListener('click', (event) => {
      if (event.target === breakModal) {
        hideBreakModal();
        stopNotificationSound();
        console.log('Người dùng đã click ra ngoài để đóng modal nghỉ ngơi.');
      }
    });
  }

  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", addNewTask);
  }

  if (saveDayBtn) {
    saveDayBtn.addEventListener("click", saveDayData);
  }

  if (closeEditModal) {
    closeEditModal.addEventListener("click", (e) => {
      e.preventDefault();
      hideModal(editDayModal);
    });

    if (editDayModal) {
      window.addEventListener('click', (event) => {
        if (event.target === editDayModal) {
          hideModal(editDayModal);
        }
      });
    }

    document.addEventListener("click", (e) => {
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

      if (e.target.closest(".edit-task-btn")) {
        const card = e.target.closest(".day-card");
        if (card) {
          const date = card.getAttribute("data-date");
          if (date) openEditDayModal(date);
        }
      }
    });

    if (tasksContainer) {
      tasksContainer.addEventListener("click", (e) => {
        if (e.target.closest(".delete-task")) {
          e.target.closest(".task-item")?.remove();
        }
      });
    }
  }
}

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

async function toggleTaskDone(date, taskIndex) {
  try {
    const ref = db.ref(`schedule/${date}/tasks/${taskIndex}`);
    const snapshot = await ref.once('value');
    const currentDone = snapshot.val().done;

    await ref.update({ done: !currentDone });

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

    updateProgress();

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

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  if (timerDisplay) {
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

function startTimer() {
  if (isPaused) {
    timerStartTime = new Date().getTime() - (timerDuration - timeLeft) * 1000;
    isPaused = false;
  } else {
    startStudySession();
    timerDuration = isStudyPhase
      ? parseInt(studyMinutesInput.value) * 60
      : parseInt(breakMinutesInput.value) * 60;
    timerStartTime = new Date().getTime();
  }
  console.log('Bắt đầu đếm ngược');
  updateTimerDisplay();
  startTimerBtn.style.display = 'none';
  pauseTimerBtn.style.display = 'inline-block';
  stopTimerBtn.style.display = 'inline-block';

  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    if (!isPaused) {
      const now = new Date().getTime();
      const elapsed = Math.floor((now - timerStartTime) / 1000);
      timeLeft = timerDuration - elapsed;

      if (timeLeft <= 0) {
        handleTimerCompletion();
      }
      updateTimerDisplay();
    }
  }, 200);
}

function pauseTimer() {
  isPaused = true;
  clearInterval(countdownInterval);
  if (timerStatus) timerStatus.textContent = isStudyPhase ? 'Đã tạm dừng học.' : 'Đã tạm dừng nghỉ.';
  startTimerBtn.style.display = 'inline-block';
  pauseTimerBtn.style.display = 'none';
  console.log('Tạm dừng đếm ngược');
}

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

  console.log('Dừng đếm ngược');
  stopNotificationSound();
  console.log('Dừng âm thanh');
}

function startBreakTimer() {
  hideModal(breakModal);
  isStudyPhase = false;
  timeLeft = parseInt(breakMinutesInput.value) * 60;
  timerStartTime = new Date().getTime();

  showModal(countdownModal);

  if (timerStatus) timerStatus.textContent = 'Đang nghỉ...';
  updateTimerDisplay();
  startTimer();
  console.log('Chuyển sang nghỉ');
}

function updateBreakMessage(studyMinutes, breakMinutes) {
  const breakMessage = document.getElementById('break-message');
  if (breakMessage) {
    breakMessage.textContent =
      `Bạn đã học liên tục ${studyMinutes} phút. Hãy nghỉ ngơi ${breakMinutes} phút để nạp năng lượng.`;
  }
}

// Cập nhật hàm handleTimerCompletion để có âm thanh báo
function handleTimerCompletion() {
  clearInterval(countdownInterval);

  if (isStudyPhase) {
    isStudyPhase = false;
    timerDuration = parseInt(breakMinutesInput.value) * 60;
    timerStartTime = new Date().getTime();

    isManualClose = false;
    showModal(breakModal);

    if (document.hidden) {
      showNotification("⏰ Hết giờ học!", `Đã hoàn thành ${studyMinutesInput.value} phút học tập!`);
    }
  } else {
    stopTimer();
    if (document.hidden) {
      showNotification("🔄 Hết giờ nghỉ!", `Đã nghỉ ${breakMinutesInput.value} phút. Sẵn sàng học tiếp!`);
    }
  }

  // Phát âm thanh báo với nhiều âm thanh dự phòng
  if (Notification.permission === 'granted') {
    playNotificationSound();
  }

  // Thêm rung cho thiết bị di động nếu hỗ trợ
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

// Cập nhật hàm playNotificationSound với nhiều âm thanh dự phòng
function playNotificationSound() {
  try {
    if (notificationAudio) {
      notificationAudio.pause();
      notificationAudio.currentTime = 0;
    }

    // Danh sách âm thanh dự phòng
    const soundUrls = [
      'https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3',
      'https://assets.mixkit.co/sfx/preview/mixkit-bell-notification-933.mp3',
      'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3',
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+zuwGQyCP....'
    ];

    // Thử phát âm thanh từ danh sách
    const playSound = (index = 0) => {
      if (index >= soundUrls.length) {
        console.log('Không thể phát âm thanh thông báo');
        return;
      }

      notificationAudio = new Audio(soundUrls[index]);
      notificationAudio.volume = 0.7;

      const playPromise = notificationAudio.play();

      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('Phát âm thanh thành công!');
        }).catch(error => {
          console.log(`Thử âm thanh tiếp theo (${index + 1})`);
          playSound(index + 1);
        });
      }
    };

    playSound();

  } catch (error) {
    console.error("Lỗi khi phát âm thanh:", error);

    // Fallback: tạo âm thanh bằng Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);

      console.log('Phát âm thanh dự phòng bằng Web Audio API');
    } catch (webAudioError) {
      console.error("Không thể phát âm thanh:", webAudioError);
    }
  }
}

function showNotification(title, message) {
  if (!("Notification" in window)) {
    console.log("Trình duyệt không hỗ trợ thông báo");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, { body: message });
  }
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body: message });
      }
    });
  }
}

function stopNotificationSound() {
  if (notificationAudio) {
    notificationAudio.pause();
    console.log('Dừng âm thanh thông báo.');
    notificationAudio.currentTime = 0;
  }
}

function setupRealTimeListeners() {
  db.ref('schedule').on('value', async () => {
    const newStreak = await calculateStreak();
    updateStreakDisplay(newStreak);
  });

  db.ref('studySessions').on('value', async () => {
    const newStreak = await calculateStreak();
    updateStreakDisplay(newStreak);
  });
}

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

////////////////////////////
//   QUẢN LÝ TÀI NGUYÊN   //
////////////////////////////

async function loadResources() {
  try {
    const snapshot = await db.ref('resources').once('value');
    const data = snapshot.val();

    if (data) {
      resourcesData = data;
    } else {
      // Dữ liệu mặc định
      resourcesData = {
        textbook: [
          { name: 'Shin Kanzen Master N1', url: 'https://drive.google.com/drive/folders/18pEPRYZCFwDM1mfG-Ul8LxIkrQjNuAYc?usp=sharing' },
          { name: 'Soumatome N1', url: 'https://drive.google.com/drive/folders/1A53-PaWkIfyKqYBrDeEI3PPHnAQMUjU8?usp=sharing' }
        ],
        listening: [
          { name: 'NHK News Web Easy', url: 'https://www3.nhk.or.jp/news/easy/' },
          { name: 'Super Native Japanese', url: 'https://supernative.tv/ja/' },
          { name: 'Nihongo con Teppei', url: 'https://nihongoconteppei.com/' }
        ],
        website: [
          { name: 'Log Excel', url: 'https://docs.google.com/spreadsheets/d/1_blVZly36X8U-23NPxMeUjpf4n7c5YVv/edit?usp=sharing&ouid=102464601056562595135&rtpof=true&sd=true' },
          { name: 'Recall Card', url: 'https://recall.cards/app' },
          { name: 'Flashcard Web Cá Nhân', url: 'https://flashcard-ashen-three.vercel.app/' },
          { name: 'Flashcard Web Tiengnhatdongian', url: 'https://www.tiengnhatdongian.com/flashcard-category/jlpt-n2/flashcard-2500-tu-vung-n2/' }
        ]
      };

      await db.ref('resources').set(resourcesData);
    }

    renderResourcesDisplay();
  } catch (error) {
    console.error('Lỗi khi tải tài nguyên:', error);
  }
}

function renderResourcesDisplay() {
  const container = document.getElementById('resources-display');
  if (!container) return;

  const categories = {
    textbook: { title: 'Sách giáo trình', icon: 'fas fa-book-open' },
    listening: { title: 'Tài nguyên nghe', icon: 'fas fa-headphones' },
    website: { title: 'Website & Ứng dụng', icon: 'fas fa-laptop' }
  };

  let html = '';

  Object.entries(categories).forEach(([categoryKey, categoryInfo]) => {
    const resources = resourcesData[categoryKey] || [];

    html += `
      <div class="resource-display-category">
        <h3><i class="${categoryInfo.icon}"></i> ${categoryInfo.title}</h3>
        <ul class="resource-list">
    `;

    resources.forEach(resource => {
      const icon = categoryKey === 'textbook' ? 'fas fa-book' :
        categoryKey === 'listening' ? 'fas fa-podcast' :
          'fas fa-globe';

      html += `
        <li class="resource-display-item">
          <i class="${icon}"></i>
          <a href="${resource.url}" target="_blank" rel="noopener noreferrer">${resource.name}</a>
        </li>
      `;
    });

    html += `
        </ul>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderResourcesEdit() {
  const categories = {
    textbook: { container: 'textbook-resources', title: 'Sách giáo trình' },
    listening: { container: 'listening-resources', title: 'Tài nguyên nghe' },
    website: { container: 'website-resources', title: 'Website & Ứng dụng' }
  };

  Object.entries(categories).forEach(([categoryKey, categoryInfo]) => {
    const container = document.getElementById(categoryInfo.container);
    if (!container) return;

    const resources = resourcesData[categoryKey] || [];

    let html = '';

    resources.forEach((resource, index) => {
      html += `
        <div class="resource-item-edit">
          <input type="text" class="resource-name" value="${resource.name}" 
                 data-category="${categoryKey}" data-index="${index}" placeholder="Tên tài nguyên">
          <input type="url" class="resource-url" value="${resource.url}" 
                 data-category="${categoryKey}" data-index="${index}" placeholder="URL">
          <button class="btn-delete-resource" data-category="${categoryKey}" data-index="${index}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  });
}

async function saveResources() {
  try {
    // Lấy dữ liệu từ form
    const resourceInputs = document.querySelectorAll('.resource-item-edit');
    const newResourcesData = { textbook: [], listening: [], website: [] };

    resourceInputs.forEach(input => {
      const nameInput = input.querySelector('.resource-name');
      const urlInput = input.querySelector('.resource-url');
      const category = nameInput.getAttribute('data-category');

      if (nameInput.value.trim() && urlInput.value.trim()) {
        newResourcesData[category].push({
          name: nameInput.value.trim(),
          url: urlInput.value.trim()
        });
      }
    });

    // Lưu vào Firebase
    await db.ref('resources').set(newResourcesData);
    resourcesData = newResourcesData;

    // Cập nhật hiển thị
    renderResourcesDisplay();
    hideModal(document.getElementById('manage-resources-modal'));

    showCustomAlert('Đã lưu tài nguyên thành công!');
  } catch (error) {
    console.error('Lỗi khi lưu tài nguyên:', error);
    showCustomAlert('Có lỗi xảy ra khi lưu tài nguyên!');
  }
}

// Thêm event listeners cho quản lý tài nguyên
function setupResourcesEventListeners() {
  // Nút chỉnh sửa tài nguyên
  document.getElementById('edit-resources-btn')?.addEventListener('click', () => {
    renderResourcesEdit();
    showModal(document.getElementById('manage-resources-modal'));
  });

  // Nút đóng modal tài nguyên
  document.getElementById('close-resources-modal')?.addEventListener('click', () => {
    hideModal(document.getElementById('manage-resources-modal'));
  });

  // Nút lưu tài nguyên
  document.getElementById('save-resources')?.addEventListener('click', saveResources);

  // Nút thêm tài nguyên
  document.querySelectorAll('.add-resource-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const category = this.getAttribute('data-category');
      const container = document.getElementById(`${category}-resources`);

      const newItem = document.createElement('div');
      newItem.className = 'resource-item-edit';
      newItem.innerHTML = `
        <input type="text" class="resource-name" data-category="${category}" 
               data-index="new" placeholder="Tên tài nguyên">
        <input type="url" class="resource-url" data-category="${category}" 
               data-index="new" placeholder="URL">
        <button class="btn-delete-resource">
          <i class="fas fa-trash"></i>
        </button>
      `;

      container.appendChild(newItem);
    });
  });

  // Xóa tài nguyên (delegate)
  document.addEventListener('click', function (e) {
    if (e.target.closest('.btn-delete-resource')) {
      const btn = e.target.closest('.btn-delete-resource');
      const item = btn.closest('.resource-item-edit');
      item.remove();
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopNotificationSound();
  } else {
    if (!isManualClose && !isStudyPhase && timeLeft > 0) {
      showModal(breakModal);
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && timerStartTime) {
    const now = new Date().getTime();
    const elapsed = Math.floor((now - timerStartTime) / 1000);
    timeLeft = Math.max(timerDuration - elapsed, 0);
    updateTimerDisplay();

    if (timeLeft <= 0) {
      handleTimerCompletion();
    }
  }
});

function initTools() {
  console.log('Đã khởi tạo tab công cụ');
}

// Initialize the app
document.addEventListener("DOMContentLoaded", async () => {
  currentWeekStart = getStartOfWeek();
  updateRemainingDays();
  await loadCustomTaskTypes();

  loadCurrentWeek();
  setupEventListeners();
  setupTabNavigation();
  setupRealTimeListeners();

  if (studyMinutesInput) {
    timeLeft = parseInt(studyMinutesInput.value) * 60;
    updateTimerDisplay();
  }

  migrateOldDataToLanguageCategory();
  loadResources();
  setupResourcesEventListeners();

  document.body.addEventListener('click', () => {
    const dummyAudio = new Audio();
    dummyAudio.play().then(() => {
      console.log("Âm thanh đã được mở khóa");
    }).catch(e => {
      console.log("Người dùng cần tương tác trước khi phát âm thanh");
    });
  }, { once: true });

  // Khởi tạo biểu đồ
  initCharts();

  // Cập nhật thời gian học hiệu quả
  displayEffectiveStudyTime();
});