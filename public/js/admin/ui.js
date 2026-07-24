export function showStatus(msg, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : '⚠️';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${msg}</span>
    `;

    container.appendChild(toast);

    if (type === 'success') {
        console.log(`%c[ADMIN SUCCESS] ${msg}`, 'color: #10b981; font-weight: bold;');
    } else {
        console.error(`%c[ADMIN ERROR] ${msg}`, 'color: #ef4444; font-weight: bold;');
    }

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

/**
 * Show or hide the fixed "unsaved changes" badge.
 * Works on any admin page that has #unsaved-changes-badge in its HTML.
 */
export function showBadge(visible) {
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
export function setButtonLoading(button, isLoading, loadingText = 'Proszę czekać...') {
    if (!button) return;
    if (isLoading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.disabled = true;
        button.classList.add('btn-loading');
        button.innerHTML = `<span class="btn-spinner"></span>${loadingText}`;
    } else {
        button.disabled = false;
        button.classList.remove('btn-loading');
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
    }
}


export function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');

            if (window.deselectImage) window.deselectImage();

            const sidebar = document.getElementById('admin-header-main');
            if (sidebar) sidebar.classList.remove('open');
        });
    });
}

export function initMobileToggle() {
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('admin-header-main');
    if (!mobileToggle || !sidebar) return;

    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    function openSidebar() {
        sidebar.classList.add('open');
        mobileToggle.classList.add('active');
        if (overlay) overlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        mobileToggle.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }

    function toggleSidebar() {
        const isOpen = sidebar.classList.toggle('open');
        mobileToggle.classList.toggle('active', isOpen);
        if (overlay) overlay.classList.toggle('active', isOpen);
    }

    mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
    });

    overlay.addEventListener('click', () => {
        closeSidebar();
    });

    // Close when clicking links inside sidebar on mobile screens
    sidebar.querySelectorAll('a, button').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                closeSidebar();
            }
        });
    });

    // Interactive Drag Tracking for Admin Sidebar (Anywhere on screen)
    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;
    const sidebarWidth = 280; // px width of sidebar

    document.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 992) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isDragging = true;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || window.innerWidth > 992) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchStartX;
        const deltaY = currentY - touchStartY;

        // Verify gesture is primarily horizontal
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            const isOpen = sidebar.classList.contains('open');
            sidebar.style.transition = 'none';
            if (overlay) overlay.style.transition = 'none';

            let currentTranslateX = 0;
            if (isOpen) {
                // Dragging left (closing): deltaX is negative
                currentTranslateX = Math.min(0, Math.max(-sidebarWidth, deltaX));
            } else {
                // Dragging right (opening): starting from -sidebarWidth
                currentTranslateX = Math.min(0, Math.max(-sidebarWidth, -sidebarWidth + deltaX));
            }

            sidebar.style.transform = `translateX(${currentTranslateX}px)`;

            // Smoothly update overlay opacity based on progress (0 to 1)
            const progress = (currentTranslateX + sidebarWidth) / sidebarWidth;
            if (overlay) {
                overlay.style.opacity = progress * 0.5; // max opacity 0.5
                overlay.style.pointerEvents = progress > 0.1 ? 'auto' : 'none';
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!isDragging || window.innerWidth > 992) return;
        isDragging = false;

        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX;
        const isOpen = sidebar.classList.contains('open');

        // Restore CSS transitions
        sidebar.style.transition = '';
        sidebar.style.transform = '';
        if (overlay) {
            overlay.style.transition = '';
            overlay.style.opacity = '';
            overlay.style.pointerEvents = '';
        }

        // Determine snap action
        if (isOpen) {
            // Dragged left significantly -> close
            if (deltaX < -50) {
                closeSidebar();
            } else {
                openSidebar();
            }
        } else {
            // Dragged right significantly -> open
            if (deltaX > 50) {
                openSidebar();
            } else {
                closeSidebar();
            }
        }
    }, { passive: true });
}
