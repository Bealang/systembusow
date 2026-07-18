import state from './state.js';
import { showStatus } from './ui.js';

let containerSchedule, btnAddRow, btnSaveSchedule;

// Snapshot of loaded schedule (for dirty-checking)
let loadedSnapshot = null;
let scheduleIsLoaded = false;

// ─── Unsaved-changes badge ────────────────────────────────────────────────────

function showBadge(visible) {
    const badge = document.getElementById('unsaved-changes-badge');
    const notifContainer = document.getElementById('notification-container');
    if (!badge) return;

    if (visible) {
        badge.style.display = 'flex';
        requestAnimationFrame(() => badge.classList.add('visible'));
    } else {
        badge.classList.remove('visible');
        setTimeout(() => {
            if (!badge.classList.contains('visible')) badge.style.display = 'none';
        }, 300);
    }

    if (notifContainer) {
        notifContainer.style.bottom = visible ? '80px' : '20px';
    }
}

function getScheduleSnapshot() {
    if (!containerSchedule) return null;
    const rows = Array.from(containerSchedule.querySelectorAll('.schedule-row'));
    return JSON.stringify(rows.map(row => ({
        time: row.querySelector('.row-time')?.value || '',
        notes: Array.from(row.querySelectorAll('.row-attr:checked')).map(cb => cb.dataset.symbol)
    })));
}

function checkUnsavedChanges() {
    if (!scheduleIsLoaded || loadedSnapshot === null) {
        showBadge(false);
        return;
    }
    const current = getScheduleSnapshot();
    showBadge(current !== loadedSnapshot);
}

// ─── Course count helper ──────────────────────────────────────────────────────

function updateCourseCount() {
    const countEl = document.getElementById('schedule-course-count');
    if (!countEl || !containerSchedule) return;
    const count = containerSchedule.querySelectorAll('.schedule-row').length;
    countEl.textContent = count;
}

// ─── Row factory ─────────────────────────────────────────────────────────────

