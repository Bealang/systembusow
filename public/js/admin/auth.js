import { setButtonLoading } from './ui.js';

export function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    const forgotForm = document.getElementById('forgot-form');
    const btnShowForgot = document.getElementById('btn-show-forgot');
    const btnHideForgot = document.getElementById('btn-hide-forgot');
    const alertEl = document.getElementById('login-alert');

    if (btnShowForgot) {
        btnShowForgot.addEventListener('click', () => {
            loginForm.style.display = 'none';
            forgotForm.style.display = 'block';
            if (alertEl) alertEl.style.display = 'none';
        });
    }

    if (btnHideForgot) {
        btnHideForgot.addEventListener('click', () => {
            forgotForm.style.display = 'none';
            loginForm.style.display = 'block';
            if (alertEl) alertEl.style.display = 'none';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button[type="submit"]');
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            setButtonLoading(btn, true, 'Logowanie...');

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (data.success) {
                    window.location.href = '/panel-zarzadzania';
                } else {
                    if (alertEl) {
                        alertEl.textContent = data.message;
                        alertEl.className = 'alert error';
                        alertEl.style.display = 'block';
                    }
                    setButtonLoading(btn, false);
                }
            } catch (err) {
                console.error("Błąd logowania", err);
                setButtonLoading(btn, false);
            }
        });
    }

    if (forgotForm) {
        let lastForgotData = null;
        const forgotBtn = forgotForm.querySelector('button[type="submit"]');

        if (forgotBtn) {
            forgotBtn.addEventListener('click', () => {
                const emailInput = document.getElementById('forgot-email');
                if (lastForgotData && !emailInput.value) {
                    emailInput.value = lastForgotData.email;
                }
            });
        }

        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = forgotBtn || forgotForm.querySelector('button[type="submit"]');
            const emailInput = document.getElementById('forgot-email');
            let email = emailInput.value.trim();

            if (!email && lastForgotData) {
                email = lastForgotData.email;
            }

            setButtonLoading(btn, true, 'Wysyłanie e-maila...');

            try {
                const res = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();

                if (alertEl) {
                    alertEl.textContent = data.message;
                    alertEl.className = data.success ? 'alert success' : 'alert error';
                    alertEl.style.display = 'block';
                }

                if (data.success) {
                    lastForgotData = { email };
                    forgotForm.reset();
                    btn.dataset.originalText = 'Wyślij ponownie';
                }
            } catch (err) {
                console.error("Błąd resetowania hasła", err);
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }
}

export function initLogout() {
    const btnLogout = document.getElementById('logout-btn-header');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await fetch('/api/logout');
            window.location.href = '/';
        });
    }
}
