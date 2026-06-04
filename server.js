const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Database = require('better-sqlite3');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const ADMIN_USER = 'bealang';
const ADMIN_HASH = (process.env.ADMIN_HASH_B64
    ? Buffer.from(process.env.ADMIN_HASH_B64, 'base64').toString()
    : process.env.ADMIN_HASH || '').trim();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for simplicity if it breaks Quill/External assets, or configure properly
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1); // Trust proxy if behind Nginx/Cloudflare for secure cookies
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: dataDir }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // process.env.NODE_ENV === 'production', // Temporarily disabled for local HTTP testing
        httpOnly: true, // Prevents JS from accessing the cookie
        sameSite: 'lax', // Protects against CSRF
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Configure EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files (frontend) with caching
const staticOptions = {
    maxAge: '1y',
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
};

// Middleware to redirect old .html URLs to clean URLs
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.slice(0, -5);
        return res.redirect(301, cleanPath);
    }
    next();
});

// Middleware to prevent caching on all API endpoints at the HTTP level
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.static('public', staticOptions));
app.use('/uploads', express.static('uploads', staticOptions));

// Redirect /index to root / for clean URLs
app.get('/index', (req, res) => {
    res.redirect(301, '/');
});

// --- Page Render Routes ---
app.get('/', (req, res) => {
    res.render('index', {
        title: 'TestBUS | Przewozy osób',
        description: 'Szukasz busa? Oferujemy regularne przewozy pasażerskie. Sprawdź aktualny rozkład jazdy online!',
        keywords: 'rozklad jazdy, bus cennik, busy, przewoz osob, bilety miesieczne',
        activePage: 'home',
        isHome: true
    });
});

app.get('/cennik', (req, res) => {
    res.render('cennik', {
        title: 'TestBUS - Cennik',
        description: 'Sprawdź ceny biletów jednorazowych oraz miesięcznych dla wszystkich połączeń.',
        keywords: 'cennik busy, ceny biletów, bilet miesięczny',
        activePage: 'cennik',
        isHome: false
    });
});

app.get('/kontakt', (req, res) => {
    res.render('kontakt', {
        title: 'TestBUS - Kontakt',
        description: 'Skontaktuj się z nami. Dane kontaktowe, adres i numer telefonu.',
        keywords: 'kontakt, telefon',
        activePage: 'kontakt',
        isHome: false
    });
});

app.get('/prywatnosc', (req, res) => {
    res.render('prywatnosc', {
        title: 'TestBUS - Polityka Prywatności',
        description: 'Polityka prywatności serwisu. Dowiedz się, jak dbamy o Twoje dane.',
        keywords: '',
        activePage: 'prywatnosc',
        isHome: false
    });
});

app.get('/rozklad', (req, res) => {
    try {
        const scheduleRow = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
        const schedule = scheduleRow ? JSON.parse(scheduleRow.value) : {};

        const attrRow = db.prepare("SELECT value FROM config WHERE key = 'course_attributes'").get();
        const attributes = attrRow ? JSON.parse(attrRow.value) : [];

        res.render('rozklad', {
            title: 'TestBUS - Rozkład Jazdy',
            description: 'Sprawdź aktualny rozkład jazdy busów. Godziny odjazdów i szczegóły połączeń.',
            keywords: 'rozklad jazdy, odjazdy, busy, przewozy',
            activePage: 'rozklad',
            isHome: false,
            schedule: schedule,
            attributes: attributes
        });
    } catch (error) {
        console.error("Błąd ładowania rozkładu:", error);
        res.status(500).send("Wystąpił błąd podczas ładowania rozkładu jazdy.");
    }
});

app.get('/admin', (req, res) => {
    res.render('admin');
});

const upload = multer({
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

const uploadPdf = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error('Tylko pliki PDF są dozwolone!'), false);
        }
    }
});

