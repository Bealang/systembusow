const multer = require('multer');

function errorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Błąd przesyłania pliku: ${err.message}` });
    }
    if (err) {
        return res.status(400).json({ error: err.message || 'Wystąpił nieznany błąd.' });
    }
    next();
}

module.exports = errorHandler;
