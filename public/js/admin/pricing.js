import state from './state.js';
import { showStatus } from './ui.js';

let currentPricingConfig = { multiplier: 40, discounts: [], applyDiscountsToSingle: false };
let savedPricingConfig = { multiplier: 40, discounts: [], applyDiscountsToSingle: false };
let originalSelectedPrice = '';

function checkUnsavedChanges() {
    let isDirty = false;

    // 1. Check price editor
    const priceSInput = document.getElementById('price-s');
    const selectA = document.getElementById('price-stop-a');
    const selectB = document.getElementById('price-stop-b');
    
    if (priceSInput && selectA && selectB && selectA.value && selectB.value) {
        const currentPrice = priceSInput.value.trim();
        const origPrice = String(originalSelectedPrice !== null && originalSelectedPrice !== undefined ? originalSelectedPrice : '').trim();
        
        const currentNum = parseFloat(currentPrice);
        const origNum = parseFloat(origPrice);
        
        let priceDirty = false;
        if (isNaN(currentNum) && isNaN(origNum)) {
            priceDirty = false;
        } else if (currentNum !== origNum) {
            priceDirty = true;
        }
        
        if (priceDirty) {
            priceSInput.classList.add('unsaved-input');
            isDirty = true;
        } else {
            priceSInput.classList.remove('unsaved-input');
        }
    } else if (priceSInput) {
        priceSInput.classList.remove('unsaved-input');
    }

    // 2. Check multiplier
    const multiplierInput = document.getElementById('config-multiplier');
    if (multiplierInput && savedPricingConfig) {
        const currentMultiplier = parseFloat(multiplierInput.value);
        const origMultiplier = parseFloat(savedPricingConfig.multiplier);
        
        if (currentMultiplier !== origMultiplier) {
            multiplierInput.classList.add('unsaved-input');
            isDirty = true;
        } else {
            multiplierInput.classList.remove('unsaved-input');
        }
    }

    // 2b. Check applyDiscountsToSingle checkbox
    const singleDiscCheckbox = document.getElementById('config-discounts-single');
    if (singleDiscCheckbox && savedPricingConfig) {
        if (singleDiscCheckbox.checked !== (savedPricingConfig.applyDiscountsToSingle ?? false)) {
            isDirty = true;
        }
    }

    // 3. Check discounts
    const nameInputs = document.querySelectorAll('.discount-input-name');
    const percentInputs = document.querySelectorAll('.discount-input-percent');
    
    const currentDiscounts = [];
    nameInputs.forEach((input, i) => {
        const name = input.value.trim();
        const discount = parseFloat(percentInputs[i].value);
        currentDiscounts.push({ name, discount: isNaN(discount) ? 0 : discount });
    });

    const savedDiscounts = savedPricingConfig.discounts || [];
    
    let discountsChanged = false;
    
    if (currentDiscounts.length !== savedDiscounts.length) {
        discountsChanged = true;
    }
    
    nameInputs.forEach((input, i) => {
        const currentName = input.value.trim();
        const currentPercent = parseFloat(percentInputs[i].value);
        
        const saved = savedDiscounts[i];
        let rowDirty = false;
        
        if (!saved) {
            rowDirty = true;
        } else if (currentName !== saved.name || currentPercent !== saved.discount) {
            rowDirty = true;
        }
        
        if (rowDirty) {
            input.classList.add('unsaved-input');
            if (percentInputs[i]) percentInputs[i].classList.add('unsaved-input');
            discountsChanged = true;
        } else {
            input.classList.remove('unsaved-input');
            if (percentInputs[i]) percentInputs[i].classList.remove('unsaved-input');
        }
    });

    if (discountsChanged) {
        isDirty = true;
    }

    // 4. Update badge visibility and shift notifications container
    const badge = document.getElementById('unsaved-changes-badge');
    const notifContainer = document.getElementById('notification-container');
    if (badge) {
        if (isDirty) {
            badge.classList.add('visible');
            badge.style.display = 'flex';
        } else {
            badge.classList.remove('visible');
            setTimeout(() => {
                if (!badge.classList.contains('visible')) {
                    badge.style.display = 'none';
                }
            }, 300);
        }
    }
    if (notifContainer) {
        if (isDirty) {
            notifContainer.style.bottom = '80px';
        } else {
            notifContainer.style.bottom = '20px';
        }
    }
}


