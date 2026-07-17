import state from './state.js';
import { showStatus } from './ui.js';

function renderStopsList() {
    const container = document.getElementById('stops-list-container');
    container.innerHTML = '';
    if (state.allStops.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">Brak dodanych przystanków.</p>';
        return;
    }

    state.allStops.forEach(stop => {
        const div = document.createElement('div');
        div.className = 'stop-item';
        div.dataset.id = stop.id;
        div.innerHTML = `
            <div class="drag-handle" title="Przeciągnij, aby zmienić kolejność">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; opacity: 0.5;"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
            </div>
            <div class="stop-name">${stop.name}</div>
            <div class="stop-actions">
                <button class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem; background: #64748b;" onclick="editStop(${stop.id}, '${stop.name.replace(/'/g, "\\'")}')">Edytuj</button>
                <button class="btn-danger" style="padding: 8px 16px; font-size: 0.85rem;" onclick="deleteStop(${stop.id})">Usuń</button>
            </div>
        `;
        container.appendChild(div);
    });

    new Sortable(container, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: () => saveReorder()
    });
}

async function saveReorder() {
    const items = document.querySelectorAll('.stop-item');
    const orders = Array.from(items).map((item, index) => ({
        id: parseInt(item.dataset.id),
        sort_order: index
    }));

    try {
        const res = await fetch('/api/admin/stops/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders })
        });
        if (res.ok) {
            localStorage.removeItem('przystanki');
            localStorage.removeItem('mleczek_pricing');
            showStatus('Kolejność przystanków została zapisana.', 'success');
            const data = await fetch('/api/pricing-data').then(r => r.json());
            state.allStops = data.stops;
            populatePriceDropdowns();
        } else {
            showStatus('Błąd podczas zapisywania kolejności.', 'error');
        }
    } catch (e) {
        showStatus('Błąd połączenia przy zapisywaniu kolejności.', 'error');
        console.error("Reorder failed", e);
    }
}

function populatePriceDropdowns() {
    const selectA = document.getElementById('price-stop-a');
    const selectB = document.getElementById('price-stop-b');
    const prevA = selectA.value;
    const prevB = selectB.value;

    selectA.innerHTML = '<option value="">-- Wybierz przystanek A --</option>';
    selectB.innerHTML = '<option value="">-- Wybierz przystanek B --</option>';

    state.allStops.forEach(stop => {
        selectA.add(new Option(stop.name, stop.id));
        selectB.add(new Option(stop.name, stop.id));
    });

    if (prevA) selectA.value = prevA;
    if (prevB) selectB.value = prevB;
    updatePriceForm();
}

function updatePriceForm() {
    state.isMonthlyManuallyEdited = false;
    state.isMonthlyDiscountManuallyEdited = false;

    const id1 = parseInt(document.getElementById('price-stop-a').value);
    const selectB = document.getElementById('price-stop-b');
    const id2 = parseInt(selectB.value);

    document.getElementById('price-s').value = '';
    document.getElementById('price-m').value = '';
    document.getElementById('price-md').value = '';

    if (!id1) {
        Array.from(selectB.options).forEach(opt => {
            opt.style.color = '';
            opt.disabled = false;
            opt.style.cursor = '';
            opt.text = opt.text.replace(' (brak ceny)', '');
        });
        return;
    }

    Array.from(selectB.options).forEach(opt => {
        const bId = parseInt(opt.value);
        if (!bId) return;

        if (bId === id1) {
            opt.disabled = true;
            opt.style.color = '#ccc';
            opt.style.cursor = 'not-allowed';
            return;
        }
        opt.disabled = false;
        opt.style.cursor = '';

        const stop1 = Math.min(id1, bId);
        const stop2 = Math.max(id1, bId);
        const hasPrice = state.allPrices.some(p => p.stop1_id === stop1 && p.stop2_id === stop2);

        opt.style.color = hasPrice ? '' : '#ef4444';
        if (!hasPrice) {
            opt.text = opt.text.replace(' (brak ceny)', '') + ' (brak ceny)';
        } else {
            opt.text = opt.text.replace(' (brak ceny)', '');
        }
    });

    if (id2 && id1 === id2) {
        showStatus('Przystanek A i B nie mogą być takie same!', 'error');
        selectB.value = "";
        return;
    }

    if (!id2) return;

    const stop1 = Math.min(id1, id2);
    const stop2 = Math.max(id1, id2);
    const price = state.allPrices.find(p => p.stop1_id === stop1 && p.stop2_id === stop2);

    if (price) {
        document.getElementById('price-s').value = price.price_s;
        document.getElementById('price-m').value = price.price_m;
        document.getElementById('price-md').value = price.price_md;
    }
}