// Database initialization
const db = new Database(path.join(dataDir, 'database.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        title TEXT,
        content TEXT
    );
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    CREATE TABLE IF NOT EXISTS stops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pricing (
        stop1_id INTEGER,
        stop2_id INTEGER,
        price_s REAL,
        price_m REAL,
        price_md REAL,
        PRIMARY KEY(stop1_id, stop2_id),
        FOREIGN KEY(stop1_id) REFERENCES stops(id) ON DELETE CASCADE,
        FOREIGN KEY(stop2_id) REFERENCES stops(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT,
        answer TEXT,
        sort_order INTEGER DEFAULT 0
    );
`);

// Migration: ensure sort_order column exists in stops
try {
    db.prepare("SELECT sort_order FROM stops LIMIT 1").get();
} catch (e) {
    if (e.message.includes("no such column: sort_order")) {
        db.prepare("ALTER TABLE stops ADD COLUMN sort_order INTEGER DEFAULT 0").run();
        console.log("Dodano brakującą kolumnę 'sort_order' do tabeli 'stops'.");
    }
}



// Rate limiting for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login attempts per window
    message: { success: false, message: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' }
});

// --- AUTH API ---
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER && bcrypt.compareSync(password, ADMIN_HASH)) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Nieprawidłowy login lub hasło.' });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.isAdmin });
});

// Middleware to protect admin routes
const requireAuth = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Brak uprawnień. Zaloguj się.' });
    }
};

// --- PUBLIC API ---
app.get('/api/schedule', (req, res) => {
    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
        res.json(row ? JSON.parse(row.value) : {});
    } catch (error) {
        console.error("Błąd bazy danych (schedule):", error);
        res.status(500).json({ error: 'Wystąpił problem wewnętrzny serwera.' });
    }
});

app.get('/api/news', (req, res) => {
    try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);

        if (!isNaN(page) && !isNaN(limit)) {
            const offset = (page - 1) * limit;
            const rows = db.prepare('SELECT * FROM news ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
            const totalRow = db.prepare('SELECT COUNT(*) as count FROM news').get();
            res.json({ news: rows, total: totalRow.count });
        } else {
            const rows = db.prepare('SELECT * FROM news ORDER BY id DESC').all();
            res.json(rows);
        }
    } catch (error) {
        console.error("Błąd bazy danych (news):", error);
        res.status(500).json({ error: 'Wystąpił problem wewnętrzny serwera przy pobieraniu aktualności.' });
    }
});

app.get('/api/pricing-data', (req, res) => {
    try {
        const stops = db.prepare('SELECT * FROM stops ORDER BY sort_order ASC, id DESC').all();
        const prices = db.prepare('SELECT * FROM pricing').all();
        res.json({ stops, prices });
    } catch (error) {
        console.error("Błąd bazy danych (pricing-data):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania danych cennika.' });
    }
});

app.get('/api/stops', (req, res) => {
    try {
        const stops = db.prepare('SELECT * FROM stops ORDER BY sort_order ASC, id DESC').all();
        res.json({ stops });
    } catch (error) {
        console.error("Błąd bazy danych (stops):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania przystanków.' });
    }
});

app.get('/api/price', (req, res) => {
    try {
        const { stop1, stop2 } = req.query;
        if (!stop1 || !stop2) return res.status(400).json({ error: 'Brak przystanków' });

        const id1 = Math.min(parseInt(stop1), parseInt(stop2));
        const id2 = Math.max(parseInt(stop1), parseInt(stop2));

        const price = db.prepare('SELECT * FROM pricing WHERE stop1_id = ? AND stop2_id = ?').get(id1, id2);
        res.json(price || null);
    } catch (error) {
        console.error("Błąd bazy danych (price):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania ceny.' });
    }
});

app.get('/api/faq', (req, res) => {
    try {
        const faqs = db.prepare('SELECT * FROM faq ORDER BY sort_order ASC').all();
        res.json(faqs);
    } catch (error) {
        console.error("Błąd bazy danych (faq):", error);
        res.status(500).json({ error: 'Błąd podczas pobierania pytań FAQ.' });
    }
});

app.get('/api/attributes', (req, res) => {
    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'course_attributes'").get();
        if (row) {
            res.json(JSON.parse(row.value));
        } else {
            const defaults = [{ symbol: 'S', description: 'kurs szkolny' }];
            res.json(defaults);
        }
    } catch (error) {
        console.error("Błąd pobierania atrybutów:", error);
        res.status(500).json({ error: 'Błąd serwera.' });
    }
});

app.post('/api/admin/attributes', requireAuth, (req, res) => {
    const { symbol, description } = req.body;
    if (!symbol || !description) {
        return res.status(400).json({ error: 'Symbol i opis są wymagane.' });
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    const cleanDesc = description.trim();

    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'course_attributes'").get();
        let attributes = row ? JSON.parse(row.value) : [{ symbol: 'S', description: 'kurs szkolny' }];

        if (attributes.some(attr => attr.symbol === cleanSymbol)) {
            return res.status(400).json({ error: 'Atrybut o tym symbolu już istnieje.' });
        }

        attributes.push({ symbol: cleanSymbol, description: cleanDesc });
        db.prepare("INSERT INTO config (key, value) VALUES ('course_attributes', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(attributes));
        res.json({ success: true, message: 'Dodano atrybut.', attributes });
    } catch (error) {
        console.error("Błąd zapisu atrybutu:", error);
        res.status(500).json({ error: 'Błąd zapisu.' });
    }
});

app.delete('/api/admin/attributes/:symbol', requireAuth, (req, res) => {
    const symbolToDelete = req.params.symbol.trim().toUpperCase();

    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'course_attributes'").get();
        let attributes = row ? JSON.parse(row.value) : [{ symbol: 'S', description: 'kurs szkolny' }];

        attributes = attributes.filter(attr => attr.symbol !== symbolToDelete);
        db.prepare("INSERT INTO config (key, value) VALUES ('course_attributes', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(attributes));
        
        // Also remove the deleted attribute from all courses in the schedule
        const rowSchedule = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
        if (rowSchedule) {
            const schedule = JSON.parse(rowSchedule.value);
            let scheduleModified = false;
            
            const removeSymbol = (courses) => {
                if (Array.isArray(courses)) {
                    courses.forEach(course => {
                        if (Array.isArray(course.notes)) {
                            const noteIndex = course.notes.indexOf(symbolToDelete);
                            if (noteIndex !== -1) {
                                course.notes.splice(noteIndex, 1);
                                scheduleModified = true;
                            }
                        }
                    });
                }
            };
            
            for (const direction in schedule) {
                const dirObj = schedule[direction];
                for (const dayType in dirObj) {
                    removeSymbol(dirObj[dayType]);
                }
            }
            
            if (scheduleModified) {
                db.prepare("INSERT INTO config (key, value) VALUES ('schedule', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(schedule));
            }
        }

        res.json({ success: true, message: 'Usunięto atrybut i wyczyszczono powiązane kursy.', attributes });
    } catch (error) {
        console.error("Błąd usuwania atrybutu:", error);
        res.status(500).json({ error: 'Błąd usuwania.' });
    }
});

app.put('/api/admin/attributes/:symbol', requireAuth, (req, res) => {
    const oldSymbol = req.params.symbol.trim().toUpperCase();
    const { symbol: newSymbol, description: newDescription } = req.body;
    
    if (!newSymbol || !newDescription) {
        return res.status(400).json({ error: 'Symbol i opis są wymagane.' });
    }
    
    const cleanNewSymbol = newSymbol.trim().toUpperCase();
    const cleanNewDesc = newDescription.trim();
    
    try {
        const rowAttr = db.prepare("SELECT value FROM config WHERE key = 'course_attributes'").get();
        let attributes = rowAttr ? JSON.parse(rowAttr.value) : [{ symbol: 'S', description: 'kurs szkolny' }];
        
        const attrIndex = attributes.findIndex(attr => attr.symbol === oldSymbol);
        if (attrIndex === -1) {
            return res.status(404).json({ error: 'Nie znaleziono atrybutu.' });
        }
        
        if (cleanNewSymbol !== oldSymbol && attributes.some(attr => attr.symbol === cleanNewSymbol)) {
            return res.status(400).json({ error: 'Atrybut o nowym symbolu już istnieje.' });
        }
        
        // Update attribute details
        attributes[attrIndex] = { symbol: cleanNewSymbol, description: cleanNewDesc };
        db.prepare("INSERT INTO config (key, value) VALUES ('course_attributes', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(attributes));
        
        // If the symbol changed, migrate all courses in the schedule
        if (cleanNewSymbol !== oldSymbol) {
            const rowSchedule = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
            if (rowSchedule) {
                const schedule = JSON.parse(rowSchedule.value);
                let scheduleModified = false;
                
                const renameSymbol = (courses) => {
                    if (Array.isArray(courses)) {
                        courses.forEach(course => {
                            if (Array.isArray(course.notes)) {
                                const noteIndex = course.notes.indexOf(oldSymbol);
                                if (noteIndex !== -1) {
                                    course.notes[noteIndex] = cleanNewSymbol;
                                    scheduleModified = true;
                                }
                            }
                        });
                    }
                };
                
                for (const direction in schedule) {
                    const dirObj = schedule[direction];
                    for (const dayType in dirObj) {
                        renameSymbol(dirObj[dayType]);
                    }
                }
                
                if (scheduleModified) {
                    db.prepare("INSERT INTO config (key, value) VALUES ('schedule', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(schedule));
                }
            }
        }
        
        res.json({ success: true, message: 'Atrybut został zaktualizowany.', attributes });
    } catch (error) {
        console.error("Błąd aktualizacji atrybutu:", error);
        res.status(500).json({ error: 'Błąd zapisu.' });
    }
});

// --- ADMIN API ---

// Update schedule JSON
app.post('/api/admin/schedule', requireAuth, (req, res) => {
    const newSchedule = req.body;

    // Deep validation of schedule format
    const isValidCourses = (courses) => Array.isArray(courses) && courses.every(c => c && typeof c.time === 'string' && Array.isArray(c.notes));
    const isValidVariant = (variant) => variant && isValidCourses(variant.workdays) && isValidCourses(variant.saturday) && isValidCourses(variant.sunday);

    if (!newSchedule || !isValidVariant(newSchedule.myslenice) || !isValidVariant(newSchedule.sulkowice)) {
        return res.status(400).json({ error: 'Nieprawidłowy format danych rozkładu.' });
    }
    try {
        db.prepare("INSERT INTO config (key, value) VALUES ('schedule', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(newSchedule));
        res.json({ success: true, message: 'Rozkład został zaktualizowany.' });
    } catch (error) {
        console.error("Błąd bazy danych przy zapisie rozkładu:", error);
        res.status(500).json({ error: 'Błąd podczas zapisu do bazy danych.' });
    }
});

// Route to dynamically serve the current schedule image, regardless of extension
app.get('/rozklad-current', (req, res) => {
    const publicDir = path.join(__dirname, 'public');
    try {
        const files = fs.readdirSync(publicDir);
        const rozkladFile = files.find(file => file.startsWith('rozklad.'));
        if (rozkladFile) {
            return res.sendFile(path.join(publicDir, rozkladFile));
        }
    } catch (e) {
        console.error("Błąd pobierania rozkładu:", e);
    }
    res.status(404).send('Nie znaleziono pliku rozkładu.');
});

// Upload schedule image
app.post('/api/admin/upload-image', requireAuth, upload.single('rozklad_image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nie wybrano pliku.' });
    }

    try {
        const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
        const publicDir = path.join(__dirname, 'public');

        // Delete any existing rozklad.* files to prevent duplicates
        const existingFiles = fs.readdirSync(publicDir);
        existingFiles.forEach(file => {
            if (file.startsWith('rozklad.')) {
                try {
                    fs.unlinkSync(path.join(publicDir, file));
                } catch (err) {
                    console.error("Błąd usuwania starego pliku rozkładu:", err);
                }
            }
        });

        // Save the new file
        const newFileName = `rozklad${ext}`;
        fs.writeFileSync(path.join(publicDir, newFileName), req.file.buffer);

        res.json({ success: true, message: `Plik rozkładu (${newFileName}) został pomyślnie zaktualizowany.` });
    } catch (error) {
        console.error("Błąd podczas wgrywania rozkładu:", error);
        res.status(500).json({ error: 'Wystąpił krytyczny błąd zapisu pliku na serwerze.' });
    }
});

// Upload rules PDF
app.post('/api/admin/upload-regulamin', requireAuth, uploadPdf.single('regulamin_file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nie wybrano pliku regulaminu.' });
    }

    try {
        const publicDir = path.join(__dirname, 'public');
        const filePath = path.join(publicDir, 'regulamin.pdf');

        // Write the PDF file, replacing any existing one
        fs.writeFileSync(filePath, req.file.buffer);

        res.json({ success: true, message: 'Plik regulaminu (.pdf) został pomyślnie wgrany i zastąpił poprzedni.' });
    } catch (error) {
        console.error("Błąd podczas wgrywania regulaminu:", error);
        res.status(500).json({ error: 'Wystąpił krytyczny błąd zapisu pliku regulaminu na serwerze (plik może być zablokowany).' });
    }
});

// Upload news image
app.post('/api/admin/upload-news-image', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nie wybrano pliku.' });
    }

    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const ext = path.extname(req.file.originalname).toLowerCase() || '.webp';
        const fileName = `news-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const filePath = path.join(uploadsDir, fileName);

        // Save the file
        fs.writeFileSync(filePath, req.file.buffer);

        res.json({ success: true, url: `/uploads/${fileName}` });
    } catch (error) {
        console.error("Błąd podczas wgrywania obrazka:", error);
        res.status(500).json({ error: 'Wystąpił błąd zapisu pliku na serwerze.' });
    }
});

