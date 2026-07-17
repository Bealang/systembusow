const router = require('express').Router();
const requireAuth = require('../middleware/auth');
const newsService = require('../services/newsService');
const { imageUpload } = require('../middleware/upload');
const { saveFile } = require('../services/fileService');
const path = require('path');
const config = require('../config/index');

// --- PUBLIC ---

router.get('/api/news', (req, res) => {
    try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);

        if (!isNaN(page) && !isNaN(limit)) {
            res.json(newsService.getPaginated(page, limit));
        } else {
            res.json(newsService.getAll());
        }
    } catch (error) {
        console.error("Błąd bazy danych (news):", error);
        res.status(500).json({ error: 'Wystąpił problem wewnętrzny serwera przy pobieraniu aktualności.' });
    }
});

// --- ADMIN ---

router.post('/api/admin/news', requireAuth, (req, res) => {
    const { title, content } = req.body;
    try {
        const news = newsService.create(title, content);
        res.json({ success: true, message: 'Aktualność dodana.', news });
    } catch (error) {
        console.error("Błąd bazy danych przy dodawaniu newsa:", error);
        res.status(500).json({ error: 'Błąd podczas zapisu nowej aktualności.' });
    }
});

router.put('/api/admin/news/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { title, content } = req.body;

    try {
        const news = newsService.update(id, title, content);
        if (!news) {
            return res.status(404).json({ error: 'Nie znaleziono aktualności.' });
        }
        res.json({ success: true, message: 'Pomyślnie zaktualizowano aktualność.', news });
    } catch (error) {
        console.error("Błąd bazy danych przy edycji newsa:", error);
        res.status(500).json({ error: 'Błąd podczas edycji aktualności w bazie.' });
    }
});

router.delete('/api/admin/news/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const news = newsService.remove(id);
        res.json({ success: true, message: 'Aktualność usunięta.', news });
    } catch (error) {
        console.error("Błąd bazy danych przy usuwaniu newsa:", error);
        res.status(500).json({ error: 'Błąd podczas usuwania aktualności z bazy.' });
    }
});

// Upload news image
router.post('/api/admin/upload-news-image', requireAuth, imageUpload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nie wybrano pliku.' });
    }

    try {
        const ext = path.extname(req.file.originalname).toLowerCase() || '.webp';
        const fileName = `news-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const filePath = path.join(config.paths.uploads, fileName);

        await saveFile(filePath, req.file.buffer);
        res.json({ success: true, url: `/uploads/${fileName}` });
    } catch (error) {
        console.error("Błąd podczas wgrywania obrazka:", error);
        res.status(500).json({ error: 'Wystąpił błąd zapisu pliku na serwerze.' });
    }
});

module.exports = router;
