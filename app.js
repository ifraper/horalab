// ========================================
// State Management
// ========================================
let state = {
    employees: [],
    currentEmployee: null,
    currentSession: null,
    history: []
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    // Time display
    currentTime: document.getElementById('currentTime'),
    elapsedTime: document.getElementById('elapsedTime'),
    
    // Employee
    employeeSelect: document.getElementById('employeeSelect'),
    addEmployeeBtn: document.getElementById('addEmployeeBtn'),
    newEmployeeForm: document.getElementById('newEmployeeForm'),
    employeeName: document.getElementById('employeeName'),
    scheduleType: document.getElementById('scheduleType'),
    saveEmployeeBtn: document.getElementById('saveEmployeeBtn'),
    cancelEmployeeBtn: document.getElementById('cancelEmployeeBtn'),
    
    // Schedule badge
    scheduleBadge: document.getElementById('scheduleBadge'),
    
    // Status
    statusIndicator: document.getElementById('statusIndicator'),
    statusDisplay: document.getElementById('statusDisplay'),
    
    // Tracking card
    trackingCard: document.getElementById('trackingCard'),
    
    // Action buttons
    clockInBtn: document.getElementById('clockInBtn'),
    clockOutBtn: document.getElementById('clockOutBtn'),
    startBreakBtn: document.getElementById('startBreakBtn'),
    endBreakBtn: document.getElementById('endBreakBtn'),
    breakControls: document.getElementById('breakControls'),
    
    // Summary
    clockInTime: document.getElementById('clockInTime'),
    clockOutTime: document.getElementById('clockOutTime'),
    breakTime: document.getElementById('breakTime'),
    totalHours: document.getElementById('totalHours'),
    breakPeriods: document.getElementById('breakPeriods'),
    
    // Daily summary and history
    dailySummary: document.getElementById('dailySummary'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn')
};

// ========================================
// Initialization
// ========================================
function init() {
    loadFromStorage();
    setupEventListeners();
    updateCurrentTime();
    updateEmployeeSelect();
    updateUI();
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
    
    // Update elapsed time if session is active
    setInterval(() => {
        if (state.currentSession && state.currentSession.clockIn) {
            updateElapsedTime();
        }
    }, 1000);
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Employee management
    elements.addEmployeeBtn.addEventListener('click', showNewEmployeeForm);
    elements.saveEmployeeBtn.addEventListener('click', saveEmployee);
    elements.cancelEmployeeBtn.addEventListener('click', hideNewEmployeeForm);
    elements.employeeSelect.addEventListener('change', selectEmployee);
    
    // Time tracking
    elements.clockInBtn.addEventListener('click', clockIn);
    elements.clockOutBtn.addEventListener('click', clockOut);
    elements.startBreakBtn.addEventListener('click', startBreak);
    elements.endBreakBtn.addEventListener('click', endBreak);
    
    // History
    elements.clearHistoryBtn.addEventListener('click', clearHistory);
}

// ========================================
// Time Display
// ========================================
function updateCurrentTime() {
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleTimeString('es-ES');
}

function updateElapsedTime() {
    if (!state.currentSession || !state.currentSession.clockIn) {
        elements.elapsedTime.textContent = '00:00:00';
        return;
    }
    
    const now = new Date();
    const clockInTime = new Date(state.currentSession.clockIn);
    let elapsed = now - clockInTime;
    
    // Subtract break time
    const breakTime = calculateBreakTime();
    elapsed -= breakTime;
    
    // If currently on break, don't count current break time
    if (state.currentSession.onBreak) {
        const currentBreakStart = new Date(state.currentSession.currentBreakStart);
        elapsed -= (now - currentBreakStart);
    }
    
    elements.elapsedTime.textContent = formatDuration(elapsed);
}

// ========================================
// Employee Management
// ========================================
function showNewEmployeeForm() {
    elements.newEmployeeForm.classList.remove('hidden');
    elements.employeeName.focus();
}

function hideNewEmployeeForm() {
    elements.newEmployeeForm.classList.add('hidden');
    elements.employeeName.value = '';
    elements.scheduleType.value = 'full';
}

function saveEmployee() {
    const name = elements.employeeName.value.trim();
    const schedule = elements.scheduleType.value;
    
    if (!name) {
        alert('Por favor, introduce el nombre del empleado');
        return;
    }
    
    const employee = {
        id: Date.now().toString(),
        name,
        scheduleType: schedule,
        expectedHours: schedule === 'full' ? 8 : 4
    };
    
    state.employees.push(employee);
    saveToStorage();
    updateEmployeeSelect();
    hideNewEmployeeForm();
    
    // Auto-select the new employee
    elements.employeeSelect.value = employee.id;
    selectEmployee();
}

function selectEmployee() {
    const employeeId = elements.employeeSelect.value;
    
    if (!employeeId) {
        state.currentEmployee = null;
        elements.trackingCard.style.opacity = '0.5';
        elements.trackingCard.style.pointerEvents = 'none';
        return;
    }
    
    state.currentEmployee = state.employees.find(emp => emp.id === employeeId);
    elements.trackingCard.style.opacity = '1';
    elements.trackingCard.style.pointerEvents = 'auto';
    
    // Update schedule badge
    updateScheduleBadge();
    
    // Load today's session if exists
    loadTodaySession();
    
    updateUI();
}

function updateEmployeeSelect() {
    // Clear existing options except the first one
    elements.employeeSelect.innerHTML = '<option value="">Seleccionar empleado...</option>';
    
    state.employees.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.id;
        option.textContent = `${employee.name} (${employee.scheduleType === 'full' ? 'Jornada Completa' : 'Media Jornada'})`;
        elements.employeeSelect.appendChild(option);
    });
}