// Manage news
app.post('/api/admin/news', requireAuth, (req, res) => {
    const { title, content } = req.body;
    const date = new Date().toISOString();

    try {
        db.prepare('INSERT INTO news (date, title, content) VALUES (?, ?, ?)').run(date, title, content);
        const news = db.prepare('SELECT * FROM news ORDER BY id DESC').all();
        res.json({ success: true, message: 'Aktualność dodana.', news });
    } catch (error) {
        console.error("Błąd bazy danych przy dodawaniu newsa:", error);
        res.status(500).json({ error: 'Błąd podczas zapisu nowej aktualności.' });
    }
});

app.delete('/api/admin/news/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    try {
        db.prepare('DELETE FROM news WHERE id = ?').run(id);
        const news = db.prepare('SELECT * FROM news ORDER BY id DESC').all();
        res.json({ success: true, message: 'Aktualność usunięta.', news });
    } catch (error) {
        console.error("Błąd bazy danych przy usuwaniu newsa:", error);
        res.status(500).json({ error: 'Błąd podczas usuwania aktualności z bazy.' });
    }
});

app.put('/api/admin/news/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { title, content } = req.body;

    try {
        const result = db.prepare('UPDATE news SET title = ?, content = ? WHERE id = ?').run(title, content, id);
        if (result.changes > 0) {
            const news = db.prepare('SELECT * FROM news ORDER BY id DESC').all();
            res.json({ success: true, message: 'Pomyślnie zaktualizowano aktualność.', news });
        } else {
            res.status(404).json({ error: 'Nie znaleziono aktualności.' });
        }
    } catch (error) {
        console.error("Błąd bazy danych przy edycji newsa:", error);
        res.status(500).json({ error: 'Błąd podczas edycji aktualności w bazie.' });
    }
});

