const db = require('../config/database');

function getAllStops() {
    return db.prepare('SELECT * FROM stops ORDER BY sort_order ASC, id DESC').all();
}

function getAllPrices() {
    return db.prepare('SELECT * FROM pricing').all();
}

function getPricingData() {
    return { stops: getAllStops(), prices: getAllPrices() };
}

function getPrice(stop1, stop2) {
    const id1 = Math.min(parseInt(stop1), parseInt(stop2));
    const id2 = Math.max(parseInt(stop1), parseInt(stop2));
    return db.prepare('SELECT * FROM pricing WHERE stop1_id = ? AND stop2_id = ?').get(id1, id2) || null;
}

function addStop(name) {
    db.prepare('INSERT INTO stops (name) VALUES (?)').run(name);
    return getAllStops();
}

function updateStop(id, name) {
    const result = db.prepare('UPDATE stops SET name = ? WHERE id = ?').run(name, id);
    if (result.changes === 0) return null;
    return getAllStops();
}

function deleteStop(id) {
    db.prepare('DELETE FROM stops WHERE id = ?').run(id);
    return getAllStops();
}

function reorderStops(orders) {
    const updateStmt = db.prepare('UPDATE stops SET sort_order = ? WHERE id = ?');
    const transaction = db.transaction((data) => {
        for (const item of data) {
            updateStmt.run(item.sort_order, item.id);
        }
    });
    transaction(orders);
}

function savePrice(stop1_id, stop2_id, price_s, price_m, price_md) {
    const id1 = Math.min(stop1_id, stop2_id);
    const id2 = Math.max(stop1_id, stop2_id);

    db.prepare(`
        INSERT INTO pricing (stop1_id, stop2_id, price_s, price_m, price_md) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(stop1_id, stop2_id) DO UPDATE SET 
            price_s=excluded.price_s, 
            price_m=excluded.price_m, 
            price_md=excluded.price_md
    `).run(id1, id2, price_s, price_m, price_md);

    return getAllPrices();
}

function bulkUpdatePrices(type, amount) {
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
        `).run(amount, amount);
    } else {
        db.prepare(
            `UPDATE pricing SET ${column} = MAX(0, ${column} + ?) WHERE ${column} IS NOT NULL AND ${column} > 0`
        ).run(amount);
    }

    return getAllPrices();
}

function recalculateMonthly() {
    db.prepare(`
        UPDATE pricing 
        SET price_m = ROUND(price_s * 40, 2),
            price_md = ROUND(price_s * 40 * 0.51, 2)
        WHERE price_s IS NOT NULL AND price_s > 0
    `).run();

    return getAllPrices();
}

module.exports = {
    getAllStops, getAllPrices, getPricingData, getPrice,
    addStop, updateStop, deleteStop, reorderStops,
    savePrice, bulkUpdatePrices, recalculateMonthly
};
