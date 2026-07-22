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
        title: 'TwojaNazwa - Busy miejscowosc1 miejscowosc2',
        description: 'Szukasz busa do miejscowosc2? Oferujemy regularne przewozy pasażerskie. Sprawdź aktualny rozkład jazdy online!',
        keywords: 'rozklad jazdy, bus cennik, busy, przewoz osob, bilety miesieczne, bus miejscowosc2, busy miejscowosc1',
        activePage: 'home',
        isHome: true,
        alert: alert,
        showScheduleImage: scheduleService.getShowScheduleImage()
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
    req.session.secretExpires = Date.now() + 60000; // 60 sekund na otwarcie strony logowania
    req.session.save((err) => {
        if (err) {
            console.error("Błąd zapisu sesji w footer-trigger:", err);
        }
        res.json({ redirectUrl: `/admin?auth=${token}` });
    });
});

router.get('/admin', (req, res) => {
    if (req.session.isAdmin) {
        const userService = require('../services/userService');
        const user = userService.getUserById(req.session.userId) || userService.getAdminUser();
        return res.render('admin/index', { activePage: 'dashboard', user });
    }

    const urlToken = req.query.auth;
    const sessionToken = req.session.accessSecret;
    const isExpired = req.session.secretExpires ? (Date.now() > req.session.secretExpires) : true;

    if (urlToken && urlToken === sessionToken && !isExpired) {
        req.session.accessSecret = null;
        req.session.secretExpires = null;
        req.session.canAccessLogin = true;
        return req.session.save((err) => {
            if (err) console.error("Błąd zapisu sesji logowania:", err);
            res.render('admin/login');
        });
    }

    if (req.session.canAccessLogin) {
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

router.get('/admin/konto', requireAdminView, (req, res) => {
    res.render('admin/konto', { activePage: 'konto' });
});

router.get('/admin/reset-password', (req, res) => {
    const token = req.query.token || '';
    res.render('admin/reset-password', { token });
});

router.get('/admin/confirm-email', (req, res) => {
    const token = req.query.token || '';
    const userService = require('../services/userService');
    const verification = userService.verifyAndConsumeToken(token, 'email_change');

    let status = 'error';
    let message = 'Nieprawidłowy lub wygasły token weryfikacji e-mail.';

    if (verification.valid) {
        userService.updateEmail(verification.userId, verification.payload.newEmail);
        status = 'success';
        message = `Adres e-mail został pomyślnie zmieniony na: ${verification.payload.newEmail}.`;
    }

    res.render('admin/confirmation-result', {
        title: 'Weryfikacja adresu E-mail',
        status,
        message
    });
});

router.get('/admin/confirm-username', (req, res) => {
    const token = req.query.token || '';
    const userService = require('../services/userService');
    const verification = userService.verifyAndConsumeToken(token, 'username_change');

    let status = 'error';
    let message = 'Nieprawidłowy lub wygasły token weryfikacji nazwy użytkownika.';

    if (verification.valid) {
        userService.updateUsername(verification.userId, verification.payload.newUsername);
        status = 'success';
        message = `Nazwa użytkownika została pomyślnie zmieniona na: ${verification.payload.newUsername}.`;
    }

    res.render('admin/confirmation-result', {
        title: 'Weryfikacja nazwy użytkownika',
        status,
        message
    });
});

// Redirect /index to root / for clean URLs
router.get('/index', (req, res) => {
    res.redirect(301, '/');
});

module.exports = router;

