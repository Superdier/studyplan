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

// App Variables
let currentWeekStart = new Date("2025-07-07");
let currentEditingDay = null;
let notificationAudio = null;
let isManualClose = false;
let currentPhaseId = null; // Track current phase
let basePhaseStartDate = new Date("2025-07-07"); // Ngày bắt đầu chặng (động)
let currentPhaseTotalWeeks = 21; // Tổng số tuần của chặng (động)
let currentPhaseWeeklyGoal = 0; // Mục tiêu giờ học mỗi tuần

// Email Reminder Variables
let reminderConfig = {
  enabled: false,
  email: "",
  times: [] // Array of strings "HH:MM"
};

// ----------------------------
// EMAIL REMINDER SYSTEM
// ----------------------------

function initReminderSystem() {
  // Khởi tạo EmailJS (Thay thế bằng Public Key của bạn)
  // Bạn cần đăng ký tại emailjs.com để lấy key
  try {
    emailjs.init("5efp51mSAgISD--du"); // <--- THAY THẾ PUBLIC KEY Ở ĐÂY
  } catch (e) {
    console.error("EmailJS init error:", e);
  }

  // Tải cấu hình từ LocalStorage
  const savedConfig = localStorage.getItem('studyPlanReminderConfig');
  if (savedConfig) {
    reminderConfig = JSON.parse(savedConfig);
  }

  // Thiết lập Event Listeners
  document.getElementById('reminder-settings-btn')?.addEventListener('click', () => {
    openReminderModal();
  });

  document.getElementById('close-reminder-modal')?.addEventListener('click', () => {
    hideModal(document.getElementById('reminder-settings-modal'));
  });

  document.getElementById('save-reminder-settings')?.addEventListener('click', saveReminderSettings);
  
  document.getElementById('test-email-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('reminder-email').value;
    if (!email) return showCustomAlert("Vui lòng nhập email trước khi thử.");
    await checkAndSendEmail(true, email); // Force send
  });

  // Bắt đầu bộ đếm thời gian kiểm tra mỗi phút
  setInterval(checkScheduledReminders, 60000);
}

function openReminderModal() {
  const modal = document.getElementById('reminder-settings-modal');
  document.getElementById('reminder-enabled').checked = reminderConfig.enabled;
  document.getElementById('reminder-email').value = reminderConfig.email || '';
  document.getElementById('reminder-times').value = reminderConfig.times.join(', ');
  showModal(modal);
}

function saveReminderSettings() {
  const enabled = document.getElementById('reminder-enabled').checked;
  const email = document.getElementById('reminder-email').value.trim();
  const timesStr = document.getElementById('reminder-times').value.trim();

  // Validate time format HH:MM
  const times = timesStr.split(',').map(t => t.trim()).filter(t => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t));

  if (enabled && !email) {
    showCustomAlert("Vui lòng nhập email để bật nhắc nhở.");
    return;
  }

  reminderConfig = { enabled, email, times };
  localStorage.setItem('studyPlanReminderConfig', JSON.stringify(reminderConfig));
  
  hideModal(document.getElementById('reminder-settings-modal'));
  showCustomAlert("Đã lưu cài đặt nhắc nhở!");
}

function checkScheduledReminders() {
  if (!reminderConfig.enabled || !reminderConfig.email || reminderConfig.times.length === 0) return;

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  if (reminderConfig.times.includes(currentTime)) {
    checkAndSendEmail();
  }
}

async function checkAndSendEmail(force = false, overrideEmail = null) {
  const todayStr = getTodayDateString();
  const emailToSend = overrideEmail || reminderConfig.email;

  // Lấy dữ liệu tasks của ngày hôm nay (Raw data)
  let tasks = [];
  try {
    // Logic lấy task tương tự loadScheduleDataFromAllPhases nhưng chỉ lấy data
    // 1. Global
    const globalSnap = await db.ref(`schedule/${todayStr}`).once("value");
    if (globalSnap.exists() && globalSnap.val().tasks) tasks = tasks.concat(globalSnap.val().tasks);

    // 2. Phases
    const phasesSnap = await db.ref('phases').once("value");
    if (phasesSnap.exists()) {
      const allPhases = phasesSnap.val();
      for (const phaseId of Object.keys(allPhases)) {
        const pSnap = await db.ref(`phaseData/${phaseId}/schedule/${todayStr}`).once("value");
        if (pSnap.exists() && pSnap.val().tasks) tasks = tasks.concat(pSnap.val().tasks);
      }
    }
  } catch (e) {
    console.error("Error fetching tasks for email:", e);
  }

  // Lọc task trùng lặp
  const uniqueTasks = tasks.filter((task, index, self) =>
      index === self.findIndex((t) => (t.title === task.title))
  );

  let message = "";
  let subject = "";

  const d = new Date();
  const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;

  if (uniqueTasks.length === 0) {
    // Trường hợp chưa có nhiệm vụ
    subject = `⚠️ [${dateStr}] Bạn chưa có kế hoạch học tập cho hôm nay!`;
    message = "Chào bạn,\n\nHôm nay bạn chưa thêm nhiệm vụ nào vào Study Plan. Hãy dành chút thời gian để lên kế hoạch học tập nhé!\n\nTruy cập ngay: " + window.location.href;
  } else {
    // Trường hợp đã có nhiệm vụ -> Gửi danh sách và tiến độ
    const completed = uniqueTasks.filter(t => t.done).length;
    const total = uniqueTasks.length;
    const pending = uniqueTasks.filter(t => !t.done);

    subject = `📅 [${dateStr}] Nhắc nhở học tập: Hoàn thành ${completed}/${total} nhiệm vụ`;
    
    let taskListStr = pending.length > 0 ? "Các nhiệm vụ cần làm:\n" : "Chúc mừng! Bạn đã hoàn thành hết nhiệm vụ:\n";
    
    if (pending.length > 0) {
        pending.forEach(t => taskListStr += `- [ ] ${t.title} (${t.duration}p)\n`);
    } else {
        uniqueTasks.forEach(t => taskListStr += `- [x] ${t.title}\n`);
    }

    message = `Chào bạn,\n\nTiến độ hôm nay của bạn: ${completed}/${total} nhiệm vụ.\n\n${taskListStr}\n\nHãy tiếp tục cố gắng nhé!`;
  }

  // Thêm báo cáo thống kê tuần vào nội dung email
  try {
    const stats = await getStudyStatistics();
    const today = new Date();
    const currentWeekNum = Math.floor((today - basePhaseStartDate) / (7 * 86400000)) + 1;
    const currentWeekStats = stats.weeklyProgress.find(w => w.week === currentWeekNum);
    
    message += `\n\n📊 Thống kê Tuần ${currentWeekNum}:\n`;
    message += `- Chuỗi Streak: ${stats.streakDays} ngày 🔥\n`;
    
    if (currentWeekStats) {
        const hours = Math.floor(currentWeekStats.studyTime / 60);
        const mins = currentWeekStats.studyTime % 60;
        message += `- Thời gian học: ${hours}h ${mins}p\n`;
        message += `- Tỷ lệ hoàn thành: ${currentWeekStats.progress}%`;
    } else {
        message += `- Chưa có dữ liệu tuần này.`;
    }
  } catch (e) {
    console.error("Error adding stats to email:", e);
  }

  // Thêm câu danh ngôn động lực ngẫu nhiên
  const quotes = [
    "Học tập là hạt giống của kiến thức, kiến thức là hạt giống của hạnh phúc.",
    "Đừng xấu hổ khi không biết, chỉ xấu hổ khi không học.",
    "Mỗi ngày là một cơ hội để tốt hơn ngày hôm qua.",
    "Thành công không phải là đích đến, mà là một hành trình.",
    "Kiên trì là chìa khóa của mọi thành công.",
    "Không có áp lực, không có kim cương.",
    "Hôm nay bạn làm những điều người khác không làm, ngày mai bạn sẽ có những điều người khác không có.",
    "Việc học như con thuyền đi trên dòng nước ngược, không tiến ắt sẽ lùi."
  ];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  message += `\n\n💡 Danh ngôn: "${randomQuote}"`;

  // Gửi qua EmailJS
  const templateParams = {
    to_email: emailToSend,
    subject: subject,
    message: message,
    app_name: "Study Plan App"
  };

  try {
    await emailjs.send('service_remind_tasks', 'template_99rl2xd', templateParams);
    if (force) showCustomAlert("Đã gửi email thành công!");
    console.log("Email reminder sent to " + emailToSend);
  } catch (error) {
    console.error("Failed to send email:", error);
    if (force) showCustomAlert("Gửi email thất bại. Kiểm tra console.");
  }
}

// --- START: AUTH & DB ABSTRACTION ---
let db; // This will be our database handler (Firebase or Local)
let userRole = 'guest'; // 'admin' or 'guest'
// --- END: AUTH & DB ABSTRACTION ---

// Helper function to get phase-specific database path
function getPhaseDataPath(dataType) {
  if (currentPhaseId) {
    return `phaseData/${currentPhaseId}/${dataType}`;
  }
  return dataType; // Fallback to global path if no phase selected
}

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
let skillAssessments = [];
let currentEditingAssessmentId = null;
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
let isTimerMinimized = false;
let minimizedTimerInterval = null
let floatingTimerInterval = null;
let jlptScores = [];
let currentEditingScoreId = null;
let progressHeatmapChart = null;
let audioManager = {
  audioInstances: new Map(),
  isEnabled: true,
  volume: 0.7,
  isInitialized: false,
  currentPlayingAudio: null
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

// Skill Assessment data structure
const skillTypes = {
  kanji: {
    name: 'Test Kanji',
    maxScore: 100,
    icon: 'fas fa-language',
    color: '#e91e63'
  },
  vocabulary: {
    name: 'Test Từ vựng',
    maxScore: 100,
    icon: 'fas fa-book',
    color: '#2196f3'
  },
  grammar: {
    name: 'Test Ngữ pháp',
    maxScore: 100,
    icon: 'fas fa-code-branch',
    color: '#ff9800'
  },
  reading: {
    name: 'Test Đọc hiểu',
    maxScore: 100,
    icon: 'fas fa-book-open',
    color: '#4caf50'
  },
  listening: {
    name: 'Test Nghe hiểu',
    maxScore: 100,
    icon: 'fas fa-headphones',
    color: '#9c27b0'
  },
  speaking: {
    name: 'Test Nói',
    maxScore: 100,
    icon: 'fas fa-microphone',
    color: '#f44336'
  },
  writing: {
    name: 'Test Viết',
    maxScore: 100,
    icon: 'fas fa-pen',
    color: '#795548'
  }
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
const floatingTimerDisplay = document.getElementById('floating-timer-display');
const restoreTimerBtn = document.getElementById('restore-timer-btn');
const stopFloatingTimerBtn = document.getElementById('stop-floating-timer');

const minimizeTimerBtn = document.getElementById('minimize-timer');
const timerFloatingContainer = document.createElement('div');

//////// Init Notification Sound ////////
// Initialize audio system
function initializeAudioSystem() {
  console.log('Initializing audio system...');

  // Tạo các audio instances với fallback
  const audioSources = {
    notification: [
      'data:audio/wav;base64,UklGRnADAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUwDAAA=',
      'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav'
    ],
    countdown: [
      'data:audio/wav;base64,UklGRnADAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUwDAAA='
    ]
  };

  Object.entries(audioSources).forEach(([name, sources]) => {
    createAudioInstance(name, sources);
  });

  audioManager.isInitialized = true;
  console.log('Audio system initialized successfully');
}

// Tạo audio instance với fallback
function createAudioInstance(name, sources) {
  let audio = null;

  // Thử tạo từ nguồn đầu tiên
  for (let source of sources) {
    try {
      audio = new Audio(source);
      audio.volume = audioManager.volume;
      audio.preload = 'auto';
      break;
    } catch (error) {
      console.warn(`Failed to create audio from ${source}:`, error);
      continue;
    }
  }

  // Nếu không tạo được, dùng Web Audio API
  if (!audio) {
    audio = createSyntheticAudio(name);
  }

  audioManager.audioInstances.set(name, {
    audio: audio,
    isPlaying: false,
    playPromise: null
  });
}

// Tạo âm thanh synthetic bằng Web Audio API
function createSyntheticAudio(type) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  return {
    play: function () {
      return new Promise((resolve) => {
        try {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          if (type === 'notification') {
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
          } else {
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          }

          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(audioManager.volume, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);

          setTimeout(resolve, 500);
        } catch (error) {
          console.error('Synthetic audio failed:', error);
          resolve();
        }
      });
    },
    pause: () => { },
    currentTime: 0,
    volume: audioManager.volume
  };
}

// Tạo audio instance với fallback
function createAudioInstance(name, sources) {
  let audio = null;

  // Thử tạo từ nguồn đầu tiên
  for (let source of sources) {
    try {
      audio = new Audio(source);
      audio.volume = audioManager.volume;
      audio.preload = 'auto';
      break;
    } catch (error) {
      console.warn(`Failed to create audio from ${source}:`, error);
      continue;
    }
  }

  // Nếu không tạo được, dùng Web Audio API
  if (!audio) {
    audio = createSyntheticAudio(name);
  }

  audioManager.audioInstances.set(name, {
    audio: audio,
    isPlaying: false,
    playPromise: null
  });
}

// Tạo âm thanh synthetic bằng Web Audio API
function createSyntheticAudio(type) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  return {
    play: function () {
      return new Promise((resolve) => {
        try {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          if (type === 'notification') {
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
          } else {
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          }

          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(audioManager.volume, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);

          setTimeout(resolve, 500);
        } catch (error) {
          console.error('Synthetic audio failed:', error);
          resolve();
        }
      });
    },
    pause: () => { },
    currentTime: 0,
    volume: audioManager.volume
  };
}

