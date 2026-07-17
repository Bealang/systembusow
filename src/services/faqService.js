const db = require('../config/database');

function getAll() {
    return db.prepare('SELECT * FROM faq ORDER BY sort_order ASC').all();
}

function create(question, answer) {
    const maxSort = db.prepare('SELECT MAX(sort_order) as maxSort FROM faq').get().maxSort || 0;
    db.prepare('INSERT INTO faq (question, answer, sort_order) VALUES (?, ?, ?)').run(question, answer, maxSort + 1);
    return getAll();
}

function update(id, question, answer) {
    const result = db.prepare('UPDATE faq SET question = ?, answer = ? WHERE id = ?').run(question, answer, id);
    if (result.changes === 0) return null;
    return getAll();
}

function remove(id) {
    db.prepare('DELETE FROM faq WHERE id = ?').run(id);
    return getAll();
}

function reorder(orders) {
    const updateStmt = db.prepare('UPDATE faq SET sort_order = ? WHERE id = ?');
    const transaction = db.transaction((data) => {
        for (const item of data) {
            updateStmt.run(item.sort_order, item.id);
        }
    });
    transaction(orders);
}

module.exports = { getAll, create, update, remove, reorder };
