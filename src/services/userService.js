const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

function getAdminUser() {
    return db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();
}

function getUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(clean, clean);
}

function verifyPassword(user, plainPassword) {
    if (!user || !user.password_hash || !plainPassword) return false;
    return bcrypt.compareSync(plainPassword, user.password_hash);
}

function createToken(userId, type, payload = {}, expirationMinutes = 15) {
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
