const router = require('express').Router();
const requireAuth = require('../middleware/auth');
const pricingService = require('../services/pricingService');

// --- PUBLIC ---

router.get('/api/pricing-data', (req, res) => {
    try {
        res.json(pricingService.getPricingData());
    } catch (error) {
        console.error("Błąd bazy danych (pricing-data):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania danych cennika.' });
    }
});

router.get('/api/pricing-config', (req, res) => {
    try {
        res.json(pricingService.getPricingConfig());
    } catch (error) {
        console.error("Błąd bazy danych (pricing-config):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania konfiguracji cennika.' });
    }
});

router.get('/api/stops', (req, res) => {
    try {
        res.json({ stops: pricingService.getAllStops() });
    } catch (error) {
        console.error("Błąd bazy danych (stops):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania przystanków.' });
    }
});

router.get('/api/price', (req, res) => {
    try {
        const { stop1, stop2 } = req.query;
        if (!stop1 || !stop2) return res.status(400).json({ error: 'Brak przystanków' });
        res.json(pricingService.getPrice(stop1, stop2));
    } catch (error) {
        console.error("Błąd bazy danych (price):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania ceny.' });
    }
});

// --- ADMIN: Config ---

router.post('/api/admin/pricing-config', requireAuth, (req, res) => {
    const { multiplier, discounts, applyDiscountsToSingle } = req.body;
    try {
        const config = pricingService.updatePricingConfig(multiplier, discounts, applyDiscountsToSingle);
        res.json({ success: true, message: 'Konfiguracja cennika została zapisana.', config });
    } catch (error) {
        console.error("Błąd bazy danych (admin-pricing-config):", error);
        res.status(500).json({ error: 'Błąd podczas zapisywania konfiguracji cennika.' });
    }
});

// --- ADMIN: Stops ---

router.post('/api/admin/stops', requireAuth, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa przystanku jest wymagana.' });

    try {
        const stops = pricingService.addStop(name);
        res.json({ success: true, message: 'Przystanek dodany.', stops });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Przystanek o tej nazwie już istnieje.' });
        }
        res.status(500).json({ error: 'Błąd podczas dodawania przystanku.' });
    }
});

router.put('/api/admin/stops/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa przystanku jest wymagana.' });

    try {
        const stops = pricingService.updateStop(id, name);
        if (!stops) return res.status(404).json({ error: 'Nie znaleziono przystanku.' });
        res.json({ success: true, message: 'Nazwa przystanku została zaktualizowana.', stops });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Przystanek o tej nazwie już istnieje.' });
        }
        console.error("Błąd edycji przystanku:", error);
        res.status(500).json({ error: 'Błąd podczas edycji przystanku.' });
    }
});

router.post('/api/admin/stops/reorder', requireAuth, (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'Nieprawidłowe dane.' });

    try {
        pricingService.reorderStops(orders);
        res.json({ success: true, message: 'Kolejność została zapisana.' });
    } catch (error) {
        console.error("Błąd reorderowania:", error);
        res.status(500).json({ error: 'Błąd podczas zapisywania kolejności.' });
    }
});

router.delete('/api/admin/stops/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const stops = pricingService.deleteStop(id);
        res.json({ success: true, message: 'Przystanek i powiązane ceny zostały usunięte.', stops });
    } catch (error) {
        res.status(500).json({ error: 'Błąd podczas usuwania przystanku.' });
    }
});

// --- ADMIN: Pricing ---

router.post('/api/admin/pricing', requireAuth, (req, res) => {
    const { stop1_id, stop2_id, price_s } = req.body;
    const id1 = Math.min(stop1_id, stop2_id);
    const id2 = Math.max(stop1_id, stop2_id);

    if (id1 === id2) return res.status(400).json({ error: 'Przystanek początkowy i końcowy muszą być różne.' });

    try {
        const prices = pricingService.savePrice(stop1_id, stop2_id, price_s);
        res.json({ success: true, message: 'Cennik zaktualizowany.', prices });
    } catch (error) {
        console.error("Błąd bazy danych (admin-pricing):", error);
        res.status(500).json({ error: 'Błąd podczas zapisywania cennika.' });
    }
});

router.post('/api/admin/pricing/bulk', requireAuth, (req, res) => {
    const { amount } = req.body;
    const type = 's'; // Force 's' (jednorazowe)

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
        return res.status(400).json({ error: 'Nieprawidłowa kwota.' });
    }

    try {
        const prices = pricingService.bulkUpdatePrices(type, parsedAmount);
        res.json({
            success: true,
            message: `Pomyślnie zaktualizowano ceny biletów jednorazowych (${parsedAmount > 0 ? '+' : ''}${parsedAmount.toFixed(2)} zł).`,
            prices
        });
    } catch (error) {
        console.error("Błąd bazy danych (admin-pricing-bulk):", error);
        res.status(500).json({ error: 'Błąd podczas aktualizacji cen.' });
    }
});

module.exports = router;
