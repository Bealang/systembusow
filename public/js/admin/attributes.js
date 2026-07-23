import state from './state.js';
import { showStatus } from './ui.js';
import { renderScheduleTable } from './schedule.js';

function renderAttributesList() {
    const container = document.getElementById('attributes-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (state.allAttributes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Brak zdefiniowanych oznaczeń.</p>';
        return;
    }

    state.allAttributes.forEach(attr => {
        const div = document.createElement('div');
        div.className = 'stop-item';
        div.innerHTML = `
            <div style="flex-grow: 1; padding: 10px 0; display: flex; align-items: center; gap: 10px;">
                <span class="legend-badge" style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${attr.symbol}</span>
                <span>${attr.description}</span>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem; background: #64748b;" onclick="editAttribute('${attr.symbol}', '${attr.description.replace(/'/g, "\\'")}')">Edytuj</button>
                <button class="btn-danger" style="padding: 8px 16px; font-size: 0.85rem;" onclick="deleteAttribute('${attr.symbol}')">Usuń</button>
            </div>
        `;
        container.appendChild(div);
    });
}

export function populateModalAttributes() {
    const container = document.getElementById('modal-attributes-container');
    if (!container) return;

    container.innerHTML = '';
    state.allAttributes.forEach(attr => {
        const label = document.createElement('label');
        label.className = 'variant-tag';
        label.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; margin-right: 10px; margin-bottom: 10px; cursor: pointer;';
        label.innerHTML = `
            <input type="checkbox" class="modal-attr-checkbox" data-symbol="${attr.symbol}">
            <span>${attr.description} (${attr.symbol})</span>
        `;
        container.appendChild(label);
    });
}

async function loadAttributesData() {
    try {
        const res = await fetch('/api/attributes');
        state.allAttributes = await res.json();
        renderAttributesList();
        populateModalAttributes();

        // Re-render schedule builder view if loaded
        const citySelect = document.getElementById('schedule-city-select');
        const daySelect = document.getElementById('schedule-day-select');
        const containerSchedule = document.getElementById('schedule-table-container');
        const hasTable = containerSchedule && containerSchedule.querySelector('.schedule-row');
        if (hasTable && citySelect && daySelect) {
            renderScheduleTable(citySelect.value, daySelect.value);
        }
    } catch (e) {
        console.error("Nie wczytano oznaczeń:", e);
    }
}

function resetAttributeForm() {
    state.editingAttrSymbol = null;
    document.getElementById('new-attr-symbol').value = '';
    document.getElementById('new-attr-desc').value = '';

    const submitBtn = document.querySelector('#add-attribute-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Dodaj oznaczenie';

    const cancelBtn = document.getElementById('cancel-edit-attr-btn');
    if (cancelBtn) cancelBtn.remove();
}

export function initAttributes() {
    loadAttributesData();

    // Global handlers
    window.resetAttributeForm = resetAttributeForm;

    window.deleteAttribute = async (symbol) => {
        if (!confirm(`Na pewno chcesz usunąć oznaczenie [${symbol}]? Upewnij się, że nie jest ono przypisane do żadnego kursu.`)) return;
        try {
            const res = await fetch(`/api/admin/attributes/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showStatus('Oznaczenie zostało usunięte.', 'success');
                loadAttributesData();
            } else {
                showStatus(data.error || 'Błąd podczas usuwania oznaczenia.', 'error');
            }
        } catch (e) {
            showStatus('Błąd połączenia podczas usuwania oznaczenia.', 'error');
        }
    };

    window.editAttribute = (symbol, description) => {
        state.editingAttrSymbol = symbol;
        document.getElementById('new-attr-symbol').value = symbol;
        document.getElementById('new-attr-desc').value = description;

        const submitBtn = document.querySelector('#add-attribute-form button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Zapisz zmiany';

        const form = document.getElementById('add-attribute-form');
        if (form && !document.getElementById('cancel-edit-attr-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancel-edit-attr-btn';
            cancelBtn.className = 'btn-danger';
            cancelBtn.style.cssText = 'height: 46px; margin-left: 10px; padding: 0 20px;';
            cancelBtn.textContent = 'Anuluj';
            cancelBtn.onclick = window.resetAttributeForm;
            form.appendChild(cancelBtn);
        }

        document.getElementById('add-attribute-form').scrollIntoView({ behavior: 'smooth' });
    };

    // Attribute form submit
    const addAttrForm = document.getElementById('add-attribute-form');
    if (addAttrForm) {
        addAttrForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const symbol = document.getElementById('new-attr-symbol').value.trim();
            const description = document.getElementById('new-attr-desc').value.trim();
            if (!symbol || !description) return;

            try {
                const url = state.editingAttrSymbol
                    ? `/api/admin/attributes/${encodeURIComponent(state.editingAttrSymbol)}`
                    : '/api/admin/attributes';
                const method = state.editingAttrSymbol ? 'PUT' : 'POST';

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol, description })
                });
                const data = await res.json();
                if (res.ok) {
                    showStatus(state.editingAttrSymbol ? 'Zaktualizowano oznaczenie kursów.' : 'Dodano nowe oznaczenie kursów.', 'success');
                    window.resetAttributeForm();
                    loadAttributesData();
                } else {
                    showStatus(data.error || 'Błąd zapisu oznaczenia.', 'error');
                }
            } catch (err) {
                showStatus('Błąd połączenia podczas zapisywania oznaczenia.', 'error');
            }
        });
    }
}
