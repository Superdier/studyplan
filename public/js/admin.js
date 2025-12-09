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
let phases = [];
let currentEditingPhaseId = null;
let pendingDeletePhaseId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase first
    initializeFirebase();
    
    // Then load phases and setup listeners
    setTimeout(() => {
        loadPhases();
        setupEventListeners();
    }, 100);
});

function setupEventListeners() {
    // Modal events
    document.getElementById('add-phase-btn').addEventListener('click', openAddPhaseModal);
    document.getElementById('close-phase-modal').addEventListener('click', closePhaseModal);
    document.getElementById('cancel-phase-btn').addEventListener('click', closePhaseModal);
    document.getElementById('phase-form').addEventListener('submit', savePhase);
    
    // Modal close on backdrop click
    document.getElementById('phase-modal').addEventListener('click', (e) => {
        if (e.target.id === 'phase-modal') closePhaseModal();
    });

    // Confirm dialog
    document.getElementById('confirm-no-btn').addEventListener('click', closeConfirmDialog);
    document.getElementById('confirm-yes-btn').addEventListener('click', confirmDelete);

    // Export/Import
    document.getElementById('export-all-data-btn').addEventListener('click', exportAllData);
    document.getElementById('import-data-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', handleImportFile);

    // Phase form preview
    document.getElementById('phase-name').addEventListener('input', updatePhasePreview);
    document.getElementById('phase-start-date').addEventListener('change', updatePhasePreview);
    document.getElementById('phase-end-date').addEventListener('change', updatePhasePreview);
    document.getElementById('phase-goal').addEventListener('input', updatePhasePreview);

    // View archive
    const viewArchiveBtn = document.getElementById('view-archive-btn');
    if (viewArchiveBtn) {
        viewArchiveBtn.addEventListener('click', () => {
            window.location.href = 'archiveHistory.html';
        });
    }
}

async function loadPhases() {
    try {
        const snapshot = await db.ref('phases').once('value');
        phases = [];
        
        if (snapshot.exists()) {
            const phasesData = snapshot.val();
            Object.keys(phasesData).forEach(key => {
                phases.push({
                    id: key,
                    ...phasesData[key]
                });
            });
        }

        // Get active phase
        const activeSnapshot = await db.ref('activePhase').once('value');
        const activePhaseId = activeSnapshot.val();

        renderPhases(activePhaseId);
    } catch (error) {
        console.error('Error loading phases:', error);
        showAlert('Lỗi khi tải dữ liệu chặng', 'danger');
    }
}