function updateScheduleBadge() {
    if (!state.currentEmployee) return;
    
    const label = state.currentEmployee.scheduleType === 'full' ? 'Jornada Completa' : 'Media Jornada';
    const hours = state.currentEmployee.expectedHours;
    
    elements.scheduleBadge.innerHTML = `
        <span class="badge-label">${label}</span>
        <span class="badge-hours">${hours}h</span>
    `;
}

// ========================================
// Time Tracking
// ========================================
function clockIn() {
    if (!state.currentEmployee) {
        alert('Por favor, selecciona un empleado primero');
        return;
    }
    
    const now = new Date();
    state.currentSession = {
        employeeId: state.currentEmployee.id,
        employeeName: state.currentEmployee.name,
        scheduleType: state.currentEmployee.scheduleType,
        expectedHours: state.currentEmployee.expectedHours,
        date: now.toISOString().split('T')[0],
        clockIn: now.toISOString(),
        clockOut: null,
        breaks: [],
        onBreak: false,
        currentBreakStart: null
    };
    
    saveToStorage();
    updateUI();
}

function clockOut() {
    if (!state.currentSession) return;
    
    // End break if currently on break
    if (state.currentSession.onBreak) {
        endBreak();
    }
    
    const now = new Date();
    state.currentSession.clockOut = now.toISOString();
    
    // Calculate totals
    const clockInTime = new Date(state.currentSession.clockIn);
    const totalTime = now - clockInTime;
    const breakTime = calculateBreakTime();
    const workTime = totalTime - breakTime;
    
    state.currentSession.totalMinutes = Math.round(workTime / 60000);
    state.currentSession.breakMinutes = Math.round(breakTime / 60000);
    
    // Add to history
    state.history.unshift({ ...state.currentSession });
    
    // Clear current session
    state.currentSession = null;
    
    saveToStorage();
    updateUI();
    updateHistory();
}

function startBreak() {
    if (!state.currentSession || state.currentSession.onBreak) return;
    
    const now = new Date();
    state.currentSession.onBreak = true;
    state.currentSession.currentBreakStart = now.toISOString();
    
    saveToStorage();
    updateUI();
}

function endBreak() {
    if (!state.currentSession || !state.currentSession.onBreak) return;
    
    const now = new Date();
    const breakStart = new Date(state.currentSession.currentBreakStart);
    const breakDuration = now - breakStart;
    
    state.currentSession.breaks.push({
        start: state.currentSession.currentBreakStart,
        end: now.toISOString(),
        duration: Math.round(breakDuration / 60000) // minutes
    });
    
    state.currentSession.onBreak = false;
    state.currentSession.currentBreakStart = null;
    
    saveToStorage();
    updateUI();
}