// Phát âm thanh với kiểm soát tốt hơn
async function playNotificationSound(options = {}) {
  if (!audioManager.isEnabled || !audioManager.isInitialized) {
    console.log('Audio disabled or not initialized');
    return;
  }

  const {
    type = 'notification',
    repeat = false,
    repeatCount = 3,
    repeatInterval = 1000
  } = options;

  const instance = audioManager.audioInstances.get(type);
  if (!instance) {
    console.warn(`Audio type ${type} not found`);
    return;
  }

  // Dừng âm thanh hiện tại nếu có
  stopNotificationSound();

  try {
    instance.isPlaying = true;
    audioManager.currentPlayingAudio = instance;

    if (repeat) {
      await playAudioWithRepeat(instance, repeatCount, repeatInterval);
    } else {
      await playAudioOnce(instance);
    }
  } catch (error) {
    console.error('Error playing audio:', error);
    instance.isPlaying = false;
  }
}

// Phát âm thanh một lần
async function playAudioOnce(instance) {
  try {
    if (instance.audio.currentTime > 0) {
      instance.audio.currentTime = 0;
    }

    const playPromise = instance.audio.play();
    instance.playPromise = playPromise;

    if (playPromise !== undefined) {
      await playPromise;
      console.log('Audio played successfully');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Play audio error:', error);
    }
  } finally {
    instance.isPlaying = false;
    instance.playPromise = null;
  }
}

// Phát âm thanh lặp lại
async function playAudioWithRepeat(instance, count, interval) {
  for (let i = 0; i < count && instance.isPlaying; i++) {
    await playAudioOnce(instance);

    if (i < count - 1 && instance.isPlaying) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

// Dừng tất cả âm thanh
function stopNotificationSound() {
  console.log('Stopping all notification sounds');

  audioManager.audioInstances.forEach((instance, name) => {
    try {
      if (instance.isPlaying) {
        instance.isPlaying = false;

        if (instance.playPromise) {
          instance.playPromise.then(() => {
            if (instance.audio.pause) {
              instance.audio.pause();
              instance.audio.currentTime = 0;
            }
          }).catch(() => {
            // Ignore promise rejection
          });
          instance.playPromise = null;
        } else if (instance.audio.pause) {
          instance.audio.pause();
          instance.audio.currentTime = 0;
        }
      }
    } catch (error) {
      console.warn(`Error stopping audio ${name}:`, error);
    }
  });

  audioManager.currentPlayingAudio = null;
}
//////// End Audio System ////////

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

    // Dừng âm thanh khi đóng modal timer
    if (modalElement === countdownModal || modalElement === breakModal) {
      console.log('Timer modal closed - stopping audio');
      stopNotificationSound();
    }

    if (modalElement === breakModal) {
      isManualClose = true;
    }
  }
}

function hideBreakModal() {
  console.log('Break modal manually closed');
  stopNotificationSound();

  if (breakModal) {
    breakModal.style.display = 'none';
  }
  isManualClose = true;
}

// Thêm audio controls vào timer modal
function addAudioControlsToModal() {
  const countdownModalContent = document.querySelector('#countdown-modal .modal-body') || document.querySelector('#countdown-modal .modal-content');
  if (countdownModalContent && !document.getElementById('audio-controls')) {
    const audioControlsHTML = `
      <div id="audio-controls" class="audio-controls">
        <div class="audio-controls-row">
          <label class="audio-toggle">
            <input type="checkbox" id="audio-enabled" ${audioManager.isEnabled ? 'checked' : ''}>
            <span>Bật âm thanh</span>
          </label>
          <label class="volume-control">
            <span>Âm lượng:</span>
            <input type="range" id="audio-volume" min="0" max="100" value="${audioManager.volume * 100}">
            <span id="volume-display">${Math.round(audioManager.volume * 100)}%</span>
          </label>
          <button id="test-audio-btn" class="btn btn-secondary btn-small" type="button">
            Test âm thanh
          </button>
        </div>
      </div>
    `;

    countdownModalContent.insertAdjacentHTML('beforeend', audioControlsHTML);
    setupAudioControlsEvents();
  }
}

// Thiết lập events cho audio controls
function setupAudioControlsEvents() {
  const audioEnabledCheckbox = document.getElementById('audio-enabled');
  const volumeSlider = document.getElementById('audio-volume');
  const volumeDisplay = document.getElementById('volume-display');
  const testAudioBtn = document.getElementById('test-audio-btn');

  if (audioEnabledCheckbox) {
    audioEnabledCheckbox.addEventListener('change', (e) => {
      audioManager.isEnabled = e.target.checked;
      console.log(`Audio ${audioManager.isEnabled ? 'enabled' : 'disabled'}`);

      if (!audioManager.isEnabled) {
        stopNotificationSound();
      }
    });
  }

  if (volumeSlider && volumeDisplay) {
    volumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      audioManager.volume = volume;
      volumeDisplay.textContent = e.target.value + '%';

      // Cập nhật volume cho tất cả audio instances
      audioManager.audioInstances.forEach(instance => {
        if (instance.audio && typeof instance.audio.volume !== 'undefined') {
          instance.audio.volume = volume;
        }
      });
    });
  }

  if (testAudioBtn) {
    testAudioBtn.addEventListener('click', () => {
      playNotificationSound({ type: 'notification' });
    });
  }
}
// End custom alert function
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
  const weekIndex = Math.floor((start - basePhaseStartDate) / (7 * 86400000)) + 1;

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

  const promises = dates.map(date => {
    return loadScheduleDataFromAllPhases(date);
  });

  const cards = await Promise.all(promises);
  grid.innerHTML = cards.join("");

  // Reset drag listeners
  grid.hasDragListeners = false;
  setupDragListeners(grid);

  updateProgress();
}

// Load schedule data from current phase, all other phases, all archived phases, and global schedule
async function loadScheduleDataFromAllPhases(date) {
  try {
    let allTasks = [];
    const taskPromises = [];

    // 1. Load from global schedule (fallback)
    taskPromises.push(db.ref(`schedule/${date}`).once("value"));

    // 2. Load from ALL phases (active and inactive)
    const phasesSnapshot = await db.ref('phases').once("value");
    if (phasesSnapshot.exists()) {
      const allPhases = phasesSnapshot.val();
      for (const phaseId of Object.keys(allPhases)) {
        taskPromises.push(db.ref(`phaseData/${phaseId}/schedule/${date}`).once("value"));
      }
    }

    // 3. Load from all archived phases
    const archivesSnapshot = await db.ref('archives').once("value");
    if (archivesSnapshot.exists()) {
      const archives = archivesSnapshot.val();
      Object.values(archives).forEach(archive => {
        const archiveSchedule = archive.scheduleSnapshot || {};
        if (archiveSchedule[date] && archiveSchedule[date].tasks) {
          allTasks = allTasks.concat(archiveSchedule[date].tasks);
        }
      });
    }

    // Execute all promises in parallel
    const snapshots = await Promise.all(taskPromises);

    // Process results
    snapshots.forEach(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.tasks) {
          allTasks = allTasks.concat(data.tasks);
        }
      }
    });

    // Remove duplicate tasks based on title and note (simple check)
    const uniqueTasks = allTasks.filter((task, index, self) =>
      index === self.findIndex((t) => (
        t.title === task.title && t.note === task.note
      ))
    );

    // Recalculate total time from the final list of tasks
    const mergedData = { time: "0 phút", tasks: uniqueTasks };
    if (mergedData.tasks.length > 0) {
      let totalCompletedMinutes = 0;
      mergedData.tasks.forEach(task => {
        if (task.done) {
          totalCompletedMinutes += task.duration || 0;
        }
      });
      const hours = Math.floor(totalCompletedMinutes / 60);
      const remainingMins = totalCompletedMinutes % 60;
      mergedData.time = hours > 0
        ? `Thời gian: ${hours} giờ ${remainingMins} phút`
        : `Thời gian: ${totalCompletedMinutes} phút`;
    }

    return generateDayCardHTML(date, mergedData);
  } catch (error) {
    console.error(`Lỗi khi tải lịch cho ${date}:`, error);
    return generateDayCardHTML(date, { time: "0 phút", tasks: [] });
  }
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
          refreshJLptCharts();
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

// Hàm escape HTML để chống XSS
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, function (match) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
  });
}

