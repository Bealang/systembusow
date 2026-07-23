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
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}
