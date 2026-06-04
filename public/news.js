// ============================================================================
// MLECZEK BUS - News Loader Module (news.js)
// Handles dynamic news feed, pagination controls, and query sync
// ============================================================================

(function() {
    function initNews() {
        const newsContainer = document.getElementById('news-container');
        if (!newsContainer) return;

        const newsPerPage = 3;
        let totalNewsCount = 0;
        let currentPage = 1;

        async function renderNewsPage(page, isInitial = false) {
            try {
                const response = await fetch(`/api/news?page=${page}&limit=${newsPerPage}`);
                const data = await response.json();
                const visibleNews = data.news;
                totalNewsCount = data.total;

                const totalPages = Math.ceil(totalNewsCount / newsPerPage);
                if (page < 1) page = 1;
                if (page > totalPages && totalPages > 0) page = totalPages;

                currentPage = page;

                if (totalNewsCount === 0) {
                    newsContainer.innerHTML = '<p class="text-center">Obecnie brak nowych komunikatów.</p>';
                    renderPaginationControls();
                    return;
                }

                newsContainer.innerHTML = visibleNews.map(item => {
                    let dateObj = new Date(item.date);
                    if (!item.date.includes('T') && item.id > 10000) {
                        let idDate = new Date(item.id);
                        if (!isNaN(idDate.getTime())) {
                            if (idDate.getFullYear() === dateObj.getFullYear() &&
                                idDate.getMonth() === dateObj.getMonth() &&
                                idDate.getDate() === dateObj.getDate()) {
                                dateObj = idDate;
                            }
                        }
                    }

                    const dateStr = dateObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

                    // Optimize image tags inside content for Lighthouse / Performance
                    let optimizedContent = item.content || '';
                    if (optimizedContent.includes('<img')) {
                        optimizedContent = optimizedContent.replace(/<img\s([^>]*)/gi, (match, p1) => {
                            let attrs = p1;
                            if (!attrs.includes('loading=')) {
                                attrs = 'loading="lazy" ' + attrs;
                            }
                            if (!attrs.includes('class=')) {
                                attrs = 'class="news-inline-image" ' + attrs;
                            } else {
                                attrs = attrs.replace(/class=["']([^"']*)["']/i, 'class="$1 news-inline-image"');
                            }
                            return `<img ${attrs}`;
                        });
                    }

                    return `
                    <div class="news-item reveal reveal-up">
                        <h3 class="news-title">${window.escapeHTML ? window.escapeHTML(item.title) : item.title}</h3>
                        <div class="news-meta">
                            <span class="news-date">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${dateStr}
                            </span>
                        </div>
                        <div class="news-content-text">${optimizedContent}</div>
                    </div>
                    `;
                }).join('');

                renderPaginationControls();

                if (window.observeNewElements) window.observeNewElements();

                // Update URL parameter
                if (!isInitial) {
                    const url = new URL(window.location.href);
                    if (page === 1) {
                        url.searchParams.delete('p');
                    } else {
                        url.searchParams.set('p', page);
                    }
                    url.hash = 'aktualnosci';
                    window.history.pushState({}, '', url.toString());

                    const newsSection = document.getElementById('aktualnosci');
                    if (newsSection) {
                        const navHeight = 100;
                        const targetPosition = newsSection.getBoundingClientRect().top + window.pageYOffset - navHeight;

                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                    }
                }
            } catch (error) {
                console.error("Error fetching news page:", error);
            }
        }

        function renderPaginationControls() {
            const totalPages = Math.ceil(totalNewsCount / newsPerPage);
            let paginationContainer = document.getElementById('news-pagination');

            if (!paginationContainer) {
                paginationContainer = document.createElement('div');
                paginationContainer.id = 'news-pagination';
                paginationContainer.className = 'pagination-container';
                newsContainer.after(paginationContainer);

                // Event delegation for pagination clicks
                paginationContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('.pagination-btn');
                    if (btn && !btn.hasAttribute('disabled')) {
                        const targetPage = parseInt(btn.dataset.page);
                        if (!isNaN(targetPage)) {
                            renderNewsPage(targetPage);
                        }
                    }
                });
            }

            if (totalPages <= 1) {
                paginationContainer.innerHTML = '';
                return;
            }

            let html = `
                <div class="pagination-controls">
                    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" aria-label="Poprzednia strona">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
            `;

            const range = 1;
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
                    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                } else if (i === currentPage - range - 1 || i === currentPage + range + 1) {
                    html += `<span class="pagination-ellipsis">...</span>`;
                }
            }

            html += `
                    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" aria-label="Następna strona">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            `;

            paginationContainer.innerHTML = html;
        }

        // Get initial page from query string
        const params = new URLSearchParams(window.location.search);
        const pageFromUrl = parseInt(params.get('p')) || 1;
        renderNewsPage(pageFromUrl, true);

        // Handle back/forward buttons
        window.addEventListener('popstate', () => {
            const p = new URLSearchParams(window.location.search);
            const page = parseInt(p.get('p')) || 1;
            renderNewsPage(page, true);
        });
    }

    document.addEventListener('DOMContentLoaded', initNews);
})();
