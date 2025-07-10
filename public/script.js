// Khởi tạo biến toàn cục
let currentUser = "user_" + Math.random().toString(36).substr(2, 9);
let currentWeek = 1;
let totalWeeks = 21;
let tasksData = {};
let editingTaskId = null;

// Khởi tạo ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
    initFirebase();
    loadInitialData();
    setupEventListeners();
    generateWeeklySchedule();
    updateStats();
});

// Thiết lập event listeners
function setupEventListeners() {
    // Nút tuần trước/sau
    document.getElementById('prev-week').addEventListener('click', goToPreviousWeek);
    document.getElementById('next-week').addEventListener('click', goToNextWeek);
    
    // Lưu ghi chú
    document.getElementById('saveNotesBtn').addEventListener('click', saveWeeklyNotes);
    
    // Modal
    document.querySelector('.close-btn').addEventListener('click', closeModal);
    document.getElementById('saveTaskBtn').addEventListener('click', saveTaskChanges);
    document.getElementById('deleteTaskBtn').addEventListener('click', deleteTask);
    document.getElementById('refreshAnalysisBtn').addEventListener('click', generateAiAnalysis);
    
    // Click bên ngoài modal để đóng
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('taskModal')) {
            closeModal();
        }
    });
}

// Tải dữ liệu ban đầu từ Firebase
function loadInitialData() {
    const userRef = firebase.database().ref('users/' + currentUser);
    
    userRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            tasksData = userData.tasks || {};
            
            // Cập nhật ghi chú nếu có
            if (userData.notes && userData.notes[currentWeek]) {
                document.getElementById('weeklyNotes').value = userData.notes[currentWeek];
            }
        } else {
            // Tạo dữ liệu mẫu nếu người dùng mới
            createSampleData();
        }
    });
}

// Tạo dữ liệu mẫu cho người dùng mới
function createSampleData() {
    tasksData = {};
    
    // Tạo dữ liệu mẫu cho 3 tuần đầu
    for (let week = 1; week <= 3; week++) {
        tasksData[week] = generateSampleTasks(week);
    }
    
    // Lưu lên Firebase
    saveDataToFirebase();
}

// Tạo nhiệm vụ mẫu
function generateSampleTasks(week) {
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    const tasks = [];
    let dayIndex = 0;
    
    // Tạo 2-3 nhiệm vụ mỗi ngày
    for (let i = 0; i < 14; i++) {
        if (i > 0 && i % 2 === 0) dayIndex++;
        if (dayIndex >= days.length) dayIndex = 0;
        
        const taskTypes = ['vocab', 'grammar', 'reading', 'listening', 'kanji'];
        const type = taskTypes[Math.floor(Math.random() * taskTypes.length)];
        
        let taskName = '';
        let time = 0;
        
        switch(type) {
            case 'vocab':
                taskName = `Từ vựng N${week <= 8 ? '2' : '1'} - Bài ${Math.ceil(i/2)+1}`;
                time = 30 + Math.floor(Math.random() * 20);
                break;
            case 'grammar':
                taskName = `Ngữ pháp N${week <= 8 ? '2' : '1'} - Chương ${Math.ceil(i/3)+1}`;
                time = 40 + Math.floor(Math.random() * 20);
                break;
            case 'reading':
                taskName = `Đọc hiểu - Bài ${i+1}`;
                time = 25 + Math.floor(Math.random() * 15);
                break;
            case 'listening':
                taskName = `Nghe hiểu - Bài ${i+1}`;
                time = 20 + Math.floor(Math.random() * 10);
                break;
            case 'kanji':
                taskName = `Kanji N${week <= 8 ? '2' : '1'} - Bài ${Math.ceil(i/2)+1}`;
                time = 25 + Math.floor(Math.random() * 15);
                break;
        }
        
        tasks.push({
            id: 'task_' + week + '_' + i,
            day: days[dayIndex],
            name: taskName,
            time: time,
            type: type,
            completed: Math.random() > 0.7,
            note: Math.random() > 0.8 ? 'Cần ôn lại phần này' : ''
        });
    }
    
    return tasks;
}

