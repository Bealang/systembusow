import { initNews } from './news.js';
import { initSchedule } from './schedule.js';
import { initPricing } from './pricing.js';
import { initFaq } from './faq.js';
import { initAttributes } from './attributes.js';
import { initAlert } from './alert.js';

export async function checkAuth() {
    try {
        const res = await fetch('/api/check-auth');
        const data = await res.json();
        if (data.authenticated) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-header-main').style.display = 'block';
            document.getElementById('admin-panel').style.display = 'block';
            initNews();
            initSchedule();
            initPricing();
            initFaq();
            initAttributes();
            initAlert();
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('admin-header-main').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'none';
        }
    } catch (e) {
        console.error("Nie zalogowano", e);
    }
}

export function initLoginForm() {
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
                window.location.href = '/admin';
            } else {
                const alertEl = document.getElementById('login-alert');
                alertEl.textContent = data.message;
                alertEl.className = 'alert error';
            }
        } catch (err) {
            console.error("Blad logowania", err);
        }
    });
}

export function initLogout() {
    document.getElementById('logout-btn-header').addEventListener('click', async () => {
        await fetch('/api/logout');
        window.location.href = '/';
    });
}
