import { showStatus } from './ui.js';

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

export async function loadAccountData() {
    try {
        const res = await fetch('/api/account');
        const data = await res.json();

        if (data.success && data.user) {
            const usernameEl = document.getElementById('account-username-display');
            const emailEl = document.getElementById('account-email-display');

            if (usernameEl) usernameEl.textContent = data.user.username;
            if (emailEl) emailEl.textContent = data.user.email;
        }
    } catch (e) {
        console.error('Błąd ładowania danych konta:', e);
    }
}

export function initAccount() {
    loadAccountData();

    // 1. Formularz zmiany nazwy użytkownika
    const formUsername = document.getElementById('form-change-username');
    if (formUsername) {
        formUsername.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formUsername.querySelector('button[type="submit"]');
            const newUsername = document.getElementById('new-username-input').value;
            const currentPassword = document.getElementById('username-confirm-password').value;

            setButtonLoading(btn, true, 'Wysyłanie wniosku...');

            try {
                const res = await fetch('/api/account/request-username-change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newUsername, currentPassword })
                });
                const data = await res.json();

                if (data.success) {
                    showStatus(data.message, 'success');
                    formUsername.reset();
                } else {
                    showStatus(data.message || 'Wystąpił błąd.', 'error');
                }
            } catch (err) {
                console.error(err);
                showStatus('Błąd połączenia z serwerem.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // 2. Formularz zmiany hasła
    const formPassword = document.getElementById('form-change-password');
    if (formPassword) {
        formPassword.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formPassword.querySelector('button[type="submit"]');
            const currentPassword = document.getElementById('pwd-current').value;
            const newPassword = document.getElementById('pwd-new').value;
            const confirmPassword = document.getElementById('pwd-confirm').value;

            setButtonLoading(btn, true, 'Zmieniam hasło...');

            try {
                const res = await fetch('/api/account/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
                });
                const data = await res.json();

                if (data.success) {
                    showStatus(data.message, 'success');
                    formPassword.reset();
                } else {
                    showStatus(data.message || 'Wystąpił błąd.', 'error');
                }
            } catch (err) {
                console.error(err);
                showStatus('Błąd połączenia z serwerem.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }

    // 3. Formularz zmiany e-maila
    const formEmail = document.getElementById('form-change-email');
    if (formEmail) {
        formEmail.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formEmail.querySelector('button[type="submit"]');
            const newEmail = document.getElementById('email-new').value;
            const currentPassword = document.getElementById('email-confirm-password').value;

            setButtonLoading(btn, true, 'Wysyłanie e-maila...');

            try {
                const res = await fetch('/api/account/request-email-change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newEmail, currentPassword })
                });
                const data = await res.json();

                if (data.success) {
                    showStatus(data.message, 'success');
                    formEmail.reset();
                } else {
                    showStatus(data.message || 'Wystąpił błąd.', 'error');
                }
            } catch (err) {
                console.error(err);
                showStatus('Błąd połączenia z serwerem.', 'error');
            } finally {
                setButtonLoading(btn, false);
            }
        });
    }
}
