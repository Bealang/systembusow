const router = require('express').Router();
const requireAuth = require('../middleware/auth');
const faqService = require('../services/faqService');

// --- PUBLIC ---

router.get('/api/faq', (req, res) => {
    try {
        res.json(faqService.getAll());
    } catch (error) {
        console.error("Błąd bazy danych (faq):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania pytań FAQ.' });
    }
});

// --- ADMIN ---

router.post('/api/admin/faq', requireAuth, (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Pytanie i odpowiedź są wymagane.' });

    try {
        const faqs = faqService.create(question, answer);
        res.json({ success: true, message: 'Pytanie FAQ dodane.', faqs });
    } catch (error) {
        console.error("Błąd bazy danych (admin-faq):", error);
        res.status(500).json({ error: 'Błąd podczas dodawania pytania FAQ.' });
    }
});

router.put('/api/admin/faq/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Pytanie i odpowiedź są wymagane.' });

    try {
        const faqs = faqService.update(id, question, answer);
        if (!faqs) return res.status(404).json({ error: 'Nie znaleziono pytania FAQ.' });
        res.json({ success: true, message: 'Pytanie FAQ zaktualizowane.', faqs });
    } catch (error) {
        console.error("Błąd bazy danych (admin-faq-edit):", error);
        res.status(500).json({ error: 'Błąd podczas edycji pytania FAQ.' });
    }
});

router.post('/api/admin/faq/reorder', requireAuth, (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'Nieprawidłowe dane.' });

    try {
        faqService.reorder(orders);
        res.json({ success: true, message: 'Kolejność FAQ została zapisana.' });
    } catch (error) {
        console.error("Błąd reorderowania FAQ:", error);
        res.status(500).json({ error: 'Błąd podczas zapisywania kolejności FAQ.' });
    }
});

router.delete('/api/admin/faq/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const faqs = faqService.remove(id);
        res.json({ success: true, message: 'Pytanie FAQ usunięte.', faqs });
    } catch (error) {
        console.error("Błąd bazy danych (admin-faq-delete):", error);
        res.status(500).json({ error: 'Błąd podczas usuwania pytania FAQ.' });
    }
});

module.exports = router;
