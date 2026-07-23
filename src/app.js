const express = require('express');
const compression = require('compression');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const path = require('path');
const config = require('./config/index');
const routes = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & compression
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for secure cookies behind Nginx/Cloudflare
app.set('trust proxy', 1);

// Session
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: config.paths.data }),
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', config.paths.views);

// Static files with caching
const staticOptions = {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
};

// Redirect old .html URLs to clean URLs
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.slice(0, -5);
        return res.redirect(301, cleanPath);
    }
    next();
});

// Prevent caching on all API endpoints
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.static(config.paths.public, staticOptions));
app.use('/uploads', express.static(config.paths.uploads, staticOptions));

// Mount all routes
app.use(routes);

// Centralized error handler (must be last)
app.use(errorHandler);

module.exports = app;