// Task management functions
async function openEditDayModal(date) {
  console.log("Opening modal for date:", date);
  currentEditingDay = date;
  const d = new Date(date);
  const dayName = d.toLocaleDateString("vi-VN", { weekday: "long" });

  try {
    if (modalDate) {
      modalDate.textContent = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${d.toLocaleDateString("vi-VN")}`;
    }

    // Tìm đường dẫn dữ liệu chính xác, ưu tiên chặng hiện tại
    let dataPath = getPhaseDataPath(`schedule/${date}`);
    let snapshot = await db.ref(dataPath).once("value");

    // Nếu không có dữ liệu ở chặng hiện tại, tìm ở các chặng khác
    if (!snapshot.exists()) {
      const foundPath = await findTaskPath(date, null, true); // Tìm đường dẫn của ngày
      if (foundPath) {
        dataPath = foundPath;
        snapshot = await db.ref(dataPath).once("value");
      }
    }

    const data = snapshot.val() || { time: "0 phút", tasks: [] };

    if (studyDurationInput) {
      studyDurationInput.value = parseStudyTime(data.time);
    }

    renderTasksInModal(data.tasks || []);

    if (editDayModal) showModal(editDayModal);

  } catch (error) {
    console.error("Lỗi khi tải dữ liệu ngày để chỉnh sửa:", error);
    showCustomAlert("Không thể tải dữ liệu để chỉnh sửa. Vui lòng thử lại.");
  }
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
    const isDone = task.done || false;
    totalMinutes += duration;

    const taskEl = document.createElement("div");
    taskEl.className = "task-item";

    // Row 1
    const row1 = document.createElement('div');
    row1.className = 'task-row-extended';

    const subjectSelect = document.createElement('select');
    subjectSelect.className = 'task-subject';
    subjectSelect.dataset.index = index;
    subjectSelect.innerHTML = `
            <option value="language" ${subject === 'language' ? 'selected' : ''}>Ngôn ngữ</option>
            <option value="it" ${subject === 'it' ? 'selected' : ''}>IT</option>
            <option value="other" ${subject === 'other' ? 'selected' : ''}>Khác</option>
        `;
    row1.appendChild(subjectSelect);

    const taskTypeField = createTaskTypeElement(index, subject, task.type);
    row1.appendChild(taskTypeField);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'task-input';
    titleInput.value = task.title;
    titleInput.dataset.index = index;
    row1.appendChild(titleInput);

    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = 0;
    durationInput.className = 'task-duration';
    durationInput.value = duration;
    durationInput.placeholder = 'Phút';
    durationInput.dataset.index = index;
    row1.appendChild(durationInput);

    // Row 2
    const row2 = document.createElement('div');
    row2.className = 'task-row';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete delete-task';
    deleteBtn.dataset.index = index;
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    row2.appendChild(deleteBtn);

    const noteTextarea = document.createElement('textarea');
    noteTextarea.className = 'task-note';
    noteTextarea.dataset.index = index;
    noteTextarea.placeholder = 'Thêm ghi chú cho nhiệm vụ...';
    noteTextarea.value = note; // Sử dụng .value thay vì innerHTML
    row2.appendChild(noteTextarea);

    // Hidden input for done status
    const doneInput = document.createElement('input');
    doneInput.type = 'hidden';
    doneInput.className = 'task-done-status';
    doneInput.dataset.index = index;
    doneInput.value = isDone;

    taskEl.appendChild(row1);
    taskEl.appendChild(row2);
    taskEl.appendChild(doneInput);
    tasksContainer.appendChild(taskEl);
  });

  // Thêm event listeners cho subject dropdowns
  document.querySelectorAll('.task-subject').forEach(select => {
    select.addEventListener('change', function () {
      const index = this.getAttribute('data-index');
      const subject = this.value;
      const taskTypeContainer = this.parentNode;
      const oldTaskType = taskTypeContainer.querySelector('.task-type-select, .task-type-container');

      if (oldTaskType) {
        const newTaskTypeField = createTaskTypeElement(index, subject, '');
        taskTypeContainer.replaceChild(newTaskTypeField, oldTaskType);
      }
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

  // Row 1
  const row1 = document.createElement('div');
  row1.className = 'task-row-extended';

  const subjectSelect = document.createElement('select');
  subjectSelect.className = 'task-subject';
  subjectSelect.dataset.index = taskCount;
  subjectSelect.innerHTML = `
        <option value="language" selected>Ngôn ngữ</option>
        <option value="it">IT</option>
        <option value="other">Khác</option>
    `;
  row1.appendChild(subjectSelect);

  const taskTypeField = createTaskTypeElement(taskCount, 'language', '');
  row1.appendChild(taskTypeField);

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'task-input';
  titleInput.placeholder = 'Nhập nhiệm vụ mới';
  titleInput.dataset.index = taskCount;
  row1.appendChild(titleInput);

  const durationInput = document.createElement('input');
  durationInput.type = 'number';
  durationInput.min = 0;
  durationInput.className = 'task-duration';
  durationInput.value = 30;
  durationInput.placeholder = 'Phút';
  durationInput.dataset.index = taskCount;
  row1.appendChild(durationInput);

  // Row 2
  const row2 = document.createElement('div');
  row2.className = 'task-row';
  row2.innerHTML = `
        <button class="btn-delete delete-task" data-index="${taskCount}"><i class="fas fa-trash"></i></button>
        <textarea class="task-note" data-index="${taskCount}" placeholder="Ghi chú..."></textarea>
    `;

  // Hidden input
  const doneInput = document.createElement('input');
  doneInput.type = 'hidden';
  doneInput.className = 'task-done-status';
  doneInput.dataset.index = taskCount;
  doneInput.value = 'false';

  taskEl.appendChild(row1);
  taskEl.appendChild(row2);
  taskEl.appendChild(doneInput);
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

  // TÍNH TỔNG THỜI GIAN CÁC TASK ĐÃ HOÀN THÀNH
  let totalCompletedMinutes = 0;
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
        const duration = parseInt(durationInput.value) || 0;
        const isDone = doneStatus ? doneStatus.value === 'true' : false;

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
          done: isDone,
          subject: subject,
          type: escapeHTML(taskType),
          duration: duration,
          note: noteInput ? escapeHTML(noteInput.value.trim()) : ""
        });

        // CỘNG THỜI GIAN NẾU TASK ĐÃ HOÀN THÀNH
        if (isDone) {
          totalCompletedMinutes += duration;
        }
      }
    }
  });

  // TẠO CHUỖI THỜI GIAN TỪ TỔNG ĐÃ HOÀN THÀNH
  const hours = Math.floor(totalCompletedMinutes / 60);
  const remainingMins = totalCompletedMinutes % 60;
  const timeStr = hours > 0
    ? `Thời gian: ${hours} giờ ${remainingMins} phút`
    : `Thời gian: ${totalCompletedMinutes} phút`;

  try {
    // Xác định đúng đường dẫn để lưu, ưu tiên chặng hiện tại nếu có dữ liệu
    let schedulePath = getPhaseDataPath(`schedule/${currentEditingDay}`);
    const existingData = await db.ref(schedulePath).once('value');
    if (!existingData.exists()) {
      const foundPath = await findTaskPath(currentEditingDay, null, true);
      if (foundPath) schedulePath = foundPath;
    }

    const weekNumber = Math.floor((new Date(currentEditingDay) - basePhaseStartDate) / (7 * 86400000)) + 1;

    // Lưu dữ liệu nhiệm vụ trước
    await db.ref(schedulePath).set({
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

// Drag and Drop Variables
let draggedTask = null;
let dragSourceDate = null;

// Initialize Drag and Drop
function initializeDragAndDrop() {
  // Sử dụng MutationObserver để theo dõi thay đổi DOM
  const observer = new MutationObserver(() => {
    const scheduleGrid = document.getElementById('weekly-schedule');
    if (scheduleGrid && !scheduleGrid.hasDragListeners) {
      setupDragListeners(scheduleGrid);
      scheduleGrid.hasDragListeners = true;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Khởi tạo ngay lập tức nếu có sẵn
  const scheduleGrid = document.getElementById('weekly-schedule');
  if (scheduleGrid) {
    setupDragListeners(scheduleGrid);
    scheduleGrid.hasDragListeners = true;
  }
}

function setupDragListeners(scheduleGrid) {
  // Xóa listeners cũ nếu có
  scheduleGrid.removeEventListener('dragstart', handleDragStart);
  scheduleGrid.removeEventListener('dragover', handleDragOver);
  scheduleGrid.removeEventListener('dragenter', handleDragEnter);
  scheduleGrid.removeEventListener('dragleave', handleDragLeave);
  scheduleGrid.removeEventListener('drop', handleDrop);
  scheduleGrid.removeEventListener('dragend', handleDragEnd);

  // Thêm listeners mới
  scheduleGrid.addEventListener('dragstart', handleDragStart);
  scheduleGrid.addEventListener('dragover', handleDragOver);
  scheduleGrid.addEventListener('dragenter', handleDragEnter);
  scheduleGrid.addEventListener('dragleave', handleDragLeave);
  scheduleGrid.addEventListener('drop', handleDrop);
  scheduleGrid.addEventListener('dragend', handleDragEnd);
}

// Thêm touch event listeners
function setupTouchDragAndDrop(scheduleGrid) {
  let touchStartX, touchStartY;
  let touchedTask = null;

  scheduleGrid.addEventListener('touchstart', (e) => {
    const taskItem = e.target.closest('.study-item');
    if (!taskItem) return;

    touchedTask = taskItem;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    e.preventDefault();
  });

  scheduleGrid.addEventListener('touchend', (e) => {
    if (!touchedTask) return;

    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;

    // Simple touch-based drag (có thể mở rộng thành drag thực sự)
    if (Math.abs(endX - touchStartX) > 10 || Math.abs(endY - touchStartY) > 10) {
      // Xử lý touch-based drag
      console.log('Touch drag detected');
    }

    touchedTask = null;
    e.preventDefault();
  });
}

// Drag Start Handler
function handleDragStart(e) {
  console.log('Drag started');
  const taskItem = e.target.closest('.study-item');
  if (!taskItem) {
    console.log('No task item found');
    return;
  }

  console.log('Dragging task:', taskItem.dataset.taskIndex, 'from date:', taskItem.closest('.day-card').dataset.date);

  draggedTask = taskItem;
  dragSourceDate = taskItem.closest('.day-card').dataset.date;

  taskItem.classList.add('dragging');

  // Sửa DataTransfer để tương thích tốt hơn
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskItem.dataset.taskIndex);
  e.dataTransfer.setData('application/source-date', dragSourceDate);

  // Thêm fallback cho mobile/tablet
  if (e.dataTransfer.setDragImage) {
    e.dataTransfer.setDragImage(taskItem, 20, 20);
  }
}

// Drag Over Handler
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
}

// Drag Enter Handler
function handleDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();

  const dayCard = e.target.closest('.day-card');
  const taskItem = e.target.closest('.study-item');

  if (dayCard) {
    dayCard.classList.add('drop-zone');
  }

  if (taskItem && !taskItem.classList.contains('dragging')) {
    taskItem.classList.add('drag-over');
  }
}

// Drag Leave Handler
function handleDragLeave(e) {
  const dayCard = e.target.closest('.day-card');
  const taskItem = e.target.closest('.study-item');

  // Only remove classes if not entering a child element
  if (dayCard && !dayCard.contains(e.relatedTarget)) {
    dayCard.classList.remove('drop-zone');
  }

  if (taskItem && !taskItem.contains(e.relatedTarget)) {
    taskItem.classList.remove('drag-over');
  }
}

// Drop Handler
function handleDrop(e) {
  console.log('Drop event triggered');
  e.preventDefault();
  e.stopPropagation();

  const targetDayCard = e.target.closest('.day-card');
  console.log('Target day card:', targetDayCard);
  const targetDate = targetDayCard ? targetDayCard.dataset.date : null;

  if (!targetDate || !draggedTask) return;

  // Lấy data với fallback
  const taskIndex = e.dataTransfer.getData('text/plain');
  const sourceDate = e.dataTransfer.getData('application/source-date') || dragSourceDate;

  // Clean up visual feedback
  cleanupDragFeedback();

  if (sourceDate !== targetDate) {
    moveTaskBetweenDays(sourceDate, parseInt(taskIndex), targetDate);
  }
}

// Drag End Handler
function handleDragEnd(e) {
  // Clean up
  document.querySelectorAll('.day-card').forEach(card => {
    card.classList.remove('drop-zone');
  });
  document.querySelectorAll('.study-item').forEach(item => {
    item.classList.remove('drag-over');
    item.classList.remove('dragging');
  });

  draggedTask = null;
  dragSourceDate = null;
}

function cleanupDragFeedback() {
  document.querySelectorAll('.day-card').forEach(card => {
    card.classList.remove('drop-zone');
  });
  document.querySelectorAll('.study-item').forEach(item => {
    item.classList.remove('drag-over');
    item.classList.remove('dragging');
  });
}

// Move task between different days
async function moveTaskBetweenDays(sourceDate, taskIndex, targetDate) {
  try {
    // Get source day data
    const sourceSchedulePath = getPhaseDataPath(`schedule/${sourceDate}`);
    const sourceSnapshot = await db.ref(sourceSchedulePath).once('value');
    const sourceData = sourceSnapshot.val() || { time: "0 phút", tasks: [] };

    // Check if task exists
    if (!sourceData.tasks || !sourceData.tasks[taskIndex]) {
      showCustomAlert('Không tìm thấy nhiệm vụ để di chuyển!');
      return;
    }

    // Get target day data
    const targetSchedulePath = getPhaseDataPath(`schedule/${targetDate}`);
    const targetSnapshot = await db.ref(targetSchedulePath).once('value');
    const targetData = targetSnapshot.val() || { time: "0 phút", tasks: [] };

    // Remove task from source
    const movedTask = sourceData.tasks.splice(taskIndex, 1)[0];

    // Add task to target
    if (!targetData.tasks) {
      targetData.tasks = [];
    }
    targetData.tasks.push(movedTask);

    // Update both days in Firebase
    await db.ref(sourceSchedulePath).update({
      tasks: sourceData.tasks
    });

    await db.ref(targetSchedulePath).update({
      tasks: targetData.tasks
    });

    // Reload the weekly schedule to reflect changes
    loadCurrentWeek();

    showCustomAlert(`Đã di chuyển nhiệm vụ từ ${formatDisplayDate(sourceDate)} sang ${formatDisplayDate(targetDate)}`);

  } catch (error) {
    console.error('Lỗi khi di chuyển nhiệm vụ:', error);
    showCustomAlert('Có lỗi xảy ra khi di chuyển nhiệm vụ!');
  }
}

// Helper function to format date for display
function formatDisplayDate(dateString) {
  const date = new Date(dateString);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function generateDayCardHTML(date, data) {
  const d = new Date(date);
  const dayName = d.toLocaleDateString("vi-VN", { weekday: "long" });
  const displayDate = `${d.getDate()}/${d.getMonth() + 1}`;
  const isWeekend = [0, 6].includes(d.getDay());

  // Calculate total completed minutes
  let totalCompletedMinutes = 0;
  const tasks = data.tasks || [];

  tasks.forEach(task => {
    if (task.done) {
      totalCompletedMinutes += task.duration || 0;
    }
  });

  // Create display time string
  const hours = Math.floor(totalCompletedMinutes / 60);
  const remainingMins = totalCompletedMinutes % 60;
  const displayTime = hours > 0
    ? `Thời gian: ${hours} giờ ${remainingMins} phút`
    : `Thời gian: ${totalCompletedMinutes} phút`;

  // Update tasks HTML to include drag handles
  const tasksHTML = tasks.map((task, i) => `
        <li class="study-item ${task.done ? "done" : ""}" 
            data-task-index="${i}" 
            data-duration="${task.duration || 0}"
            draggable="true">
            <div class="drag-handle" title="Kéo để di chuyển">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <span class="task-content">${task.title}</span>
            <div class="task-actions">
                <button class="edit-task-btn" title="Chỉnh sửa">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="check-btn ${task.done ? "done" : ""}" title="${task.done ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'}">
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
            <div class="study-time">${displayTime}</div>
            <ul class="study-items">${tasksHTML}</ul>
            <button class="add-task-btn"><i class="fas fa-plus"></i> Thêm nhiệm vụ</button>
        </div>
    `;
}

function detectTaskType(title) {
  if (title.match(/nghe|listening|聴解/i)) return "listening";
  if (title.match(/ngữ pháp|grammar|文法/i)) return "grammar";
  if (title.match(/từ vựng|vocabulary|語彙/i)) return "vocabulary";
  if (title.match(/đọc|reading|読解/i)) return "reading";
  return "other";
}

// Hàm tạo hiệu ứng Confetti (Pháo hoa giấy)
function triggerConfetti() {
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#fdbb2d', '#1a2a6c'];
  const confettiCount = 100;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.classList.add('confetti');
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (Math.random() * 3 + 2) + 's'; // 2-5s
    confetti.style.opacity = Math.random();
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000); // Xóa sau khi rơi xong
  }
}

function updateProgress(animate = false) {
  const allTasks = document.querySelectorAll('.study-item');
  const completedTasks = document.querySelectorAll('.study-item.done');

  const total = allTasks.length;
  const completed = completedTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const progressFill = document.getElementById('progress-fill');
  const weekProgress = document.getElementById("week-progress");

  // Tính tổng thời gian đã học
  let currentMinutes = 0;
  completedTasks.forEach(task => {
    currentMinutes += parseInt(task.dataset.duration) || 0;
  });
  const currentHours = currentMinutes / 60;

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
    progressFill.style.transition = 'width 0.5s ease';

    // Thay đổi màu sắc nếu đạt mục tiêu tuần
    if (currentPhaseWeeklyGoal > 0 && currentHours >= currentPhaseWeeklyGoal) {
      // Mục tiêu đạt được: Gradient màu xanh lá
      progressFill.style.background = 'linear-gradient(90deg, #11998e, #38ef7d)';
    } else {
      // Mặc định: Gradient xanh dương - cam
      progressFill.style.background = 'linear-gradient(90deg, #1a2a6c, #fdbb2d)';
    }
  }

  if (weekProgress) {
    let displayText = progress + '%';
    if (currentPhaseWeeklyGoal > 0) {
      const currentHoursDisplay = currentHours.toFixed(1);
      displayText += ` (${currentHoursDisplay}/${currentPhaseWeeklyGoal}h)`;
      
      // Thêm biểu tượng ăn mừng nếu đạt mục tiêu
      if (currentHours >= currentPhaseWeeklyGoal) {
         displayText += ' 🎉';
         
         // Kích hoạt confetti nếu có yêu cầu animation và vừa đạt/vượt mục tiêu
         if (animate) {
           triggerConfetti();
         }
      }
    }
    weekProgress.textContent = displayText;
  }

  const completedCount = document.getElementById('completed-count');
  if (completedCount) completedCount.textContent = completed;
  const totalCount = document.getElementById('total-tasks');
  if (totalCount) totalCount.textContent = total;
}

// ----------------------------
// STATISTICS & CHARTS FUNCTIONS - UPDATED
// ----------------------------

async function migrateOldDataToLanguageCategory() {
  try {
    const schedulePath = getPhaseDataPath('schedule');
    const snapshot = await db.ref(schedulePath).once('value');
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
          db.ref(`${schedulePath}/${date}`).update({ tasks: dayData.tasks });
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
    const schedulePath = getPhaseDataPath('schedule');
    const scheduleSnapshot = await db.ref(schedulePath).once('value');
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

      // Tính toán lại weekNumber dựa trên ngày bắt đầu của chặng hiện tại
      // Điều này giúp sửa lỗi hiển thị cho các task cũ khi chuyển chặng
      const taskDate = new Date(date);
      const weekNumber = Math.floor((taskDate - basePhaseStartDate) / (7 * 86400000)) + 1;
      
      // Bỏ qua nếu task nằm trước ngày bắt đầu chặng
      if (weekNumber < 1) return;

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
    // Sử dụng tổng số tuần của chặng hiện tại thay vì cố định 21
    for (let week = 1; week <= currentPhaseTotalWeeks; week++) {
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

//Skill
// Load skill assessments from Firebase
async function loadSkillAssessments() {
  try {
    const skillPath = getPhaseDataPath('skillAssessments');
    const snapshot = await db.ref(skillPath).once('value');
    const data = snapshot.val();

    if (data) {
      skillAssessments = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    } else {
      skillAssessments = [];
    }

    // Sort by date (newest first)
    skillAssessments.sort((a, b) => new Date(b.date) - new Date(a.date));

    renderSkillAssessmentsTable();
    updateSkillAssessmentsSummary();
    updateSkillRadarChartWithFilter();

  } catch (error) {
    console.error('Lỗi khi tải skill assessments:', error);
    skillAssessments = [];
  }
}

// Render skill assessments table
function renderSkillAssessmentsTable() {
  const tbody = document.getElementById('skill-assessments-list');
  if (!tbody) return;

  if (skillAssessments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
          <p>Chưa có đánh giá kỹ năng nào. Hãy thêm để theo dõi tiến bộ!</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = skillAssessments.map((assessment, index) => {
    const date = new Date(assessment.date);
    const formattedDate = date.toLocaleDateString('vi-VN');
    const skillInfo = skillTypes[assessment.skillType];

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${formattedDate}</td>
        <td>
          <div style="display: flex; align-items: center;">
            <i class="${skillInfo.icon}" style="color: ${skillInfo.color}; margin-right: 8px;"></i>
            ${skillInfo.name}
          </div>
        </td>
        <td>${assessment.title}</td>
        <td>
          ${assessment.link ?
        `<a href="${assessment.link}" target="_blank" title="Xem bài test">
              <i class="fas fa-external-link-alt"></i>
            </a>` : '-'
      }
        </td>
        <td class="score-cell ${getSkillScoreClass(assessment.score, skillInfo.maxScore)}">
          <strong>${assessment.score}</strong>/${skillInfo.maxScore}
        </td>
        <td>
          <div class="skill-level-badge ${getSkillLevelClass(assessment.score, skillInfo.maxScore)}">
            ${getSkillLevel(assessment.score, skillInfo.maxScore)}
          </div>
        </td>
        <td>
          <button class="btn-score-action btn-edit-assessment" data-id="${assessment.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-score-action btn-delete-assessment" data-id="${assessment.id}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Add event listeners
  tbody.querySelectorAll('.btn-edit-assessment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const assessmentId = e.currentTarget.dataset.id;
      openEditSkillAssessmentModal(assessmentId);
    });
  });

  tbody.querySelectorAll('.btn-delete-assessment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const assessmentId = e.currentTarget.dataset.id;
      deleteSkillAssessment(assessmentId);
    });
  });
}

// Get skill level based on score percentage
function getSkillLevel(score, maxScore) {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 'Xuất sắc';
  if (percentage >= 80) return 'Giỏi';
  if (percentage >= 70) return 'Khá';
  if (percentage >= 60) return 'Trung bình';
  if (percentage >= 50) return 'Yếu';
  return 'Kém';
}

function getSkillLevelClass(score, maxScore) {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 'level-excellent';
  if (percentage >= 80) return 'level-good';
  if (percentage >= 70) return 'level-fair';
  if (percentage >= 60) return 'level-average';
  if (percentage >= 50) return 'level-poor';
  return 'level-bad';
}

function getSkillScoreClass(score, maxScore) {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return 'score-high';
  if (percentage >= 60) return 'score-medium';
  return 'score-low';
}

// Update skill assessments summary
function updateSkillAssessmentsSummary() {
  const summaryEl = document.getElementById('skill-assessments-summary');
  if (!summaryEl) return;

  if (skillAssessments.length === 0) {
    summaryEl.innerHTML = '<div class="stat-summary-item">Chưa có dữ liệu</div>';
    return;
  }

  // Calculate summary statistics
  const totalTests = skillAssessments.length;
  const avgScore = Math.round(
    skillAssessments.reduce((sum, assessment) => {
      const percentage = (assessment.score / skillTypes[assessment.skillType].maxScore) * 100;
      return sum + percentage;
    }, 0) / totalTests
  );

  const excellentTests = skillAssessments.filter(assessment => {
    const percentage = (assessment.score / skillTypes[assessment.skillType].maxScore) * 100;
    return percentage >= 90;
  }).length;

  // Find most improved skill
  const skillProgress = calculateSkillProgress();
  const mostImprovedSkill = findMostImprovedSkill(skillProgress);

  summaryEl.innerHTML = `
    <div class="stat-summary-item">
      <div class="stat-summary-value">${totalTests}</div>
      <div class="stat-summary-label">Bài test</div>
    </div>
    <div class="stat-summary-item">
      <div class="stat-summary-value">${excellentTests}</div>
      <div class="stat-summary-label">Xuất sắc</div>
    </div>
    <div class="stat-summary-item">
      <div class="stat-summary-value">${avgScore}%</div>
      <div class="stat-summary-label">Điểm TB</div>
    </div>
    <div class="stat-summary-item">
      <div class="stat-summary-value" style="font-size: 0.8em;">${mostImprovedSkill}</div>
      <div class="stat-summary-label">Tiến bộ nhất</div>
    </div>
  `;
}

// Calculate skill progress over time
function calculateSkillProgress() {
  const progress = {};

  Object.keys(skillTypes).forEach(skillType => {
    const skillAssessmentsForType = skillAssessments
      .filter(a => a.skillType === skillType)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (skillAssessmentsForType.length >= 2) {
      const first = skillAssessmentsForType[0];
      const last = skillAssessmentsForType[skillAssessmentsForType.length - 1];
      const firstPercentage = (first.score / skillTypes[first.skillType].maxScore) * 100;
      const lastPercentage = (last.score / skillTypes[last.skillType].maxScore) * 100;

      progress[skillType] = lastPercentage - firstPercentage;
    }
  });

  return progress;
}

function findMostImprovedSkill(progress) {
  let maxImprovement = -Infinity;
  let mostImproved = 'Chưa có dữ liệu';

  Object.entries(progress).forEach(([skillType, improvement]) => {
    if (improvement > maxImprovement) {
      maxImprovement = improvement;
      mostImproved = skillTypes[skillType].name;
    }
  });

  return mostImproved;
}

// Open add skill assessment modal
function openAddSkillAssessmentModal() {
  currentEditingAssessmentId = null;
  document.getElementById('skill-assessment-modal-title').textContent = 'Thêm đánh giá kỹ năng';

  // Reset form
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('skill-assessment-date').value = today;
  document.getElementById('skill-assessment-type').value = 'kanji';
  document.getElementById('skill-assessment-title').value = '';
  document.getElementById('skill-assessment-link').value = '';
  document.getElementById('skill-assessment-score').value = '';

  updateSkillScoreMax();
  showModal(document.getElementById('skill-assessment-modal'));
}

// Open edit skill assessment modal
function openEditSkillAssessmentModal(assessmentId) {
  const assessment = skillAssessments.find(a => a.id === assessmentId);
  if (!assessment) return;

  currentEditingAssessmentId = assessmentId;
  document.getElementById('skill-assessment-modal-title').textContent = 'Chỉnh sửa đánh giá kỹ năng';

  document.getElementById('skill-assessment-date').value = assessment.date;
  document.getElementById('skill-assessment-type').value = assessment.skillType;
  document.getElementById('skill-assessment-title').value = assessment.title;
  document.getElementById('skill-assessment-link').value = assessment.link || '';
  document.getElementById('skill-assessment-score').value = assessment.score;

  updateSkillScoreMax();
  showModal(document.getElementById('skill-assessment-modal'));
}

// Update max score display when skill type changes
function updateSkillScoreMax() {
  const skillType = document.getElementById('skill-assessment-type').value;
  const maxScore = skillTypes[skillType].maxScore;
  document.getElementById('skill-score-max').textContent = maxScore;
  document.getElementById('skill-assessment-score').max = maxScore;
}

// Save skill assessment
async function saveSkillAssessment() {
  const date = document.getElementById('skill-assessment-date').value;
  const skillType = document.getElementById('skill-assessment-type').value;
  const title = document.getElementById('skill-assessment-title').value.trim();
  const link = document.getElementById('skill-assessment-link').value.trim();
  const score = parseInt(document.getElementById('skill-assessment-score').value) || 0;

  if (!date || !title || score < 0) {
    showCustomAlert('Vui lòng điền đầy đủ thông tin và điểm số hợp lệ!');
    return;
  }

  const maxScore = skillTypes[skillType].maxScore;
  if (score > maxScore) {
    showCustomAlert(`Điểm số không được vượt quá ${maxScore}!`);
    return;
  }

  const assessmentData = {
    date,
    skillType,
    title,
    link: link || '',
    score,
    updatedAt: new Date().toISOString()
  };

  try {
    const skillPath = getPhaseDataPath('skillAssessments');
    if (currentEditingAssessmentId) {
      await db.ref(`${skillPath}/${currentEditingAssessmentId}`).update(assessmentData);
    } else {
      const newAssessmentId = `skill_${Date.now()}`;
      assessmentData.createdAt = new Date().toISOString();
      await db.ref(`${skillPath}/${newAssessmentId}`).set(assessmentData);
    }

    hideModal(document.getElementById('skill-assessment-modal'));
    await loadSkillAssessments();
    refreshSkillCharts();
    showCustomAlert('Đã lưu đánh giá kỹ năng thành công!');

  } catch (error) {
    console.error('Lỗi khi lưu đánh giá kỹ năng:', error);
    showCustomAlert('Có lỗi xảy ra khi lưu đánh giá kỹ năng!');
  }
}

// Delete skill assessment
async function deleteSkillAssessment(assessmentId) {
  if (!confirm('Bạn có chắc muốn xóa đánh giá kỹ năng này?')) return;

  try {
    const skillPath = getPhaseDataPath('skillAssessments');
    await db.ref(`${skillPath}/${assessmentId}`).remove();
    await loadSkillAssessments();
    refreshSkillCharts();
    showCustomAlert('Đã xóa đánh giá kỹ năng thành công!');
  } catch (error) {
    console.error('Lỗi khi xóa đánh giá kỹ năng:', error);
    showCustomAlert('Có lỗi xảy ra khi xóa đánh giá kỹ năng!');
  }
}

// Update skill radar chart with filter
function updateSkillRadarChartWithFilter() {
  const filterValue = document.getElementById('skill-chart-filter')?.value || 'all';

  if (filterValue === 'jlpt') {
    updateScoresRadarChart(); // Show JLPT scores
  } else if (filterValue === 'individual') {
    updateIndividualSkillsRadarChart(); // Show individual skill assessments
  } else {
    updateCombinedSkillsRadarChart(); // Show both combined
  }
}

// Update individual skills radar chart
function updateIndividualSkillsRadarChart() {
  const ctx = document.getElementById('skillRadarChart')?.getContext('2d');
  if (!ctx) return;

  if (skillRadarChart) {
    skillRadarChart.destroy();
    skillRadarChart = null;
  }

  if (skillAssessments.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu đánh giá kỹ năng riêng', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  // Calculate average scores for each skill type
  const skillAverages = {};
  Object.keys(skillTypes).forEach(skillType => {
    const assessments = skillAssessments.filter(a => a.skillType === skillType);
    if (assessments.length > 0) {
      const avgScore = assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length;
      const avgPercentage = (avgScore / skillTypes[skillType].maxScore) * 100;
      skillAverages[skillType] = Math.round(avgPercentage);
    } else {
      skillAverages[skillType] = 0;
    }
  });

  const labels = Object.keys(skillTypes).map(key => skillTypes[key].name);
  const data = Object.keys(skillTypes).map(key => skillAverages[key]);
  const colors = Object.keys(skillTypes).map(key => skillTypes[key].color);

  try {
    skillRadarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Điểm trung bình (%)',
          data: data,
          backgroundColor: 'rgba(26, 42, 108, 0.2)',
          borderColor: 'rgba(26, 42, 108, 1)',
          pointBackgroundColor: colors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
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
            angleLines: { color: 'rgba(0,0,0,0.1)' },
            pointLabels: {
              font: { size: 10, weight: 'bold' },
              color: '#333'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 12, weight: 'bold' } }
          },
          tooltip: {
            callbacks: {
              label: context => {
                const skillType = Object.keys(skillTypes)[context.dataIndex];
                const count = skillAssessments.filter(a => a.skillType === skillType).length;
                return `${context.label}: ${context.raw}% (${count} bài test)`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo individual skills radar chart:', error);
  }
}

// Update combined skills radar chart
function updateCombinedSkillsRadarChart() {
  // Implementation for showing both JLPT and individual skills
  // This would be more complex, showing multiple datasets
  updateIndividualSkillsRadarChart(); // For now, show individual skills
}

// Refresh all skill-related charts
function refreshSkillCharts() {
  updateSkillRadarChartWithFilter();

  // Update progress heatmap if it includes skill assessments
  if (typeof createProgressHeatmap === 'function') {
    // Combine JLPT scores and skill assessments for heatmap
    const combinedData = [...jlptScores];
    createProgressHeatmap(combinedData);
  }
}

// Setup skill assessment event listeners
function setupSkillAssessmentEventListeners() {
  // Manage skill assessments button
  document.getElementById('manage-skill-assessments-btn')?.addEventListener('click', () => {
    loadSkillAssessments();
    showModal(document.getElementById('skill-assessments-modal'));
  });

  // Close skill assessments modal
  document.getElementById('close-skill-assessments-modal')?.addEventListener('click', () => {
    hideModal(document.getElementById('skill-assessments-modal'));
  });

  // Add new skill assessment
  document.getElementById('add-skill-assessment-btn')?.addEventListener('click', openAddSkillAssessmentModal);

  // Close skill assessment detail modal
  document.getElementById('close-skill-assessment-modal')?.addEventListener('click', () => {
    hideModal(document.getElementById('skill-assessment-modal'));
  });

  // Cancel skill assessment
  document.getElementById('cancel-skill-assessment')?.addEventListener('click', () => {
    hideModal(document.getElementById('skill-assessment-modal'));
  });

  // Save skill assessment
  document.getElementById('save-skill-assessment')?.addEventListener('click', saveSkillAssessment);

  // Skill type change handler
  document.getElementById('skill-assessment-type')?.addEventListener('change', updateSkillScoreMax);

  // Skill chart filter change
  document.getElementById('skill-chart-filter')?.addEventListener('change', (e) => {
    currentSkillFilter = e.target.value;
    updateSkillRadarChartWithFilter();
  });
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
    const schedulePath = getPhaseDataPath('schedule');
    const sessionsPath = getPhaseDataPath('studySessions');

    const [scheduleSnapshot, sessionsSnapshot] = await Promise.all([
      db.ref(schedulePath).once('value'),
      db.ref(sessionsPath).once('value')
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

function initProgressChart(weeklyData) {
  const ctx = document.getElementById('progressChart');

  // Debug: Kiểm tra phần tử canvas
  if (!ctx) {
    console.error('Không tìm thấy phần tử progressChart canvas');
    return;
  }

  const canvasCtx = ctx.getContext('2d');
  if (!canvasCtx) {
    console.error('Không thể lấy context của progressChart canvas');
    return;
  }

  console.log('Đang khởi tạo progressChart với dữ liệu:', weeklyData);

  // Hủy biểu đồ cũ nếu tồn tại
  if (progressChart) {
    progressChart.destroy();
    progressChart = null;
  }

  // Kiểm tra dữ liệu
  if (!weeklyData || weeklyData.length === 0) {
    console.warn('Không có dữ liệu weeklyData để hiển thị biểu đồ');

    // Hiển thị thông báo "Không có dữ liệu"
    canvasCtx.fillStyle = '#666';
    canvasCtx.font = '16px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Chưa có dữ liệu tiến độ tuần', ctx.width / 2, ctx.height / 2);
    return;
  }

  try {
    progressChart = new Chart(canvasCtx, {
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
            title: {
              display: true,
              text: 'Tỷ lệ hoàn thành (%)',
              font: { weight: 'bold' }
            },
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.1)' },
            ticks: {
              callback: function (value) {
                return value + '%';
              }
            }
          },
          y1: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Giờ học',
              font: { weight: 'bold' }
            },
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: 'rgba(253, 187, 45, 1)',
              callback: function (value) {
                return value + 'h';
              }
            }
          },
          x: {
            grid: { color: 'rgba(0,0,0,0.1)' },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              font: { weight: 'bold' }
            }
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

    console.log('progressChart đã được khởi tạo thành công');

  } catch (error) {
    console.error('Lỗi khi khởi tạo progressChart:', error);

    // Hiển thị thông báo lỗi
    canvasCtx.fillStyle = '#f44336';
    canvasCtx.font = '14px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Lỗi khi tải biểu đồ tiến độ', ctx.width / 2, ctx.height / 2);
  }
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
    const schedulePath = getPhaseDataPath('schedule');
    const sessionsPath = getPhaseDataPath('studySessions');
    const [scheduleSnapshot, sessionsSnapshot] = await Promise.all([
      db.ref(schedulePath).once('value'),
      db.ref(sessionsPath).once('value')
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

// Thêm hàm tải riêng từng biểu đồ
function loadSkillChart() {
  if (skillRadarChart) {
    skillRadarChart.destroy();
    skillRadarChart = null;
  }

  getStudyStatistics().then(stats => {
    const filteredStats = filterStatsBySubject(stats, currentSkillFilter, currentTimeFilter);
    const skillChartData = currentSkillFilter === 'all' ?
      filteredStats.subjectDistribution : filteredStats.languageSkills;
    initSkillRadarChart(skillChartData);
  });
}

function loadTimeDistributionChart() {
  if (timeDistributionChart) {
    timeDistributionChart.destroy();
    timeDistributionChart = null;
  }

  getStudyStatistics().then(stats => {
    const filteredStats = filterStatsBySubject(stats, currentSkillFilter, currentTimeFilter);
    const timeChartData = currentTimeFilter === 'all' ?
      filteredStats.subjectDistribution : filteredStats.subjectDistribution;
    initSubjectDistributionChart(timeChartData);
  });
}

// Cập nhật event listeners cho các nút lọc
document.getElementById('skill-chart-filter')?.addEventListener('change', function (e) {
  currentSkillFilter = e.target.value;
  loadSkillChart();
});

document.getElementById('time-chart-filter')?.addEventListener('change', function (e) {
  currentTimeFilter = e.target.value;

  getStudyStatistics().then(stats => {
    const filteredStats = filterStatsBySubject(stats, 'all', currentTimeFilter);
    const timeChartData = currentTimeFilter === 'all' ?
      filteredStats.subjectDistribution : filteredStats.subjectDistribution;

    if (timeDistributionChart) {
      timeDistributionChart.destroy();
    }
    initSubjectDistributionChart(timeChartData);
  });
});

// Hàm debug để kiểm tra trạng thái biểu đồ
function debugCharts() {
  console.log('=== DEBUG CHARTS ===');

  // Kiểm tra phần tử canvas
  const progressCanvas = document.getElementById('progressChart');
  const skillCanvas = document.getElementById('skillRadarChart');
  const timeCanvas = document.getElementById('timeDistributionChart');

  console.log('progressChart canvas:', progressCanvas);
  console.log('skillRadarChart canvas:', skillCanvas);
  console.log('timeDistributionChart canvas:', timeCanvas);

  // Kiểm tra kích thước canvas
  if (progressCanvas) {
    console.log('progressChart size:', progressCanvas.offsetWidth, 'x', progressCanvas.offsetHeight);
  }
  if (skillCanvas) {
    console.log('skillRadarChart size:', skillCanvas.offsetWidth, 'x', skillCanvas.offsetHeight);
  }

  // Kiểm tra instance biểu đồ
  console.log('progressChart instance:', progressChart);
  console.log('skillRadarChart instance:', skillRadarChart);
  console.log('timeDistributionChart instance:', timeDistributionChart);

  // Kiểm tra dữ liệu
  getStudyStatistics().then(stats => {
    console.log('Weekly data for progressChart:', stats.weeklyProgress);
    console.log('JLPT scores for skillRadarChart:', jlptScores);
  });
}

// Gọi hàm debug khi cần (có thể gọi từ console browser)
window.debugCharts = debugCharts;

async function initCharts() {
  console.log('=== INIT CHARTS START ===');

  // Debug: Kiểm tra phần tử
  const progressCanvas = document.getElementById('progressChart');
  if (!progressCanvas) {
    console.error('Không tìm thấy progressChart canvas element');
  }

  // Hủy biểu đồ cũ
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

  try {
    const stats = await getStudyStatistics();
    console.log('Statistics data loaded:', stats);

    updateStatsCards(stats);

    // 1. Khởi tạo progressChart đầu tiên
    console.log('Initializing progressChart...');
    initProgressChart(stats.weeklyProgress);

    // 2. Khởi tạo skillRadarChart (JLPT scores)
    console.log('Initializing skillRadarChart...');
    updateScoresRadarChart();

    // 3. Khởi tạo timeDistributionChart
    console.log('Initializing timeDistributionChart...');
    const filteredStats = filterStatsBySubject(stats, 'all', currentTimeFilter);
    const timeChartData = currentTimeFilter === 'all' ?
      filteredStats.subjectDistribution : filteredStats.subjectDistribution;

    initSubjectDistributionChart(timeChartData);
    displayTaskCategories(filteredStats.taskCategories);
    await displayEffectiveStudyTime();

    console.log('=== INIT CHARTS COMPLETED ===');

  } catch (error) {
    console.error('Lỗi khi khởi tạo biểu đồ:', error);

    // Hiển thị thông báo lỗi trên các canvas
    const canvases = [
      document.getElementById('progressChart'),
      document.getElementById('skillRadarChart'),
      document.getElementById('timeDistributionChart')
    ];

    canvases.forEach(canvas => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f44336';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Lỗi tải biểu đồ', canvas.width / 2, canvas.height / 2);
      }
    });
  }
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

// Hàm tải điểm số từ Firebase
async function loadJLptScores() {
  try {
    const jlptPath = getPhaseDataPath('jlptScores');
    const snapshot = await db.ref(jlptPath).once('value');
    const data = snapshot.val();

    if (data) {
      // Chuyển đổi object thành array
      jlptScores = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    } else {
      jlptScores = [];
    }

    // Sắp xếp theo ngày (mới nhất đầu tiên)
    jlptScores.sort((a, b) => new Date(b.date) - new Date(a.date));

    renderJLptScoresTable();
    updateJLptStatsSummary();
    updateScoresRadarChart();

  } catch (error) {
    console.error('Lỗi khi tải điểm số JLPT:', error);
    jlptScores = [];
  }
}

// Hàm hiển thị bảng điểm số
function renderJLptScoresTable() {
  const tbody = document.getElementById('jlpt-scores-list');
  if (!tbody) return;

  if (jlptScores.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
                    <p>Chưa có điểm số nào. Hãy thêm điểm số để theo dõi tiến độ JLPT!</p>
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = jlptScores.map((score, index) => {
    const passStatus = score.total >= 100; // Điểm đỗ JLPT thường là 100/180
    const date = new Date(score.date);
    const formattedDate = date.toLocaleDateString('vi-VN');

    return `
            <tr>
                <td>${index + 1}</td>
                <td>${formattedDate}</td>
                <td>${score.title}</td>
                <td>
                    ${score.link ?
        `<a href="${score.link}" target="_blank" title="Xem bài thi">
                            <i class="fas fa-external-link-alt"></i>
                        </a>` :
        '-'
      }
                </td>
                <td class="score-cell ${getScoreClass(score.language, 60)}">${score.language}</td>
                <td class="score-cell ${getScoreClass(score.reading, 60)}">${score.reading}</td>
                <td class="score-cell ${getScoreClass(score.listening, 60)}">${score.listening}</td>
                <td class="total-score-cell ${passStatus ? 'score-high' : 'score-low'}">
                    <strong>${score.total}</strong>/180
                </td>
                <td>
                    <button class="btn-score-action btn-edit-score" data-id="${score.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-score-action btn-delete-score" data-id="${score.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
  }).join('');

  // Thêm event listeners cho các nút
  tbody.querySelectorAll('.btn-edit-score').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const scoreId = e.currentTarget.dataset.id;
      openEditJLptScoreModal(scoreId);
    });
  });

  tbody.querySelectorAll('.btn-delete-score').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const scoreId = e.currentTarget.dataset.id;
      deleteJLptScore(scoreId);
    });
  });
}