function renderPhases(activePhaseId = null) {
    const grid = document.getElementById('phases-grid');
    
    if (phases.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Chưa có chặng nào. Tạo chặng mới để bắt đầu!</p>
            </div>
        `;
        return;
    }

    // Sort phases by start date
    const sortedPhases = [...phases].sort((a, b) => {
        return new Date(a.startDate) - new Date(b.startDate);
    });

    grid.innerHTML = sortedPhases.map(phase => {
        const isActive = phase.id === activePhaseId;
        const startDate = new Date(phase.startDate);
        const endDate = new Date(phase.endDate);
        const weeks = Math.ceil((endDate - startDate) / (7 * 24 * 60 * 60 * 1000));
        const completedTasks = phase.completedTasksCount || 0;
        const totalTasks = phase.totalTasksCount || 0;

        return `
            <div class="phase-card ${isActive ? 'active' : ''}">
                <div class="phase-card-header">
                    <h3 class="phase-title">${phase.name}</h3>
                    ${isActive ? '<span class="phase-badge active-badge">Đang học</span>' : ''}
                </div>

                <div class="phase-info">
                    <div><i class="fas fa-calendar"></i> <strong>${formatDate(phase.startDate)}</strong> - <strong>${formatDate(phase.endDate)}</strong></div>
                    <div><i class="fas fa-hourglass-half"></i> <strong>${weeks}</strong> tuần</div>
                    ${phase.goal ? `<div><i class="fas fa-bullseye"></i> Mục tiêu: <strong>${phase.goal}</strong></div>` : ''}
                </div>

                <div class="phase-stats">
                    <div class="phase-stat">
                        <div class="phase-stat-value">${weeks}</div>
                        <div class="phase-stat-label">Tuần</div>
                    </div>
                    <div class="phase-stat">
                        <div class="phase-stat-value">${completedTasks}/${totalTasks}</div>
                        <div class="phase-stat-label">Nhiệm vụ</div>
                    </div>
                </div>

                ${phase.description ? `<div style="padding: 10px; background: #f0f0f0; border-radius: 4px; font-size: 13px; color: #666; margin-bottom: 15px;">${phase.description}</div>` : ''}

                <div class="phase-actions">
                    ${!isActive ? `<button class="btn-small btn-success" onclick="setActivePhase('${phase.id}')">
                        <i class="fas fa-check"></i> Chọn chặng này
                    </button>` : ''}
                    <button class="btn-small btn-info" onclick="editPhase('${phase.id}')">
                        <i class="fas fa-edit"></i> Chỉnh sửa
                    </button>
                    <button class="btn-small btn-warning" onclick="viewPhaseData('${phase.id}')">
                        <i class="fas fa-eye"></i> Xem dữ liệu
                    </button>
                    ${!isActive && !phase.archived ? `<button class="btn-small btn-warning" onclick="archivePhase('${phase.id}')">
                        <i class="fas fa-archive"></i> Lưu trữ
                    </button>` : ''}
                    <button class="btn-small btn-danger" onclick="deletePhase('${phase.id}')">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openAddPhaseModal() {
    currentEditingPhaseId = null;
    document.getElementById('phase-modal-title').textContent = 'Tạo Chặng Mới';
    document.getElementById('phase-form').reset();
    document.getElementById('phase-preview').style.display = 'none';
    
    // Set default dates
    const today = new Date();
    document.getElementById('phase-start-date').valueAsDate = today;
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 147); // 21 weeks
    document.getElementById('phase-end-date').valueAsDate = endDate;
    
    showPhaseModal();
}

function editPhase(phaseId) {
    currentEditingPhaseId = phaseId;
    const phase = phases.find(p => p.id === phaseId);
    
    if (!phase) return;

    document.getElementById('phase-modal-title').textContent = 'Chỉnh sửa Chặng';
    document.getElementById('phase-name').value = phase.name;
    document.getElementById('phase-start-date').value = phase.startDate;
    document.getElementById('phase-end-date').value = phase.endDate;
    document.getElementById('phase-description').value = phase.description || '';
    document.getElementById('phase-goal').value = phase.goal || '';
    
    document.getElementById('phase-preview').style.display = 'block';
    updatePhasePreview();
    
    showPhaseModal();
}

function showPhaseModal() {
    document.getElementById('phase-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closePhaseModal() {
    document.getElementById('phase-modal').classList.remove('show');
    document.body.style.overflow = 'auto';
    currentEditingPhaseId = null;
}

async function savePhase(e) {
    e.preventDefault();

    const name = document.getElementById('phase-name').value.trim();
    const startDate = document.getElementById('phase-start-date').value;
    const endDate = document.getElementById('phase-end-date').value;
    const description = document.getElementById('phase-description').value.trim();
    const goal = document.getElementById('phase-goal').value.trim();

    if (!name || !startDate || !endDate) {
        showAlert('Vui lòng điền tất cả trường bắt buộc', 'danger');
        return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
        showAlert('Ngày bắt đầu phải trước ngày kết thúc', 'danger');
        return;
    }

    try {
        const phaseData = {
            name,
            startDate,
            endDate,
            description,
            goal,
            createdAt: new Date().toISOString(),
            completedTasksCount: 0,
            totalTasksCount: 0
        };

        if (currentEditingPhaseId) {
            // Update existing phase
            phaseData.updatedAt = new Date().toISOString();
            await db.ref(`phases/${currentEditingPhaseId}`).update(phaseData);
            showAlert('Chặng đã được cập nhật', 'success');
        } else {
            // Create new phase
            const newPhaseRef = db.ref('phases').push();
            phaseData.id = newPhaseRef.key;
            await newPhaseRef.set(phaseData);
            showAlert('Chặng mới đã được tạo', 'success');
        }

        closePhaseModal();
        loadPhases();
    } catch (error) {
        console.error('Error saving phase:', error);
        showAlert('Lỗi khi lưu chặng', 'danger');
    }
}

async function setActivePhase(phaseId) {
    try {
        await db.ref('activePhase').set(phaseId);
        showAlert('Chặng đã được chọn', 'success');
        loadPhases();
    } catch (error) {
        console.error('Error setting active phase:', error);
        showAlert('Lỗi khi chọn chặng', 'danger');
    }
}

async function archivePhase(phaseId) {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    // Confirm action
    if (!confirm(`Bạn muốn lưu trữ chặng "${phase.name}"? Hành động này sẽ:\n1. Tạo snapshot dữ liệu hiện tại\n2. Đánh dấu chặng là đã lưu trữ\n3. Xóa sạch dữ liệu để chuẩn bị chặng mới`)) {
        return;
    }

    try {
        // Load current phase data from phaseData/{phaseId} or global if not found
        let scheduleSnapshot = await db.ref(`phaseData/${phaseId}/schedule`).once('value');
        if (!scheduleSnapshot.exists()) {
            scheduleSnapshot = await db.ref('schedule').once('value');
        }
        
        let skillAssessmentsSnapshot = await db.ref(`phaseData/${phaseId}/skillAssessments`).once('value');
        if (!skillAssessmentsSnapshot.exists()) {
            skillAssessmentsSnapshot = await db.ref('skillAssessments').once('value');
        }
        
        let jlptScoresSnapshot = await db.ref(`phaseData/${phaseId}/jlptScores`).once('value');
        if (!jlptScoresSnapshot.exists()) {
            jlptScoresSnapshot = await db.ref('jlptScores').once('value');
        }
        
        let studySessionsSnapshot = await db.ref(`phaseData/${phaseId}/studySessions`).once('value');
        if (!studySessionsSnapshot.exists()) {
            studySessionsSnapshot = await db.ref('studySessions').once('value');
        }

        const archiveData = {
            phaseId: phaseId,
            phaseName: phase.name,
            phaseStartDate: phase.startDate,
            phaseEndDate: phase.endDate,
            phaseGoal: phase.goal,
            archivedAt: new Date().toISOString(),
            // Snapshot data
            scheduleSnapshot: scheduleSnapshot.val() || {},
            skillAssessmentsSnapshot: skillAssessmentsSnapshot.val() || {},
            jlptScoresSnapshot: jlptScoresSnapshot.val() || {},
            studySessionsSnapshot: studySessionsSnapshot.val() || {}
        };

        // Mark phase as archived
        await db.ref(`phases/${phaseId}`).update({
            archived: true,
            archivedAt: new Date().toISOString()
        });

        // Save archive
        const archiveRef = db.ref('archives').push();
        await archiveRef.set(archiveData);

        // Clear current data for new phase
        await db.ref('schedule').remove();
        await db.ref('skillAssessments').remove();
        await db.ref('jlptScores').remove();
        await db.ref('studySessions').remove();
        await db.ref('resources').remove();

        showAlert(`Chặng "${phase.name}" đã được lưu trữ thành công!`, 'success');
        loadPhases();
    } catch (error) {
        console.error('Error archiving phase:', error);
        showAlert('Lỗi khi lưu trữ chặng', 'danger');
    }
}

function deletePhase(phaseId) {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    pendingDeletePhaseId = phaseId;
    document.getElementById('confirm-message').textContent = 
        `Bạn có chắc muốn xóa chặng "${phase.name}"? Tất cả dữ liệu của chặng này sẽ bị xóa.`;
    
    showConfirmDialog();
}

async function confirmDelete() {
    if (!pendingDeletePhaseId) return;

    try {
        // Delete phase
        await db.ref(`phases/${pendingDeletePhaseId}`).remove();
        
        // If this phase is active, clear the active phase reference
        const activeSnapshot = await db.ref('activePhase').once('value');
        if (activeSnapshot.val() === pendingDeletePhaseId) {
            await db.ref('activePhase').remove();
        }

        showAlert('Chặng đã được xóa', 'success');
        closeConfirmDialog();
        loadPhases();
    } catch (error) {
        console.error('Error deleting phase:', error);
        showAlert('Lỗi khi xóa chặng', 'danger');
    }
    
    pendingDeletePhaseId = null;
}

function showConfirmDialog() {
    document.getElementById('confirm-backdrop').style.display = 'block';
    document.getElementById('confirm-dialog').style.display = 'block';
}

function closeConfirmDialog() {
    document.getElementById('confirm-backdrop').style.display = 'none';
    document.getElementById('confirm-dialog').style.display = 'none';
    pendingDeletePhaseId = null;
}

function updatePhasePreview() {
    const name = document.getElementById('phase-name').value;
    const startDate = document.getElementById('phase-start-date').value;
    const endDate = document.getElementById('phase-end-date').value;
    const goal = document.getElementById('phase-goal').value;

    if (!startDate || !endDate) return;

    const weeks = Math.ceil((new Date(endDate) - new Date(startDate)) / (7 * 24 * 60 * 60 * 1000));

    document.getElementById('preview-name').textContent = name || '-';
    document.getElementById('preview-dates').textContent = 
        `${formatDate(startDate)} - ${formatDate(endDate)}`;
    document.getElementById('preview-weeks').textContent = `${weeks} tuần`;
    document.getElementById('preview-goal').textContent = goal || '-';

    document.getElementById('phase-preview').style.display = 'block';
}

function viewPhaseData(phaseId) {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    alert(`Chi tiết chặng: ${phase.name}\n\n` +
        `ID: ${phase.id}\n` +
        `Từ: ${phase.startDate}\n` +
        `Đến: ${phase.endDate}\n` +
        `Mục tiêu: ${phase.goal || 'Không có'}\n` +
        `Mô tả: ${phase.description || 'Không có'}\n\n` +
        `Dữ liệu chặng được lưu dưới: phases/${phaseId}`);
}

async function exportAllData() {
    try {
        const allDataSnapshot = await db.ref('/').once('value');
        const allData = allDataSnapshot.val() || {};

        const exportData = {
            exportDate: new Date().toISOString(),
            phases: allData.phases || {},
            activePhase: allData.activePhase || null,
            // Include other data structures
            schedule: allData.schedule || {},
            skillAssessments: allData.skillAssessments || {},
            jlptScores: allData.jlptScores || {},
            studySessions: allData.studySessions || {},
            resources: allData.resources || {},
            customTaskTypes: allData.customTaskTypes || {}
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `study-plan-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showAlert('Dữ liệu đã được xuất', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showAlert('Lỗi khi xuất dữ liệu', 'danger');
    }
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            
            // Confirm import
            if (!confirm('Nhập dữ liệu sẽ ghi đè dữ liệu hiện tại. Bạn có chắc không?')) {
                return;
            }

            // Import data
            const updates = {};
            if (importedData.phases) {
                updates['phases'] = importedData.phases;
            }
            if (importedData.activePhase) {
                updates['activePhase'] = importedData.activePhase;
            }
            if (importedData.schedule) {
                updates['schedule'] = importedData.schedule;
            }
            if (importedData.skillAssessments) {
                updates['skillAssessments'] = importedData.skillAssessments;
            }
            if (importedData.jlptScores) {
                updates['jlptScores'] = importedData.jlptScores;
            }
            if (importedData.studySessions) {
                updates['studySessions'] = importedData.studySessions;
            }
            if (importedData.resources) {
                updates['resources'] = importedData.resources;
            }
            if (importedData.customTaskTypes) {
                updates['customTaskTypes'] = importedData.customTaskTypes;
            }

            await db.ref('/').update(updates);
            showAlert('Dữ liệu đã được nhập thành công', 'success');
            loadPhases();
        } catch (error) {
            console.error('Error importing data:', error);
            showAlert('Lỗi khi nhập dữ liệu. Vui lòng kiểm tra định dạng file', 'danger');
        }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alerts-container');
    const alertId = `alert-${Date.now()}`;
    const alert = document.createElement('div');
    alert.id = alertId;
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(alert);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
}
