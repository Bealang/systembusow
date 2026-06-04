const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.sqlite');
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);

try {
    const row = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
    if (row) {
        const schedule = JSON.parse(row.value);
        
        const cleanCourses = (courses) => {
            if (Array.isArray(courses)) {
                courses.forEach(c => {
                    c.notes = [];
                });
            }
        };
        
        const cleanVariant = (variant) => {
            if (variant) {
                cleanCourses(variant.workdays);
                cleanCourses(variant.saturday);
                cleanCourses(variant.sunday);
            }
        };
        
        cleanVariant(schedule.myslenice);
        cleanVariant(schedule.sulkowice);
        
        db.prepare("UPDATE config SET value = ? WHERE key = 'schedule'").run(JSON.stringify(schedule));
        console.log("Successfully cleared all course notes in the database.");
    } else {
        console.log("No schedule config found to clear.");
    }
} catch (e) {
    console.error("Error cleaning notes in database:", e);
} finally {
    db.close();
}
