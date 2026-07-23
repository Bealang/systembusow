const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

function ensureDefaultSuperuser() {
    try {
        const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
        if (userCount === 0) {
            const defaultUser = 'admin';
            const defaultEmail = 'admin@twojadomena.pl';
            const defaultHash = bcrypt.hashSync('admin!#', 12);
            db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)").run(defaultUser, defaultEmail, defaultHash);
            console.log(`[DB Migration] Inicjalizacja domyślnego superusera (${defaultUser}).`);
        }
    } catch (err) {
        console.error("Błąd tworzenia domyślnego superusera:", err);
    }
}

function getAdminUser() {
    ensureDefaultSuperuser();
    return db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();
}

function getUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    
    // Try query with SQLite LOWER (using registered JS utf-8 lower function)
    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(clean, clean);
    if (user) return user;

    // Fallback search in JS for maximum compatibility
    const allUsers = db.prepare('SELECT * FROM users').all();
    return allUsers.find(u => 
        (u.username && u.username.trim().toLowerCase() === clean) ||
        (u.email && u.email.trim().toLowerCase() === clean)
    ) || null;
}

function verifyPassword(user, plainPassword) {
    if (!user || !user.password_hash || !plainPassword) return false;
    return bcrypt.compareSync(plainPassword, user.password_hash);
}

function createToken(userId, type, payload = {}, expirationMinutes = 15) {
    const nowIso = new Date().toISOString();
    // Clean up all expired tokens
    db.prepare('DELETE FROM auth_tokens WHERE expires_at <= ?').run(nowIso);

    // 64 bytes = 128 hex characters
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();
    const payloadJson = JSON.stringify(payload);

    db.prepare(`
        INSERT INTO auth_tokens (user_id, token_hash, type, payload, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, tokenHash, type, payloadJson, expiresAt);

    return rawToken;
}

function verifyAndConsumeToken(rawToken, expectedType) {
    if (!rawToken || typeof rawToken !== 'string') return { valid: false, reason: 'Brak tokena.' };

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const nowIso = new Date().toISOString();

    const record = db.prepare(`
        SELECT * FROM auth_tokens 
        WHERE token_hash = ? AND type = ? AND expires_at > ?
    `).get(tokenHash, expectedType, nowIso);

    if (!record) {
        return { valid: false, reason: 'Token wygasł lub jest nieprawidłowy.' };
    }

    // Delete token immediately so it cannot be reused (Single Use)
    db.prepare('DELETE FROM auth_tokens WHERE id = ?').run(record.id);

    let payload = {};
    try {
        payload = JSON.parse(record.payload || '{}');
    } catch (e) {
        // ignore parse error
    }

    return {
        valid: true,
        record,
        userId: record.user_id,
        payload,
    };
}

function changePassword(userId, newPlainPassword) {
    const newHash = bcrypt.hashSync(newPlainPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, userId);
    return true;
}

function updateUsername(userId, newUsername) {
    db.prepare('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newUsername, userId);
    return true;
}

function updateEmail(userId, newEmail) {
    db.prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newEmail, userId);
    return true;
}

module.exports = {
    ensureDefaultSuperuser,
    getAdminUser,
    getUserById,
    getUserByUsernameOrEmail,
    verifyPassword,
    createToken,
    verifyAndConsumeToken,
    changePassword,
    updateUsername,
    updateEmail,
};
