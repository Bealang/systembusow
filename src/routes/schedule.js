const router = require('express').Router();
const path = require('path');
const requireAuth = require('../middleware/auth');
const scheduleService = require('../services/scheduleService');
const { imageUpload } = require('../middleware/upload');
const { saveFile, deleteFilesMatching, listFiles } = require('../services/fileService');
const config = require('../config/index');

// --- PUBLIC ---

router.get('/api/schedule', (req, res) => {
    try {
        res.json(scheduleService.getSchedule());
    } catch (error) {
        console.error("Błąd bazy danych (schedule):", error);
        res.status(500).json({ error: 'Wystąpił problem wewnętrzny serwera.' });
    }
});

// Route to dynamically serve the current schedule image
router.get('/rozklad-current', async (req, res) => {
    try {
        const files = await listFiles(config.paths.public);
        const rozkladFile = files.find(file => file.startsWith('rozklad.'));
        if (rozkladFile) {
            return res.sendFile(path.join(config.paths.public, rozkladFile));
        }
    } catch (e) {
        console.error("Błąd pobierania rozkładu:", e);
    }
    res.status(404).send('Nie znaleziono pliku rozkładu.');
});

// --- ADMIN ---

router.post('/api/admin/schedule', requireAuth, (req, res) => {
    const newSchedule = req.body;

    if (!scheduleService.validateScheduleFormat(newSchedule)) {
        return res.status(400).json({ error: 'Nieprawidłowy format danych rozkładu.' });
    }

    try {
        scheduleService.updateSchedule(newSchedule);
        res.json({ success: true, message: 'Rozkład został zaktualizowany.' });
    } catch (error) {
        console.error("Błąd bazy danych przy zapisie rozkładu:", error);
        res.status(500).json({ error: 'Błąd podczas zapisu do bazy danych.' });
    }
});

// Upload schedule image
router.post('/api/admin/upload-image', requireAuth, imageUpload.single('rozklad_image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nie wybrano pliku.' });
    }

    try {
        const ext = path.extname(req.file.originalname).toLowerCase() || '.png';

        // Delete any existing rozklad.* files to prevent duplicates
        await deleteFilesMatching(config.paths.public, 'rozklad.');

        // Save the new file
        const newFileName = `rozklad${ext}`;
        await saveFile(path.join(config.paths.public, newFileName), req.file.buffer);

        res.json({ success: true, message: `Plik rozkładu (${newFileName}) został pomyślnie zaktualizowany.` });
    } catch (error) {
        console.error("Błąd podczas wgrywania rozkładu:", error);
        res.status(500).json({ error: 'Wystąpił krytyczny błąd zapisu pliku na serwerze.' });
    }
});

// Schedule image visibility setting
router.get('/api/admin/schedule-image-config', requireAuth, (req, res) => {
    try {
        res.json({ showScheduleImage: scheduleService.getShowScheduleImage() });
    } catch (error) {
        res.status(500).json({ error: 'Błąd podczas pobierania ustawień zdjęcia rozkładu.' });
    }
});

router.post('/api/admin/toggle-schedule-image', requireAuth, (req, res) => {
    try {
        const { show } = req.body;
        scheduleService.setShowScheduleImage(show);
        res.json({ success: true, showScheduleImage: scheduleService.getShowScheduleImage() });
    } catch (error) {
        console.error("Błąd podczas zapisu ustawienia zdjęcia rozkładu:", error);
        res.status(500).json({ error: 'Błąd podczas zapisu ustawień.' });
    }
});

module.exports = router;
