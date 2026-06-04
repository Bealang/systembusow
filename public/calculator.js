// ============================================================================
// Testbus - Pricing Calculator Module (calculator.js)
// Lazily loads stops database, handles searches, select UI, and price calculation
// ============================================================================

(function() {
    let allStopsClient = [];
    let lastFetchedPrice = null;
    let currentPriceType = localStorage.getItem('testbus_price_type') || 'normal';

    function initCalculator() {
        const calcFrom = document.getElementById('calc-from');
        const calcTo = document.getElementById('calc-to');

        // Only initialize if calculator tags are present
        if (!calcFrom && !calcTo) return;

        const pricingSection = document.querySelector('.pricing-section') || document.getElementById('items-from');
        const calcResults = document.getElementById('calc-results');
        const calcWarning = document.getElementById('calc-warning');
        const priceSingle = document.getElementById('price-single');
        const priceMonthly = document.getElementById('price-monthly');
        const priceToggleWrap = document.getElementById('price-toggle-wrap');
        const toggleNormal = document.getElementById('toggle-normal');
        const toggleReduced = document.getElementById('toggle-reduced');
        const monthlyLabel = document.getElementById('monthly-label');
        const priceToggle = document.querySelector('.price-toggle');
        const priceInfoNotes = document.getElementById('price-info-notes');
        const noteReduced = document.getElementById('note-reduced');

        // UI Custom Select Box toggles
        const customSelects = document.querySelectorAll('.custom-select');
        customSelects.forEach(selectContainer => {
            const selectedDiv = selectContainer.querySelector('.select-selected');
            const itemsContainer = selectContainer.querySelector('.select-items');

            selectedDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                closeAllSelect(this);
                const itemsDiv = this.nextElementSibling;
                itemsDiv.classList.toggle('select-hide');
                this.classList.toggle('select-arrow-active');

                if (!itemsDiv.classList.contains('select-hide')) {
                    const searchInput = itemsDiv.querySelector('.select-search');
                    if (searchInput) searchInput.focus();
                }
            });
        });

        function closeAllSelect(exceptEl) {
            const selects = document.querySelectorAll('.select-selected');
            const items = document.querySelectorAll('.select-items');
            selects.forEach((s, idx) => {
                if (s !== exceptEl) {
                    s.classList.remove('select-arrow-active');
                    items[idx].classList.add('select-hide');
                }
            });
        }

        document.addEventListener('click', () => closeAllSelect(null));

        // Lazy load Pricing Stops
        if (pricingSection) {
            const pObs = new IntersectionObserver((entries, obs) => {
                if (entries[0].isIntersecting) {
                    fetchPricingData();
                    obs.disconnect();
                }
            }, { rootMargin: '200px' });
            pObs.observe(pricingSection);
        }

        async function fetchPricingData() {
            try {
                if (window.fetchWithCache) {
                    const data = await window.fetchWithCache('/api/stops', 'przystanki', 86400000);
                    allStopsClient = data.stops;
                    populateCalculatorStops();
                }
            } catch (e) {
                console.error("Failed to load pricing data", e);
            }
        }

        function populateCalculatorStops() {
            const fromContainer = document.getElementById('items-from');
            const toContainer = document.getElementById('items-to');
            if (!fromContainer || !toContainer) return;

            [fromContainer, toContainer].forEach(container => {
                container.innerHTML = `
                    <div class="select-search-container">
                        <input type="text" class="select-search" placeholder="Wyszukaj przystanek...">
                    </div>
                    <div class="select-items-list"></div>
                `;

                const searchInput = container.querySelector('.select-search');
                const listContainer = container.querySelector('.select-items-list');

                searchInput.addEventListener('click', (e) => e.stopPropagation());

                searchInput.addEventListener('input', function() {
                    const filter = this.value.toLowerCase();
                    const items = listContainer.querySelectorAll('.stop-option');
                    items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        item.style.display = text.includes(filter) ? '' : 'none';
                    });
                });

                allStopsClient.forEach(stop => {
                    const div = document.createElement('div');
                    div.className = 'stop-option';
                    div.dataset.value = stop.id;
                    div.textContent = stop.name;
                    div.addEventListener('click', function() {
                        const selectContainer = this.closest('.custom-select');
                        const selectedDiv = selectContainer.querySelector('.select-selected');
                        const targetInput = document.getElementById(selectContainer.dataset.target);

                        selectedDiv.innerHTML = this.innerHTML;
                        targetInput.value = this.dataset.value;
                        targetInput.dispatchEvent(new Event('change'));

                        const itemsDiv = selectContainer.querySelector('.select-items');
                        itemsDiv.classList.add('select-hide');
                        selectedDiv.classList.remove('select-arrow-active');

                        searchInput.value = '';
                        listContainer.querySelectorAll('.stop-option').forEach(opt => opt.style.display = '');
                    });
                    listContainer.appendChild(div);
                });
            });
        }

        function updatePriceDisplay() {
            if (!lastFetchedPrice) return;

            if (priceSingle) {
                priceSingle.textContent = lastFetchedPrice.price_s.toFixed(2).replace('.', ',') + ' zł';
            }

            if (currentPriceType === 'reduced') {
                if (priceMonthly) priceMonthly.textContent = (lastFetchedPrice.price_md || 0).toFixed(2).replace('.', ',') + ' zł';
                if (monthlyLabel) monthlyLabel.textContent = "Miesięczny ulgowy";
                if (toggleNormal) toggleNormal.classList.remove('active');
                if (toggleReduced) toggleReduced.classList.add('active');
                if (priceToggle) priceToggle.setAttribute('data-active', 'reduced');
                if (noteReduced) noteReduced.classList.remove('hidden');
            } else {
                if (priceMonthly) priceMonthly.textContent = (lastFetchedPrice.price_m || 0).toFixed(2).replace('.', ',') + ' zł';
                if (monthlyLabel) monthlyLabel.textContent = "Miesięczny normalny";
                if (toggleNormal) toggleNormal.classList.add('active');
                if (toggleReduced) toggleReduced.classList.remove('active');
                if (priceToggle) priceToggle.setAttribute('data-active', 'normal');
                if (noteReduced) noteReduced.classList.add('hidden');
            }
        }

        [toggleNormal, toggleReduced].forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                currentPriceType = btn.id === 'toggle-normal' ? 'normal' : 'reduced';
                localStorage.setItem('testbus_price_type', currentPriceType);
                updatePriceDisplay();
            });
        });

        async function calculatePrice() {
            if (!calcFrom.value || !calcTo.value) return;

            if (calcFrom.value === calcTo.value) {
                if (calcResults) calcResults.classList.add('hidden');
                if (priceToggleWrap) priceToggleWrap.classList.add('hidden');
                if (priceInfoNotes) priceInfoNotes.classList.add('hidden');
                if (calcWarning) {
                    calcWarning.textContent = "Wybierz różne przystanki.";
                    calcWarning.classList.remove('hidden');
                }
                return;
            }

            const id1 = parseInt(calcFrom.value);
            const id2 = parseInt(calcTo.value);

            try {
                const res = await fetch(`/api/price?stop1=${id1}&stop2=${id2}`);
                const price = await res.json();

                if (price) {
                    lastFetchedPrice = price;
                    updatePriceDisplay();

                    if (calcWarning) calcWarning.classList.add('hidden');
                    if (priceToggleWrap) priceToggleWrap.classList.remove('hidden');
                    if (calcResults) calcResults.classList.remove('hidden');
                    if (priceInfoNotes) priceInfoNotes.classList.remove('hidden');

                    if (window.observeNewElements) window.observeNewElements();
                } else {
                    lastFetchedPrice = null;
                    if (calcResults) calcResults.classList.add('hidden');
                    if (priceToggleWrap) priceToggleWrap.classList.add('hidden');
                    if (priceInfoNotes) priceInfoNotes.classList.add('hidden');
                    if (calcWarning) {
                        calcWarning.innerHTML = "Ta relacja nie została uzupełniona. Skontaktuj się z nami <a href='/kontakt' style='color: inherit; text-decoration: underline;'>tutaj</a>.";
                        calcWarning.classList.remove('hidden');
                    }
                }
            } catch (e) {
                console.error("Failed to fetch price", e);
            }
        }

        if (calcFrom && calcTo) {
            calcFrom.addEventListener('change', calculatePrice);
            calcTo.addEventListener('change', calculatePrice);
        }
    }

    document.addEventListener('DOMContentLoaded', initCalculator);
})();