// Tạo lịch học hàng tuần
function generateWeeklySchedule() {
    const scheduleGrid = document.getElementById('weeklySchedule');
    scheduleGrid.innerHTML = '';
    
    // Lấy nhiệm vụ cho tuần hiện tại
    const weekTasks = tasksData[currentWeek] || [];
    
    // Nhóm nhiệm vụ theo ngày
    const tasksByDay = {};
    weekTasks.forEach(task => {
        if (!tasksByDay[task.day]) {
            tasksByDay[task.day] = [];
        }
        tasksByDay[task.day].push(task);
    });
    
    // Tạo các ngày trong tuần
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    const startDate = calculateWeekStartDate(currentWeek);
    
    days.forEach((day, index) => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card' + (index >= 5 ? ' weekend' : '');
        
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
        const dateStr = formatDate(date);
        
        // Tính tổng thời gian học trong ngày
        const dayTasks = tasksByDay[day] || [];
        const totalTime = dayTasks.reduce((sum, task) => sum + task.time, 0);
        const hours = Math.floor(totalTime / 60);
        const mins = totalTime % 60;
        const timeStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}p` : ''}` : `${totalTime}p`;
        
        dayCard.innerHTML = `
            <div class="day-header">
                <div class="day-name">${day}</div>
                <div class="day-date">${dateStr}</div>
            </div>
            <div class="study-time">Thời gian: ${timeStr}</div>
            <ul class="study-items" id="tasks-${day}"></ul>
            <button class="add-task-btn" data-day="${day}"><i class="fas fa-plus"></i> Thêm nhiệm vụ</button>
        `;
        
        scheduleGrid.appendChild(dayCard);
        
        // Thêm nhiệm vụ vào ngày
        const tasksList = dayCard.querySelector(`#tasks-${day}`);
        dayTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = `study-item ${task.type} ${task.completed ? 'done' : ''}`;
            taskItem.dataset.id = task.id;
            taskItem.innerHTML = `
                <span>${task.name}</span>
                <div>
                    <span class="task-time">${task.time}p</span>
                    <button class="check-btn ${task.completed ? 'done' : ''}">
                        <i class="fas fa-${task.completed ? 'check' : 'circle'}-circle"></i>
                    </button>
                </div>
            `;
            tasksList.appendChild(taskItem);
            
            // Thêm sự kiện click cho nhiệm vụ
            taskItem.addEventListener('click', function(e) {
                if (!e.target.classList.contains('check-btn')) {
                    openEditModal(task.id);
                }
            });
            
            // Thêm sự kiện cho nút check
            const checkBtn = taskItem.querySelector('.check-btn');
            checkBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleTaskCompletion(task.id);
            });
        });
        
        // Thêm sự kiện cho nút thêm nhiệm vụ
        dayCard.querySelector('.add-task-btn').addEventListener('click', function() {
            addNewTask(this.dataset.day);
        });
    });
    
    // Cập nhật hiển thị tuần
    updateWeekDisplay();
}

// Mở modal chỉnh sửa nhiệm vụ
function openEditModal(taskId) {
    editingTaskId = taskId;
    const task = findTaskById(taskId);
    
    if (task) {
        document.getElementById('editTaskName').value = task.name;
        document.getElementById('editTaskTime').value = task.time;
        document.getElementById('editTaskType').value = task.type;
        document.getElementById('taskModal').style.display = 'block';
    }
}

// Đóng modal
function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
    editingTaskId = null;
}

// Lưu thay đổi nhiệm vụ
function saveTaskChanges() {
    const task = findTaskById(editingTaskId);
    
    if (task) {
        task.name = document.getElementById('editTaskName').value;
        task.time = parseInt(document.getElementById('editTaskTime').value) || 15;
        task.type = document.getElementById('editTaskType').value;
        
        saveDataToFirebase();
        generateWeeklySchedule();
        updateStats();
        closeModal();
    }
}

// Xóa nhiệm vụ
function deleteTask() {
    if (editingTaskId) {
        if (confirm('Bạn có chắc muốn xóa nhiệm vụ này?')) {
            const week = editingTaskId.split('_')[1];
            tasksData[week] = tasksData[week].filter(task => task.id !== editingTaskId);
            
            saveDataToFirebase();
            generateWeeklySchedule();
            updateStats();
            closeModal();
        }
    }
}

