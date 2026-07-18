const db = require('../config/database');

function getPricingConfig() {
    try {
        const multRow = db.prepare("SELECT value FROM config WHERE key = 'monthly_multiplier'").get();
        const discRow = db.prepare("SELECT value FROM config WHERE key = 'pricing_discounts'").get();
        const singleDiscRow = db.prepare("SELECT value FROM config WHERE key = 'discounts_apply_to_single'").get();
        
        return {
            multiplier: multRow && multRow.value ? parseFloat(multRow.value) : 40,
            discounts: discRow && discRow.value ? JSON.parse(discRow.value) : [{ name: 'Uczniowski', discount: 49 }],
            applyDiscountsToSingle: singleDiscRow ? singleDiscRow.value === '1' : false
        };
    } catch (e) {
        console.error("Error fetching pricing config:", e);
        return { multiplier: 40, discounts: [{ name: 'Uczniowski', discount: 49 }], applyDiscountsToSingle: false };
    }
}

function updatePricingConfig(multiplier, discounts, applyDiscountsToSingle) {
    const multValue = parseFloat(multiplier) || 40;
    const discValue = JSON.stringify(discounts || []);
    const singleDiscValue = applyDiscountsToSingle ? '1' : '0';
    
    db.prepare(`INSERT INTO config (key, value) VALUES ('monthly_multiplier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(multValue.toString());
    db.prepare(`INSERT INTO config (key, value) VALUES ('pricing_discounts', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(discValue);
    db.prepare(`INSERT INTO config (key, value) VALUES ('discounts_apply_to_single', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(singleDiscValue);
    
    return { multiplier: multValue, discounts, applyDiscountsToSingle: applyDiscountsToSingle ?? false };
}

function calculateDynamicPrice(priceRow, config) {
    const price_s = priceRow.price_s || 0;
    const monthly_base = Math.round(price_s * config.multiplier * 100) / 100;
    
    const calculatedDiscounts = config.discounts.map(d => {
        return {
            name: d.name,
            percentage: d.discount,
            price: Math.round(monthly_base * (1 - d.discount / 100) * 100) / 100,
            price_s: config.applyDiscountsToSingle
                ? Math.round(price_s * (1 - d.discount / 100) * 100) / 100
                : null
        };
    });

    return {
        stop1_id: priceRow.stop1_id,
        stop2_id: priceRow.stop2_id,
        price_s: price_s,
        monthly_base: monthly_base,
        discounts: calculatedDiscounts,
        applyDiscountsToSingle: config.applyDiscountsToSingle ?? false
    };
}

function getAllStops() {
    return db.prepare('SELECT * FROM stops ORDER BY sort_order ASC, id DESC').all();
}

function getAllPrices() {
    const prices = db.prepare('SELECT * FROM pricing').all();
    const config = getPricingConfig();
    return prices.map(p => calculateDynamicPrice(p, config));
}

function getPricingData() {
    return { stops: getAllStops(), prices: getAllPrices() };
}

function getPrice(stop1, stop2) {
    const id1 = Math.min(parseInt(stop1), parseInt(stop2));
    const id2 = Math.max(parseInt(stop1), parseInt(stop2));
    const priceRow = db.prepare('SELECT * FROM pricing WHERE stop1_id = ? AND stop2_id = ?').get(id1, id2) || null;
    if (!priceRow) return null;
    const config = getPricingConfig();
    return calculateDynamicPrice(priceRow, config);
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

function savePrice(stop1_id, stop2_id, price_s) {
    const id1 = Math.min(stop1_id, stop2_id);
    const id2 = Math.max(stop1_id, stop2_id);

    db.prepare(`
        INSERT INTO pricing (stop1_id, stop2_id, price_s, price_m, price_md) 
        VALUES (?, ?, ?, 0, 0)
        ON CONFLICT(stop1_id, stop2_id) DO UPDATE SET 
            price_s=excluded.price_s
    `).run(id1, id2, price_s);

    return getAllPrices();
}

function bulkUpdatePrices(type, amount) {
    if (type === 's') {
        db.prepare(
            `UPDATE pricing SET price_s = MAX(0, price_s + ?) WHERE price_s IS NOT NULL AND price_s > 0`
        ).run(amount);
    }
    return getAllPrices();
}

module.exports = {
    getPricingConfig, updatePricingConfig,
    getAllStops, getAllPrices, getPricingData, getPrice,
    addStop, updateStop, deleteStop, reorderStops,
    savePrice, bulkUpdatePrices
};
