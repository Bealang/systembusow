const db = require('../config/database');

function getAll() {
    return db.prepare('SELECT * FROM news ORDER BY id DESC').all();
}

function getPaginated(page, limit) {
    const offset = (page - 1) * limit;
    const rows = db.prepare('SELECT * FROM news ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM news').get();
    return { news: rows, total: totalRow.count };
}

function create(title, content) {
    const date = new Date().toISOString();
    db.prepare('INSERT INTO news (date, title, content) VALUES (?, ?, ?)').run(date, title, content);
    return getAll();
}

function update(id, title, content) {
    const result = db.prepare('UPDATE news SET title = ?, content = ? WHERE id = ?').run(title, content, id);
    if (result.changes === 0) return null;
    return getAll();
}

function remove(id) {
    db.prepare('DELETE FROM news WHERE id = ?').run(id);
    return getAll();
}

module.exports = { getAll, getPaginated, create, update, remove };