async function loadPricingData() {
    try {
        const res = await fetch('/api/pricing-data');
        const data = await res.json();
        state.allStops = data.stops;
        state.allPrices = data.prices;
        renderStopsList();
        populatePriceDropdowns();
    } catch (e) {
        console.error("Failed to load pricing data", e);
    }
}

export function initPricing() {
    loadPricingData();

    // Global handlers
    window.editStop = async (id, currentName) => {
        const newName = prompt('Wpisz nową nazwę przystanku:', currentName);
        if (newName === null || newName.trim() === '' || newName === currentName) return;

        try {
            const res = await fetch(`/api/admin/stops/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                state.allStops = data.stops;
                localStorage.removeItem('przystanki');
                localStorage.removeItem('mleczek_pricing');
                showStatus('Nazwa przystanku została zaktualizowana.', 'success');
                renderStopsList();
                populatePriceDropdowns();
            } else {
                showStatus(data.error || 'Błąd podczas edycji przystanku.', 'error');
            }
        } catch (e) {
            showStatus('Błąd połączenia podczas edycji przystanku.', 'error');
            console.error("Edit stop error:", e);
        }
    };

    window.deleteStop = async (id) => {
        if (!confirm('Na pewno usunąć ten przystanek? Spowoduje to również usunięcie wszystkich powiązanych cen!')) return;
        try {
            const res = await fetch(`/api/admin/stops/${id}`, { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                state.allStops = data.stops;
                localStorage.removeItem('przystanki');
                localStorage.removeItem('mleczek_pricing');
                showStatus('Przystanek usunięty pomyślnie.', 'success');
                loadPricingData();
            } else {
                showStatus('Błąd podczas usuwania przystanku.', 'error');
            }
        } catch (e) {
            showStatus('Krytyczny błąd podczas usuwania przystanku.', 'error');
            console.error("Stop deletion error:", e);
        }
    };

    // Add stop form
    document.getElementById('add-stop-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-stop-name').value.trim();
        if (!name) {
            showStatus('Wpisz nazwę przystanku przed dodaniem.', 'error');
            return;
        }
        try {
            const res = await fetch('/api/admin/stops', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (res.ok) {
                state.allStops = data.stops;
                localStorage.removeItem('przystanki');
                localStorage.removeItem('mleczek_pricing');
                document.getElementById('new-stop-name').value = '';
                showStatus(`Przystanek "${name}" został dodany.`, 'success');
                loadPricingData();
            } else {
                showStatus(data.error || 'Błąd dodawania przystanku.', 'error');
            }
        } catch (e) {
            showStatus('Błąd połączenia przy dodawaniu przystanku.', 'error');
            console.error("Add stop error:", e);
        }
    });

    // Price dropdowns
    document.getElementById('price-stop-a').addEventListener('change', updatePriceForm);
    document.getElementById('price-stop-b').addEventListener('change', updatePriceForm);

    // Auto-calculate monthly
    document.getElementById('price-s').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            const priceM = val * 2 * 20;
            if (!state.isMonthlyManuallyEdited) document.getElementById('price-m').value = priceM.toFixed(2);
            if (!state.isMonthlyDiscountManuallyEdited) {
                const currentPriceM = !state.isMonthlyManuallyEdited ? priceM : parseFloat(document.getElementById('price-m').value);
                document.getElementById('price-md').value = !isNaN(currentPriceM) ? (currentPriceM * 0.51).toFixed(2) : '';
            }
        } else {
            if (!state.isMonthlyManuallyEdited) document.getElementById('price-m').value = '';
            if (!state.isMonthlyDiscountManuallyEdited) document.getElementById('price-md').value = '';
        }
    });

    document.getElementById('price-m').addEventListener('input', (e) => {
        state.isMonthlyManuallyEdited = e.target.value.trim() !== '';
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && !state.isMonthlyDiscountManuallyEdited) {
            document.getElementById('price-md').value = (val * 0.51).toFixed(2);
        } else if (!state.isMonthlyDiscountManuallyEdited) {
            document.getElementById('price-md').value = '';
        }
    });

    document.getElementById('price-md').addEventListener('input', (e) => {
        state.isMonthlyDiscountManuallyEdited = e.target.value.trim() !== '';
    });

    // Save price
    document.getElementById('save-price-btn').addEventListener('click', async () => {
        const stop1_id = parseInt(document.getElementById('price-stop-a').value);
        const stop2_id = parseInt(document.getElementById('price-stop-b').value);
        const price_s = parseFloat(document.getElementById('price-s').value);
        const price_m = parseFloat(document.getElementById('price-m').value);
        const price_md = parseFloat(document.getElementById('price-md').value);

        if (!stop1_id || !stop2_id || isNaN(price_s)) {
            showStatus('Wypełnij przynajmniej cenę jednorazową.', 'error');
            return;
        }
        if (stop1_id === stop2_id) {
            showStatus('Błąd: Przystanek A i B są identyczne.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/admin/pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stop1_id, stop2_id, price_s, price_m, price_md })
            });
            const data = await res.json();
            if (res.ok) {
                state.allPrices = data.prices;
                localStorage.removeItem('mleczek_pricing');
                showStatus('Cena relacji została pomyślnie zapisana.', 'success');
                updatePriceForm();
            } else {
                showStatus(data.error || 'Błąd podczas zapisywania ceny.', 'error');
            }
        } catch (e) {
            showStatus('Błąd połączenia podczas zapisywania ceny.', 'error');
            console.error("Price save error:", e);
        }
    });

    // Bulk price update
    document.getElementById('bulk-price-btn').addEventListener('click', async () => {
        const type = document.getElementById('bulk-price-type').value;
        const amount = parseFloat(document.getElementById('bulk-price-amount').value);

        if (isNaN(amount) || amount === 0) {
            showStatus('Wprowadź poprawną kwotę zmiany (np. 2.00 lub -1.50).', 'error');
            return;
        }

        let typeName = type === 's' ? 'jednorazowych' : 'miesięcznych';
        if (type === 'm') typeName += ' (oraz automatycznie obliczyć ulgowe)';
        const actionStr = amount > 0 ? 'zwiększyć' : 'zmniejszyć';
        const absAmount = Math.abs(amount).toFixed(2);

        if (!confirm(`Na pewno chcesz ${actionStr} ceny wszystkich biletów ${typeName} o ${absAmount} zł? Zmiana dotknie tylko przystanków, które mają już wprowadzoną cenę.`)) return;

        try {
            const res = await fetch('/api/admin/pricing/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, amount })
            });
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Serwer zwrócił nieoczekiwany błąd (prawdopodobnie wymaga restartu).");
            }
            const data = await res.json();
            if (res.ok) {
                state.allPrices = data.prices;
                localStorage.removeItem('mleczek_pricing');
                showStatus(data.message, 'success');
                updatePriceForm();
                document.getElementById('bulk-price-amount').value = '';
            } else {
                showStatus(data.error || 'Błąd podczas masowej zmiany cen.', 'error');
            }
        } catch (e) {
            showStatus(`Błąd podczas masowej zmiany cen: ${e.message}`, 'error');
            console.error("Bulk price save error:", e);
        }
    });

    // Recalculate monthly
    const recalculateBtn = document.getElementById('recalculate-monthly-btn');
    if (recalculateBtn) {
        recalculateBtn.addEventListener('click', async () => {
            if (!confirm('Czy na pewno chcesz przeliczyć i zaktualizować ceny biletów miesięcznych normalnych i ulgowych dla WSZYSTKICH relacji na podstawie cen jednorazowych? Ta operacja nadpisze obecne ceny miesięczne.')) return;
            try {
                const res = await fetch('/api/admin/pricing/recalculate-monthly', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (res.ok) {
                    state.allPrices = data.prices;
                    localStorage.removeItem('mleczek_pricing');
                    showStatus(data.message, 'success');
                    updatePriceForm();
                } else {
                    showStatus(data.error || 'Błąd podczas przeliczania biletów.', 'error');
                }
            } catch (e) {
                showStatus('Błąd połączenia podczas przeliczania biletów.', 'error');
                console.error("Recalculate monthly error:", e);
            }
        });
    }
}
