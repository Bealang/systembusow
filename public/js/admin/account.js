import { showStatus, setButtonLoading } from './ui.js';

let fullUserEmail = '';
let maskedUserEmail = '';
let isEmailVisible = false;

const eyeOpenSvg = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
const eyeOffSvg = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;

export async function loadAccountData() {
    try {
        const res = await fetch('/api/account');
        const data = await res.json();

        if (data.success && data.user) {
            const usernameEl = document.getElementById('account-username-display');
            const emailEl = document.getElementById('account-email-display');

            if (usernameEl) usernameEl.textContent = data.user.username;

            fullUserEmail = data.user.email || '';
            maskedUserEmail = data.user.maskedEmail || fullUserEmail;

            if (emailEl) {
                emailEl.textContent = isEmailVisible ? fullUserEmail : maskedUserEmail;
            }
        }
    } catch (e) {
        console.error('Błąd ładowania danych konta:', e);
    }
}

export function initAccount() {
    loadAccountData();

    const toggleBtn = document.getElementById('toggle-email-visibility');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            isEmailVisible = !isEmailVisible;
            const emailEl = document.getElementById('account-email-display');
            const eyeIcon = document.getElementById('eye-icon');

            if (emailEl) {
                emailEl.textContent = isEmailVisible ? fullUserEmail : maskedUserEmail;
            }
            if (eyeIcon) {
                eyeIcon.innerHTML = isEmailVisible ? eyeOffSvg : eyeOpenSvg;
            }
        });
    }

    // 1. Formularz zmiany nazwy użytkownika
    const formUsername = document.getElementById('form-change-username');
    if (formUsername) {
        let lastUsernameData = null;
        const usernameBtn = formUsername.querySelector('button[type="submit"]');

        if (usernameBtn) {
            usernameBtn.addEventListener('click', () => {
                const inputUser = document.getElementById('new-username-input');
                const inputPass = document.getElementById('username-confirm-password');
                if (lastUsernameData && (!inputUser.value || !inputPass.value)) {
                    if (!inputUser.value) inputUser.value = lastUsernameData.newUsername;
                    if (!inputPass.value) inputPass.value = lastUsernameData.currentPassword;
                }
            });
        }

        formUsername.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = usernameBtn || formUsername.querySelector('button[type="submit"]');
            const inputUser = document.getElementById('new-username-input');
            const inputPass = document.getElementById('username-confirm-password');

            let newUsername = inputUser.value.trim();
            let currentPassword = inputPass.value;

            if ((!newUsername || !currentPassword) && lastUsernameData) {
                newUsername = newUsername || lastUsernameData.newUsername;
                currentPassword = currentPassword || lastUsernameData.currentPassword;
            }

            setButtonLoading(btn, true, 'Proszę czekać...');

            try {
                const res = await fetch('/api/account/request-username-change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newUsername, currentPassword })
                });
                const data = await res.json();

                if (data.success) {
                    showStatus(data.message, 'success');
                    lastUsernameData = { newUsername, currentPassword };
                    formUsername.reset();
                    btn.dataset.originalText = 'Wyślij ponownie';
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

            setButtonLoading(btn, true, 'Proszę czekać...');

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
        let lastEmailData = null;
        const emailBtn = formEmail.querySelector('button[type="submit"]');

        if (emailBtn) {
            emailBtn.addEventListener('click', () => {
                const inputEmail = document.getElementById('email-new');
                const inputPass = document.getElementById('email-confirm-password');
                if (lastEmailData && (!inputEmail.value || !inputPass.value)) {
                    if (!inputEmail.value) inputEmail.value = lastEmailData.newEmail;
                    if (!inputPass.value) inputPass.value = lastEmailData.currentPassword;
                }
            });
        }

        formEmail.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = emailBtn || formEmail.querySelector('button[type="submit"]');
            const inputEmail = document.getElementById('email-new');
            const inputPass = document.getElementById('email-confirm-password');

            let newEmail = inputEmail.value.trim();
            let currentPassword = inputPass.value;

            if ((!newEmail || !currentPassword) && lastEmailData) {
                newEmail = newEmail || lastEmailData.newEmail;
                currentPassword = currentPassword || lastEmailData.currentPassword;
            }

            setButtonLoading(btn, true, 'Proszę czekać...');

            try {
                const res = await fetch('/api/account/request-email-change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newEmail, currentPassword })
                });
                const data = await res.json();

                if (data.success) {
                    showStatus(data.message, 'success');
                    lastEmailData = { newEmail, currentPassword };
                    formEmail.reset();
                    btn.dataset.originalText = 'Wyślij ponownie';
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
