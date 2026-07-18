const router = require('express').Router();
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
        title: 'Bodzio - Busy Sułkowice Kraków',
        description: 'Szukasz busa do Krakowa? Oferujemy regularne przewozy pasażerskie. Sprawdź aktualny rozkład jazdy online!',
        keywords: 'rozklad jazdy, bus cennik, busy, przewoz osob, bilety miesieczne, bus kraków, busy sułkowice',
        activePage: 'home',
        isHome: true,
        alert: alert
    });
});

router.get('/cennik', (req, res) => {
    res.render('cennik', {
        title: 'Bodzio - Cennik',
        description: 'Sprawdź ceny biletów jednorazowych oraz miesięcznych dla wszystkich połączeń.',
        keywords: 'cennik busy, ceny biletów, bilet miesięczny',
        activePage: 'cennik',
        isHome: false
    });
});

router.get('/kontakt', (req, res) => {
    res.render('kontakt', {
        title: 'Bodzio - Kontakt',
        description: 'Skontaktuj się z nami. Dane firmy, numer telefonu.',
        keywords: 'kontakt, telefon',
        activePage: 'kontakt',
        isHome: false
    });
});

router.get('/prywatnosc', (req, res) => {
    res.render('prywatnosc', {
        title: 'Bodzio - Polityka prywatności',
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
            title: 'Bodzio - Rozkład Jazdy',
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

router.get('/admin', (req, res) => {
    if (req.session.isAdmin) {
        res.render('admin/index', { activePage: 'dashboard' });
    } else {
        res.render('admin/login');
    }
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

