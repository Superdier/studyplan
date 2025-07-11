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
            Tuần ${weekIndex}: ${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}
            <span class="phase-badge">Củng cố N2</span>
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
    
    tasks.forEach((task, index) => {
        const taskEl = document.createElement("div");
        taskEl.className = "task-item";
        taskEl.innerHTML = `
            <input type="text" class="task-input" value="${task.title}" data-index="${index}">
            <button class="btn-delete delete-task" data-index="${index}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        tasksContainer.appendChild(taskEl);
    });
}

function addNewTask() {
    if (!tasksContainer) return;
    
    const taskEl = document.createElement("div");
    taskEl.className = "task-item";
    taskEl.innerHTML = `
        <input type="text" class="task-input" placeholder="Nhập nhiệm vụ mới">
        <button class="btn-delete delete-task">
            <i class="fas fa-trash"></i>
        </button>
    `;
    tasksContainer.appendChild(taskEl);
}

async function saveDayData() {
    if (!currentEditingDay || !studyDurationInput || !tasksContainer) return;
    
    const minutes = parseInt(studyDurationInput.value) || 0;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    const timeStr = hours > 0 
        ? `Thời gian: ${hours} giờ ${remainingMins} phút` 
        : `Thời gian: ${minutes} phút`;
    
    const tasks = [];
    const taskInputs = tasksContainer.querySelectorAll(".task-input");
    
    taskInputs.forEach(input => {
        if (input.value.trim()) {
            tasks.push({
                title: input.value.trim(),
                done: false,
                type: detectTaskType(input.value.trim())
            });
        }
    });
    
    try {
        await db.ref(`schedule/${currentEditingDay}`).set({
            time: timeStr,
            tasks: tasks
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