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
let db = null;

function initializeFirebase() {
    if (!db) {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase already initialized:', error);
            db = firebase.database();
        }
    }
}

// Global variables
let archives = [];
let chartInstances = {};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase first
    initializeFirebase();
    
    // Then load archives and setup listeners
    setTimeout(() => {
        loadArchives();
        setupEventListeners();
    }, 100);
});

function setupEventListeners() {
    document.getElementById('close-archive-modal').addEventListener('click', closeArchiveModal);
    document.getElementById('archive-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'archive-detail-modal') closeArchiveModal();
    });
}

async function loadArchives() {
    try {
        const snapshot = await db.ref('archives').once('value');
        archives = [];

        if (snapshot.exists()) {
            const archivesData = snapshot.val();
            Object.keys(archivesData).forEach(key => {
                archives.push({
                    id: key,
                    ...archivesData[key]
                });
            });
        }

        // Sort by archived date (newest first)
        archives.sort((a, b) => {
            return new Date(b.archivedAt) - new Date(a.archivedAt);
        });

        renderArchivesList();
    } catch (error) {
        console.error('Error loading archives:', error);
        showAlert('Lỗi khi tải dữ liệu lưu trữ', 'danger');
    }
}

function renderArchivesList() {
    const container = document.getElementById('archives-list-container');

    if (archives.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Chưa có chặng nào được lưu trữ.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = archives.map(archive => {
        const archivedDate = new Date(archive.archivedAt);
        const formattedDate = archivedDate.toLocaleDateString('vi-VN');

        return `
            <div class="archive-card" onclick="viewArchiveDetail('${archive.id}')">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 class="archive-title">${archive.phaseName}</h3>
                    <span class="archive-badge"><i class="fas fa-archive"></i> Lưu trữ</span>
                </div>

                <div class="archive-info">
                    <div><i class="fas fa-calendar"></i> <strong>${formatDate(archive.phaseStartDate)}</strong> - <strong>${formatDate(archive.phaseEndDate)}</strong></div>
                    <div><i class="fas fa-hourglass-half"></i> <strong>${calculateWeeks(archive.phaseStartDate, archive.phaseEndDate)}</strong> tuần</div>
                    ${archive.phaseGoal ? `<div><i class="fas fa-bullseye"></i> Mục tiêu: <strong>${archive.phaseGoal}</strong></div>` : ''}
                    <div><i class="fas fa-clock"></i> Lưu trữ: <strong>${formattedDate}</strong></div>
                </div>

                <div class="archive-actions">
                    <button class="btn-view" onclick="viewArchiveDetail('${archive.id}'); event.stopPropagation();">
                        <i class="fas fa-eye"></i> Xem Chi tiết
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function viewArchiveDetail(archiveId) {
    const archive = archives.find(a => a.id === archiveId);
    if (!archive) return;

    // Show modal
    document.getElementById('archive-detail-modal').classList.add('show');

    // Set title
    document.getElementById('archive-modal-title').textContent = `Chi tiết: ${archive.phaseName}`;

    // Set header info
    document.getElementById('archive-detail-header').innerHTML = `
        <div>
            <strong><i class="fas fa-calendar"></i> Thời gian chặng:</strong> 
            ${formatDate(archive.phaseStartDate)} - ${formatDate(archive.phaseEndDate)}
            (${calculateWeeks(archive.phaseStartDate, archive.phaseEndDate)} tuần)
        </div>
        <div style="margin-top: 10px;">
            <strong><i class="fas fa-clock"></i> Lưu trữ lúc:</strong> 
            ${new Date(archive.archivedAt).toLocaleString('vi-VN')}
        </div>
        ${archive.phaseGoal ? `<div style="margin-top: 10px;"><strong><i class="fas fa-bullseye"></i> Mục tiêu:</strong> ${archive.phaseGoal}</div>` : ''}
    `;

    // Calculate and display statistics
    const stats = calculateArchiveStats(archive);
    renderArchiveStats(stats);

    // Render charts
    renderArchiveCharts(archive, stats);

    // Render schedule
    renderArchiveSchedule(archive);
}

function calculateArchiveStats(archive) {
    const schedule = archive.scheduleSnapshot || {};
    const skillAssessments = archive.skillAssessmentsSnapshot || {};
    const jlptScores = archive.jlptScoresSnapshot || {};
    const studySessions = archive.studySessionsSnapshot || {};

    let totalHours = 0;
    let completedTasks = 0;
    let totalTasks = 0;
    let completedDays = 0;

    // Calculate from schedule
    Object.keys(schedule).forEach(date => {
        const dayData = schedule[date];
        if (dayData && dayData.tasks) {
            totalTasks += dayData.tasks.length;
            completedTasks += dayData.tasks.filter(t => t.completed).length;
            if (dayData.tasks.some(t => t.completed)) {
                completedDays++;
            }
        }
    });

    // Calculate from study sessions
    Object.keys(studySessions).forEach(sessionKey => {
        const session = studySessions[sessionKey];
        if (session && session.duration) {
            totalHours += session.duration / 60; // Convert minutes to hours
        }
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const skillCount = Object.keys(skillAssessments).length;
    const jlptScoreCount = Object.keys(jlptScores).length;

    return {
        totalHours: totalHours.toFixed(1),
        completedTasks,
        totalTasks,
        completionRate,
        completedDays,
        skillCount,
        jlptScoreCount
    };
}

function renderArchiveStats(stats) {
    const statsHtml = `
        <div class="detail-item">
            <strong>Giờ học tổng cộng</strong>
            <span>${stats.totalHours}h</span>
        </div>
        <div class="detail-item">
            <strong>Nhiệm vụ hoàn thành</strong>
            <span>${stats.completedTasks}/${stats.totalTasks}</span>
        </div>
        <div class="detail-item">
            <strong>Tỷ lệ hoàn thành</strong>
            <span>${stats.completionRate}%</span>
        </div>
        <div class="detail-item">
            <strong>Ngày học tập</strong>
            <span>${stats.completedDays}</span>
        </div>
        <div class="detail-item">
            <strong>Kỹ năng được kiểm tra</strong>
            <span>${stats.skillCount}</span>
        </div>
        <div class="detail-item">
            <strong>Điểm JLPT ghi lại</strong>
            <span>${stats.jlptScoreCount}</span>
        </div>
    `;

    document.getElementById('archive-stats').innerHTML = statsHtml;
}

function renderArchiveCharts(archive, stats) {
    const container = document.getElementById('archive-charts-container');
    container.innerHTML = '';

    if (stats.totalTasks > 0) {
        // Completion Chart
        const completionChartHtml = `
            <div class="section-title"><i class="fas fa-chart-pie"></i> Tỷ lệ Hoàn thành Nhiệm vụ</div>
            <div class="chart-container">
                <div class="chart-wrapper">
                    <canvas id="completion-chart"></canvas>
                </div>
            </div>
        `;
        container.innerHTML += completionChartHtml;

        setTimeout(() => {
            const ctx = document.getElementById('completion-chart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Hoàn thành', 'Chưa hoàn thành'],
                        datasets: [{
                            data: [stats.completedTasks, stats.totalTasks - stats.completedTasks],
                            backgroundColor: ['#4caf50', '#e0e0e0'],
                            borderColor: ['#45a049', '#d0d0d0'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
        }, 100);
    }

    // Skill Assessments Chart
    if (Object.keys(archive.skillAssessmentsSnapshot || {}).length > 0) {
        const skillChartHtml = `
            <div class="section-title"><i class="fas fa-chart-radar"></i> Đánh giá Kỹ năng</div>
            <div class="chart-container">
                <div class="chart-wrapper">
                    <canvas id="skill-chart"></canvas>
                </div>
            </div>
        `;
        container.innerHTML += skillChartHtml;

        setTimeout(() => {
            renderSkillChart(archive.skillAssessmentsSnapshot);
        }, 100);
    }

    // JLPT Scores Trend
    if (Object.keys(archive.jlptScoresSnapshot || {}).length > 0) {
        const jlptChartHtml = `
            <div class="section-title"><i class="fas fa-chart-line"></i> Xu hướng Điểm JLPT</div>
            <div class="chart-container">
                <div class="chart-wrapper">
                    <canvas id="jlpt-chart"></canvas>
                </div>
            </div>
        `;
        container.innerHTML += jlptChartHtml;

        setTimeout(() => {
            renderJLPTChart(archive.jlptScoresSnapshot);
        }, 100);
    }
}

function renderSkillChart(skillAssessments) {
    const skills = Object.values(skillAssessments || {});
    const skillNames = skills.map(s => s.skillName || 'Kỹ năng');
    const scores = skills.map(s => s.score || 0);

    const ctx = document.getElementById('skill-chart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: skillNames,
            datasets: [{
                label: 'Điểm số',
                data: scores,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function renderJLPTChart(jlptScores) {
    const scores = Object.values(jlptScores || {}).sort((a, b) => 
        new Date(a.testDate || 0) - new Date(b.testDate || 0)
    );

    const labels = scores.map((s, i) => `Lần ${i + 1}`);
    const reading = scores.map(s => s.reading || 0);
    const listening = scores.map(s => s.listening || 0);
    const grammar = scores.map(s => s.grammar || 0);
    const kanji = scores.map(s => s.kanji || 0);

    const ctx = document.getElementById('jlpt-chart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Đọc',
                    data: reading,
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Nghe',
                    data: listening,
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Ngữ pháp',
                    data: grammar,
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Kanji',
                    data: kanji,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function renderArchiveSchedule(archive) {
    const schedule = archive.scheduleSnapshot || {};
    const scheduleContainer = document.getElementById('archive-schedule-container');

    if (Object.keys(schedule).length === 0) {
        scheduleContainer.innerHTML = '<div class="section-title"><i class="fas fa-calendar"></i> Lịch Học</div><p style="color: #999;">Không có dữ liệu lịch học.</p>';
        return;
    }

    let tableHtml = '<div class="section-title"><i class="fas fa-calendar"></i> Lịch Học (Chỉ đọc)</div><table class="schedule-table"><thead><tr><th>Ngày</th><th>Nhiệm vụ</th><th>Thời gian (phút)</th><th>Trạng thái</th></tr></thead><tbody>';

    Object.keys(schedule).sort().forEach(date => {
        const dayData = schedule[date];
        if (dayData && dayData.tasks && dayData.tasks.length > 0) {
            dayData.tasks.forEach((task, index) => {
                tableHtml += `
                    <tr>
                        ${index === 0 ? `<td rowspan="${dayData.tasks.length}">${formatDate(date)}</td>` : ''}
                        <td>
                            <span class="task-item">
                                <i class="fas fa-check-circle"></i> ${task.title || 'Nhiệm vụ không tiêu đề'}
                            </span>
                        </td>
                        <td>${task.duration || 60}</td>
                        <td>
                            <span style="padding: 4px 8px; border-radius: 3px; ${task.completed ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">
                                ${task.completed ? '<i class="fas fa-check"></i> Hoàn thành' : 'Chưa hoàn thành'}
                            </span>
                        </td>
                    </tr>
                `;
            });
        }
    });

    tableHtml += '</tbody></table>';
    scheduleContainer.innerHTML += tableHtml;
}

function closeArchiveModal() {
    document.getElementById('archive-detail-modal').classList.remove('show');
    // Destroy charts to prevent memory leaks
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
        }
    });
    chartInstances = {};
}

function showAlert(message, type = 'info') {
    alert(message);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
}

function calculateWeeks(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000));
}
