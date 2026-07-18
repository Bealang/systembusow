const router = require('express').Router();
const crypto = require('crypto');
const scheduleService = require('../services/scheduleService');
const alertService = require('../services/alertService');
const { requireAdminView } = require('../middleware/auth');


router.get('/', (req, res) => {
    let alert = null;
    try {
        alert = alertService.getAlert();
    } catch (error) {
        console.error("Błąd podczas pobierania alertu dla strony głównej:", error);
    }

    res.render('index', {
        title: 'TwojaNazwa - Busy Sułkowice Kraków',
        description: 'Szukasz busa do Krakowa? Oferujemy regularne przewozy pasażerskie. Sprawdź aktualny rozkład jazdy online!',
        keywords: 'rozklad jazdy, bus cennik, busy, przewoz osob, bilety miesieczne, bus kraków, busy sułkowice',
        activePage: 'home',
        isHome: true,
        alert: alert
    });
});

router.get('/cennik', (req, res) => {
    res.render('cennik', {
        title: 'TwojaNazwa - Cennik',
        description: 'Sprawdź ceny biletów jednorazowych oraz miesięcznych dla wszystkich połączeń.',
        keywords: 'cennik busy, ceny biletów, bilet miesięczny',
        activePage: 'cennik',
        isHome: false
    });
});

router.get('/kontakt', (req, res) => {
    res.render('kontakt', {
        title: 'TwojaNazwa - Kontakt',
        description: 'Skontaktuj się z nami. Dane firmy, numer telefonu.',
        keywords: 'kontakt, telefon',
        activePage: 'kontakt',
        isHome: false
    });
});

router.get('/prywatnosc', (req, res) => {
    res.render('prywatnosc', {
        title: 'TwojaNazwa - Polityka prywatności',
        description: 'Polityka prywatności serwisu. Dowiedz się, jak dbamy o Twoje dane.',
        keywords: '',
        activePage: 'prywatnosc',
        isHome: false
    });
});

router.get('/rozklad', (req, res) => {
    try {
        const { schedule, attributes } = scheduleService.getScheduleWithAttributes();
        res.render('rozklad', {
            title: 'TwojaNazwa - Rozkład Jazdy',
            description: 'Sprawdź aktualny rozkład jazdy busów. Godziny odjazdów i szczegóły połączeń.',
            keywords: 'rozklad jazdy, odjazdy, busy, przewozy',
            activePage: 'rozklad',
            isHome: false,
            schedule,
            attributes
        });
    } catch (error) {
        console.error("Błąd ładowania rozkładu:", error);
        res.status(500).send("Wystąpił błąd podczas ładowania rozkładu jazdy.");
    }
});

router.post('/action/footer-trigger', (req, res) => {
    const token = crypto.randomBytes(16).toString('hex');
    req.session.accessSecret = token;
    req.session.secretExpires = Date.now() + 5000;
    res.json({ redirectUrl: `/admin?auth=${token}` });
});

router.get('/admin', (req, res) => {
    if (req.session.isAdmin) {
        return res.render('admin/index', { activePage: 'dashboard' });
    }

    const urlToken = req.query.auth;
    const sessionToken = req.session.accessSecret;
    const isExpired = req.session.secretExpires ? (Date.now() > req.session.secretExpires) : true;

    if (urlToken && urlToken === sessionToken && !isExpired) {
        req.session.accessSecret = null;
        req.session.secretExpires = null;
        req.session.canAccessLogin = true;
        return res.render('admin/login');
    }

    res.status(401).send('Nieprawidłowy token autoryzacyjny.');
});

router.get('/admin/cennik', requireAdminView, (req, res) => {
    res.render('admin/cennik', { activePage: 'cennik' });
});

router.get('/admin/rozklad-jazdy', requireAdminView, (req, res) => {
    res.render('admin/rozklad-jazdy', { activePage: 'rozklad-jazdy' });
});

router.get('/admin/regulamin', requireAdminView, (req, res) => {
    res.render('admin/regulamin', { activePage: 'regulamin' });
});

router.get('/admin/aktualnosci', requireAdminView, (req, res) => {
    res.render('admin/aktualnosci', { activePage: 'aktualnosci' });
});

router.get('/admin/faq', requireAdminView, (req, res) => {
    res.render('admin/faq', { activePage: 'faq' });
});

// Redirect /index to root / for clean URLs
router.get('/index', (req, res) => {
    res.redirect(301, '/');
});

module.exports = router;

