const db = require('../config/database');

const DEFAULT_ATTRIBUTES = [{ symbol: 'S', description: 'kurs szkolny' }];

function getAll() {
    const row = db.prepare("SELECT value FROM config WHERE key = 'course_attributes'").get();
    return row ? JSON.parse(row.value) : DEFAULT_ATTRIBUTES;
}

function saveAll(attributes) {
    db.prepare(
        "INSERT INTO config (key, value) VALUES ('course_attributes', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(JSON.stringify(attributes));
}

function create(symbol, description) {
    const cleanSymbol = symbol.trim().toUpperCase();
    const cleanDesc = description.trim();

    const attributes = getAll();
    if (attributes.some(attr => attr.symbol === cleanSymbol)) {
        return { error: 'Oznaczenie o tym symbolu już istnieje.' };
    }

    attributes.push({ symbol: cleanSymbol, description: cleanDesc });
    saveAll(attributes);
    return { success: true, attributes };
}

function update(oldSymbol, newSymbol, newDescription) {
    const cleanOld = oldSymbol.trim().toUpperCase();
    const cleanNew = newSymbol.trim().toUpperCase();
    const cleanDesc = newDescription.trim();

    const attributes = getAll();
    const attrIndex = attributes.findIndex(attr => attr.symbol === cleanOld);
    if (attrIndex === -1) return { error: 'Nie znaleziono oznaczenia.', status: 404 };

    if (cleanNew !== cleanOld && attributes.some(attr => attr.symbol === cleanNew)) {
        return { error: 'Oznaczenie o nowym symbolu już istnieje.' };
    }

    attributes[attrIndex] = { symbol: cleanNew, description: cleanDesc };
    saveAll(attributes);

    // Migrate symbol in schedule if changed
    if (cleanNew !== cleanOld) {
        migrateSymbolInSchedule(cleanOld, cleanNew);
    }

    return { success: true, attributes };
}

function remove(symbol) {
    const cleanSymbol = symbol.trim().toUpperCase();
    let attributes = getAll();
    attributes = attributes.filter(attr => attr.symbol !== cleanSymbol);
    saveAll(attributes);

    // Remove from schedule
    removeSymbolFromSchedule(cleanSymbol);

    return { success: true, attributes };
}

function migrateSymbolInSchedule(oldSymbol, newSymbol) {
    const rowSchedule = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
    if (!rowSchedule) return;

    const schedule = JSON.parse(rowSchedule.value);
    let modified = false;

    const renameSymbol = (courses) => {
        if (!Array.isArray(courses)) return;
        courses.forEach(course => {
            if (Array.isArray(course.notes)) {
                const noteIndex = course.notes.indexOf(oldSymbol);
                if (noteIndex !== -1) {
                    course.notes[noteIndex] = newSymbol;
                    modified = true;
                }
            }
        });
    };

    for (const direction in schedule) {
        const dirObj = schedule[direction];
        for (const dayType in dirObj) {
            renameSymbol(dirObj[dayType]);
        }
    }

    if (modified) {
        db.prepare(
            "INSERT INTO config (key, value) VALUES ('schedule', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        ).run(JSON.stringify(schedule));
    }
}

function removeSymbolFromSchedule(symbol) {
    const rowSchedule = db.prepare("SELECT value FROM config WHERE key = 'schedule'").get();
    if (!rowSchedule) return;

    const schedule = JSON.parse(rowSchedule.value);
    let modified = false;

    const removeSymbolFn = (courses) => {
        if (!Array.isArray(courses)) return;
        courses.forEach(course => {
            if (Array.isArray(course.notes)) {
                const noteIndex = course.notes.indexOf(symbol);
                if (noteIndex !== -1) {
                    course.notes.splice(noteIndex, 1);
                    modified = true;
                }
            }
        });
    };

    for (const direction in schedule) {
        const dirObj = schedule[direction];
        for (const dayType in dirObj) {
            removeSymbolFn(dirObj[dayType]);
        }
    }

    if (modified) {
        db.prepare(
            "INSERT INTO config (key, value) VALUES ('schedule', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        ).run(JSON.stringify(schedule));
    }
}

module.exports = { getAll, create, update, remove };
