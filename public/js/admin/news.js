import state from './state.js';
import { showStatus, showBadge } from './ui.js';

// Snapshot for edit mode (null = add-new mode)
let newsFormSnapshot = null;

function checkNewsUnsaved() {
    const titleEl = document.getElementById('news-title');
    const editorEl = document.getElementById('news-editor');
    const qlContainer = editorEl?.querySelector('.ql-container') || editorEl;
    const qlToolbar = editorEl?.previousElementSibling;

    if (newsFormSnapshot === null) {
        // Add-new mode: no yellow, no badge
        if (titleEl) titleEl.classList.remove('unsaved-input');
        if (editorEl) editorEl.classList.remove('unsaved-input');
        if (qlContainer) qlContainer.classList.remove('unsaved-input');
        if (qlToolbar && qlToolbar.classList.contains('ql-toolbar')) qlToolbar.classList.remove('unsaved-input');
        showBadge(false);
        return;
    }

    // Edit mode: compare with snapshot
    const title = (titleEl?.value ?? '').trim();
    const quillHtml = state.quill ? state.quill.root.innerHTML : '';

    const titleDirty = title !== newsFormSnapshot.title;
    const contentDirty = quillHtml !== newsFormSnapshot.content;

    if (titleEl) {
        titleEl.classList.toggle('unsaved-input', titleDirty);
    }

    if (editorEl) {
        if (contentDirty) {
            editorEl.classList.add('unsaved-input');
            if (qlContainer) qlContainer.classList.add('unsaved-input');
            if (qlToolbar && qlToolbar.classList.contains('ql-toolbar')) qlToolbar.classList.add('unsaved-input');
        } else {
            editorEl.classList.remove('unsaved-input');
            if (qlContainer) qlContainer.classList.remove('unsaved-input');
            if (qlToolbar && qlToolbar.classList.contains('ql-toolbar')) qlToolbar.classList.remove('unsaved-input');
        }
    }

    showBadge(titleDirty || contentDirty);
}

function renderNewsList(newsList, total = 0) {
    const listDiv = document.getElementById('news-list');
    if (!listDiv) return;
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
        loadMoreBtn.addEventListener('click', () => loadAdminNews(state.currentAdminNewsPage + 1, true));
        listDiv.appendChild(loadMoreBtn);
    }

    document.querySelectorAll('.delete-news-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Na pewno usunąć ten komunikat?')) {
                await deleteNews(e.target.dataset.id);
            }
        });
    });
}

async function loadAdminNews(page = 1, append = false) {
    try {
        const res = await fetch(`/api/news?page=${page}&limit=10`);
        const data = await res.json();
        if (append) {
            state.allLoadedAdminNews = state.allLoadedAdminNews.concat(data.news);
        } else {
            state.allLoadedAdminNews = data.news;
        }
        state.currentAdminNewsPage = page;
        renderNewsList(state.allLoadedAdminNews, data.total);
    } catch (e) { }
}

