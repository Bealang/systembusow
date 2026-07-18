const router = require('express').Router();
const requireAuth = require('../middleware/auth');
const alertService = require('../services/alertService');

// --- PUBLIC ---
router.get('/api/alert', (req, res) => {
    try {
        res.json(alertService.getAlert());
    } catch (error) {
        console.error("Błąd bazy danych (get alert):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania alertu.' });
    }
});

// --- ADMIN ---
router.post('/api/admin/alert', requireAuth, (req, res) => {
    const { text } = req.body;
    const trimmedText = (text || '').trim();
    const active = trimmedText.length > 0;
    try {
        const alert = alertService.updateAlert(trimmedText, active);
        res.json({ success: true, message: 'Alert zaktualizowany.', alert });
    } catch (error) {
        console.error("Błąd bazy danych (update alert):", error);
        res.status(500).json({ error: 'Błąd podczas aktualizacji alertu.' });
    }
});

module.exports = router;
