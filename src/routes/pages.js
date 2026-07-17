const router = require('express').Router();
const scheduleService = require('../services/scheduleService');

router.get('/', (req, res) => {
    res.render('index', {
        title: 'Bodzio - Busy Sułkowice Kraków',
        description: 'Szukasz busa do Krakowa? Oferujemy regularne przewozy pasażerskie. Sprawdź aktualny rozkład jazdy online!',
        keywords: 'rozklad jazdy, bus cennik, busy, przewoz osob, bilety miesieczne, bus kraków, busy sułkowice',
        activePage: 'home',
        isHome: true
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
    res.render('admin');
});

// Redirect /index to root / for clean URLs
router.get('/index', (req, res) => {
    res.redirect(301, '/');
});

module.exports = router;