// --- PRICING ADMIN API ---

app.post('/api/admin/stops', requireAuth, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa przystanku jest wymagana.' });

    try {
        // Nowe przystanki mają domyślnie sort_order = 0, będą na początku przy ORDER BY sort_order ASC, id DESC
        db.prepare('INSERT INTO stops (name) VALUES (?)').run(name);
        const stops = db.prepare('SELECT * FROM stops ORDER BY sort_order ASC, id DESC').all();
        res.json({ success: true, message: 'Przystanek dodany.', stops });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Przystanek o tej nazwie już istnieje.' });
        }
        res.status(500).json({ error: 'Błąd podczas dodawania przystanku.' });
    }
});

app.put('/api/admin/stops/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa przystanku jest wymagana.' });

    try {
        const result = db.prepare('UPDATE stops SET name = ? WHERE id = ?').run(name, id);
        if (result.changes > 0) {
            const stops = db.prepare('SELECT * FROM stops ORDER BY sort_order ASC, id DESC').all();
            res.json({ success: true, message: 'Nazwa przystanku została zaktualizowana.', stops });
        } else {
            res.status(404).json({ error: 'Nie znaleziono przystanku.' });
        }
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Przystanek o tej nazwie już istnieje.' });
        }
        console.error("Błąd edycji przystanku:", error);
        res.status(500).json({ error: 'Błąd podczas edycji przystanku.' });
    }
});

