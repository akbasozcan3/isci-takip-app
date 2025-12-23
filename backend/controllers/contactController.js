// Contact Controller
const db = require('../config/database');

// Submit contact form
exports.submitContact = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Tüm alanlar gereklidir'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Geçerli bir e-posta adresi girin'
            });
        }

        // Save to database
        await db.query(
            'INSERT INTO contact_messages (name, email, subject, message, userId) VALUES (?, ?, ?, ?, ?)',
            [name, email, subject, message, req.user?.id || null]
        );

        // Send email notification to admin
        try {
            const nodemailer = require('nodemailer');

            // Create transporter using SMTP settings from .env
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '465', 10),
                secure: true, // Use SSL
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            // Professional HTML email template
            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 1px;">BAVAXE</h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Yeni İletişim Mesajı</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: 700;">📬 Yeni Mesaj Alındı</h2>
                            
                            <!-- Sender Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; border-radius: 8px; padding: 16px;">
                                        <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Gönderen Bilgileri</p>
                                        <p style="margin: 0 0 4px 0; color: #ffffff; font-size: 16px; font-weight: 600;">👤 ${name}</p>
                                        <p style="margin: 0; color: #cbd5e1; font-size: 14px;">📧 ${email}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Subject -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px;">
                                        <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Konu</p>
                                        <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">${subject}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Message -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px;">
                                        <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Mesaj İçeriği</p>
                                        <p style="margin: 0; color: #cbd5e1; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Timestamp -->
                            <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
                                🕐 ${new Date().toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' })}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: rgba(15, 23, 42, 0.5); padding: 32px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">
                                © 2024 Bavaxe. Tüm hakları saklıdır.
                            </p>
                            <p style="margin: 0; color: #475569; font-size: 12px;">
                                Bu otomatik bir bildirimdir.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `;

            // Send email to admin
            await transporter.sendMail({
                from: `"Bavaxe İletişim Formu" <${process.env.SMTP_USER}>`,
                to: process.env.SMTP_USER, // Admin email (same as SMTP_USER)
                subject: `📬 Yeni İletişim Mesajı: ${subject}`,
                html: emailHtml,
                replyTo: email, // Allow admin to reply directly to sender
            });

            console.log(`[Contact] Email sent successfully to ${process.env.SMTP_USER}`);
        } catch (emailError) {
            // Log email error but don't fail the request
            // Message is already saved to database
            console.error('[Contact] Email send error:', emailError);
            console.error('[Contact] Email error details:', emailError.message);
        }

        res.json({
            success: true,
            message: 'Mesajınız başarıyla gönderildi'
        });
    } catch (error) {
        console.error('[Contact] Submit error:', error);
        res.status(500).json({
            success: false,
            error: 'Mesaj gönderilemedi'
        });
    }
};

// Get all contact messages (admin only)
exports.getAllMessages = async (req, res) => {
    try {
        const [messages] = await db.query(
            'SELECT * FROM contact_messages ORDER BY createdAt DESC'
        );

        res.json({
            success: true,
            data: { messages }
        });
    } catch (error) {
        console.error('[Contact] Get all error:', error);
        res.status(500).json({
            success: false,
            error: 'Mesajlar alınamadı'
        });
    }
};
