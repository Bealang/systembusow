const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config/index');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' }
});

router.post('/api/login', loginLimiter, (req, res) => {
    if (!req.session.canAccessLogin) {
        return res.status(403).json({ success: false, message: 'Brak autoryzacji do logowania.' });
    }

    const { username, password } = req.body;

    if (username === config.admin.user && bcrypt.compareSync(password, config.admin.hash)) {
        req.session.isAdmin = true;
        delete req.session.canAccessLogin;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Nieprawidłowy login lub hasło.' });
    }
});

router.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.isAdmin });
});

module.exports = router;