function calculateBreakTime() {
    if (!state.currentSession) return 0;
    
    let total = 0;
    state.currentSession.breaks.forEach(brk => {
        const start = new Date(brk.start);
        const end = new Date(brk.end);
        total += (end - start);
    });
    
    return total;
}

function loadTodaySession() {
    if (!state.currentEmployee) return;
    
    const today = new Date().toISOString().split('T')[0];
    const todaySession = state.history.find(
        session => session.employeeId === state.currentEmployee.id && 
                   session.date === today &&
                   !session.clockOut
    );
    
    if (todaySession) {
        state.currentSession = todaySession;
        // Remove from history since it's active
        state.history = state.history.filter(s => s !== todaySession);
    }
}

// ========================================
// UI Updates
// ========================================
function updateUI() {
    updateStatusDisplay();
    updateActionButtons();
    updateTimeSummary();
    updateBreakPeriods();
    updateDailySummary();
}

function updateStatusDisplay() {
    const statusDot = elements.statusIndicator.querySelector('.status-dot');
    const statusText = elements.statusIndicator.querySelector('.status-text');
    
    if (!state.currentSession) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Fuera de servicio';
        elements.elapsedTime.textContent = '00:00:00';
    } else if (state.currentSession.onBreak) {
        statusDot.className = 'status-dot break';
        statusText.textContent = 'En descanso';
    } else {
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Trabajando';
    }
    
    updateElapsedTime();
}

function updateActionButtons() {
    const hasSession = !!state.currentSession;
    const onBreak = hasSession && state.currentSession.onBreak;
    
    // Clock buttons
    elements.clockInBtn.classList.toggle('hidden', hasSession);
    elements.clockOutBtn.classList.toggle('hidden', !hasSession);
    
    // Break buttons
    elements.breakControls.classList.toggle('hidden', !hasSession);
    elements.startBreakBtn.classList.toggle('hidden', onBreak);
    elements.endBreakBtn.classList.toggle('hidden', !onBreak);
}