async function deleteNews(id) {
    try {
        const res = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
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

function cancelEditing() {
    if (window.deselectImage) window.deselectImage();
    state.editingNewsId = null;
    newsFormSnapshot = null;
    const titleEl = document.getElementById('news-title');
    if (titleEl) {
        titleEl.value = '';
        titleEl.classList.remove('unsaved-input');
    }
    const editorEl = document.getElementById('news-editor');
    if (editorEl) {
        editorEl.classList.remove('unsaved-input');
        const qlContainer = editorEl.querySelector('.ql-container');
        if (qlContainer) qlContainer.classList.remove('unsaved-input');
        const qlToolbar = editorEl.previousElementSibling;
        if (qlToolbar && qlToolbar.classList.contains('ql-toolbar')) qlToolbar.classList.remove('unsaved-input');
    }
    if (state.quill) state.quill.root.innerHTML = '';
    if (formBtn) formBtn.textContent = 'Zapisz Publikację';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    showBadge(false);
}

let formBtn, cancelEditBtn;

export function initNews() {
    // Toggle schedule image visibility checkbox
    const toggleScheduleImageCheckbox = document.getElementById('toggle-schedule-image-checkbox');
    if (toggleScheduleImageCheckbox) {
        fetch('/api/admin/schedule-image-config')
            .then(res => res.json())
            .then(data => {
                toggleScheduleImageCheckbox.checked = !!data.showScheduleImage;
            })
            .catch(err => console.error("Błąd podczas pobierania ustawień zdjęcia rozkładu:", err));

        toggleScheduleImageCheckbox.addEventListener('change', async (e) => {
            const show = e.target.checked;
            try {
                const res = await fetch('/api/admin/toggle-schedule-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ show })
                });
                const data = await res.json();
                if (res.ok) {
                    showStatus(show ? 'Włączono wyświetlanie zdjęcia rozkładu.' : 'Wyłączono wyświetlanie zdjęcia rozkładu.', 'success');
                } else {
                    showStatus(data.error || 'Błąd zapisu ustawień.', 'error');
                    toggleScheduleImageCheckbox.checked = !show;
                }
            } catch (err) {
                showStatus('Krytyczny błąd połączenia przy zapisie ustawień.', 'error');
                toggleScheduleImageCheckbox.checked = !show;
            }
        });
    }

    // Upload schedule image
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('rozklad_image');
            if (!fileInput || !fileInput.files[0]) return;

            const formData = new FormData();
            formData.append('rozklad_image', fileInput.files[0]);

            try {
                const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
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
    }

    // Upload regulamin PDF
    const uploadRegulaminForm = document.getElementById('upload-regulamin-form');
    if (uploadRegulaminForm) {
        uploadRegulaminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('regulamin_file');
            if (!fileInput || !fileInput.files[0]) return;

            const formData = new FormData();
            formData.append('regulamin_file', fileInput.files[0]);

            try {
                const res = await fetch('/api/admin/upload-regulamin', { method: 'POST', body: formData });
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
    }

    const newsForm = document.getElementById('news-form');
    if (!newsForm) return;

    loadAdminNews();

    formBtn = newsForm.querySelector('button[type="submit"]');

    // Cancel edit button
    cancelEditBtn = document.createElement('button');
    cancelEditBtn.type = 'button';
    cancelEditBtn.className = 'btn-danger';
    cancelEditBtn.style.padding = '15px 30px';
    cancelEditBtn.style.marginLeft = '10px';
    cancelEditBtn.style.display = 'none';
    cancelEditBtn.textContent = 'Anuluj edycję';
    formBtn.parentNode.insertBefore(cancelEditBtn, formBtn.nextSibling);
    cancelEditBtn.addEventListener('click', cancelEditing);

    // Global handlers for onclick in HTML
    window.cancelEditing = cancelEditing;

    // After Quill and title input are ready, wire up unsaved-change listeners
    // We use a short delay so Quill is fully initialized by imageEditor.js
    setTimeout(() => {
        const titleEl = document.getElementById('news-title');
        if (titleEl) titleEl.addEventListener('input', checkNewsUnsaved);
        if (state.quill) {
            state.quill.on('text-change', checkNewsUnsaved);
        }
    }, 300);

    window.editNews = (id) => {
        fetch('/api/news')
            .then(res => res.json())
            .then(allNews => {
                const newsItem = allNews.find(n => n.id === id);
                if (newsItem) {
                    state.editingNewsId = id;
                    const titleEl = document.getElementById('news-title');
                    if (titleEl) titleEl.value = newsItem.title;
                    if (state.quill) state.quill.root.innerHTML = newsItem.content;

                    // Take snapshot of original values
                    newsFormSnapshot = {
                        title: newsItem.title.trim(),
                        content: newsItem.content
                    };

                    if (formBtn) formBtn.textContent = 'Zapisz zmiany (Edycja)';
                    if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
                    const container = document.querySelector('.admin-container');
                    if (container) container.scrollIntoView({ behavior: 'smooth' });

                    // Not dirty yet — just loaded
                    showBadge(false);
                }
            });
    };

    // News form submit
    newsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (window.deselectImage) window.deselectImage();
        const titleEl = document.getElementById('news-title');
        if (!titleEl) return;
        const title = titleEl.value;
        const content = state.quill ? state.quill.root.innerHTML : '';
        if (!title || title.trim() === '') {
            showStatus('Nie można opublikować: Brakuje tytułu aktualności!', 'error');
            return;
        }
        if (state.quill && state.quill.getText().trim() === '') {
            showStatus('Nie można opublikować: Treść wiadomości nie może być pusta.', 'error');
            return;
        }

        try {
            const url = state.editingNewsId ? `/api/admin/news/${state.editingNewsId}` : '/api/admin/news';
            const method = state.editingNewsId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            const data = await res.json();
            if (res.ok) {
                showStatus(state.editingNewsId ? 'Aktualność została pomyślnie zedytowana.' : 'Nowa aktualność została opublikowana!', 'success');
                newsFormSnapshot = null;
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
}

export function initQuickNews() {
    const form = document.getElementById('quick-news-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('quick-news-title');
        const contentInput = document.getElementById('quick-news-content');
        if (!titleInput || !contentInput) return;

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        if (!title || !content) {
            showStatus('Wypełnij wszystkie pola.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/admin/news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showStatus('Nowa aktualność została opublikowana!', 'success');
                titleInput.value = '';
                contentInput.value = '';
            } else {
                showStatus(data.error || 'Błąd podczas zapisywania aktualności.', 'error');
            }
        } catch (err) {
            showStatus('Błąd połączenia podczas publikacji.', 'error');
        }
    });
}
