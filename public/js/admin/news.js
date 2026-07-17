import state from './state.js';
import { showStatus } from './ui.js';

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
    document.getElementById('news-title').value = '';
    state.quill.root.innerHTML = '';
    formBtn.textContent = 'Zapisz Publikację';
    cancelEditBtn.style.display = 'none';
}

let formBtn, cancelEditBtn;

export function initNews() {
    loadAdminNews();

    formBtn = document.querySelector('#news-form button[type="submit"]');

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

    window.editNews = (id) => {
        fetch('/api/news')
            .then(res => res.json())
            .then(allNews => {
                const newsItem = allNews.find(n => n.id === id);
                if (newsItem) {
                    state.editingNewsId = id;
                    document.getElementById('news-title').value = newsItem.title;
                    state.quill.root.innerHTML = newsItem.content;
                    formBtn.textContent = 'Zapisz zmiany (Edycja)';
                    cancelEditBtn.style.display = 'inline-block';
                    document.querySelector('.admin-container').scrollIntoView({ behavior: 'smooth' });
                }
            });
    };

    // News form submit
    document.getElementById('news-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (window.deselectImage) window.deselectImage();
        const title = document.getElementById('news-title').value;
        const content = state.quill.root.innerHTML;
        if (!title || title.trim() === '') {
            showStatus('Nie można opublikować: Brakuje tytułu aktualności!', 'error');
            return;
        }
        if (state.quill.getText().trim() === '') {
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

    // Upload schedule image
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('rozklad_image');
        if (!fileInput.files[0]) return;

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

    // Upload regulamin PDF
    document.getElementById('upload-regulamin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('regulamin_file');
        if (!fileInput.files[0]) return;

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
