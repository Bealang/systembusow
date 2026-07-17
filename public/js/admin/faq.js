import state from './state.js';
import { showStatus } from './ui.js';

function renderFaqList() {
    const container = document.getElementById('faq-list-container');
    container.innerHTML = '';
    if (state.allFaqs.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">Brak pytań FAQ.</p>';
        return;
    }

    state.allFaqs.forEach(faq => {
        const div = document.createElement('div');
        div.className = 'faq-admin-item';
        div.dataset.id = faq.id;
        div.innerHTML = `
            <div class="faq-admin-drag" title="Przeciągnij, aby zmienić kolejność">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; opacity: 0.5;"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
            </div>
            <div class="faq-admin-content">
                <div class="faq-admin-question">${faq.question}</div>
                <div class="faq-admin-answer">${faq.answer.replace(/<[^>]*>?/gm, '')}</div>
            </div>
            <div class="faq-admin-actions">
                <button class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem; background: #64748b;" onclick="editFaq(${faq.id})">Edytuj</button>
                <button class="btn-danger" style="padding: 8px 16px; font-size: 0.85rem;" onclick="deleteFaq(${faq.id})">Usuń</button>
            </div>
        `;
        container.appendChild(div);
    });

    new Sortable(container, {
        animation: 150,
        handle: '.faq-admin-drag',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: async function () {
            const items = container.querySelectorAll('.faq-admin-item');
            const orders = Array.from(items).map((item, index) => ({
                id: parseInt(item.dataset.id),
                sort_order: index
            }));
            try {
                await fetch('/api/admin/faq/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orders })
                });
                localStorage.removeItem('pytania');
                showStatus('Kolejność FAQ została zapisana.', 'success');
            } catch (e) {
                showStatus('Błąd połączenia przy zapisywaniu kolejności FAQ.', 'error');
            }
        }
    });
}

function resetFaqForm() {
    state.editingFaqId = null;
    document.getElementById('faq-question').value = '';
    document.getElementById('faq-answer').value = '';
    document.getElementById('faq-save-btn').textContent = 'Zapisz Pytanie FAQ';
    const cancelBtn = document.getElementById('faq-cancel-edit');
    if (cancelBtn) cancelBtn.remove();
}

async function loadFaqData() {
    try {
        const res = await fetch('/api/faq');
        state.allFaqs = await res.json();
        renderFaqList();
    } catch (e) {
        console.error("Failed to load FAQ data", e);
    }
}

export function initFaq() {
    loadFaqData();

    // Global handlers
    window.editFaq = (id) => {
        const faq = state.allFaqs.find(f => f.id === id);
        if (!faq) return;

        state.editingFaqId = id;
        document.getElementById('faq-question').value = faq.question;
        document.getElementById('faq-answer').value = faq.answer;
        document.getElementById('faq-save-btn').textContent = 'Zapisz zmiany w FAQ';

        if (!document.getElementById('faq-cancel-edit')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'faq-cancel-edit';
            cancelBtn.className = 'btn-danger';
            cancelBtn.style.cssText = 'padding: 12px 24px; margin-left: 10px;';
            cancelBtn.textContent = 'Anuluj';
            cancelBtn.onclick = resetFaqForm;
            document.getElementById('faq-save-btn').parentNode.appendChild(cancelBtn);
        }

        document.getElementById('tab-faq').scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteFaq = async (id) => {
        if (!confirm('Na pewno usunąć to pytanie FAQ?')) return;
        try {
            const res = await fetch(`/api/admin/faq/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                state.allFaqs = data.faqs;
                localStorage.removeItem('pytania');
                showStatus('Pytanie FAQ zostało usunięte.', 'success');
                renderFaqList();
            }
        } catch (e) {
            showStatus('Błąd połączenia podczas usuwania FAQ.', 'error');
        }
    };

    // FAQ form submit
    document.getElementById('faq-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = document.getElementById('faq-question').value.trim();
        const answer = document.getElementById('faq-answer').value.trim();
        if (!question || !answer) return;

        const url = state.editingFaqId ? `/api/admin/faq/${state.editingFaqId}` : '/api/admin/faq';
        const method = state.editingFaqId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, answer })
            });
            const data = await res.json();
            if (res.ok) {
                state.allFaqs = data.faqs;
                localStorage.removeItem('pytania');
                showStatus(state.editingFaqId ? 'Pytanie FAQ zostało zaktualizowane.' : 'Nowe pytanie FAQ zostało dodane.', 'success');
                resetFaqForm();
                renderFaqList();
            } else {
                showStatus(data.error || 'Błąd zapisu FAQ.', 'error');
            }
        } catch (e) {
            showStatus('Błąd połączenia przy zapisywaniu FAQ.', 'error');
        }
    });
}
