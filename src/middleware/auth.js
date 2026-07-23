function requireAuth(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Brak uprawnień. Zaloguj się.' });
    }
}

function requireAdminView(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/panel-zarzadzania');
    }
}

module.exports = requireAuth;
module.exports.requireAdminView = requireAdminView;