// Hàm xác định class cho điểm số
function getScoreClass(score, max) {
  const percentage = (score / max) * 100;
  if (percentage >= 70) return 'score-high';
  if (percentage >= 50) return 'score-medium';
  return 'score-low';
}

// Hàm cập nhật thống kê tổng quan
function updateJLptStatsSummary() {
  const summaryEl = document.getElementById('jlpt-stats-summary');
  if (!summaryEl) return;

  if (jlptScores.length === 0) {
    summaryEl.innerHTML = '<div class="stat-summary-item">Chưa có dữ liệu</div>';
    return;
  }

  const totalTests = jlptScores.length;
  const passedTests = jlptScores.filter(score => score.total >= 100).length;
  const avgTotal = Math.round(jlptScores.reduce((sum, score) => sum + score.total, 0) / totalTests);
  const passRate = Math.round((passedTests / totalTests) * 100);

  summaryEl.innerHTML = `
        <div class="stat-summary-item">
            <div class="stat-summary-value">${totalTests}</div>
            <div class="stat-summary-label">Bài thi</div>
        </div>
        <div class="stat-summary-item">
            <div class="stat-summary-value">${passedTests}</div>
            <div class="stat-summary-label">Đỗ</div>
        </div>
        <div class="stat-summary-item">
            <div class="stat-summary-value">${passRate}%</div>
            <div class="stat-summary-label">Tỷ lệ đỗ</div>
        </div>
        <div class="stat-summary-item">
            <div class="stat-summary-value">${avgTotal}</div>
            <div class="stat-summary-label">Điểm TB</div>
        </div>
    `;
}