function renderStopsList() {
    const container = document.getElementById('stops-list-container');
    if (!container) return;
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
    if (!selectA || !selectB) return;
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
    const selectA = document.getElementById('price-stop-a');
    const selectB = document.getElementById('price-stop-b');
    const priceSInput = document.getElementById('price-s');
    if (!selectA || !selectB || !priceSInput) return;

    const id1 = parseInt(selectA.value);
    const id2 = parseInt(selectB.value);

    priceSInput.value = '';

    if (!id1) {
        Array.from(selectB.options).forEach(opt => {
            opt.style.color = '';
            opt.disabled = false;
            opt.style.cursor = '';
            opt.text = opt.text.replace(' (brak ceny)', '');
        });
        originalSelectedPrice = '';
        checkUnsavedChanges();
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
        originalSelectedPrice = '';
        checkUnsavedChanges();
        return;
    }

    if (!id2) {
        originalSelectedPrice = '';
        checkUnsavedChanges();
        return;
    }

    const stop1 = Math.min(id1, id2);
    const stop2 = Math.max(id1, id2);
    const price = state.allPrices.find(p => p.stop1_id === stop1 && p.stop2_id === stop2);

    originalSelectedPrice = price ? price.price_s : '';
    if (price) {
        const priceSInput = document.getElementById('price-s');
        if (priceSInput) priceSInput.value = price.price_s;
    }
    checkUnsavedChanges();
}

async function loadPricingData() {
    try {
        const [resData, resConfig] = await Promise.all([
            fetch('/api/pricing-data'),
            fetch('/api/pricing-config')
        ]);
        const data = await resData.json();
        const config = await resConfig.json();
        
        state.allStops = data.stops;
        state.allPrices = data.prices;
        currentPricingConfig = config;
        savedPricingConfig = JSON.parse(JSON.stringify(config));
        
        renderStopsList();
        populatePriceDropdowns();
        renderPricingConfig();
    } catch (e) {
        console.error("Failed to load pricing data or config", e);
    }
}

function renderPricingConfig() {
    const multiplierInput = document.getElementById('config-multiplier');
    const listContainer = document.getElementById('discounts-list-container');
    const singleDiscCheckbox = document.getElementById('config-discounts-single');
    if (!multiplierInput || !listContainer) return;
    multiplierInput.value = currentPricingConfig.multiplier || 40;
    if (singleDiscCheckbox) {
        singleDiscCheckbox.checked = currentPricingConfig.applyDiscountsToSingle ?? false;
    }
    listContainer.innerHTML = '';
    
    if (!currentPricingConfig.discounts || currentPricingConfig.discounts.length === 0) {
        listContainer.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; padding: 10px 0;">Brak zdefiniowanych ulg. Dodaj pierwszą ulgę korzystając z formularza poniążej.</p>';
        checkUnsavedChanges();
        return;
    }
    
    currentPricingConfig.discounts.forEach((discount, idx) => {
        const div = document.createElement('div');
        div.style = 'display: grid; grid-template-columns: 2fr 1fr 100px; gap: 12px; align-items: center; background: white; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);';
        div.innerHTML = `
            <div>
                <input type="text" value="${discount.name}" class="discount-input-name" data-idx="${idx}" placeholder="Nazwa ulgi" style="width: 100%; padding: 12px; border: 1.5px solid var(--admin-border); background: #f8fafc; font-weight: 500; font-size: 0.95rem;">
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
                <input type="number" value="${discount.discount}" class="discount-input-percent" data-idx="${idx}" min="0" max="100" style="width: 80px; padding: 12px; border: 1.5px solid var(--admin-border); background: #f8fafc; text-align: center; font-weight: 600; font-size: 0.95rem;">
                <span style="font-weight: 600; color: #64748b;">%</span>
            </div>
            <div style="text-align: right;">
                <button type="button" class="btn-danger" style="padding: 12px 18px; font-size: 0.85rem; border-radius: 4px; font-weight: 500;" onclick="removeDiscount(${idx})">Usuń</button>
            </div>
        `;
        listContainer.appendChild(div);
    });

    const nameInputs = listContainer.querySelectorAll('.discount-input-name');
    const percentInputs = listContainer.querySelectorAll('.discount-input-percent');
    nameInputs.forEach(input => input.addEventListener('input', checkUnsavedChanges));
    percentInputs.forEach(input => input.addEventListener('input', checkUnsavedChanges));

    checkUnsavedChanges();
}

