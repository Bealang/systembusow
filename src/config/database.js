const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('./index');

// Ensure data directory exists (sync is OK at startup)
if (!fs.existsSync(config.paths.data)) {
    fs.mkdirSync(config.paths.data, { recursive: true });
}

const db = new Database(path.join(config.paths.data, 'database.sqlite'));

// Register UTF-8 lower function for SQLite so Polish characters like Ł, Ą, Ę, Ś, Ć, Ź, Ż, Ń, Ó work with LOWER()
db.function('lower', { deterministic: true }, (str) => {
    if (typeof str !== 'string') return str;
    return str.toLowerCase();
});

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
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        payload TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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

// Seed default admin if no users exist
try {
    const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
    if (userCount === 0) {
        const defaultUser = 'admin';
        const defaultEmail = 'admin@twojadomena.pl';
        const defaultHash = bcrypt.hashSync('admin!#', 12);
        db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)").run(defaultUser, defaultEmail, defaultHash);
        console.log(`[DB Migration] Inicjalizacja konta admina (${defaultUser} / ${defaultEmail}) z hasłem admin!#.`);
    }
} catch (err) {
    console.error("Błąd podczas inicjalizacji użytkowników:", err);
}

module.exports = db;
