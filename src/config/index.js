const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',

    session: {
        secret: process.env.SESSION_SECRET,
    },

    admin: {
        user: process.env.ADMIN_USER || 'ostafinbodzio',
        hash: (process.env.ADMIN_HASH_B64
            ? Buffer.from(process.env.ADMIN_HASH_B64, 'base64').toString()
            : process.env.ADMIN_HASH || '').trim(),
    },

    appUrl: process.env.APP_URL || 'http://localhost:3001',

    mail: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: process.env.SMTP_SECURE === 'false' ? false : true,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        fromName: process.env.MAIL_FROM_NAME || 'TwojaNazwa - Powiadomienia',
        fromEmail: process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || 'powiadomienia@twojanazwa.pl',
    },

    paths: {
        data: path.join(__dirname, '..', '..', 'data'),
        public: path.join(__dirname, '..', '..', 'public'),
        uploads: path.join(__dirname, '..', '..', 'uploads'),
        views: path.join(__dirname, '..', '..', 'views'),
    },
};

if (!config.session.secret) {
    console.error('FATAL: SESSION_SECRET is not set in .env');
    process.exit(1);
}

if (!config.admin.hash) {
    console.error('FATAL: ADMIN_HASH_B64 (or ADMIN_HASH) is not set in .env');
    process.exit(1);
}

module.exports = config;
