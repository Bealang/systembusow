const db = require('../config/database');

function getAlert() {
    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'important_alert'").get();
        if (row && row.value) {
            return JSON.parse(row.value);
        }
    } catch (e) {
        console.error("Error fetching alert config:", e);
    }
    return { text: '', active: false };
}

function updateAlert(text, active) {
    const value = JSON.stringify({ text, active: !!active });
    const stmt = db.prepare(`
        INSERT INTO config (key, value)
        VALUES ('important_alert', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(value);
    return { text, active: !!active };
}

module.exports = { getAlert, updateAlert };