app.post('/api/admin/stops/reorder', requireAuth, (req, res) => {
    const { orders } = req.body; // Array of {id, sort_order}
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'Nieprawidłowe dane.' });

    const updateStmt = db.prepare('UPDATE stops SET sort_order = ? WHERE id = ?');

    try {
        const transaction = db.transaction((data) => {
            for (const item of data) {
                updateStmt.run(item.sort_order, item.id);
            }
        });
        transaction(orders);
        res.json({ success: true, message: 'Kolejność została zapisana.' });
    } catch (error) {
        console.error("Błąd reorderowania:", error);
        res.status(500).json({ error: 'Błąd podczas zapisywania kolejności.' });
    }
});

app.delete('/api/admin/stops/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    try {
        db.prepare('DELETE FROM stops WHERE id = ?').run(id);
        const stops = db.prepare('SELECT * FROM stops ORDER BY sort_order ASC, id DESC').all();
        res.json({ success: true, message: 'Przystanek i powiązane ceny zostały usunięte.', stops });
    } catch (error) {
        res.status(500).json({ error: 'Błąd podczas usuwania przystanku.' });
    }
});

app.post('/api/admin/pricing', requireAuth, (req, res) => {
    const { stop1_id, stop2_id, price_s, price_m, price_md } = req.body;

    // Zawsze zapisuj stop1_id jako mniejszą wartość, aby zapewnić dwukierunkowość relacji
    const id1 = Math.min(stop1_id, stop2_id);
    const id2 = Math.max(stop1_id, stop2_id);

    if (id1 === id2) return res.status(400).json({ error: 'Przystanek początkowy i końcowy muszą być różne.' });

    try {
        db.prepare(`
            INSERT INTO pricing (stop1_id, stop2_id, price_s, price_m, price_md) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(stop1_id, stop2_id) DO UPDATE SET 
                price_s=excluded.price_s, 
                price_m=excluded.price_m, 
                price_md=excluded.price_md
        `).run(id1, id2, price_s, price_m, price_md);

        const prices = db.prepare('SELECT * FROM pricing').all();
        res.json({ success: true, message: 'Cennik zaktualizowany.', prices });
    } catch (error) {
        console.error("Błąd bazy danych (admin-pricing):", error);
        res.status(500).json({ error: 'Błąd podczas zapisywania cennika.' });
    }
});

