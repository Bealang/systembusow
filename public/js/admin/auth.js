function setButtonLoading(button, isLoading, loadingText = 'Wysyłanie...') {
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
                    window.location.href = '/admin';
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
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = forgotForm.querySelector('button[type="submit"]');
            const email = document.getElementById('forgot-email').value;

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
                forgotForm.reset();
                forgotForm.style.display = 'none';
                loginForm.style.display = 'block';
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
