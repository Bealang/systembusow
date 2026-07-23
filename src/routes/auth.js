const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config/index');
const userService = require('../services/userService');
const mailService = require('../services/mailService');
const requireAuth = require('../middleware/auth');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' }
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Zbyt wiele prób wysłania prośby o reset. Spróbuj ponownie za 15 minut.' }
});

// GET Current account info (for admin panel)
router.get('/api/account', requireAuth, (req, res) => {
    const user = userService.getUserById(req.session.userId) || userService.getAdminUser();
    if (!user) {
        return res.status(404).json({ success: false, message: 'Użytkownik nie istnieje.' });
    }
    res.json({
        success: true,
        user: {
            username: user.username,
            email: user.email,
            maskedEmail: mailService.maskEmail(user.email),
        }
    });
});

// POST Login
router.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Wypełnij wszystkie pola.' });
    }

    // Ensure default superuser exists if database has 0 users
    userService.ensureDefaultSuperuser();

    // Try finding user by username or email
    const user = userService.getUserByUsernameOrEmail(username);

    if (user && userService.verifyPassword(user, password)) {
        req.session.isAdmin = true;
        req.session.userId = user.id;
        return req.session.save((err) => {
            if (err) {
                console.error("Błąd zapisu sesji po logowaniu:", err);
                return res.status(500).json({ success: false, message: 'Błąd zapisu sesji.' });
            }
            res.json({ success: true });
        });
    }

    return res.status(401).json({ success: false, message: 'Nieprawidłowy login lub hasło.' });
});

// GET Logout
router.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// GET Check auth
router.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.isAdmin });
});

// POST Forgot password request (From login screen)
router.post('/api/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Podaj prawidłowy adres e-mail.' });
    }

    const user = userService.getUserByUsernameOrEmail(email.trim());

    // Security best practice: Always return generic message to prevent account enumeration
    const genericResponse = {
        success: true,
        message: 'Jeśli podany adres e-mail istnieje w systemie, wysłano wiadomość z instrukcją resetowania hasła.'
    };

    if (user) {
        const rawToken = userService.createToken(user.id, 'password_reset', {}, 15);
        const resetLink = `${config.appUrl}/panel-zarzadzania/reset-password?token=${rawToken}`;
        await mailService.sendPasswordResetEmail(user.email, resetLink);
    }

    res.json(genericResponse);
});

// POST Reset password with token
router.post('/api/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, message: 'Brak tokenu resetującego.' });
    }
    if (!password || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Hasło musi mieć co najmniej 8 znaków.' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Hasła nie są identyczne.' });
    }

    const verification = userService.verifyAndConsumeToken(token, 'password_reset');
    if (!verification.valid) {
        return res.status(400).json({ success: false, message: verification.reason || 'Nieprawidłowy lub wygasły token.' });
    }

    const user = userService.getUserById(verification.userId);
    userService.changePassword(verification.userId, password);

    if (user) {
        await mailService.sendPasswordChangedNotification(user.email);
    }

    res.json({ success: true, message: 'Hasło zostało pomyślnie zmienione. Możesz się teraz zalogować.' });
});

// POST Change password in admin panel
router.post('/api/account/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = userService.getUserById(req.session.userId) || userService.getAdminUser();

    if (!user) {
        return res.status(404).json({ success: false, message: 'Nie znaleziono użytkownika.' });
    }

    if (!userService.verifyPassword(user, currentPassword)) {
        return res.status(400).json({ success: false, message: 'Aktualne hasło jest nieprawidłowe.' });
    }

    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Nowe hasło musi mieć co najmniej 8 znaków.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Nowe hasła nie są takie same.' });
    }

    userService.changePassword(user.id, newPassword);
    await mailService.sendPasswordChangedNotification(user.email);

    res.json({ success: true, message: 'Hasło zostało pomyślnie zmienione.' });
});

// POST Request Email change (Panel)
router.post('/api/account/request-email-change', requireAuth, async (req, res) => {
    const { currentPassword, newEmail } = req.body;
    const user = userService.getUserById(req.session.userId) || userService.getAdminUser();

    if (!user) {
        return res.status(404).json({ success: false, message: 'Nie znaleziono użytkownika.' });
    }

    if (!userService.verifyPassword(user, currentPassword)) {
        return res.status(400).json({ success: false, message: 'Aktualne hasło jest nieprawidłowe.' });
    }

    const cleanNewEmail = (newEmail || '').trim().toLowerCase();
    if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
        return res.status(400).json({ success: false, message: 'Podaj prawidłowy adres e-mail.' });
    }

    if (cleanNewEmail === user.email.toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Nowy adres e-mail jest taki sam jak obecny.' });
    }

    // Generate token
    const rawToken = userService.createToken(user.id, 'email_change', { newEmail: cleanNewEmail }, 30);
    const confirmLink = `${config.appUrl}/panel-zarzadzania/confirm-email?token=${rawToken}`;

    // Send verification to new email
    await mailService.sendEmailChangeVerification(cleanNewEmail, confirmLink);
    // Send security notification to old email
    await mailService.sendEmailChangeNotificationToOldAddress(user.email, cleanNewEmail);

    res.json({
        success: true,
        message: `Wysłano link weryfikacyjny na nowy adres (${cleanNewEmail}). Potwierdź zmianę w e-mailu.`
    });
});

// POST Request Username change (Panel)
router.post('/api/account/request-username-change', requireAuth, async (req, res) => {
    const { currentPassword, newUsername } = req.body;
    const user = userService.getUserById(req.session.userId) || userService.getAdminUser();

    if (!user) {
        return res.status(404).json({ success: false, message: 'Nie znaleziono użytkownika.' });
    }

    if (!userService.verifyPassword(user, currentPassword)) {
        return res.status(400).json({ success: false, message: 'Aktualne hasło jest nieprawidłowe.' });
    }

    const cleanUsername = (newUsername || '').trim();
    if (!cleanUsername || cleanUsername.length < 3) {
        return res.status(400).json({ success: false, message: 'Nazwa użytkownika musi mieć co najmniej 3 znaki.' });
    }

    const rawToken = userService.createToken(user.id, 'username_change', { newUsername: cleanUsername }, 30);
    const confirmLink = `${config.appUrl}/panel-zarzadzania/confirm-username?token=${rawToken}`;

    await mailService.sendUsernameChangeVerification(user.email, cleanUsername, confirmLink);

    res.json({
        success: true,
        message: `Wysłano e-mail weryfikacyjny naTwój adres (${user.email}). Kliknij link, aby zatwierdzić nową nazwę użytkownika.`
    });
});

module.exports = router;