app.post('/api/admin/pricing/bulk', requireAuth, (req, res) => {
    const { type, amount } = req.body;

    if (!['s', 'm', 'md'].includes(type)) {
        return res.status(400).json({ error: 'Nieprawidłowy typ biletu.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
        return res.status(400).json({ error: 'Nieprawidłowa kwota.' });
    }

    try {
        let column;
        if (type === 's') column = 'price_s';
        if (type === 'm') column = 'price_m';
        if (type === 'md') column = 'price_md';

        if (type === 'm') {
            db.prepare(`
                UPDATE pricing 
                SET price_m = MAX(0, price_m + ?),
                    price_md = ROUND(MAX(0, price_m + ?) * 0.51, 2)
                WHERE price_m IS NOT NULL AND price_m > 0
            `).run(parsedAmount, parsedAmount);
        } else {
            db.prepare(`UPDATE pricing SET ${column} = MAX(0, ${column} + ?) WHERE ${column} IS NOT NULL AND ${column} > 0`).run(parsedAmount);
        }

        const prices = db.prepare('SELECT * FROM pricing').all();
        res.json({ success: true, message: `Pomyślnie zaktualizowano ceny (${parsedAmount > 0 ? '+' : ''}${parsedAmount.toFixed(2)} zł).`, prices });
    } catch (error) {
        console.error("Błąd bazy danych (admin-pricing-bulk):", error);
        res.status(500).json({ error: 'Błąd podczas masowej zmiany cen.' });
    }
});

app.post('/api/admin/pricing/recalculate-monthly', requireAuth, (req, res) => {
    try {
        db.prepare(`
            UPDATE pricing 
            SET price_m = ROUND(price_s * 40, 2),
                price_md = ROUND(price_s * 40 * 0.51, 2)
            WHERE price_s IS NOT NULL AND price_s > 0
        `).run();

        const prices = db.prepare('SELECT * FROM pricing').all();
        res.json({ success: true, message: 'Pomyślnie przeliczono ceny biletów miesięcznych dla wszystkich relacji.', prices });
    } catch (error) {
        console.error("Błąd bazy danych (recalculate-monthly):", error);
        res.status(500).json({ error: 'Błąd podczas przeliczania biletów miesięcznych.' });
    }
});

// --- FAQ ADMIN API ---

app.post('/api/admin/faq', requireAuth, (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Pytanie i odpowiedź są wymagane.' });

    try {
        const maxSort = db.prepare('SELECT MAX(sort_order) as maxSort FROM faq').get().maxSort || 0;
        db.prepare('INSERT INTO faq (question, answer, sort_order) VALUES (?, ?, ?)').run(question, answer, maxSort + 1);
        const faqs = db.prepare('SELECT * FROM faq ORDER BY sort_order ASC').all();
        res.json({ success: true, message: 'Pytanie FAQ dodane.', faqs });
    } catch (error) {
        console.error("Błąd bazy danych (admin-faq):", error);
        res.status(500).json({ error: 'Błąd podczas dodawania pytania FAQ.' });
    }
});

app.put('/api/admin/faq/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Pytanie i odpowiedź są wymagane.' });

    try {
        const result = db.prepare('UPDATE faq SET question = ?, answer = ? WHERE id = ?').run(question, answer, id);
        if (result.changes > 0) {
            const faqs = db.prepare('SELECT * FROM faq ORDER BY sort_order ASC').all();
            res.json({ success: true, message: 'Pytanie FAQ zaktualizowane.', faqs });
        } else {
            res.status(404).json({ error: 'Nie znaleziono pytania FAQ.' });
        }
    } catch (error) {
        console.error("Błąd bazy danych (admin-faq-edit):", error);
        res.status(500).json({ error: 'Błąd podczas edycji pytania FAQ.' });
    }
});