// Hàm mở modal thêm điểm số mới
function openAddJLptScoreModal() {
  currentEditingScoreId = null;
  document.getElementById('jlpt-score-modal-title').textContent = 'Thêm điểm số JLPT';

  // Reset form
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('jlpt-score-date').value = today;
  document.getElementById('jlpt-score-title').value = '';
  document.getElementById('jlpt-score-link').value = '';
  document.getElementById('jlpt-score-language').value = 0;
  document.getElementById('jlpt-score-reading').value = 0;
  document.getElementById('jlpt-score-listening').value = 0;

  updateJLptTotalScore();
  showModal(document.getElementById('jlpt-score-detail-modal'));
}

// Hàm mở modal sửa điểm số
function openEditJLptScoreModal(scoreId) {
  const score = jlptScores.find(s => s.id === scoreId);
  if (!score) return;

  currentEditingScoreId = scoreId;
  document.getElementById('jlpt-score-modal-title').textContent = 'Chỉnh sửa điểm số JLPT';

  document.getElementById('jlpt-score-date').value = score.date;
  document.getElementById('jlpt-score-title').value = score.title;
  document.getElementById('jlpt-score-link').value = score.link || '';
  document.getElementById('jlpt-score-language').value = score.language;
  document.getElementById('jlpt-score-reading').value = score.reading;
  document.getElementById('jlpt-score-listening').value = score.listening;

  updateJLptTotalScore();
  showModal(document.getElementById('jlpt-score-detail-modal'));
}

