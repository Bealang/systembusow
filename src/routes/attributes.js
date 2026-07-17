const router = require('express').Router();
const requireAuth = require('../middleware/auth');
const attributeService = require('../services/attributeService');
const { pdfUpload } = require('../middleware/upload');
const { saveFile } = require('../services/fileService');
const path = require('path');
const config = require('../config/index');

// --- PUBLIC ---

router.get('/api/attributes', (req, res) => {
    try {
        res.json(attributeService.getAll());
    } catch (error) {
        console.error("Błąd pobierania oznaczeń:", error);
        res.status(500).json({ error: 'Błąd serwera.' });
    }
});

// --- ADMIN ---

router.post('/api/admin/attributes', requireAuth, (req, res) => {
    const { symbol, description } = req.body;
    if (!symbol || !description) {
        return res.status(400).json({ error: 'Symbol i opis są wymagane.' });
    }

    try {
        const result = attributeService.create(symbol, description);
        if (result.error) return res.status(400).json({ error: result.error });
        res.json({ success: true, message: 'Dodano oznaczenie', attributes: result.attributes });
    } catch (error) {
        console.error("Błąd zapisu oznaczenia:", error);
        res.status(500).json({ error: 'Błąd zapisu.' });
    }
});

router.put('/api/admin/attributes/:symbol', requireAuth, (req, res) => {
    const oldSymbol = req.params.symbol;
    const { symbol: newSymbol, description: newDescription } = req.body;

    if (!newSymbol || !newDescription) {
        return res.status(400).json({ error: 'Symbol i opis są wymagane.' });
    }

    try {
        const result = attributeService.update(oldSymbol, newSymbol, newDescription);
        if (result.error) {
            const status = result.status || 400;
            return res.status(status).json({ error: result.error });
        }
        res.json({ success: true, message: 'Oznaczenie zostało zaktualizowane.', attributes: result.attributes });
    } catch (error) {
        console.error("Błąd aktualizacji oznaczeń:", error);
        res.status(500).json({ error: 'Błąd zapisu.' });
    }
});

router.delete('/api/admin/attributes/:symbol', requireAuth, (req, res) => {
    const symbol = req.params.symbol;
    try {
        const result = attributeService.remove(symbol);
        res.json({ success: true, message: 'Usunięto oznaczenie', attributes: result.attributes });
    } catch (error) {
        console.error("Błąd usuwania oznaczenia: ", error);
        res.status(500).json({ error: 'Błąd usuwania.' });
    }
});

// Upload regulamin PDF (co-located with attributes since both are "misc admin")
router.post('/api/admin/upload-regulamin', requireAuth, pdfUpload.single('regulamin_file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nie wybrano pliku regulaminu.' });
    }

    try {
        const filePath = path.join(config.paths.public, 'regulamin.pdf');
        await saveFile(filePath, req.file.buffer);
        res.json({ success: true, message: 'Plik regulaminu (.pdf) został pomyślnie wgrany i zastąpił poprzedni.' });
    } catch (error) {
        console.error("Błąd podczas wgrywania regulaminu:", error);
        res.status(500).json({ error: 'Wystąpił krytyczny błąd zapisu pliku regulaminu na serwerze (plik może być zablokowany).' });
    }
});

module.exports = router;