// Thêm nhiệm vụ mới
function addNewTask(day) {
    const weekTasks = tasksData[currentWeek] || [];
    const newId = 'task_' + currentWeek + '_' + (weekTasks.length + 1);
    
    const newTask = {
        id: newId,
        day: day,
        name: 'Nhiệm vụ mới',
        time: 30,
        type: 'vocab',
        completed: false,
        note: ''
    };
    
    if (!tasksData[currentWeek]) {
        tasksData[currentWeek] = [];
    }
    
    tasksData[currentWeek].push(newTask);
    saveDataToFirebase();
    generateWeeklySchedule();
    openEditModal(newId);
}

// Chuyển đổi trạng thái hoàn thành nhiệm vụ
function toggleTaskCompletion(taskId) {
    const task = findTaskById(taskId);
    
    if (task) {
        task.completed = !task.completed;
        saveDataToFirebase();
        generateWeeklySchedule();
        updateStats();
    }
}

// Tìm nhiệm vụ theo ID
function findTaskById(taskId) {
    const week = taskId.split('_')[1];
    if (tasksData[week]) {
        return tasksData[week].find(task => task.id === taskId);
    }
    return null;
}

// Chuyển đến tuần trước
function goToPreviousWeek() {
    if (currentWeek > 1) {
        currentWeek--;
        generateWeeklySchedule();
        loadWeeklyNotes();
        updateStats();
    } else {
        alert('Đây là tuần đầu tiên!');
    }
}

// Chuyển đến tuần sau
function goToNextWeek() {
    if (currentWeek < totalWeeks) {
        currentWeek++;
        
        // Nếu tuần này chưa có dữ liệu, tạo mẫu
        if (!tasksData[currentWeek]) {
            tasksData[currentWeek] = generateSampleTasks(currentWeek);
            saveDataToFirebase();
        }
        
        generateWeeklySchedule();
        loadWeeklyNotes();
        updateStats();
    } else {
        alert('Đây là tuần cuối cùng!');
    }
}

// Cập nhật hiển thị tuần
function updateWeekDisplay() {
    const startDate = calculateWeekStartDate(currentWeek);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    document.getElementById('currentWeekDisplay').innerHTML = `
        Tuần ${currentWeek}: ${formatDate(startDate)} - ${formatDate(endDate)}
        <span class="phase-badge">${getPhaseName(currentWeek)}</span>
    `;
    
    document.getElementById('currentDateRange').textContent = 
        `${formatDate(calculateWeekStartDate(1))} - ${formatDate(calculateWeekStartDate(totalWeeks + 1))}`;
}

// Lấy tên giai đoạn
function getPhaseName(week) {
    if (week <= 8) return 'Củng cố N2';
    if (week <= 16) return 'Tập trung N1';
    return 'Luyện đề N1';
}

// Tính ngày bắt đầu của tuần
function calculateWeekStartDate(weekNum) {
    const startDate = new Date(2025, 6, 10); // 10/7/2025
    startDate.setDate(startDate.getDate() + (weekNum - 1) * 7);
    return startDate;
}

// Định dạng ngày
function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
}

// Cập nhật thống kê
function updateStats() {
    const weekTasks = tasksData[currentWeek] || [];
    const totalTasks = weekTasks.length;
    const completedTasks = weekTasks.filter(task => task.completed).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalTime = weekTasks.reduce((sum, task) => sum + (task.completed ? task.time : 0), 0);
    
    // Cập nhật UI
    document.getElementById('completedCount').textContent = completedTasks;
    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('progressPercent').textContent = progress + '%';
    document.getElementById('progressFill').style.width = progress + '%';
    
    // Tính tổng giờ học
    const hours = Math.floor(totalTime / 60);
    const mins = totalTime % 60;
    document.getElementById('totalHours').textContent = hours > 0 ? `${hours}h${mins}p` : `${totalTime}p`;
    
    // Tính streak (đơn giản)
    const streak = calculateStreak();
    document.getElementById('streakDays').textContent = streak;
    
    // Cập nhật tỷ lệ hoàn thành
    document.getElementById('completionRate').textContent = progress + '%';
    
    // Cập nhật level hiện tại
    document.getElementById('currentLevel').textContent = currentWeek <= 8 ? 'N2' : 'N1';
    
    // Cập nhật tài nguyên đề xuất
    updateRecommendedResources();
}

// Tính streak (đơn giản)
function calculateStreak() {
    // Trong thực tế, bạn sẽ lưu và tính toán từ dữ liệu thực
    return Math.min(currentWeek * 2, 14); // Giả lập
}