// Hàm cập nhật tổng điểm
function updateJLptTotalScore() {
  const language = parseInt(document.getElementById('jlpt-score-language').value) || 0;
  const reading = parseInt(document.getElementById('jlpt-score-reading').value) || 0;
  const listening = parseInt(document.getElementById('jlpt-score-listening').value) || 0;
  const total = language + reading + listening;

  document.getElementById('jlpt-total-score').textContent = total;

  // Cập nhật trạng thái
  const statusEl = document.getElementById('jlpt-score-status');
  statusEl.className = 'score-status ' + (total >= 100 ? 'status-pass' : 'status-fail');
  statusEl.textContent = total >= 100 ? 'ĐẠT (≥100/180)' : 'CHƯA ĐẠT';
}

// Hàm lưu điểm số
async function saveJLptScore() {
  const date = document.getElementById('jlpt-score-date').value;
  const title = document.getElementById('jlpt-score-title').value.trim();
  const link = document.getElementById('jlpt-score-link').value.trim();
  const language = parseInt(document.getElementById('jlpt-score-language').value) || 0;
  const reading = parseInt(document.getElementById('jlpt-score-reading').value) || 0;
  const listening = parseInt(document.getElementById('jlpt-score-listening').value) || 0;
  const total = language + reading + listening;

  if (!date || !title) {
    showCustomAlert('Vui lòng điền ngày và tiêu đề!');
    return;
  }

  if (language < 0 || language > 60 || reading < 0 || reading > 60 || listening < 0 || listening > 60) {
    showCustomAlert('Điểm từng phần phải nằm trong khoảng 0-60!');
    return;
  }

  const scoreData = {
    date,
    title,
    link: link || '',
    language,
    reading,
    listening,
    total,
    updatedAt: new Date().toISOString()
  };

  try {
    const jlptPath = getPhaseDataPath('jlptScores');
    if (currentEditingScoreId) {
      // Cập nhật điểm số hiện có
      await db.ref(`${jlptPath}/${currentEditingScoreId}`).update(scoreData);
    } else {
      // Thêm điểm số mới
      const newScoreId = `jlpt_${Date.now()}`;
      scoreData.createdAt = new Date().toISOString();
      await db.ref(`${jlptPath}/${newScoreId}`).set(scoreData);
    }

    hideModal(document.getElementById('jlpt-score-detail-modal'));
    // Sau khi lưu thành công
    await loadJLptScores();
    refreshJLptCharts();
    showCustomAlert('Đã lưu điểm số thành công!');

  } catch (error) {
    console.error('Lỗi khi lưu điểm số:', error);
    showCustomAlert('Có lỗi xảy ra khi lưu điểm số!');
  }
}

// Hàm xóa điểm số
async function deleteJLptScore(scoreId) {
  if (!confirm('Bạn có chắc muốn xóa điểm số này?')) return;

  try {
    const jlptPath = getPhaseDataPath('jlptScores');
    await db.ref(`${jlptPath}/${scoreId}`).remove();
    // Sau khi xóa thành công
    await loadJLptScores();
    refreshJLptCharts();
    showCustomAlert('Đã xóa điểm số thành công!');
  } catch (error) {
    console.error('Lỗi khi xóa điểm số:', error);
    showCustomAlert('Có lỗi xảy ra khi xóa điểm số!');
  }
}

// Hàm cập nhật biểu đồ radar với điểm số JLPT
function updateScoresRadarChart() {
  const ctx = document.getElementById('skillRadarChart')?.getContext('2d');

  if (!ctx) {
    console.error('Không tìm thấy skillRadarChart canvas');
    return;
  }

  // Hủy biểu đồ cũ nếu có
  if (skillRadarChart) {
    skillRadarChart.destroy();
    skillRadarChart = null;
  }

  // Nếu không có điểm số, hiển thị thông báo
  if (jlptScores.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Vẽ thông báo "Chưa có dữ liệu"
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu điểm số JLPT', ctx.canvas.width / 2, ctx.canvas.height / 2 - 15);

    ctx.font = '14px Arial';
    ctx.fillText('Hãy thêm điểm số để xem biểu đồ', ctx.canvas.width / 2, ctx.canvas.height / 2 + 15);
    return;
  }

  // Tính điểm trung bình và cao nhất
  const averages = {
    language: 0,
    reading: 0,
    listening: 0
  };

  const maxScores = {
    language: 0,
    reading: 0,
    listening: 0
  };

  jlptScores.forEach(score => {
    averages.language += score.language;
    averages.reading += score.reading;
    averages.listening += score.listening;

    maxScores.language = Math.max(maxScores.language, score.language);
    maxScores.reading = Math.max(maxScores.reading, score.reading);
    maxScores.listening = Math.max(maxScores.listening, score.listening);
  });

  averages.language = Math.round(averages.language / jlptScores.length);
  averages.reading = Math.round(averages.reading / jlptScores.length);
  averages.listening = Math.round(averages.listening / jlptScores.length);

  try {
    skillRadarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: [
          `Kiến thức ngôn ngữ`,
          `Đọc hiểu`,
          `Nghe hiểu`
        ],
        datasets: [
          {
            label: `Điểm trung bình (${jlptScores.length} bài)`,
            data: [averages.language, averages.reading, averages.listening],
            backgroundColor: 'rgba(26, 42, 108, 0.2)',
            borderColor: 'rgba(26, 42, 108, 1)',
            pointBackgroundColor: 'rgba(26, 42, 108, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            borderWidth: 2
          },
          {
            label: 'Điểm cao nhất',
            data: [maxScores.language, maxScores.reading, maxScores.listening],
            backgroundColor: 'rgba(253, 187, 45, 0.2)',
            borderColor: 'rgba(253, 187, 45, 1)',
            pointBackgroundColor: 'rgba(253, 187, 45, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            borderWidth: 2,
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 60,
            ticks: {
              stepSize: 15,
              callback: function (value) {
                return value + ' điểm';
              },
              font: {
                size: 11
              }
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            angleLines: {
              color: 'rgba(0,0,0,0.1)'
            },
            pointLabels: {
              font: {
                size: 12,
                weight: 'bold'
              },
              color: '#333'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || '';
                const skill = context.label;
                const value = context.raw;
                const avgText = context.datasetIndex === 0 ?
                  ` (TB: ${averages[getSkillKey(skill)]} điểm)` :
                  ` (Cao nhất: ${maxScores[getSkillKey(skill)]} điểm)`;

                return `${label} - ${skill}: ${value} điểm${avgText}`;
              }
            }
          }
        }
      }
    });

    console.log('skillRadarChart đã được khởi tạo thành công');

  } catch (error) {
    console.error('Lỗi khi khởi tạo skillRadarChart:', error);

    // Hiển thị thông báo lỗi
    ctx.fillStyle = '#f44336';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Lỗi khi tải biểu đồ kỹ năng', ctx.canvas.width / 2, ctx.canvas.height / 2);
  }
}

// Hàm helper để lấy key từ tên kỹ năng
function getSkillKey(skillName) {
  const skillMap = {
    'Kiến thức ngôn ngữ': 'language',
    'Đọc hiểu': 'reading',
    'Nghe hiểu': 'listening'
  };
  return skillMap[skillName] || 'language';
}

// Hàm tải biểu đồ điểm số độc lập
function loadJLptScoresChart() {
  updateScoresRadarChart();
}

// Hàm refresh biểu đồ khi có thay đổi điểm số
function refreshJLptCharts() {
  loadJLptScores().then(() => {
    updateScoresRadarChart();
    createProgressHeatmap(jlptScores);
  });

  // Also refresh skill assessments
  loadSkillAssessments().then(() => {
    updateSkillRadarChartWithFilter();
  });
}

// Hàm thiết lập event listeners cho phần điểm số
function setupJLptScoresEventListeners() {
  // Nút mở modal quản lý điểm số
  document.getElementById('manage-scores-btn')?.addEventListener('click', () => {
    loadJLptScores();
    showModal(document.getElementById('jlpt-scores-modal'));
  });

  // Nút đóng modal quản lý điểm số
  document.getElementById('close-scores-modal')?.addEventListener('click', () => {
    hideModal(document.getElementById('jlpt-scores-modal'));
  });

  // Nút thêm điểm số mới
  document.getElementById('add-jlpt-score-btn')?.addEventListener('click', openAddJLptScoreModal);

  // Nút đóng modal chi tiết điểm số
  document.getElementById('close-score-detail-modal')?.addEventListener('click', () => {
    hideModal(document.getElementById('jlpt-score-detail-modal'));
  });

  // Nút hủy trong modal chi tiết
  document.getElementById('cancel-jlpt-score')?.addEventListener('click', () => {
    hideModal(document.getElementById('jlpt-score-detail-modal'));
  });

  // Nút lưu điểm số
  document.getElementById('save-jlpt-score')?.addEventListener('click', saveJLptScore);

  // Tự động tính tổng khi thay đổi điểm từng phần
  ['jlpt-score-language', 'jlpt-score-reading', 'jlpt-score-listening'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateJLptTotalScore);
  });

  // Đóng modal khi click ra ngoài
  document.getElementById('jlpt-scores-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('jlpt-scores-modal')) {
      hideModal(document.getElementById('jlpt-scores-modal'));
    }
  });

  document.getElementById('jlpt-score-detail-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('jlpt-score-detail-modal')) {
      hideModal(document.getElementById('jlpt-score-detail-modal'));
    }
  });
}

// Progress Heat Map
// Hàm tạo Progress Heatmap
function createProgressHeatmap(jlptScores) {
  console.log('Creating Progress Heatmap with scores:', jlptScores);

  if (!jlptScores || jlptScores.length < 2) {
    displayNoHeatmapData();
    return;
  }

  // Tính toán dữ liệu tiến bộ
  const progressData = calculateProgressData(jlptScores);

  // Render heatmap
  renderProgressHeatmap(progressData);
}

// Tính toán dữ liệu tiến bộ từ điểm JLPT
function calculateProgressData(scores) {
  const skills = ['Kiến thức ngôn ngữ', 'Đọc hiểu', 'Nghe hiểu'];
  const skillKeys = ['language', 'reading', 'listening'];

  // Sắp xếp theo ngày
  const sortedScores = scores.sort((a, b) => new Date(a.date) - new Date(b.date));

  const weeks = [];
  const progressData = [];

  // Tính deltaScore cho mỗi lần thi (từ lần 2 trở đi)
  for (let i = 1; i < sortedScores.length; i++) {
    const currentScore = sortedScores[i];
    const previousScore = sortedScores[i - 1];
    const weekLabel = `Lần ${i + 1}`;

    weeks.push(weekLabel);

    // Tính cho từng kỹ năng
    skillKeys.forEach((skillKey, skillIndex) => {
      const deltaScore = currentScore[skillKey] - previousScore[skillKey];

      progressData.push({
        skillIndex,
        weekIndex: i - 1,
        skillName: skills[skillIndex],
        week: weekLabel,
        deltaScore,
        currentScore: currentScore[skillKey],
        previousScore: previousScore[skillKey],
        date: currentScore.date,
        testTitle: currentScore.title || `Bài thi ${i + 1}`
      });
    });
  }

  return {
    skills,
    weeks,
    data: progressData
  };
}

// Render Progress Heatmap
function renderProgressHeatmap(progressData) {
  const container = document.getElementById('progress-heatmap-container');
  if (!container) return;

  const { skills, weeks, data } = progressData;

  // Tạo mapping data
  const gridData = new Map();
  data.forEach(item => {
    const key = `${item.skillIndex}-${item.weekIndex}`;
    gridData.set(key, item);
  });

  // CSS classes cho màu sắc
  const getCellClass = (deltaScore) => {
    if (deltaScore === null || deltaScore === undefined) return 'cell-no-data';
    if (deltaScore === 0) return 'cell-neutral';

    if (deltaScore > 0) {
      if (deltaScore >= 10) return 'cell-positive-5';
      if (deltaScore >= 7) return 'cell-positive-4';
      if (deltaScore >= 5) return 'cell-positive-3';
      if (deltaScore >= 3) return 'cell-positive-2';
      return 'cell-positive-1';
    } else {
      const abs = Math.abs(deltaScore);
      if (abs >= 10) return 'cell-negative-5';
      if (abs >= 7) return 'cell-negative-4';
      if (abs >= 5) return 'cell-negative-3';
      if (abs >= 3) return 'cell-negative-2';
      return 'cell-negative-1';
    }
  };

  // HTML cho heatmap
  let heatmapHTML = `
    <div class="heatmap-grid">
      <div class="heatmap-header">
        <div class="heatmap-header-skill">Kỹ năng</div>
        ${weeks.map(week => `<div class="heatmap-header-week">${week}</div>`).join('')}
      </div>
  `;

  // Render các hàng dữ liệu
  skills.forEach((skill, skillIndex) => {
    heatmapHTML += `<div class="heatmap-row">`;
    heatmapHTML += `<div class="heatmap-skill-label">${skill}</div>`;

    weeks.forEach((week, weekIndex) => {
      const key = `${skillIndex}-${weekIndex}`;
      const cellData = gridData.get(key);

      if (cellData) {
        const deltaScore = cellData.deltaScore;
        const cellClass = getCellClass(deltaScore);
        const displayValue = deltaScore > 0 ? `+${deltaScore}` : deltaScore.toString();

        heatmapHTML += `
          <div class="heatmap-cell ${cellClass}" 
               data-skill="${skill}" 
               data-week="${week}" 
               data-delta="${deltaScore}"
               data-current="${cellData.currentScore}"
               data-previous="${cellData.previousScore}"
               data-test="${cellData.testTitle}"
               title="${skill}, ${week}: ${deltaScore > 0 ? '+' : ''}${deltaScore} điểm (từ ${cellData.previousScore} → ${cellData.currentScore}) - ${cellData.testTitle}">
            ${displayValue}
          </div>
        `;
      } else {
        heatmapHTML += `
          <div class="heatmap-cell cell-no-data" title="Chưa có dữ liệu">-</div>
        `;
      }
    });

    heatmapHTML += `</div>`;
  });

  heatmapHTML += `</div>`;

  // Render container
  container.innerHTML = `
    <div class="heatmap-chart">
      ${heatmapHTML}
    </div>
    <div class="heatmap-summary">
      ${renderHeatmapSummary(data)}
    </div>
  `;
}

