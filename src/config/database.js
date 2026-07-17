const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./index');

// Ensure data directory exists (sync is OK at startup)
if (!fs.existsSync(config.paths.data)) {
    fs.mkdirSync(config.paths.data, { recursive: true });
}

const db = new Database(path.join(config.paths.data, 'database.sqlite'));

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

module.exports = db;
