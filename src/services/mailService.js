const nodemailer = require('nodemailer');
const config = require('../config/index');

let transporter = null;

async function getTransporter() {
    if (transporter) return transporter;

    if (config.mail.host && config.mail.user) {
        transporter = nodemailer.createTransport({
            host: config.mail.host,
            port: config.mail.port,
            secure: config.mail.secure,
            auth: {
                user: config.mail.user,
                pass: config.mail.pass,
            },
        });
    } else {
        // Fallback for development without SMTP credentials
        try {
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            console.log('[MailService] Utworzono konto testowe Ethereal:', testAccount.user);
        } catch (err) {
            console.warn('[MailService] Nie można utworzyć konta testowego Ethereal. Używam konsoli.');
            transporter = {
                sendMail: async (opts) => {
                    console.log('\n=================== [MAIL CONSOLE DEV] ===================');
                    console.log('Do:', opts.to);
                    console.log('Temat:', opts.subject);
                    console.log('Treść (HTML):\n', opts.html);
                    console.log('==========================================================\n');
                    return { messageId: 'dev-console-msg' };
                }
            };
        }
    }
    return transporter;
}

function getEmailWrapper(contentHtml) {
    return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                font-family: 'Poppins', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
            }
            body { 
                font-family: 'Poppins', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; 
                background-color: #f7f9fc; 
                margin: 0; 
                padding: 30px 12px; 
                color: #0a1931; 
                -webkit-font-smoothing: antialiased;
            }
            .card { 
                max-width: 520px; 
                margin: 0 auto; 
                background: #ffffff; 
                border: 1px solid #e2e8f0; 
                border-radius: 0; 
                padding: 32px 28px; 
                box-shadow: 0 4px 20px rgba(10, 25, 49, 0.05); 
            }
            .header-brand { 
                font-size: 20px; 
                font-weight: 700; 
                color: #0a1931; 
                margin-bottom: 24px; 
                padding-bottom: 16px; 
                border-bottom: 2px solid #f1f5f9; 
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .header-brand span {
                color: #e2b659;
            }
            h2 { 
                font-size: 18px; 
                font-weight: 700; 
                color: #0a1931; 
                margin: 0 0 14px 0; 
            }
            p { 
                font-size: 14.5px; 
                line-height: 1.65; 
                color: #334155; 
                margin: 0 0 16px 0; 
            }
            .btn-wrap { 
                margin: 24px 0; 
                text-align: left;
            }
            .btn { 
                display: inline-block; 
                background-color: #0a1931; 
                color: #ffffff !important; 
                font-weight: 600; 
                font-family: 'Poppins', sans-serif;
                text-decoration: none; 
                padding: 13px 28px; 
                border-radius: 0; 
                font-size: 14.5px; 
                border-bottom: 3px solid #e2b659;
            }
            .fallback-box { 
                background: #f8fafc; 
                border: 1px solid #e2e8f0; 
                border-radius: 0; 
                padding: 12px 14px; 
                margin: 10px 0 20px 0; 
                word-break: break-all; 
                font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; 
                font-size: 12.5px; 
                color: #0a1931; 
            }
            .note-box { 
                background: #fffdf5; 
                border: 1px solid #fef08a; 
                padding: 14px 16px; 
                border-radius: 0; 
                font-size: 13.5px; 
                color: #854d0e; 
                margin-top: 20px; 
                line-height: 1.55;
            }
            .note-box.danger {
                background: #fef2f2;
                border: 1px solid #fecaca;
                color: #991b1b;
                border-radius: 0;
            }
            .note-box.success {
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                color: #166534;
                border-radius: 0;
            }
            .footer { 
                max-width: 520px; 
                margin: 24px auto 0 auto; 
                text-align: center; 
                font-size: 12.5px; 
                color: #64748b; 
                line-height: 1.6; 
            }
            .footer a { 
                color: #0a1931; 
                text-decoration: none; 
                font-weight: 600; 
            }
            .footer a:hover {
                color: #e2b659;
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header-brand">Twoja<span>Nazwa</span></div>
            ${contentHtml}
        </div>
        <div class="footer">
            <p style="margin: 0 0 6px 0;">Potrzebujesz pomocy? Skontaktuj się z naszą pomocą techniczną:</p>
            <p style="margin: 0; font-weight: 600;">
                Tel: <a href="tel:+48796760814">+48 796 760 814</a> &nbsp;&bull;&nbsp; E-mail: <a href="mailto:pomoc@web2sell.pl">pomoc@web2sell.pl</a>
            </p>
            <p style="margin-top: 14px; font-size: 11.5px; color: #94a3b8;">Wiadomość wygenerowana automatycznie przez system TwojaNazwa. Prosimy na nią nie odpowiadać.</p>
        </div>
    </body>
    </html>
    `;
}

function maskEmail(email) {
    if (!email || !email.includes('@')) return '***@***';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

async function sendMail({ to, subject, html }) {
    try {
        const mailTransporter = await getTransporter();
        const info = await mailTransporter.sendMail({
            from: `"${config.mail.fromName}" <${config.mail.fromEmail}>`,
            to,
            subject,
            html: getEmailWrapper(html),
        });

        if (nodemailer.getTestMessageUrl(info)) {
            console.log('[MailService] Podgląd Ethereal URL:', nodemailer.getTestMessageUrl(info));
        }
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[MailService] Błąd wysyłania e-maila:', error);
        return { success: false, error: error.message };
    }
}

async function sendPasswordResetEmail(toEmail, resetLink) {
    const html = `
        <h2>Resetowanie hasła</h2>
        <p>Witaj!</p>
        <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w panelu TwojaNazwa.</p>
        <div class="btn-wrap">
            <a href="${resetLink}" class="btn">Ustaw nowe hasło</a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 6px;">Jeśli przycisk nie działa, skopiuj poniższy link i wklej go w przeglądarce:</p>
        <div class="fallback-box">${resetLink}</div>
        <div class="note-box">
            Link jest ważny przez 15 minut. Jeśli to nie Ty prosiłeś o reset hasła, bez obaw, po prostu zignoruj ten e-mail — Twoje obecne hasło pozostanie bez zmian.
        </div>
    `;
    return sendMail({
        to: toEmail,
        subject: 'Resetowanie hasła — TwojaNazwa',
        html,
    });
}

async function sendEmailChangeVerification(newEmail, confirmLink) {
    const html = `
        <h2>Potwierdzenie nowego adresu e-mail</h2>
        <p>Cześć!</p>
        <p>Podano ten adres e-mail (<strong>${newEmail}</strong>) podczas zmiany danych konta w panelu TwojaNazwa.</p>
        <p>Kliknij poniższy przycisk, aby zatwierdzić nowy adres e-mail:</p>
        <div class="btn-wrap">
            <a href="${confirmLink}" class="btn">Potwierdź adres e-mail</a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 6px;">Jeśli przycisk nie działa, skopiuj poniższy link i wklej go w przeglądarce:</p>
        <div class="fallback-box">${confirmLink}</div>
        <p style="font-size: 13px; color: #64748b;">Jeśli to nie ty zmieniałeś email, po prostu zignoruj tę wiadomość.</p>
    `;
    return sendMail({
        to: newEmail,
        subject: 'Potwierdzenie adresu e-mail — TwojaNazwa',
        html,
    });
}

async function sendEmailChangeNotificationToOldAddress(oldEmail, newEmail) {
    const masked = maskEmail(newEmail);
    const html = `
        <h2>Informacja o zmianie adresu e-mail</h2>
        <p>Cześć!</p>
        <p>W Twoim koncie w panelu TwojaNazwa zgłoszono zmianę adresu e-mail na: <strong>${masked}</strong>.</p>
        <p>Wysłaliśmy wiadomość z linkiem potwierdzającym na nowy adres e-mail.</p>
        <div class="note-box danger">
            Jeśli to nie Ty wnioskowałeś o tę zmianę, ktoś mógł uzyskać dostęp do Twojego konta. Zaloguj się natychmiast do panelu i zmień hasło.
        </div>
    `;
    return sendMail({
        to: oldEmail,
        subject: 'Zgłoszono zmianę adresu e-mail — TwojaNazwa',
        html,
    });
}

async function sendUsernameChangeVerification(email, newUsername, confirmLink) {
    const html = `
        <h2>Potwierdzenie nowej nazwy użytkownika</h2>
        <p>Cześć!</p>
        <p>Zgłoszono zmianę nazwy użytkownika w panelu TwojaNazwa na: <strong style="color: #0a1931;">${newUsername}</strong>.</p>
        <p>Kliknij przycisk poniżej, aby potwierdzić zmianę:</p>
        <div class="btn-wrap">
            <a href="${confirmLink}" class="btn">Zatwierdź nową nazwę</a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 6px;">Jeśli przycisk nie działa, skopiuj poniższy link i wklej go w przeglądarce:</p>
        <div class="fallback-box">${confirmLink}</div>
    `;
    return sendMail({
        to: email,
        subject: 'Potwierdzenie nazwy użytkownika — TwojaNazwa',
        html,
    });
}

async function sendPasswordChangedNotification(email) {
    const html = `
        <h2>Hasło zostało zmienione</h2>
        <p>Cześć!</p>
        <p>Hasło do Twojego konta w panelu TwojaNazwa zostało pomyślnie zmienione.</p>
        <div class="note-box success">
            Zmiana została zapisana. Jeśli to nie Ty zmieniałeś hasło, zresetuj je natychmiast za pomocą opcji "Zapomniałem hasła" na stronie logowania i skontaktuj się z pomocą techniczną poniżej.
        </div>
    `;
    return sendMail({
        to: email,
        subject: 'Hasło zostało zmienione — TwojaNazwa',
        html,
    });
}

module.exports = {
    sendPasswordResetEmail,
    sendEmailChangeVerification,
    sendEmailChangeNotificationToOldAddress,
    sendUsernameChangeVerification,
    sendPasswordChangedNotification,
    maskEmail,
};