app.post('/api/admin/faq/reorder', requireAuth, (req, res) => {
    const { orders } = req.body; // Array of {id, sort_order}
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'Nieprawidłowe dane.' });

    const updateStmt = db.prepare('UPDATE faq SET sort_order = ? WHERE id = ?');
    try {
        const transaction = db.transaction((data) => {
            for (const item of data) {
                updateStmt.run(item.sort_order, item.id);
            }
        });
        transaction(orders);
        res.json({ success: true, message: 'Kolejność FAQ została zapisana.' });
    } catch (error) {
        console.error("Błąd reorderowania FAQ:", error);
        res.status(500).json({ error: 'Błąd podczas zapisywania kolejności FAQ.' });
    }
});

app.delete('/api/admin/faq/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    try {
        db.prepare('DELETE FROM faq WHERE id = ?').run(id);
        const faqs = db.prepare('SELECT * FROM faq ORDER BY sort_order ASC').all();
        res.json({ success: true, message: 'Pytanie FAQ usunięte.', faqs });
    } catch (error) {
        console.error("Błąd bazy danych (admin-faq-delete):", error);
        res.status(500).json({ error: 'Błąd podczas usuwania pytania FAQ.' });
    }
});

// Generic error handler for Multer or other middleware errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Błąd przesyłania pliku: ${err.message}` });
    }
    if (err) {
        return res.status(400).json({ error: err.message || 'Wystąpił nieznany błąd.' });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