// Cập nhật tài nguyên đề xuất
function updateRecommendedResources() {
    const resourcesList = document.getElementById('recommendedResources');
    resourcesList.innerHTML = '';
    
    const resources = [
        { icon: 'book', name: 'Soumatome N1 - Từ vựng & Kanji' },
        { icon: 'book', name: 'Shinkanzen N1 - Ngữ pháp & Đọc hiểu' },
        { icon: 'headphones', name: 'Speed Master N1 - Nghe hiểu' },
        { icon: 'file-alt', name: 'Đề thi thật các năm' },
        { icon: 'mobile-alt', name: 'Anki - Flashcard N1' }
    ];
    
    if (currentWeek <= 8) {
        resources.unshift(
            { icon: 'book', name: 'Somatome N2 - Ôn tập cơ bản' },
            { icon: 'book', name: 'Try! N2 - Ngữ pháp' }
        );
    }
    
    resources.forEach(resource => {
        const item = document.createElement('li');
        item.className = 'resource-item';
        item.innerHTML = `
            <i class="fas fa-${resource.icon}"></i> ${resource.name}
        `;
        resourcesList.appendChild(item);
    });
}

// Tạo phân tích AI (giả lập)
function generateAiAnalysis() {
    const weekTasks = tasksData[currentWeek] || [];
    const completedTasks = weekTasks.filter(task => task.completed).length;
    const totalTasks = weekTasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    let advice = '';
    
    if (progress < 30) {
        advice = `Bạn đang hoàn thành ${progress}% nhiệm vụ tuần này. Hãy tập trung hơn vào các buổi học ngắn nhưng thường xuyên. Gợi ý: 
        <ul>
            <li>Chia nhỏ nhiệm vụ thành các phần 20-30 phút</li>
            <li>Ưu tiên ngữ pháp và từ vựng trước</li>
            <li>Đặt mục tiêu nhỏ mỗi ngày</li>
        </ul>`;
    } else if (progress < 70) {
        advice = `Tiến độ ${progress}% là khá tốt! Để cải thiện:
        <ul>
            <li>Tập trung vào kỹ năng yếu nhất (${getWeakestSkill()})</li>
            <li>Thử phương pháp Pomodoro (25 phút học, 5 phút nghỉ)</li>
            <li>Ôn tập vào buổi sáng sẽ hiệu quả hơn</li>
        </ul>`;
    } else {
        advice = `Xuất sắc! Bạn đã hoàn thành ${progress}% nhiệm vụ. Để duy trì:
        <ul>
            <li>Thử thách bản thân với đề thi thử</li>
            <li>Ghi chú lại những lỗi thường gặp</li>
            <li>Dành thời gian xem phim/anime không phụ đề</li>
        </ul>`;
    }
    
    document.getElementById('aiAdvice').innerHTML = advice;
}

// Xác định kỹ năng yếu nhất (giả lập)
function getWeakestSkill() {
    const skills = ['Ngữ pháp', 'Từ vựng', 'Kanji', 'Đọc hiểu', 'Nghe hiểu'];
    return skills[Math.floor(Math.random() * skills.length)];
}

// Lưu ghi chú tuần
function saveWeeklyNotes() {
    const notes = document.getElementById('weeklyNotes').value;
    
    // Lưu lên Firebase
    const userRef = firebase.database().ref('users/' + currentUser);
    userRef.child('notes').child(currentWeek).set(notes)
        .then(() => {
            alert('Đã lưu ghi chú thành công!');
        })
        .catch(error => {
            console.error('Lỗi khi lưu ghi chú:', error);
        });
}

// Tải ghi chú tuần
function loadWeeklyNotes() {
    const userRef = firebase.database().ref('users/' + currentUser + '/notes/' + currentWeek);
    
    userRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
            document.getElementById('weeklyNotes').value = snapshot.val();
        } else {
            document.getElementById('weeklyNotes').value = '';
        }
    });
}

// Lưu dữ liệu lên Firebase
function saveDataToFirebase() {
    const userRef = firebase.database().ref('users/' + currentUser);
    userRef.child('tasks').set(tasksData)
        .catch(error => {
            console.error('Lỗi khi lưu dữ liệu:', error);
        });
}