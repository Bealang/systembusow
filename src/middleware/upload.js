const multer = require('multer');

const imageUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tylko pliki PNG, JPEG, JPG, WEBP oraz AVIF są dozwolone!'), false);
        }
    }
});

const pdfUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error('Tylko pliki PDF są dozwolone!'), false);
        }
    }
});

module.exports = { imageUpload, pdfUpload };