// Render thống kê tóm tắt cho heatmap
function renderHeatmapSummary(data) {
  if (!data || data.length === 0) return '';

  const totalChanges = data.length;
  const positiveChanges = data.filter(d => d.deltaScore > 0).length;
  const negativeChanges = data.filter(d => d.deltaScore < 0).length;
  const neutralChanges = data.filter(d => d.deltaScore === 0).length;

  const avgImprovement = data.reduce((sum, d) => sum + d.deltaScore, 0) / totalChanges;
  const maxImprovement = Math.max(...data.map(d => d.deltaScore));
  const maxDecline = Math.min(...data.map(d => d.deltaScore));

  // Tìm kỹ năng tiến bộ nhất
  const skillProgress = {};
  data.forEach(d => {
    if (!skillProgress[d.skillName]) {
      skillProgress[d.skillName] = [];
    }
    skillProgress[d.skillName].push(d.deltaScore);
  });

  let bestSkill = '';
  let bestAvg = -Infinity;
  Object.keys(skillProgress).forEach(skill => {
    const avg = skillProgress[skill].reduce((a, b) => a + b, 0) / skillProgress[skill].length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestSkill = skill;
    }
  });

  return `
    <div class="heatmap-stats">
      <h4><i class="fas fa-chart-bar"></i> Thống kê tiến bộ</h4>
      <div class="heatmap-stats-grid">
        <div class="heatmap-stat-item">
          <div class="stat-value">${totalChanges}</div>
          <div class="stat-label">Lần đánh giá</div>
        </div>
        <div class="heatmap-stat-item positive">
          <div class="stat-value">${positiveChanges}</div>
          <div class="stat-label">Lần tiến bộ</div>
        </div>
        <div class="heatmap-stat-item negative">
          <div class="stat-value">${negativeChanges}</div>
          <div class="stat-label">Lần tụt lùi</div>
        </div>
        <div class="heatmap-stat-item">
          <div class="stat-value ${avgImprovement >= 0 ? 'positive' : 'negative'}">
            ${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(1)}
          </div>
          <div class="stat-label">Trung bình</div>
        </div>
        <div class="heatmap-stat-item positive">
          <div class="stat-value">+${maxImprovement}</div>
          <div class="stat-label">Tiến bộ tối đa</div>
        </div>
        <div class="heatmap-stat-item">
          <div class="stat-value" style="font-size: 0.9em;">${bestSkill}</div>
          <div class="stat-label">Kỹ năng mạnh nhất</div>
        </div>
      </div>
    </div>
  `;
}

// Hiển thị thông báo khi không có dữ liệu
function displayNoHeatmapData() {
  const container = document.getElementById('progress-heatmap-container');
  if (!container) return;

  container.innerHTML = `
    <div class="no-data-message">
      <i class="fas fa-chart-bar"></i>
      <p><strong>Chưa có dữ liệu cho Progress Heatmap</strong></p>
      <p>Cần ít nhất 2 lần thi JLPT để tạo bản đồ nhiệt tiến bộ</p>
      <p>Hãy thêm điểm số từ nút "Quản lý điểm JLPT" ở trên</p>
    </div>
  `;
}

// Cập nhật hàm refreshJLptCharts để bao gồm heatmap
function refreshJLptCharts() {
  loadJLptScores().then(() => {
    updateScoresRadarChart();
    createProgressHeatmap(jlptScores); // Thêm dòng này
  });
}

// Cập nhật hàm initCharts để bao gồm heatmap
async function initCharts() {
  console.log('=== INIT CHARTS START ===');

  try {
    const stats = await getStudyStatistics();
    console.log('Statistics data loaded:', stats);

    updateStatsCards(stats);

    // 1. Khởi tạo progressChart
    console.log('Initializing progressChart...');
    initProgressChart(stats.weeklyProgress);

    // 2. Khởi tạo skillRadarChart (JLPT scores)
    console.log('Initializing skillRadarChart...');
    updateScoresRadarChart();

    // 3. Khởi tạo timeDistributionChart
    console.log('Initializing timeDistributionChart...');
    const filteredStats = filterStatsBySubject(stats, 'all', currentTimeFilter);
    const timeChartData = currentTimeFilter === 'all' ?
      filteredStats.subjectDistribution : filteredStats.subjectDistribution;

    initSubjectDistributionChart(timeChartData);
    displayTaskCategories(filteredStats.taskCategories);
    await displayEffectiveStudyTime();

    // 4. Khởi tạo Progress Heatmap - THÊM MỚI
    console.log('Initializing Progress Heatmap...');
    createProgressHeatmap(jlptScores);

    console.log('=== INIT CHARTS COMPLETED ===');

  } catch (error) {
    console.error('Lỗi khi khởi tạo biểu đồ:', error);
  }
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

  const sessionsPath = getPhaseDataPath(`studySessions/${dateKey}/${sessionKey}`);
  db.ref(sessionsPath).set({
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
    const sessionsPath = getPhaseDataPath(`studySessions/${dateKey}/${sessionKey}`);
    await db.ref(sessionsPath).update({
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

  const dailyPath = getPhaseDataPath(`userStats/daily/${monthKey}/${date.getDate()}`);
  const dailyRef = db.ref(dailyPath);
  const dailySnapshot = await dailyRef.once('value');
  const currentDaily = dailySnapshot.val() || 0;
  await dailyRef.set(currentDaily + duration);

  const weeklyPath = getPhaseDataPath(`userStats/weekly/${weekKey}`);
  const weeklyRef = db.ref(weeklyPath);
  const weeklySnapshot = await weeklyRef.once('value');
  const currentWeekly = weeklySnapshot.val() || 0;
  await weeklyRef.set(currentWeekly + duration);

  const monthlyPath = getPhaseDataPath(`userStats/monthly/${monthKey}`);
  const monthlyRef = db.ref(monthlyPath);
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

function setupEventListeners() {
  document.getElementById("prev-week")?.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadCurrentWeek();
  });

  document.getElementById("next-week")?.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadCurrentWeek();
  });

  document.getElementById("current-week-btn")?.addEventListener("click", () => {
    currentWeekStart = getStartOfWeek(new Date());
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
  // Handle check button clicks
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
    return;
  }

  // Handle edit button clicks
  const editBtn = e.target.closest('.edit-task-btn');
  if (editBtn) {
    e.preventDefault();
    const card = editBtn.closest('.day-card');
    if (card) {
      const date = card.getAttribute('data-date');
      if (date) openEditDayModal(date);
    }
    return;
  }

  // Prevent drag handle from triggering other actions
  if (e.target.closest('.drag-handle')) {
    e.preventDefault();
    return;
  }
});

async function toggleTaskDone(date, taskIndex) {
  try {
    const taskElement = document.querySelector(`.day-card[data-date="${date}"] .study-item[data-task-index="${taskIndex}"]`);
    if (!taskElement) return;

    const taskTitle = taskElement.querySelector('.task-content').textContent;

    // Find the correct path for the task
    const schedulePath = await findTaskPath(date, taskTitle);

    if (!schedulePath) {
      console.error(`Không tìm thấy đường dẫn cho nhiệm vụ: "${taskTitle}" vào ngày ${date}`);
      showCustomAlert("Không thể cập nhật nhiệm vụ vì không tìm thấy dữ liệu gốc.");
      return;
    }

    const taskRef = db.ref(schedulePath);
    const snapshot = await taskRef.once('value');
    const taskData = snapshot.val();

    if (!taskData) {
      console.error(`Dữ liệu không tồn tại tại đường dẫn: ${schedulePath}`);
      return;
    }

    const currentDone = taskData.done;
    await taskRef.update({ done: !currentDone });

    if (taskElement) { // Re-use the existing taskElement variable
      taskElement.classList.toggle('done', !currentDone);
      const icon = taskElement.querySelector('.check-btn i');
      if (icon) {
        icon.className = !currentDone ? 'fas fa-check-circle' : 'far fa-circle';
      }
    }

    const newStreak = await calculateStreak();
    updateStreakDisplay(newStreak);

    updateProgress(true); // Truyền true để kích hoạt confetti nếu đạt mục tiêu

    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'stats') {
      initCharts();
    }

  } catch (error) {
    console.error("Lỗi khi cập nhật nhiệm vụ:", error);
  }
}

async function findTaskPath(date, taskTitle, findDayPath = false) {
  // 1. Check current phase
  if (currentPhaseId) {
    const phasePath = `phaseData/${currentPhaseId}/schedule/${date}/tasks`;
    const dayPath = `phaseData/${currentPhaseId}/schedule/${date}`;
    const phaseSnapshot = await db.ref(dayPath).once('value');
    if (phaseSnapshot.exists()) {
      if (findDayPath) return dayPath;
      if (!taskTitle) return `${phasePath}/0`; // Fallback

      const tasks = phaseSnapshot.val().tasks || [];
      const taskIndex = tasks.findIndex(t => t && t.title === taskTitle);
      if (taskIndex !== -1) return `${phasePath}/${taskIndex}`;
    }
  }

  // 2. Check all other phases
  const phasesSnapshot = await db.ref('phases').once("value");
  if (phasesSnapshot.exists()) {
    const allPhases = phasesSnapshot.val();
    for (const phaseId of Object.keys(allPhases)) {
      if (phaseId === currentPhaseId) continue;
      const phasePath = `phaseData/${phaseId}/schedule/${date}/tasks`;
      const dayPath = `phaseData/${phaseId}/schedule/${date}`;
      const phaseSnapshot = await db.ref(dayPath).once('value');
      if (phaseSnapshot.exists()) {
        if (findDayPath) return dayPath;
        if (!taskTitle) return `${phasePath}/0`; // Fallback

        const tasks = phaseSnapshot.val().tasks || [];
        const taskIndex = tasks.findIndex(t => t && t.title === taskTitle);
        if (taskIndex !== -1) return `${phasePath}/${taskIndex}`;
      }
    }
  }

  // 3. Check global schedule (fallback)
  const globalPath = `schedule/${date}/tasks`;
  const dayPath = `schedule/${date}`;
  const globalSnapshot = await db.ref(dayPath).once('value');
  if (globalSnapshot.exists()) {
    if (findDayPath) return dayPath;
    if (!taskTitle) return `${globalPath}/0`; // Fallback

    const tasks = globalSnapshot.val().tasks || [];
    const taskIndex = tasks.findIndex(t => t && t.title === taskTitle);
    if (taskIndex !== -1) return `${globalPath}/${taskIndex}`;
  }

  return null; // Task not found
}

function updateStreakDisplay(streakData) {
  const streakElement = document.getElementById('streak-days');
  if (streakElement) {
    streakElement.textContent = streakData.current;
  }
}

function minimizeTimer() {
  isTimerMinimized = true;

  // Ẩn modal chính
  hideModal(countdownModal);

  // Hiển thị đồng hồ nổi
  timerFloatingContainer.classList.remove('minimized');

  // Cập nhật đồng hồ nổi
  updateFloatingTimerDisplay();

  // Bắt đầu cập nhật đồng hồ nổi
  if (minimizedTimerInterval) clearInterval(minimizedTimerInterval);
  minimizedTimerInterval = setInterval(updateFloatingTimerDisplay, 1000);
}

function restoreTimer() {
  isTimerMinimized = false;

  // Ẩn đồng hồ nổi
  timerFloatingContainer.classList.add('minimized');

  // Hiển thị modal chính
  showModal(countdownModal);

  // Dừng cập nhật đồng hồ nổi
  if (minimizedTimerInterval) {
    clearInterval(minimizedTimerInterval);
    minimizedTimerInterval = null;
  }
}

function updateFloatingTimerDisplay() {
  if (!isTimerMinimized) return;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  if (floatingTimerDisplay) {
    floatingTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Thay đổi màu sắc khi sắp hết giờ
    if (timeLeft < 60) {
      floatingTimerDisplay.style.color = '#ff4757';
    } else {
      floatingTimerDisplay.style.color = '';
    }
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Cập nhật đồng hồ chính
  if (timerDisplay) {
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Cập nhật đồng hồ nổi nếu đang thu nhỏ
  if (isTimerMinimized) {
    updateFloatingTimerDisplay();
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

// Cập nhật handleTimerCompletion với âm thanh được cải thiện
function handleTimerCompletion() {
  clearInterval(countdownInterval);

  if (isStudyPhase) {
    console.log('Study phase completed');

    // Phát âm thanh thông báo hết giờ học
    playNotificationSound({
      type: 'notification',
      repeat: true,
      repeatCount: 3,
      repeatInterval: 1500
    });

    // Vibration cho mobile
    if ('vibrate' in navigator) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }

    isStudyPhase = false;
    timerDuration = parseInt(breakMinutesInput.value) * 60;
    timerStartTime = new Date().getTime();

    isManualClose = false;
    showModal(breakModal);
    updateBreakMessage(studyMinutesInput.value, breakMinutesInput.value);

    if (document.hidden) {
      showNotification("Hết giờ học!", `Đã hoàn thành ${studyMinutesInput.value} phút học tập!`);
    }
  } else {
    console.log('Break phase completed');

    // Phát âm thanh thông báo hết giờ nghỉ
    playNotificationSound({
      type: 'notification',
      repeat: true,
      repeatCount: 5,
      repeatInterval: 800
    });

    // Vibration cho mobile
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 50, 200, 50, 200, 50, 200]);
    }

    stopTimer();

    if (document.hidden) {
      showNotification("Hết giờ nghỉ!", `Đã nghỉ ${breakMinutesInput.value} phút. Sẵn sàng học tiếp!`);
    }
  }
}
///// ----------------------------
// BONG BÓNG ĐỒNG HỒ NỔI
///// ----------------------------
// Hàm thu nhỏ bộ đếm giờ thành bong bóng
function minimizeToBubble() {
  isTimerMinimized = true;

  // Ẩn modal chính
  hideModal(countdownModal);

  // Hiển thị bong bóng
  const bubble = document.getElementById('floating-timer-bubble');
  if (bubble) {
    bubble.classList.remove('minimized');
  }

  // Cập nhật hiển thị bong bóng
  updateBubbleTimerDisplay();

  // Bắt đầu cập nhật bong bóng
  if (floatingTimerInterval) clearInterval(floatingTimerInterval);
  floatingTimerInterval = setInterval(updateBubbleTimerDisplay, 1000);
}

