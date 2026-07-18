import { showStatus } from './ui.js';

export async function initAlert() {
    const alertForm = document.getElementById('alert-form');
    const alertTextInput = document.getElementById('alert-text');

    if (!alertForm) return;

    // Load initial alert data from API
    try {
        const res = await fetch('/api/alert');
        if (res.ok) {
            const data = await res.json();
            alertTextInput.value = data.text || '';
        } else {
            showStatus('Błąd podczas ładowania danych alertu.', 'error');
        }
    } catch (e) {
        console.error("Error fetching initial alert config client-side:", e);
    }

    // Handle form submit
    alertForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = alertTextInput.value.trim();
        const active = text.length > 0;

        try {
            const res = await fetch('/api/admin/alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, active })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showStatus('Alert został pomyślnie zaktualizowany.', 'success');
            } else {
                showStatus(data.error || 'Błąd zapisu alertu.', 'error');
            }
        } catch (err) {
            console.error("Error saving alert configuration:", err);
            showStatus('Błąd połączenia przy zapisywaniu alertu.', 'error');
        }
    });
}
