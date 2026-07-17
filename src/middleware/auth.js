function requireAuth(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Brak uprawnień. Zaloguj się.' });
    }
}

module.exports = requireAuth;
