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
