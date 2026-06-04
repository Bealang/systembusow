document.addEventListener('DOMContentLoaded', () => {
    let fullScheduleData = null;
    let editingNewsId = null;
    let allStops = [];
    let allPrices = [];
    let allFaqs = [];
    let allAttributes = [];
    let editingFaqId = null;
    let editingAttrSymbol = null;
    let isMonthlyManuallyEdited = false;
    let isMonthlyDiscountManuallyEdited = false;

    // Initialize Quill Editor
    var quill = new Quill('#news-editor', {
        theme: 'snow',
        placeholder: 'Wpisz treść komunikatu...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'header': [1, 2, 3, false] }],
                [{ 'size': ['small', false, 'large', 'huge'] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['image'],
                ['clean']
            ]
        }
    });

    // Override Quill's default image handler
    quill.getModule('toolbar').addHandler('image', () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/png, image/jpeg, image/jpg, image/webp, image/avif');
        input.click();

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            await processAndUploadImage(file);
        };
    });

    // Drag & Drop and Paste handlers for News Editor
    const editorContainer = document.querySelector('#news-editor');
    if (editorContainer) {
        editorContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        editorContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                const files = Array.from(e.dataTransfer.files);
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        await processAndUploadImage(file);
                    }
                }
            }
        });

        editorContainer.addEventListener('paste', async (e) => {
            if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
                e.preventDefault();
                const files = Array.from(e.clipboardData.files);
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        await processAndUploadImage(file);
                    }
                }
            }
        });
    }

    // Client-side image load helper
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Niepoprawny plik graficzny.'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Błąd odczytu pliku.'));
            reader.readAsDataURL(file);
        });
    }

    // Optimize image using Canvas and upload to server
    async function processAndUploadImage(file) {
        showStatus('Przetwarzanie i optymalizacja obrazu...', 'success');
        
        try {
            const img = await loadImage(file);
            
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            const maxDimension = 1200;
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const webpBlob = await new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', 0.82);
            });
            
            if (!webpBlob) {
                throw new Error('Kompresja obrazu nie powiodła się.');
            }
            
            const formData = new FormData();
            formData.append('image', webpBlob, 'image.webp');
            
            const res = await fetch('/api/admin/upload-news-image', {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Wystąpił błąd podczas wgrywania pliku.');
            }
            
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', data.url, Quill.sources.USER);
            quill.setSelection(range.index + 1, Quill.sources.SILENT);
            
            showStatus('Obraz został pomyślnie dodany i zoptymalizowany!', 'success');
        } catch (err) {
            console.error('Błąd przetwarzania obrazu:', err);
            showStatus(err.message || 'Błąd przetwarzania obrazu.', 'error');
        }
    }

    // --- Custom Image Resizer ---
    let currentSelectedImg = null;
    let resizerOverlay = null;

    function initImageResizer() {
        const editorContainer = document.querySelector('#news-editor');
        if (!editorContainer) return;

        resizerOverlay = document.createElement('div');
        resizerOverlay.className = 'quill-image-resizer-overlay';
        resizerOverlay.style.position = 'absolute';
        resizerOverlay.style.display = 'none';
        resizerOverlay.style.pointerEvents = 'none';
        resizerOverlay.style.zIndex = '1000';
        resizerOverlay.style.border = '2px dashed var(--primary-color, #2563eb)';

        const handle = document.createElement('div');
        handle.className = 'quill-image-resizer-handle';
        handle.style.position = 'absolute';
        handle.style.width = '12px';
        handle.style.height = '12px';
        handle.style.background = 'var(--primary-color, #2563eb)';
        handle.style.border = '2px solid white';
        handle.style.borderRadius = '50%';
        handle.style.bottom = '-7px';
        handle.style.right = '-7px';
        handle.style.cursor = 'se-resize';
        handle.style.pointerEvents = 'auto';

        resizerOverlay.appendChild(handle);
        
        const quillWrapper = editorContainer.querySelector('.ql-container');
        if (quillWrapper) {
            quillWrapper.style.position = 'relative';
            quillWrapper.appendChild(resizerOverlay);
        }

        const qlEditor = editorContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.addEventListener('click', (e) => {
                if (e.target.tagName === 'IMG') {
                    selectImageForResize(e.target);
                    e.stopPropagation();
                } else {
                    deselectImage();
                }
            });

            qlEditor.addEventListener('scroll', () => {
                if (currentSelectedImg) {
                    repositionResizer();
                }
            });
        }

        let isDragging = false;
        let startWidth = 0;
        let startX = 0;

        handle.addEventListener('mousedown', (e) => {
            if (!currentSelectedImg) return;
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            startWidth = currentSelectedImg.clientWidth;
            startX = e.clientX;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!isDragging || !currentSelectedImg) return;
            const deltaX = e.clientX - startX;
            let newWidth = startWidth + deltaX;

            const minWidth = 50;
            const maxWidth = qlEditor.clientWidth - 30;
            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > maxWidth) newWidth = maxWidth;

            currentSelectedImg.style.width = newWidth + 'px';
            currentSelectedImg.style.height = 'auto';

            repositionResizer();
        }

        function onMouseUp() {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                quill.update();
            }
        }
    }

    function selectImageForResize(img) {
        currentSelectedImg = img;
        repositionResizer();
        resizerOverlay.style.display = 'block';
    }

    window.deselectImage = () => {
        currentSelectedImg = null;
        if (resizerOverlay) {
            resizerOverlay.style.display = 'none';
        }
    };

    function repositionResizer() {
        if (!currentSelectedImg || !resizerOverlay) return;

        const img = currentSelectedImg;
        const qlContainer = document.querySelector('#news-editor .ql-container');
        if (!qlContainer) return;

        const imgRect = img.getBoundingClientRect();
        const containerRect = qlContainer.getBoundingClientRect();
        
        const top = imgRect.top - containerRect.top + qlContainer.scrollTop;
        const left = imgRect.left - containerRect.left + qlContainer.scrollLeft;
        
        resizerOverlay.style.top = top + 'px';
        resizerOverlay.style.left = left + 'px';
        resizerOverlay.style.width = imgRect.width + 'px';
        resizerOverlay.style.height = imgRect.height + 'px';
    }

    document.addEventListener('click', (e) => {
        const editor = document.querySelector('#news-editor');
        if (editor && !editor.contains(e.target)) {
            window.deselectImage();
        }
    });

    // Initialize resizer
    initImageResizer();

    // Check Auth Status
    checkAuth();

    // Tabs logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');

            if (window.deselectImage) window.deselectImage();

            // Zamknij menu na mobile po kliknięciu w zakładkę
            const sidebar = document.getElementById('admin-header-main');
            if (sidebar) sidebar.classList.remove('open');
        });
    });

    // Mobile Toggle Logic
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('admin-header-main');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    function showStatus(msg, type = 'success') {
        const container = document.getElementById('notification-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? '✅' : '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${msg}</span>
        `;

        container.appendChild(toast);

        // Console reporting
        if (type === 'success') {
            console.log(`%c[ADMIN SUCCESS] ${msg}`, 'color: #10b981; font-weight: bold;');
        } else {
            console.error(`%c[ADMIN ERROR] ${msg}`, 'color: #ef4444; font-weight: bold;');
        }

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 4000);
    }

    async function checkAuth() {
        try {
            const res = await fetch('/api/check-auth');
            const data = await res.json();
            if (data.authenticated) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('admin-header-main').style.display = 'block';
                document.getElementById('admin-panel').style.display = 'block';
                loadAdminNews();
                loadAdminSchedule();
                loadPricingData();
                loadFaqData();
                loadAttributesData();
            } else {
                document.getElementById('login-screen').style.display = 'flex';
                document.getElementById('admin-header-main').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'none';
            }
        } catch (e) {
            console.error("Nie zalogowano", e);
        }
    }

    async function loadAdminSchedule() {
        try {
            const res = await fetch('/api/schedule');
            fullScheduleData = await res.json();
            if (Object.keys(fullScheduleData).length === 0) {
                fullScheduleData = { myslenice: { workdays: [], saturday: [], sunday: [] }, sulkowice: { workdays: [], saturday: [], sunday: [] } };
            }
        } catch (e) {
            console.error("Nie wczytano rozkładu jazdy:",e);
        }
    }

    async function loadAttributesData() {
        try {
            const res = await fetch('/api/attributes');
            allAttributes = await res.json();
            renderAttributesList();
            populateModalAttributes();
            
            // Re-render schedule builder view if we currently have one loaded
            const citySelect = document.getElementById('schedule-city-select');
            const daySelect = document.getElementById('schedule-day-select');
            const hasTable = containerSchedule && containerSchedule.querySelector('.schedule-row');
            if (hasTable && citySelect && daySelect) {
                renderScheduleTable(citySelect.value, daySelect.value);
            }
        } catch (e) {
            console.error("Nie wczytano atrybutów:", e);
        }
    }

    function renderAttributesList() {
        const container = document.getElementById('attributes-list-container');
        if (!container) return;
        
        container.innerHTML = '';
        if (allAttributes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Brak zdefiniowanych oznaczeń.</p>';
            return;
        }

        allAttributes.forEach(attr => {
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

    window.deleteAttribute = async (symbol) => {
        if (!confirm(`Na pewno chcesz usunąć oznaczenie [${symbol}]? Upewnij się, że nie jest ono przypisane do żadnego kursu.`)) return;
        try {
            const res = await fetch(`/api/admin/attributes/${encodeURIComponent(symbol)}`, {
                method: 'DELETE'
            });
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
        editingAttrSymbol = symbol;
        document.getElementById('new-attr-symbol').value = symbol;
        document.getElementById('new-attr-desc').value = description;
        
        const submitBtn = document.querySelector('#add-attribute-form button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Zapisz zmiany';
        
        // Add cancel button if not present
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

    window.resetAttributeForm = () => {
        editingAttrSymbol = null;
        document.getElementById('new-attr-symbol').value = '';
        document.getElementById('new-attr-desc').value = '';
        
        const submitBtn = document.querySelector('#add-attribute-form button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Dodaj atrybut';
        
        const cancelBtn = document.getElementById('cancel-edit-attr-btn');
        if (cancelBtn) cancelBtn.remove();
    };

    function populateModalAttributes() {
        const container = document.getElementById('modal-attributes-container');
        if (!container) return;
        
        container.innerHTML = '';
        allAttributes.forEach(attr => {
            const label = document.createElement('label');
            label.className = 'variant-tag';
            label.style.display = 'inline-flex';
            label.style.alignItems = 'center';
            label.style.gap = '6px';
            label.style.marginRight = '10px';
            label.style.marginBottom = '10px';
            label.style.cursor = 'pointer';
            
            label.innerHTML = `
                <input type="checkbox" class="modal-attr-checkbox" data-symbol="${attr.symbol}">
                <span>${attr.description} (${attr.symbol})</span>
            `;
            container.appendChild(label);
        });
    }

    // Login Form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                checkAuth();
            } else {
                const alertEl = document.getElementById('login-alert');
                alertEl.textContent = data.message;
                alertEl.className = 'alert error';
            }
        } catch (err) {
            console.error("Blad logowania", err);
        }
    });

    // Logout
    const logout = async () => {
        await fetch('/api/logout');
        checkAuth();
    };

    document.getElementById('logout-btn-header').addEventListener('click', logout);

    // Upload Schedule Image
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('rozklad_image');
        if (!fileInput.files[0]) return;

        const formData = new FormData();
        formData.append('rozklad_image', fileInput.files[0]);

        try {
            const res = await fetch('/api/admin/upload-image', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showStatus('Pomyślnie zaktualizowano plik rozkładu (.png)', 'success');
                fileInput.value = '';
            } else {
                showStatus(data.error || 'Błąd podczas wgrywania rozkładu', 'error');
            }
        } catch (err) {
            showStatus('Wystąpił krytyczny błąd połączenia przy wgrywaniu rozkładu.', 'error');
            console.error("Critical upload error:", err);
        }
    });

    // Upload Regulamin PDF
    document.getElementById('upload-regulamin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('regulamin_file');
        if (!fileInput.files[0]) return;

        const formData = new FormData();
        formData.append('regulamin_file', fileInput.files[0]);

        try {
            const res = await fetch('/api/admin/upload-regulamin', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showStatus('Pomyślnie zaktualizowano plik regulaminu (.pdf)', 'success');
                fileInput.value = '';
            } else {
                showStatus(data.error || 'Błąd podczas wgrywania regulaminu', 'error');
            }
        } catch (err) {
            showStatus('Wystąpił krytyczny błąd połączenia przy wgrywaniu regulaminu.', 'error');
            console.error("Critical regulamin upload error:", err);
        }
    });

    // --- SCHEDULE BUILDER LOGIC ---
    const btnLoadSchedule = document.getElementById('load-schedule-view');
    const containerSchedule = document.getElementById('schedule-table-container');
    const btnAddRow = document.getElementById('add-schedule-row');
    const btnSaveSchedule = document.getElementById('save-schedule-btn');

    function renderScheduleTable(city, dayType) {
        if (!fullScheduleData || !fullScheduleData[city]) return;

        let courses = fullScheduleData[city][dayType] || [];
        containerSchedule.innerHTML = '';

        courses.forEach((course) => {
            containerSchedule.appendChild(createScheduleRow(course.time, course.notes));
        });

        btnAddRow.style.display = 'inline-block';
        btnSaveSchedule.style.display = 'block';
    }

    function createScheduleRow(time = "12:00", notes = []) {
        const div = document.createElement('div');
        div.className = 'schedule-row';

        const checkboxesHtml = allAttributes.map(attr => {
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

        div.querySelector('.rm-row').addEventListener('click', () => { div.remove(); });

        div.querySelector('.row-time').addEventListener('change', () => {
            sortScheduleDOM();
        });

        return div;
    }

    function sortScheduleDOM() {
        const rows = Array.from(containerSchedule.querySelectorAll('.schedule-row'));
        rows.sort((a, b) => {
            const timeA = a.querySelector('.row-time').value || "00:00";
            const timeB = b.querySelector('.row-time').value || "00:00";
            return timeA.localeCompare(timeB);
        });

        rows.forEach(row => containerSchedule.appendChild(row));
    }

    btnLoadSchedule.addEventListener('click', () => {
        const city = document.getElementById('schedule-city-select').value;
        const dayType = document.getElementById('schedule-day-select').value;
        renderScheduleTable(city, dayType);
    });

    // --- Modal Logic ---
    const addCourseModal = document.getElementById('add-course-modal');
    const closeBtns = document.querySelectorAll('.close-modal-btn');
    const confirmAddBtn = document.getElementById('confirm-add-course');

    function openModal() {
        addCourseModal.classList.add('active');
        document.getElementById('new-course-time').value = "12:00";
        // Uncheck all checkboxes in modal-attributes-container
        const checkboxes = document.querySelectorAll('#modal-attributes-container .modal-attr-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
    }

    function closeModal() {
        addCourseModal.classList.remove('active');
    }

    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

    // Zamknij po kliknięciu poza modalem
    window.addEventListener('click', (e) => {
        if (e.target === addCourseModal) closeModal();
    });

    btnAddRow.addEventListener('click', openModal);

    confirmAddBtn.addEventListener('click', () => {
        const time = document.getElementById('new-course-time').value;
        const notes = [];
        const checkboxes = document.querySelectorAll('#modal-attributes-container .modal-attr-checkbox:checked');
        checkboxes.forEach(cb => {
            notes.push(cb.dataset.symbol);
        });

        containerSchedule.appendChild(createScheduleRow(time, notes));
        sortScheduleDOM();
        closeModal();
        showStatus('Kurs został dodany do listy (nie zapomnij zapisać zmian!).', 'success');
    });

    // Form submit listener for adding/editing attributes
    const addAttrForm = document.getElementById('add-attribute-form');
    if (addAttrForm) {
        addAttrForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const symbol = document.getElementById('new-attr-symbol').value.trim();
            const description = document.getElementById('new-attr-desc').value.trim();
            if (!symbol || !description) return;

            try {
                const url = editingAttrSymbol ? `/api/admin/attributes/${encodeURIComponent(editingAttrSymbol)}` : '/api/admin/attributes';
                const method = editingAttrSymbol ? 'PUT' : 'POST';
                
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol, description })
                });
                const data = await res.json();
                if (res.ok) {
                    showStatus(editingAttrSymbol ? 'Zaktualizowano oznaczenie kursów.' : 'Dodano nowe oznaczenie kursów.', 'success');
                    window.resetAttributeForm();
                    loadAttributesData();
                    // Load the schedule as well, since renaming a symbol migrates it in database!
                    loadAdminSchedule();
                } else {
                    showStatus(data.error || 'Błąd zapisu oznaczenia.', 'error');
                }
            } catch (err) {
                showStatus('Błąd połączenia podczas zapisywania oznaczenia.', 'error');
            }
        });
    }

    btnSaveSchedule.addEventListener('click', async () => {
        const city = document.getElementById('schedule-city-select').value;
        const dayType = document.getElementById('schedule-day-select').value;

        const rows = document.querySelectorAll('.schedule-row');
        let newCourses = [];

        rows.forEach(row => {
            const time = row.querySelector('.row-time').value;
            const notes = [];
            row.querySelectorAll('.row-attr:checked').forEach(cb => {
                notes.push(cb.dataset.symbol);
            });

            newCourses.push({ time, notes });
        });

        // Posortujmy po czasie
        newCourses.sort((a, b) => {
            return a.time.localeCompare(b.time);
        });

        // Aktualizuj lokalny obiekt
        fullScheduleData[city][dayType] = newCourses;
        renderScheduleTable(city, dayType); // Odbuduj widok obustronnie po sortowaniu

        try {
            const res = await fetch('/api/admin/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullScheduleData)
            });
            const data = await res.json();
            if (res.ok) {
                showStatus(data.message, 'success');
            } else {
                showStatus(data.error || 'Błąd', 'error');
            }
        } catch (err) {
            showStatus('Błąd sieci/Zapisywania', 'error');
        }
    });


    // News Submit (Add / Edit)
    document.getElementById('news-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (window.deselectImage) window.deselectImage();
        const title = document.getElementById('news-title').value;
        const content = quill.root.innerHTML;
        if (!title || title.trim() === '') {
            showStatus('Nie można opublikować: Brakuje tytułu aktualności!', 'error');
            return;
        }

        if (quill.getText().trim() === '') {
            showStatus('Nie można opublikować: Treść wiadomości nie może być pusta.', 'error');
            return;
        }

        try {
            const url = editingNewsId ? `/api/admin/news/${editingNewsId}` : '/api/admin/news';
            const method = editingNewsId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            const data = await res.json();
            if (res.ok) {
                showStatus(editingNewsId ? 'Aktualność została pomyślnie zedytowana.' : 'Nowa aktualność została opublikowana!', 'success');
                cancelEditing();
                loadAdminNews(1, false);
            } else {
                showStatus(data.error || 'Błąd podczas zapisywania aktualności.', 'error');
            }
        } catch (err) {
            showStatus('Błąd sieci/serwera podczas publikacji.', 'error');
            console.error("News saving error:", err);
        }
    });

    const formBtn = document.querySelector('#news-form button[type="submit"]');

    // Anuluj edycję logic
    const cancelEditBtn = document.createElement('button');
    cancelEditBtn.type = 'button';
    cancelEditBtn.className = 'btn-danger';
    cancelEditBtn.style.padding = '15px 30px';
    cancelEditBtn.style.marginLeft = '10px';
    cancelEditBtn.style.display = 'none';
    cancelEditBtn.textContent = 'Anuluj edycję';
    formBtn.parentNode.insertBefore(cancelEditBtn, formBtn.nextSibling);

    window.cancelEditing = () => {
            if (window.deselectImage) window.deselectImage();
            editingNewsId = null;
            document.getElementById('news-title').value = '';
            quill.root.innerHTML = '';
            formBtn.textContent = 'Zapisz Publikację';
            cancelEditBtn.style.display = 'none';
        };

    cancelEditBtn.addEventListener('click', cancelEditing);

    window.editNews = (id) => {
        fetch('/api/news')
            .then(res => res.json())
            .then(allNews => {
                const newsItem = allNews.find(n => n.id === id);
                if (newsItem) {
                    editingNewsId = id;
                    document.getElementById('news-title').value = newsItem.title;
                    quill.root.innerHTML = newsItem.content;
                    formBtn.textContent = 'Zapisz zmiany (Edycja)';
                    cancelEditBtn.style.display = 'inline-block';

                    // Scroll up smoothly
                    document.querySelector('.admin-container').scrollIntoView({ behavior: 'smooth' });
                }
            });
    };

    let currentAdminNewsPage = 1;
    let allLoadedAdminNews = [];

    async function loadAdminNews(page = 1, append = false) {
        try {
            const res = await fetch(`/api/news?page=${page}&limit=10`);
            const data = await res.json();
            if (append) {
                allLoadedAdminNews = allLoadedAdminNews.concat(data.news);
            } else {
                allLoadedAdminNews = data.news;
            }
            currentAdminNewsPage = page;
            renderNewsList(allLoadedAdminNews, data.total);
        } catch (e) { }
    }

    function renderNewsList(newsList, total = 0) {
        const listDiv = document.getElementById('news-list');
        listDiv.innerHTML = '';
        if (newsList.length === 0) {
            listDiv.innerHTML = '<p>Brak dodanych aktualności.</p>';
            return;
        }

        newsList.forEach(news => {
            let dateStr = news.date;
            if (news.date && news.date.includes('T')) {
                dateStr = new Date(news.date).toLocaleDateString('pl-PL') + ' ' + new Date(news.date).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            }
            const div = document.createElement('div');
            div.className = 'news-list-item';
            div.innerHTML = `
                <div style="flex-grow: 1; padding-right: 20px;">
                    <strong>${news.title}</strong>
                    <div style="font-size: 0.85rem; color: #64748b;">${dateStr} - ${news.content.replace(/<[^>]*>?/gm, '').substring(0, 50)}...</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-primary" style="padding: 8px 16px; font-size: 0.9rem;" onclick="editNews(${news.id})">Edytuj</button>
                    <button class="btn-danger delete-news-btn" style="padding: 8px 16px; font-size: 0.9rem;" data-id="${news.id}">Usuń</button>
                </div>
            `;
            listDiv.appendChild(div);
        });

        if (newsList.length < total) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'btn-primary';
            loadMoreBtn.style.marginTop = '15px';
            loadMoreBtn.style.width = '100%';
            loadMoreBtn.textContent = 'Wczytaj więcej';
            loadMoreBtn.addEventListener('click', () => {
                loadAdminNews(currentAdminNewsPage + 1, true);
            });
            listDiv.appendChild(loadMoreBtn);
        }

        document.querySelectorAll('.delete-news-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Na pewno usunąć ten komunikat?')) {
                    const id = e.target.dataset.id;
                    await deleteNews(id);
                }
            });
        });
    }

    async function deleteNews(id) {
        try {
            const res = await fetch(`/api/admin/news/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                showStatus('Aktualność została pomyślnie usunięta.', 'success');
                loadAdminNews(1, false);
            } else {
                showStatus(data.error || 'Błąd podczas usuwania aktualności.', 'error');
            }
        } catch (err) {
            showStatus('Błąd połączenia podczas usuwania aktualności.', 'error');
            console.error("News deletion error:", err);
        }
    }

    // --- PRICING LOGIC ---
    async function loadPricingData() {
        try {
            const res = await fetch('/api/pricing-data');
            const data = await res.json();
            allStops = data.stops;
            allPrices = data.prices;
            renderStopsList();
            populatePriceDropdowns();
        } catch (e) {
            console.error("Failed to load pricing data", e);
        }
    }

    function renderStopsList() {
        const container = document.getElementById('stops-list-container');
        container.innerHTML = '';
        if (allStops.length === 0) {
            container.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">Brak dodanych przystanków.</p>';
            return;
        }

        allStops.forEach(stop => {
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

        // Initialize Sortable
        new Sortable(container, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: function () {
                saveReorder();
            }
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
                // Refresh local data to match server sort
                const data = await fetch('/api/pricing-data').then(r => r.json());
                allStops = data.stops;
                populatePriceDropdowns();
            } else {
                showStatus('Błąd podczas zapisywania kolejności.', 'error');
            }
        } catch (e) {
            showStatus('Błąd połączenia przy zapisywaniu kolejności.', 'error');
            console.error("Reorder failed", e);
        }
    }

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
                allStops = data.stops;
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
                allStops = data.stops;
                localStorage.removeItem('przystanki');
                localStorage.removeItem('mleczek_pricing');
                showStatus('Przystanek usunięty pomyślnie.', 'success');
                loadPricingData(); // Reload everything to refresh prices
            } else {
                showStatus('Błąd podczas usuwania przystanku.', 'error');
            }
        } catch (e) {
            showStatus('Krytyczny błąd podczas usuwania przystanku.', 'error');
            console.error("Stop deletion error:", e);
        }
    };

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
                allStops = data.stops;
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

    function populatePriceDropdowns() {
        const selectA = document.getElementById('price-stop-a');
        const selectB = document.getElementById('price-stop-b');
        const prevA = selectA.value;
        const prevB = selectB.value;

        selectA.innerHTML = '<option value="">-- Wybierz przystanek A --</option>';
        selectB.innerHTML = '<option value="">-- Wybierz przystanek B --</option>';

        allStops.forEach(stop => {
            selectA.add(new Option(stop.name, stop.id));
            selectB.add(new Option(stop.name, stop.id));
        });

        if (prevA) selectA.value = prevA;
        if (prevB) selectB.value = prevB;

        updatePriceForm();
    }

    function updatePriceForm() {
        isMonthlyManuallyEdited = false;
        isMonthlyDiscountManuallyEdited = false;

        const id1 = parseInt(document.getElementById('price-stop-a').value);
        const selectB = document.getElementById('price-stop-b');
        const id2 = parseInt(selectB.value);

        // Reset inputs
        document.getElementById('price-s').value = '';
        document.getElementById('price-m').value = '';
        document.getElementById('price-md').value = '';

        if (!id1) {
            // Reset colors and state if A is not selected
            Array.from(selectB.options).forEach(opt => {
                opt.style.color = '';
                opt.disabled = false;
                opt.style.cursor = '';
                opt.text = opt.text.replace(' (brak ceny)', '');
            });
            return;
        }

        // Color options in B based on existing prices with A
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
            const hasPrice = allPrices.some(p => p.stop1_id === stop1 && p.stop2_id === stop2);

            opt.style.color = hasPrice ? '' : '#ef4444'; // Red if no price
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
        const price = allPrices.find(p => p.stop1_id === stop1 && p.stop2_id === stop2);

        if (price) {
            document.getElementById('price-s').value = price.price_s;
            document.getElementById('price-m').value = price.price_m;
            document.getElementById('price-md').value = price.price_md;
        }
    }

    document.getElementById('price-stop-a').addEventListener('change', updatePriceForm);
    document.getElementById('price-stop-b').addEventListener('change', updatePriceForm);

    // Auto-calculate monthly based on single price:
    // Bilet miesięczny = 2 * Bilet jednorazowy * 20
    // Bilet miesięczny ulgowy = Bilet miesięczny - 49%
    document.getElementById('price-s').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            const priceM = val * 2 * 20;
            if (!isMonthlyManuallyEdited) {
                document.getElementById('price-m').value = priceM.toFixed(2);
            }
            if (!isMonthlyDiscountManuallyEdited) {
                const currentPriceM = !isMonthlyManuallyEdited ? priceM : parseFloat(document.getElementById('price-m').value);
                if (!isNaN(currentPriceM)) {
                    document.getElementById('price-md').value = (currentPriceM * 0.51).toFixed(2);
                } else {
                    document.getElementById('price-md').value = '';
                }
            }
        } else {
            if (!isMonthlyManuallyEdited) {
                document.getElementById('price-m').value = '';
            }
            if (!isMonthlyDiscountManuallyEdited) {
                document.getElementById('price-md').value = '';
            }
        }
    });

    // Auto-calculate discount (-49%)
    document.getElementById('price-m').addEventListener('input', (e) => {
        if (e.target.value.trim() === '') {
            isMonthlyManuallyEdited = false;
        } else {
            isMonthlyManuallyEdited = true;
        }
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            if (!isMonthlyDiscountManuallyEdited) {
                // Ulgowy to -49% czyli 51% ceny podstawowej
                const discounted = (val * 0.51).toFixed(2);
                document.getElementById('price-md').value = discounted;
            }
        } else {
            if (!isMonthlyDiscountManuallyEdited) {
                document.getElementById('price-md').value = '';
            }
        }
    });

    document.getElementById('price-md').addEventListener('input', (e) => {
        if (e.target.value.trim() === '') {
            isMonthlyDiscountManuallyEdited = false;
        } else {
            isMonthlyDiscountManuallyEdited = true;
        }
    });

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
                allPrices = data.prices;
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

        if (!confirm(`Na pewno chcesz ${actionStr} ceny wszystkich biletów ${typeName} o ${absAmount} zł? Zmiana dotknie tylko przystanków, które mają już wprowadzoną cenę.`)) {
            return;
        }

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
                allPrices = data.prices;
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

    document.getElementById('recalculate-monthly-btn').addEventListener('click', async () => {
        if (!confirm('Czy na pewno chcesz przeliczyć i zaktualizować ceny biletów miesięcznych normalnych i ulgowych dla WSZYSTKICH relacji na podstawie cen jednorazowych? Ta operacja nadpisze obecne ceny miesięczne.')) {
            return;
        }
        try {
            const res = await fetch('/api/admin/pricing/recalculate-monthly', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok) {
                allPrices = data.prices;
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

    // --- FAQ LOGIC ---
    async function loadFaqData() {
        try {
            const res = await fetch('/api/faq');
            allFaqs = await res.json();
            renderFaqList();
        } catch (e) {
            console.error("Failed to load FAQ data", e);
        }
    }

    function renderFaqList() {
        const container = document.getElementById('faq-list-container');
        container.innerHTML = '';
        if (allFaqs.length === 0) {
            container.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">Brak pytań FAQ.</p>';
            return;
        }

        allFaqs.forEach(faq => {
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

    document.getElementById('faq-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = document.getElementById('faq-question').value.trim();
        const answer = document.getElementById('faq-answer').value.trim();

        if (!question || !answer) return;

        const url = editingFaqId ? `/api/admin/faq/${editingFaqId}` : '/api/admin/faq';
        const method = editingFaqId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, answer })
            });
            const data = await res.json();
            if (res.ok) {
                allFaqs = data.faqs;
                localStorage.removeItem('pytania');
                showStatus(editingFaqId ? 'Pytanie FAQ zostało zaktualizowane.' : 'Nowe pytanie FAQ zostało dodane.', 'success');
                resetFaqForm();
                renderFaqList();
            } else {
                showStatus(data.error || 'Błąd zapisu FAQ.', 'error');
            }
        } catch (e) {
            showStatus('Błąd połączenia przy zapisywaniu FAQ.', 'error');
        }
    });

    function resetFaqForm() {
        editingFaqId = null;
        document.getElementById('faq-question').value = '';
        document.getElementById('faq-answer').value = '';
        document.getElementById('faq-save-btn').textContent = 'Zapisz Pytanie FAQ';

        const cancelBtn = document.getElementById('faq-cancel-edit');
        if (cancelBtn) cancelBtn.remove();
    }

    window.editFaq = (id) => {
        const faq = allFaqs.find(f => f.id === id);
        if (!faq) return;

        editingFaqId = id;
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
                allFaqs = data.faqs;
                localStorage.removeItem('pytania');
                showStatus('Pytanie FAQ zostało usunięte.', 'success');
                renderFaqList();
            }
        } catch (e) {
            showStatus('Błąd połączenia podczas usuwania FAQ.', 'error');
        }
    };
});