export function initPricing() {
    loadPricingData();

    // Attach listeners for unsaved changes detection
    const priceSInput = document.getElementById('price-s');
    if (priceSInput) {
        priceSInput.addEventListener('input', checkUnsavedChanges);
    }
    const multiplierInput = document.getElementById('config-multiplier');
    if (multiplierInput) {
        multiplierInput.addEventListener('input', checkUnsavedChanges);
    }
    const singleDiscCheckbox = document.getElementById('config-discounts-single');
    if (singleDiscCheckbox) {
        singleDiscCheckbox.addEventListener('change', checkUnsavedChanges);
    }

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

    window.removeDiscount = (idx) => {
        // First sync current inputs to array
        syncDiscountsFromInputs();
        currentPricingConfig.discounts.splice(idx, 1);
        renderPricingConfig();
    };

    function syncDiscountsFromInputs() {
        const nameInputs = document.querySelectorAll('.discount-input-name');
        const percentInputs = document.querySelectorAll('.discount-input-percent');
        const updatedDiscounts = [];
        
        nameInputs.forEach((input, i) => {
            const name = input.value.trim();
            const discount = parseFloat(percentInputs[i].value);
            if (name && !isNaN(discount)) {
                updatedDiscounts.push({ name, discount });
            }
        });
        currentPricingConfig.discounts = updatedDiscounts;
    }

    // Add discount
    const addDiscountForm = document.getElementById('add-discount-form');
    if (addDiscountForm) {
        addDiscountForm.addEventListener('submit', (e) => {
            e.preventDefault();
            syncDiscountsFromInputs();
            
            const nameInput = document.getElementById('new-discount-name');
            const percentInput = document.getElementById('new-discount-percent');
            if (!nameInput || !percentInput) return;
            const name = nameInput.value.trim();
            const percent = parseFloat(percentInput.value);
            if (!name || isNaN(percent)) return;
            
            if (!currentPricingConfig.discounts) currentPricingConfig.discounts = [];
            currentPricingConfig.discounts.push({ name, discount: percent });
            
            nameInput.value = '';
            percentInput.value = '';
            renderPricingConfig();
        });
    }

    // Save pricing config
    const saveConfigBtn = document.getElementById('save-pricing-config-btn');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', async () => {
            syncDiscountsFromInputs();

            const multiplierInput = document.getElementById('config-multiplier');
            const singleDiscCheckbox = document.getElementById('config-discounts-single');
            if (!multiplierInput) return;
            const multiplier = parseFloat(multiplierInput.value);
            if (isNaN(multiplier) || multiplier <= 0) {
                showStatus('Wprowadź poprawną wartość (wielokrotność biletów).', 'error');
                return;
            }
            const applyDiscountsToSingle = singleDiscCheckbox ? singleDiscCheckbox.checked : false;
            
            try {
                const res = await fetch('/api/admin/pricing-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ multiplier, discounts: currentPricingConfig.discounts, applyDiscountsToSingle })
                });
                if (res.ok) {
                    showStatus('Ustawienia cennika zostały pomyślnie zapisane.', 'success');
                    localStorage.removeItem('mleczek_pricing');
                    currentPricingConfig.applyDiscountsToSingle = applyDiscountsToSingle;
                    savedPricingConfig = JSON.parse(JSON.stringify(currentPricingConfig));
                    renderPricingConfig();
                } else {
                    showStatus('Błąd podczas zapisywania konfiguracji.', 'error');
                }
            } catch (e) {
                showStatus('Błąd połączenia podczas zapisywania konfiguracji.', 'error');
                console.error("Config save error:", e);
            }
        });
    }

    // Add stop form
    const addStopForm = document.getElementById('add-stop-form');
    if (addStopForm) {
        addStopForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-stop-name');
            if (!nameInput) return;
            const name = nameInput.value.trim();
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
                    nameInput.value = '';
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
    }

    // Price dropdowns
    const priceStopA = document.getElementById('price-stop-a');
    const priceStopB = document.getElementById('price-stop-b');
    if (priceStopA) priceStopA.addEventListener('change', updatePriceForm);
    if (priceStopB) priceStopB.addEventListener('change', updatePriceForm);

    // Save price
    const savePriceBtn = document.getElementById('save-price-btn');
    if (savePriceBtn) {
        savePriceBtn.addEventListener('click', async () => {
            const stopA = document.getElementById('price-stop-a');
            const stopB = document.getElementById('price-stop-b');
            const priceSInput = document.getElementById('price-s');
            if (!stopA || !stopB || !priceSInput) return;
            const stop1_id = parseInt(stopA.value);
            const stop2_id = parseInt(stopB.value);
            const price_s = parseFloat(priceSInput.value);

            if (!stop1_id || !stop2_id || isNaN(price_s)) {
                showStatus('Wypełnij cenę jednorazową.', 'error');
                return;
            }
            if (stop1_id === stop2_id) {
                showStatus('Błąd: Przystanek A i B są identyczne.', 'error');
                return;
            }

            if (typeof Sortable !== 'undefined') {
                new Sortable(container, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    dragClass: 'sortable-drag',
                    onEnd: async function () {
                        const stopIds = Array.from(container.children).map(el => parseInt(el.dataset.id, 10));
                        try {
                            const res = await fetch('/api/stops/reorder', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ stopIds })
                            });
                            const data = await res.json();
                            if (data.success) {
                                state.stops = data.stops;
                                showStatus('Kolejność przystanków zapisana');
                            } else {
                                showStatus(data.error || 'Błąd zapisu kolejności', 'error');
                            }
                        } catch (err) {
                            console.error('Błąd reorder:', err);
                            showStatus('Błąd połączenia z serwerem', 'error');
                        }
                    }
                });
            }

            try {
                const res = await fetch('/api/admin/pricing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stop1_id, stop2_id, price_s })
                });
                const data = await res.json();
                if (res.ok) {
                    state.allPrices = data.prices;
                    localStorage.removeItem('mleczek_pricing');
                    showStatus('Cena relacji została pomyślnie zapisana.', 'success');
                    
                    const stop1 = Math.min(stop1_id, stop2_id);
                    const stop2 = Math.max(stop1_id, stop2_id);
                    const price = state.allPrices.find(p => p.stop1_id === stop1 && p.stop2_id === stop2);
                    originalSelectedPrice = price ? price.price_s : '';
                    updatePriceForm();
                } else {
                    showStatus(data.error || 'Błąd podczas zapisywania ceny.', 'error');
                }
            } catch (e) {
                showStatus('Błąd połączenia podczas zapisywania ceny.', 'error');
                console.error("Price save error:", e);
            }
        });
    }

    // Bulk price update
    const bulkPriceBtn = document.getElementById('bulk-price-btn');
    if (bulkPriceBtn) {
        bulkPriceBtn.addEventListener('click', async () => {
            const bulkPriceAmountInput = document.getElementById('bulk-price-amount');
            if (!bulkPriceAmountInput) return;
            const amount = parseFloat(bulkPriceAmountInput.value);

            if (isNaN(amount) || amount === 0) {
                showStatus('Wprowadź poprawną kwotę zmiany (np. 2.00 lub -1.50).', 'error');
                return;
            }

            const typeName = 'jednorazowych';
            const actionStr = amount > 0 ? 'zwiększyć' : 'zmniejszyć';
            const absAmount = Math.abs(amount).toFixed(2);

            if (!confirm(`Na pewno chcesz ${actionStr} ceny wszystkich biletów ${typeName} o ${absAmount} zł? Zmiana dotknie tylko przystanków, które mają już wprowadzoną cenę.`)) return;

            try {
                const res = await fetch('/api/admin/pricing/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount })
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
                    
                    const stopA = document.getElementById('price-stop-a');
                    const stopB = document.getElementById('price-stop-b');
                    if (stopA && stopB) {
                        const id1 = parseInt(stopA.value);
                        const id2 = parseInt(stopB.value);
                        if (id1 && id2) {
                            const stop1 = Math.min(id1, id2);
                            const stop2 = Math.max(id1, id2);
                            const price = state.allPrices.find(p => p.stop1_id === stop1 && p.stop2_id === stop2);
                            originalSelectedPrice = price ? price.price_s : '';
                        }
                    }
                    updatePriceForm();
                    bulkPriceAmountInput.value = '';
                } else {
                    showStatus(data.error || 'Błąd podczas masowej zmiany cen.', 'error');
                }
            } catch (e) {
                showStatus(`Błąd podczas masowej zmiany cen: ${e.message}`, 'error');
                console.error("Bulk price save error:", e);
            }
        });
    }
}

export function initQuickBulkPrice() {
    const btn = document.getElementById('quick-bulk-price-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const amountInput = document.getElementById('quick-bulk-price-amount');
        if (!amountInput) return;
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount === 0) {
            showStatus('Wprowadź poprawną kwotę zmiany (np. 1.00 lub -0.50).', 'error');
            return;
        }

        const actionStr = amount > 0 ? 'zwiększyć' : 'zmniejszyć';
        const absAmount = Math.abs(amount).toFixed(2);

        if (!confirm(`Na pewno chcesz ${actionStr} ceny biletów jednorazowych o ${absAmount} zł?`)) return;

        try {
            const res = await fetch('/api/admin/pricing/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showStatus(data.message, 'success');
                amountInput.value = '';
            } else {
                showStatus(data.error || 'Błąd podczas masowej zmiany cen.', 'error');
            }
        } catch (e) {
            showStatus(`Błąd podczas masowej zmiany cen: ${e.message}`, 'error');
        }
    });
}