// Hàm khôi phục từ bong bóng về modal
function restoreFromBubble() {
  isTimerMinimized = false;

  // Ẩn bong bóng
  const bubble = document.getElementById('floating-timer-bubble');
  if (bubble) {
    bubble.classList.add('minimized');
  }

  // Hiển thị modal chính
  showModal(countdownModal);

  // Dừng cập nhật bong bóng
  if (floatingTimerInterval) {
    clearInterval(floatingTimerInterval);
    floatingTimerInterval = null;
  }
}

// Cập nhật trạng thái cảnh báo
function updateBubbleWarningState() {
  const bubble = document.getElementById('floating-timer-bubble');
  if (!bubble) return;

  if (timeLeft < 60) {
    bubble.classList.add('warning');
  } else {
    bubble.classList.remove('warning');
  }
}

// Cập nhật hiển thị đồng hồ trên bong bóng
function updateBubbleTimerDisplay() {
  if (!isTimerMinimized) return;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const bubbleDisplay = document.getElementById('bubble-timer-display');

  if (bubbleDisplay) {
    bubbleDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Thay đổi màu sắc khi sắp hết giờ
    if (timeLeft < 60) {
      bubbleDisplay.style.color = '#ff4757';
    } else {
      bubbleDisplay.style.color = '';
    }
  }
}

// Cập nhật stopTimer để dừng âm thanh
function stopTimer() {
  console.log('Stopping timer - cleaning up audio');

  // Dừng âm thanh trước tiên
  stopNotificationSound();

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

  // Ẩn floating timer
  if (isTimerMinimized) {
    const bubble = document.getElementById('floating-timer-bubble');
    if (bubble) {
      bubble.classList.add('minimized');
    }
    isTimerMinimized = false;
  }

  if (floatingTimerInterval) {
    clearInterval(floatingTimerInterval);
    floatingTimerInterval = null;
  }

  if (minimizedTimerInterval) {
    clearInterval(minimizedTimerInterval);
    minimizedTimerInterval = null;
  }
}

// Thêm sự kiện cho nút thu nhỏ và khôi phục
if (minimizeTimerBtn) {
  minimizeTimerBtn.addEventListener('click', minimizeToBubble);
}

// Thêm sự kiện cho nút khôi phục trên bong bóng
document.getElementById('restore-timer-bubble')?.addEventListener('click', restoreFromBubble);

// Thêm sự kiện cho nút dừng trên bong bóng
document.getElementById('stop-timer-bubble')?.addEventListener('click', stopTimer);

// Cho phép kéo bong bóng (tùy chọn)
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
const bubble = document.getElementById('floating-timer-bubble');

if (bubble) {
  bubble.addEventListener('mousedown', function (e) {
    isDragging = true;
    dragOffset.x = e.clientX - bubble.getBoundingClientRect().left;
    dragOffset.y = e.clientY - bubble.getBoundingClientRect().top;
    bubble.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', function (e) {
    if (isDragging) {
      bubble.style.left = (e.clientX - dragOffset.x) + 'px';
      bubble.style.top = (e.clientY - dragOffset.y) + 'px';
      bubble.style.right = 'unset';
      bubble.style.bottom = 'unset';
    }
  });

  document.addEventListener('mouseup', function () {
    isDragging = false;
    bubble.style.cursor = 'pointer';
  });
}

// Thêm sự kiện cho nút thu nhỏ và khôi phục
if (minimizeTimerBtn) {
  minimizeTimerBtn.addEventListener('click', minimizeTimer);
}

if (restoreTimerBtn) {
  restoreTimerBtn.addEventListener('click', restoreTimer);
}

if (stopFloatingTimerBtn) {
  stopFloatingTimerBtn.addEventListener('click', stopTimer);
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

function setupRealTimeListeners() {
  const schedulePath = getPhaseDataPath('schedule');
  const sessionsPath = getPhaseDataPath('studySessions');

  db.ref(schedulePath).on('value', async () => {
    const newStreak = await calculateStreak();
    updateStreakDisplay(newStreak);
  });

  db.ref(sessionsPath).on('value', async () => {
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

// Load and display current phase
async function loadAndDisplayPhase() {
  try {
    const snapshot = await db.ref('activePhase').once('value');
    const activePhaseId = snapshot.val();

    if (activePhaseId) {
      currentPhaseId = activePhaseId;
      const phaseSnapshot = await db.ref(`phases/${activePhaseId}`).once('value');
      if (phaseSnapshot.exists()) {
        const phase = phaseSnapshot.val();

        console.log('Phase data loaded:', phase); // Debug log

        // Cập nhật biến toàn cục cho ngày bắt đầu và tổng số tuần
        if (phase.startDate) {
          // Chuẩn hóa về đầu tuần (Thứ 2) để khớp với cách tính lịch
          basePhaseStartDate = getStartOfWeek(new Date(phase.startDate));
          
          if (phase.endDate) {
            const start = new Date(phase.startDate);
            const end = new Date(phase.endDate);
            const diffTime = Math.abs(end - start);
            const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)); 
            currentPhaseTotalWeeks = diffWeeks > 0 ? diffWeeks : 1;
          }
        }

        currentPhaseWeeklyGoal = phase.weeklyGoal || 0;

        document.getElementById('phase-name-display').textContent = phase.name;

        // Sử dụng cách tạo ngày đơn giản và chính xác hơn
        const startDate = new Date(phase.startDate);
        const endDate = new Date(phase.endDate);
        const today = new Date();

        // Chỉ lấy phần ngày (bỏ giờ phút giây)
        today.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        console.log('Dates:', {
          startDate: startDate.toDateString(),
          endDate: endDate.toDateString(),
          today: today.toDateString()
        }); // Debug log

        // Tính số tuần
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);
        const weeks = Math.ceil(daysDiff / 7);

        // Tính ngày còn lại - QUAN TRỌNG: cần tính từ hôm nay đến endDate
        const remainingTime = endDate.getTime() - today.getTime();
        const remainingDays = Math.round(remainingTime / (1000 * 3600 * 24));

        console.log('Calculated:', { weeks, remainingDays, remainingTime }); // Debug log

        // Hiển thị thông tin phase
        document.getElementById('phase-dates-display').textContent =
          `${formatDateDisplay(phase.startDate)} - ${formatDateDisplay(phase.endDate)}`;
        document.getElementById('phase-weeks-display').textContent = weeks;

        // Cập nhật thẻ thống kê tóm tắt
        const summaryWeeksEl = document.getElementById('summary-weeks');
        const summaryGoalEl = document.getElementById('summary-goal');
        const summaryRemainingDaysEl = document.getElementById('summary-remaining-days');
        const completedBadge = document.getElementById('phase-completed-badge');

        if (summaryWeeksEl) summaryWeeksEl.textContent = weeks;
        if (summaryGoalEl) summaryGoalEl.textContent = phase.goal || 'Chưa có';

        // Sửa lỗi hiển thị ngày còn lại
        if (summaryRemainingDaysEl) {
          if (remainingDays <= 0) { 
            summaryRemainingDaysEl.textContent = "Đã hoàn thành";
            if (completedBadge) {
              completedBadge.style.display = 'inline-block';
            }
          } else {
            summaryRemainingDaysEl.textContent = remainingDays;
            if (completedBadge) completedBadge.style.display = 'none';
          }
        }

        console.log("Remaining days: ", remainingDays);
        console.log("Displayed as: ", summaryRemainingDaysEl?.textContent);
      }
    }
  } catch (error) {
    console.error('Error loading phase:', error);
  }
}

// Sửa hàm formatDateDisplay để hiển thị đúng định dạng Việt Nam
function formatDateDisplay(dateStr) {
  const date = new Date(dateStr);
  // Đảm bảo không có vấn đề timezone bằng cách sử dụng UTC
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1; // Tháng bắt đầu từ 0
  const year = date.getUTCFullYear();

  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
}

// --- START: AUTH & DB ABSTRACTION LAYER ---

class FirebaseHandler {
  constructor() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      this.db = firebase.database();
      console.log("Firebase Initialized for Admin.");
    } catch (e) {
      console.error("Firebase initialization error:", e);
    }
  }

  ref(path) {
    return this.db.ref(path);
  }
}

class LocalStorageHandler {
  constructor() {
    this.storageKey = 'studyPlanGuestData';
    this.data = this._loadData();
    console.log("LocalStorage DB Initialized for Guest.");
  }

  _loadData() {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      return storedData ? JSON.parse(storedData) : {};
    } catch (e) {
      console.error("Error loading data from localStorage", e);
      return {};
    }
  }

  _saveData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.error("Error saving data to localStorage", e);
    }
  }

  _getNested(path) {
    return path.split('/').reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, this.data);
  }

  _setNested(path, value) {
    const keys = path.split('/');
    const lastKey = keys.pop();
    let current = this.data;
    for (const key of keys) {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    current[lastKey] = value;
    this._saveData();
  }

  _removeNested(path) {
    const keys = path.split('/');
    const lastKey = keys.pop();
    let parent = this.data;
    for (const key of keys) {
      if (!parent[key]) return;
      parent = parent[key];
    }
    if (parent) {
      delete parent[lastKey];
      this._saveData();
    }
  }

  ref(path) {
    const self = this;
    return {
      once: (eventType) => {
        return Promise.resolve({
          val: () => self._getNested(path),
          exists: () => self._getNested(path) !== undefined
        });
      },
      set: (value) => {
        self._setNested(path, value);
        return Promise.resolve();
      },
      update: (value) => {
        const existing = self._getNested(path) || {};
        self._setNested(path, { ...existing, ...value });
        return Promise.resolve();
      },
      remove: () => {
        self._removeNested(path);
        return Promise.resolve();
      }
    };
  }
}

// Initialize the app
document.addEventListener("DOMContentLoaded", async () => {
  // Khởi tạo audio sau user interaction đầu tiên
  const enableAudioOnInteraction = () => {
    initializeAudioSystem();
    addAudioControlsToModal();

    // Remove listeners sau khi đã khởi tạo
    document.removeEventListener('click', enableAudioOnInteraction);
    document.removeEventListener('touchstart', enableAudioOnInteraction);
    document.removeEventListener('keydown', enableAudioOnInteraction);
  };

  document.addEventListener('click', enableAudioOnInteraction);
  document.addEventListener('touchstart', enableAudioOnInteraction);
  document.addEventListener('keydown', enableAudioOnInteraction);

  // --- START: LOGIN LOGIC ---
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const pinInput = document.getElementById('pin-input');
  const guestBtn = document.getElementById('guest-login-btn');
  const loginError = document.getElementById('login-error');

  // --- START: SESSION & PIN VISIBILITY LOGIC ---
  const togglePinBtn = document.getElementById('toggle-pin-visibility');
  if (togglePinBtn) {
    togglePinBtn.addEventListener('click', () => {
      const isPassword = pinInput.type === 'password';
      pinInput.type = isPassword ? 'text' : 'password';
      togglePinBtn.classList.toggle('fa-eye', !isPassword);
      togglePinBtn.classList.toggle('fa-eye-slash', isPassword);
    });
  }

  const checkAdminSession = () => {
    const session = JSON.parse(localStorage.getItem('adminSession'));
    return session && (new Date().getTime() - session.timestamp < 30 * 24 * 60 * 60 * 1000);
  };
  // --- END: SESSION & PIN VISIBILITY LOGIC ---

  const startApp = async (role) => {
    userRole = role;
    if (role === 'admin') {
      db = new FirebaseHandler();
    } else {
      db = new LocalStorageHandler();
      // Hide admin button for guests
      const adminBtn = document.getElementById('admin-btn');
      if (adminBtn) adminBtn.style.display = 'none';
    }

    hideModal(loginModal);

    // --- Regular App Initialization ---
    await loadAndDisplayPhase();
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
      });
    }
    currentWeekStart = getStartOfWeek();
    await loadCustomTaskTypes();
    loadCurrentWeek();
    setupSkillAssessmentEventListeners();
    await loadSkillAssessments();
    setupEventListeners();
    setupTabNavigation();
    if (userRole === 'admin') {
      setupRealTimeListeners();
    }
    setupJLptScoresEventListeners();
    await loadJLptScores();
    if (studyMinutesInput) {
      timeLeft = parseInt(studyMinutesInput.value) * 60;
      updateTimerDisplay();
    }
    if (userRole === 'admin') {
      migrateOldDataToLanguageCategory();
    }
    loadResources();
    setupResourcesEventListeners();
    initializeDragAndDrop();
    initReminderSystem(); // Khởi tạo hệ thống nhắc nhở
    initCharts();
    displayEffectiveStudyTime();
  };

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pinInput.value === '290302') {
      // Save admin session
      const session = { timestamp: new Date().getTime() };
      localStorage.setItem('adminSession', JSON.stringify(session));
      startApp('admin');
    } else {
      loginError.style.display = 'block';
      localStorage.removeItem('adminSession');
    }
  });

  guestBtn.addEventListener('click', () => {
    // Clear admin session when logging in as guest
    localStorage.removeItem('adminSession');
    startApp('guest');
  });

  // Check for existing session on page load
  if (checkAdminSession()) {
    startApp('admin');
  }
  // --- END: LOGIN LOGIC ---
});