const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.sqlite');
const backupPath = path.join(__dirname, '../../data/database.sqlite.bak');

console.log('Database path:', dbPath);

// 1. Backup the database
try {
    if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`Backup created at: ${backupPath}`);
    } else {
        console.log('Database file does not exist yet. No backup needed.');
    }
} catch (e) {
    console.error("Warning: Backup failed:", e);
}

// 2. Open database
let db;
try {
    db = new Database(dbPath);
} catch (e) {
    console.error("Failed to open SQLite database:", e);
    process.exit(1);
}

try {
    db.transaction(() => {
        // 3. Clear existing pricing and stops
        db.prepare('DELETE FROM pricing').run();
        db.prepare('DELETE FROM stops').run();
        console.log('Cleared tables: pricing, stops');

        // 4. Insert stops: Przystanek 1, 2, ..., 8
        const numStops = 8;
        const insertStop = db.prepare('INSERT INTO stops (id, name, sort_order) VALUES (?, ?, ?)');
        
        for (let i = 1; i <= numStops; i++) {
            insertStop.run(i, `Przystanek ${i}`, i);
        }
        console.log(`Inserted ${numStops} stops.`);

        // 5. Insert pricing between all pairs
        const insertPrice = db.prepare(`
            INSERT INTO pricing (stop1_id, stop2_id, price_s, price_m, price_md) 
            VALUES (?, ?, ?, ?, ?)
        `);

        let count = 0;
        for (let i = 1; i <= numStops; i++) {
            for (let j = i + 1; j <= numStops; j++) {
                // Price based on distance (number of stops between them)
                const distance = j - i;
                const price_s = parseFloat((2.50 + distance * 1.20).toFixed(2));
                const price_m = parseFloat((price_s * 40).toFixed(2));
                const price_md = parseFloat((price_s * 40 * 0.51).toFixed(2));

                insertPrice.run(i, j, price_s, price_m, price_md);
                count++;
            }
        }
        console.log(`Inserted ${count} pricing relationships.`);
    })();
    console.log('Database seeded successfully!');
} catch (error) {
    console.error('Error during seeding:', error);
} finally {
    db.close();
}