function createScheduleRow(time = '12:00', notes = []) {
    const div = document.createElement('div');
    div.className = 'schedule-row';

    const checkboxesHtml = state.allAttributes.map(attr => {
        const isChecked = notes.includes(attr.symbol);
        return `
            <label class="variant-tag" style="display: inline-flex; align-items: center; gap: 4px; margin-right: 8px; cursor: pointer;">
                <input type="checkbox" class="row-attr" data-symbol="${attr.symbol}" ${isChecked ? 'checked' : ''}>
                <span>${attr.symbol}</span>
            </label>
        `;
    }).join('');

    div.innerHTML = `
        <div class="schedule-time-wrap">
            <input type="time" class="row-time input-time" value="${time}" required>
        </div>
        <div class="schedule-tags-wrap">
            ${checkboxesHtml || '<span style="color: #94a3b8; font-size: 0.85rem;">Brak oznaczeń</span>'}
        </div>
        <button type="button" class="btn-danger rm-row">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Usuń</span>
        </button>
    `;

    // Sort on time change
    div.querySelector('.row-time').addEventListener('change', () => {
        sortScheduleDOM();
        checkUnsavedChanges();
    });

    // Checkbox changes
    div.querySelectorAll('.row-attr').forEach(cb => {
        cb.addEventListener('change', checkUnsavedChanges);
    });

    // Delete row
    div.querySelector('.rm-row').addEventListener('click', () => {
        div.remove();
        updateCourseCount();
        checkUnsavedChanges();
    });

    return div;
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortScheduleDOM() {
    const rows = Array.from(containerSchedule.querySelectorAll('.schedule-row'));
    rows.sort((a, b) => {
        const timeA = a.querySelector('.row-time').value || '00:00';
        const timeB = b.querySelector('.row-time').value || '00:00';
        return timeA.localeCompare(timeB);
    });
    rows.forEach(row => containerSchedule.appendChild(row));
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderScheduleTable(city, dayType) {
    if (!state.fullScheduleData || !state.fullScheduleData[city]) return;

    const courses = state.fullScheduleData[city][dayType] || [];
    containerSchedule.innerHTML = '';

    courses.forEach(course => containerSchedule.appendChild(createScheduleRow(course.time, course.notes)));

    btnAddRow.style.display = 'inline-flex';
    btnSaveSchedule.style.display = 'inline-flex';

    // Show status bar
    const statusBar = document.getElementById('schedule-status-bar');
    if (statusBar) statusBar.style.display = 'flex';

    updateCourseCount();

    // Take snapshot AFTER DOM is fully rendered
    scheduleIsLoaded = true;
    loadedSnapshot = getScheduleSnapshot();
    showBadge(false);
}

// ─── Load from API ────────────────────────────────────────────────────────────

export async function loadAdminSchedule() {
    try {
        const res = await fetch('/api/schedule');
        state.fullScheduleData = await res.json();
        if (Object.keys(state.fullScheduleData).length === 0) {
            state.fullScheduleData = {
                myslenice: { workdays: [], saturday: [], sunday: [] },
                sulkowice: { workdays: [], saturday: [], sunday: [] }
            };
        }
    } catch (e) {
        console.error('Nie wczytano rozkładu jazdy:', e);
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initSchedule() {
    loadAdminSchedule();

    containerSchedule = document.getElementById('schedule-table-container');
    btnAddRow = document.getElementById('add-schedule-row');
    btnSaveSchedule = document.getElementById('save-schedule-btn');
    const btnLoadSchedule = document.getElementById('load-schedule-view');
    const addCourseModal = document.getElementById('add-course-modal');
    const confirmAddBtn = document.getElementById('confirm-add-course');

    // Reset state when filters change
    ['schedule-city-select', 'schedule-day-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                scheduleIsLoaded = false;
                loadedSnapshot = null;
                showBadge(false);
            });
        }
    });

    btnLoadSchedule.addEventListener('click', () => {
        const city = document.getElementById('schedule-city-select').value;
        const dayType = document.getElementById('schedule-day-select').value;
        renderScheduleTable(city, dayType);
    });

    // ── Modal logic ──

    function openModal() {
        addCourseModal.classList.add('active');
        document.getElementById('new-course-time').value = '12:00';
        document.querySelectorAll('#modal-attributes-container .modal-attr-checkbox').forEach(cb => (cb.checked = false));
    }

    function closeModal() {
        addCourseModal.classList.remove('active');
    }

    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeModal));
    window.addEventListener('click', e => { if (e.target === addCourseModal) closeModal(); });

    btnAddRow.addEventListener('click', openModal);

    confirmAddBtn.addEventListener('click', () => {
        const time = document.getElementById('new-course-time').value;
        const notes = [];
        document.querySelectorAll('#modal-attributes-container .modal-attr-checkbox:checked').forEach(cb => {
            notes.push(cb.dataset.symbol);
        });

        containerSchedule.appendChild(createScheduleRow(time, notes));
        sortScheduleDOM();
        closeModal();
        updateCourseCount();
        checkUnsavedChanges();
        showStatus('Kurs dodany — pamiętaj o zapisaniu zmian!', 'success');
    });

    // ── Save schedule ──

    btnSaveSchedule.addEventListener('click', async () => {
        const city = document.getElementById('schedule-city-select').value;
        const dayType = document.getElementById('schedule-day-select').value;
        const rows = document.querySelectorAll('.schedule-row');
        const newCourses = [];

        rows.forEach(row => {
            const time = row.querySelector('.row-time').value;
            const notes = [];
            row.querySelectorAll('.row-attr:checked').forEach(cb => notes.push(cb.dataset.symbol));
            newCourses.push({ time, notes });
        });

        newCourses.sort((a, b) => a.time.localeCompare(b.time));
        state.fullScheduleData[city][dayType] = newCourses;

        // Hide badge optimistically
        showBadge(false);

        try {
            const res = await fetch('/api/admin/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.fullScheduleData)
            });
            const data = await res.json();
            if (res.ok) {
                showStatus(data.message, 'success');
                // Re-render and take new snapshot
                renderScheduleTable(city, dayType);
            } else {
                showStatus(data.error || 'Błąd zapisywania', 'error');
                // Restore badge on failure
                checkUnsavedChanges();
            }
        } catch (err) {
            showStatus('Błąd sieci/Zapisywania', 'error');
            checkUnsavedChanges();
        }
    });
}