function updateTimeSummary() {
    if (!state.currentSession) {
        elements.clockInTime.textContent = '--:--';
        elements.clockOutTime.textContent = '--:--';
        elements.breakTime.textContent = '00:00';
        elements.totalHours.textContent = '00:00';
        return;
    }
    
    // Clock in time
    const clockIn = new Date(state.currentSession.clockIn);
    elements.clockInTime.textContent = clockIn.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Clock out time
    if (state.currentSession.clockOut) {
        const clockOut = new Date(state.currentSession.clockOut);
        elements.clockOutTime.textContent = clockOut.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else {
        elements.clockOutTime.textContent = '--:--';
    }
    
    // Break time
    const breakTime = calculateBreakTime();
    elements.breakTime.textContent = formatDuration(breakTime);
    
    // Total hours (work time)
    if (state.currentSession.clockOut) {
        const totalMinutes = state.currentSession.totalMinutes || 0;
        elements.totalHours.textContent = formatMinutes(totalMinutes);
    } else {
        const now = new Date();
        const clockInTime = new Date(state.currentSession.clockIn);
        let elapsed = now - clockInTime - breakTime;
        
        if (state.currentSession.onBreak) {
            const currentBreakStart = new Date(state.currentSession.currentBreakStart);
            elapsed -= (now - currentBreakStart);
        }
        
        elements.totalHours.textContent = formatDuration(elapsed);
    }
}

function updateBreakPeriods() {
    if (!state.currentSession || state.currentSession.breaks.length === 0) {
        elements.breakPeriods.innerHTML = '';
        return;
    }
    
    let html = '<div style="margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--color-border);">';
    html += '<h3 style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-md);">Períodos de Descanso</h3>';
    
    state.currentSession.breaks.forEach((brk, index) => {
        const start = new Date(brk.start);
        const end = new Date(brk.end);
        html += `
            <div class="break-period-item">
                <span class="break-period-label">Descanso ${index + 1}</span>
                <span class="break-period-time">
                    ${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - 
                    ${end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    (${brk.duration} min)
                </span>
            </div>
        `;
    });
    
    html += '</div>';
    elements.breakPeriods.innerHTML = html;
}

function updateDailySummary() {
    if (!state.currentEmployee) {
        elements.dailySummary.innerHTML = '<p class="empty-state">Selecciona un empleado para ver el resumen</p>';
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = state.history.filter(
        session => session.employeeId === state.currentEmployee.id && 
                   session.date === today &&
                   session.clockOut
    );
    
    if (todayRecords.length === 0 && !state.currentSession) {
        elements.dailySummary.innerHTML = '<p class="empty-state">No hay registros para hoy</p>';
        return;
    }
    
    let html = '';
    
    // Show current session if active
    if (state.currentSession) {
        html += createRecordHTML({
            ...state.currentSession,
            totalMinutes: calculateCurrentWorkMinutes(),
            breakMinutes: Math.round(calculateBreakTime() / 60000),
            isActive: true
        });
    }
    
    // Show completed sessions
    todayRecords.forEach(record => {
        html += createRecordHTML(record);
    });
    
    elements.dailySummary.innerHTML = html;
}

function updateHistory() {
    if (state.history.length === 0) {
        elements.historyList.innerHTML = '<p class="empty-state">No hay registros históricos</p>';
        return;
    }
    
    // Group by date
    const groupedByDate = {};
    state.history.forEach(record => {
        if (!record.clockOut) return; // Skip incomplete sessions
        
        if (!groupedByDate[record.date]) {
            groupedByDate[record.date] = [];
        }
        groupedByDate[record.date].push(record);
    });
    
    let html = '';
    Object.keys(groupedByDate).sort().reverse().forEach(date => {
        const dateObj = new Date(date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        html += `<h3 style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-lg); margin-bottom: var(--space-md); text-transform: capitalize;">${dateStr}</h3>`;
        
        groupedByDate[date].forEach(record => {
            html += createRecordHTML(record);
        });
    });
    
    elements.historyList.innerHTML = html;
}

function createRecordHTML(record) {
    const clockIn = new Date(record.clockIn);
    const clockOut = record.clockOut ? new Date(record.clockOut) : null;
    const totalHours = formatMinutes(record.totalMinutes || 0);
    const breakHours = formatMinutes(record.breakMinutes || 0);
    const isActive = record.isActive || false;
    
    return `
        <div class="record-item" style="${isActive ? 'border-left-color: var(--color-success);' : ''}">
            <div class="record-header">
                <span class="record-employee">${record.employeeName}</span>
                <span class="record-date">
                    ${isActive ? '🟢 En curso' : clockOut.toLocaleDateString('es-ES')}
                </span>
            </div>
            <div class="record-details">
                <div class="record-detail">
                    <span>Entrada:</span>
                    <span class="record-detail-value">${clockIn.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="record-detail">
                    <span>Salida:</span>
                    <span class="record-detail-value">${clockOut ? clockOut.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
                <div class="record-detail">
                    <span>Descanso:</span>
                    <span class="record-detail-value">${breakHours}</span>
                </div>
                <div class="record-detail">
                    <span>Total:</span>
                    <span class="record-detail-value" style="color: var(--color-success);">${totalHours}</span>
                </div>
            </div>
        </div>
    `;
}

function calculateCurrentWorkMinutes() {
    if (!state.currentSession) return 0;
    
    const now = new Date();
    const clockIn = new Date(state.currentSession.clockIn);
    let elapsed = now - clockIn;
    
    const breakTime = calculateBreakTime();
    elapsed -= breakTime;
    
    if (state.currentSession.onBreak) {
        const currentBreakStart = new Date(state.currentSession.currentBreakStart);
        elapsed -= (now - currentBreakStart);
    }
    
    return Math.round(elapsed / 60000);
}

// ========================================
// History Management
// ========================================
function clearHistory() {
    if (!confirm('¿Estás seguro de que quieres borrar todo el historial?')) {
        return;
    }
    
    state.history = [];
    saveToStorage();
    updateHistory();
}

// ========================================
// Storage
// ========================================
function saveToStorage() {
    localStorage.setItem('timeTrackingState', JSON.stringify(state));
}

function loadFromStorage() {
    const saved = localStorage.getItem('timeTrackingState');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading state:', e);
        }
    }
}

// ========================================
// Utility Functions
// ========================================
function formatDuration(milliseconds) {
    if (milliseconds < 0) milliseconds = 0;
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// ========================================
// Start Application
// ========================================
document.addEventListener('DOMContentLoaded', init);
