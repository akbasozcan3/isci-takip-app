const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');

const router = express.Router();

// API Versioning Middleware (optional, can be enabled per route)
const { apiVersionMiddleware } = require('../core/middleware/apiVersion.middleware');

router.use(helmet());
router.use(compression());
// CORS middleware - skip Socket.IO and WebSocket upgrade requests
router.use((req, res, next) => {
  // Skip Socket.IO requests - handled by Socket.IO server
  // Also skip WebSocket upgrade requests completely
  if (req.path?.includes('/socket.io/') ||
    req.url?.includes('/socket.io/') ||
    req.headers.upgrade === 'websocket' ||
    req.headers.connection?.toLowerCase().includes('upgrade')) {
    return next();
  }
  // Use CORS for regular API requests only
  return cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
  })(req, res, next);
});
router.use(bodyParser.json({ limit: '10mb' }));
router.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// API Versioning (optional - can be enabled for specific routes)
// router.use(apiVersionMiddleware);

const requestLogger = require('../core/middleware/requestLogger');
const performanceMiddleware = require('../core/middleware/performance.middleware');
const tracingMiddleware = require('../core/middleware/tracing.middleware');
const securityMiddleware = require('../core/middleware/security.middleware');
const responseMiddleware = require('../core/middleware/response.middleware');
const inputSanitizer = require('../core/middleware/inputSanitizer.middleware');
const { asyncHandler } = require('../core/middleware/errorHandler.middleware');
const { validateCoordinates, validateGroupId, validateDeviceId, validateUserId, validateDeliveryId, validateRouteId, validateArticleId, validateReportId, validatePaymentId, validateRequestId } = require('../core/middleware/requestValidator.middleware');
const rateLimiter = require('../core/middleware/rateLimiter');

router.use(require('../core/middleware/requestId.middleware'));
router.use(require('../core/middleware/startupCheck.middleware'));
router.use(require('../middleware/postgresMiddleware')); // Ensure PostgreSQL connection
router.use(tracingMiddleware);
router.use(securityMiddleware);
router.use(require('../core/middleware/securityEnhancer.middleware'));
router.use(inputSanitizer);
router.use(performanceMiddleware);
router.use(require('../core/middleware/performanceOptimizer.middleware'));
router.use(require('../core/middleware/monitoring.middleware'));
router.use(require('../core/middleware/performanceTracking.middleware'));
router.use(require('../core/middleware/queryOptimizer.middleware'));
router.use(require('../core/middleware/database.middleware'));
router.use(require('../core/middleware/auditLog.middleware'));
router.use(require('../core/middleware/responseOptimizer.middleware'));
router.use(requestLogger);
router.use(responseMiddleware);

// API Response Caching (for GET requests)
const apiResponseCache = require('../core/middleware/apiResponseCache.middleware');
router.use(apiResponseCache());

router.use(rateLimiter());

const { attachSubscription } = require('../core/middleware/subscriptionCheck');
router.use(attachSubscription);

const activityLogger = require('../middleware/activityLogger');
router.use(activityLogger);

// Professional Health Check
const { healthCheckMiddleware } = require('../core/middleware/healthCheck.middleware');
router.get('/health', healthCheckMiddleware);
router.get('/api/health', healthCheckMiddleware); // Alias for consistency

// Video serving removed - using static hero banner design instead

// System Status Controller
const systemStatusController = require('../controllers/systemStatusController');
router.get('/system/status', require('../core/middleware/auth.middleware').requireAuth, systemStatusController.getSystemStatus.bind(systemStatusController));
router.get('/system/health', systemStatusController.getHealthCheck.bind(systemStatusController));
router.get('/system/version', systemStatusController.getApiVersion.bind(systemStatusController));

// Import requireAuth early to avoid hoisting issues
const { requireAuth } = require('../core/middleware/auth.middleware');

// API Metrics Endpoint
router.get('/metrics', requireAuth, (req, res) => {
  try {
    const ResponseFormatter = require('../core/utils/responseFormatter');
    const apiMetrics = require('../core/utils/apiMetrics');
    const databaseService = require('../core/services/database.service');
    const backupService = require('../core/services/backup.service');

    const metrics = apiMetrics.getMetrics();
    const dbStats = databaseService.getStats();
    const backupStats = backupService.getStats();

    res.json(ResponseFormatter.success({
      ...metrics,
      topEndpoints: apiMetrics.getTopEndpoints(10),
      errorRate: apiMetrics.getErrorRate(),
      database: dbStats,
      backups: backupStats
    }));
  } catch (error) {
    const ResponseFormatter = require('../core/utils/responseFormatter');
    res.status(500).json(
      ResponseFormatter.error('Metrics unavailable', 'METRICS_ERROR', { message: error.message })
    );
  }
});

// Database Backup Endpoints
router.post('/admin/backup/create', requireAuth, asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const backupService = require('../core/services/backup.service');
  const result = await backupService.createBackup({
    type: 'manual',
    userId: req.user?.id,
    trigger: 'api'
  });

  if (result && result.success) {
    res.json(
      ResponseFormatter.success(result, 'Backup created successfully')
    );
  } else {
    res.status(500).json(
      ResponseFormatter.error(result?.error || 'Backup creation failed', 'BACKUP_ERROR')
    );
  }
}));

router.get('/admin/backups', requireAuth, (req, res) => {
  try {
    const ResponseFormatter = require('../core/utils/responseFormatter');
    const backupService = require('../core/services/backup.service');
    const backups = backupService.listBackups();
    const stats = backupService.getStats();

    res.json(ResponseFormatter.success({
      backups,
      stats
    }));
  } catch (error) {
    const ResponseFormatter = require('../core/utils/responseFormatter');
    res.status(500).json(
      ResponseFormatter.error('Failed to list backups', 'BACKUP_LIST_ERROR', { message: error.message })
    );
  }
});

router.use('/auth', require('../modules/auth/auth.routes'));

// Password Reset Routes - Premium Implementation
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Rate limiter for password reset requests
const resetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: 'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request password reset code
router.post('/api/auth/reset/request', resetRateLimiter, asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json(ResponseFormatter.error('Geçerli bir e-posta adresi girin.', 'INVALID_EMAIL'));
  }

  try {
    const db = req.db;

    // Check if user exists
    const userResult = await db.query('SELECT id, email, name FROM users WHERE email = $1', [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json(ResponseFormatter.success({}, 'Eğer bu e-posta kayıtlıysa, doğrulama kodu gönderildi.'));
    }

    const user = userResult.rows[0];

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create password_reset_codes table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Delete old codes for this user
    await db.query('DELETE FROM password_reset_codes WHERE email = $1', [email.toLowerCase()]);

    // Insert new code
    await db.query(
      'INSERT INTO password_reset_codes (user_id, email, code, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, email.toLowerCase(), code, expiresAt]
    );

    // Send email (in development, log to console)
    if (process.env.NODE_ENV === 'production') {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Bavaxe" <${process.env.SMTP_USER}>`,
          to: email,
          subject: '🔐 Şifre Sıfırlama Kodu - Bavaxe',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%); padding: 40px; text-align: center;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 1px;">BAVAXE</h1>
                          <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Konum Takip Sistemi</p>
                        </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 700;">Şifre Sıfırlama</h2>
                          <p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                            Merhaba <strong style="color: #0EA5E9;">${user.name || 'Kullanıcı'}</strong>,
                          </p>
                          <p style="margin: 0 0 32px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                            Şifre sıfırlama talebiniz alındı. Aşağıdaki doğrulama kodunu kullanarak yeni şifrenizi belirleyebilirsiniz:
                          </p>
                          
                          <!-- Code Box -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                            <tr>
                              <td style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%); border: 2px solid rgba(14, 165, 233, 0.3); border-radius: 16px; padding: 32px; text-align: center;">
                                <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Doğrulama Kodu</p>
                                <h1 style="margin: 0; color: #0EA5E9; font-size: 48px; font-weight: 800; letter-spacing: 12px; font-family: 'Courier New', monospace;">${code}</h1>
                              </td>
                            </tr>
                          </table>
                          
                          <!-- Info Box -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                            <tr>
                              <td style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px;">
                                <p style="margin: 0; color: #fbbf24; font-size: 14px; line-height: 1.6;">
                                  ⏱️ Bu kod <strong>15 dakika</strong> geçerlidir.
                                </p>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                            Eğer bu talebi siz yapmadıysanız, bu e-postayı güvenle görmezden gelebilirsiniz. Hesabınız güvendedir.
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
                            Bu otomatik bir e-postadır, lütfen yanıtlamayın.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });
      } catch (emailError) {
        console.error('[Reset] Email send error:', emailError);
        // Continue even if email fails
      }
    } else {
      // Development: Log code to console
      console.log(`\n🔐 [PASSWORD RESET] Code for ${email}: ${code}\n`);
    }

    res.json(ResponseFormatter.success({}, 'Doğrulama kodu e-postanıza gönderildi.'));
  } catch (error) {
    console.error('[Reset] Request error:', error);
    res.status(500).json(ResponseFormatter.error('Bir hata oluştu.', 'SERVER_ERROR'));
  }
}));

// Verify reset code
router.post('/api/auth/reset/verify', asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const { email, code } = req.body;

  if (!email || !code || !/^\d{6}$/.test(code)) {
    return res.status(400).json(ResponseFormatter.error('Geçersiz e-posta veya kod.', 'INVALID_INPUT'));
  }

  try {
    const db = req.db;

    // Find valid code
    const result = await db.query(
      `SELECT * FROM password_reset_codes 
       WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase(), code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json(ResponseFormatter.error('Geçersiz veya süresi dolmuş kod.', 'INVALID_CODE'));
    }

    res.json(ResponseFormatter.success({}, 'Kod başarıyla doğrulandı.'));
  } catch (error) {
    console.error('[Reset] Verify error:', error);
    res.status(500).json(ResponseFormatter.error('Bir hata oluştu.', 'SERVER_ERROR'));
  }
}));

// Confirm password reset
router.post('/api/auth/reset/confirm', asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json(ResponseFormatter.error('Tüm alanları doldurun.', 'MISSING_FIELDS'));
  }

  if (newPassword.length < 6) {
    return res.status(400).json(ResponseFormatter.error('Şifre en az 6 karakter olmalıdır.', 'WEAK_PASSWORD'));
  }

  try {
    const db = req.db;

    // Find and validate code
    const codeResult = await db.query(
      `SELECT * FROM password_reset_codes 
       WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase(), code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json(ResponseFormatter.error('Geçersiz veya süresi dolmuş kod.', 'INVALID_CODE'));
    }

    const resetCode = codeResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await db.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, resetCode.user_id]
    );

    // Mark code as used
    await db.query('UPDATE password_reset_codes SET used = TRUE WHERE id = $1', [resetCode.id]);

    // Delete all other codes for this user
    await db.query('DELETE FROM password_reset_codes WHERE email = $1 AND id != $2', [email.toLowerCase(), resetCode.id]);

    res.json(ResponseFormatter.success({}, 'Şifreniz başarıyla sıfırlandı.'));
  } catch (error) {
    console.error('[Reset] Confirm error:', error);
    res.status(500).json(ResponseFormatter.error('Bir hata oluştu.', 'SERVER_ERROR'));
  }
}));

// Resend password reset code
router.post('/api/auth/reset/resend', resetRateLimiter, asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json(ResponseFormatter.error('Geçerli bir e-posta adresi girin.', 'INVALID_EMAIL'));
  }

  try {
    const db = req.db;

    // Check if user exists
    const userResult = await db.query('SELECT id, email, name FROM users WHERE email = $1', [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json(ResponseFormatter.success({}, 'Eğer bu e-posta kayıtlıysa, doğrulama kodu gönderildi.'));
    }

    const user = userResult.rows[0];

    // Generate new 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete old codes for this user
    await db.query('DELETE FROM password_reset_codes WHERE email = $1', [email.toLowerCase()]);

    // Insert new code
    await db.query(
      'INSERT INTO password_reset_codes (user_id, email, code, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, email.toLowerCase(), code, expiresAt]
    );

    // Send email (in development, log to console)
    if (process.env.NODE_ENV === 'production') {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Bavaxe" <${process.env.SMTP_USER}>`,
          to: email,
          subject: '🔐 Şifre Sıfırlama Kodu - Bavaxe',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%); padding: 40px; text-align: center;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 1px;">BAVAXE</h1>
                          <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Konum Takip Sistemi</p>
                        </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 700;">Şifre Sıfırlama</h2>
                          <p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                            Merhaba <strong style="color: #0EA5E9;">${user.name || 'Kullanıcı'}</strong>,
                          </p>
                          <p style="margin: 0 0 32px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                            Şifre sıfırlama talebiniz alındı. Aşağıdaki doğrulama kodunu kullanarak yeni şifrenizi belirleyebilirsiniz:
                          </p>
                          
                          <!-- Code Box -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                            <tr>
                              <td style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%); border: 2px solid rgba(14, 165, 233, 0.3); border-radius: 16px; padding: 32px; text-align: center;">
                                <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Doğrulama Kodu</p>
                                <h1 style="margin: 0; color: #0EA5E9; font-size: 48px; font-weight: 800; letter-spacing: 12px; font-family: 'Courier New', monospace;">${code}</h1>
                              </td>
                            </tr>
                          </table>
                          
                          <!-- Info Box -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                            <tr>
                              <td style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px;">
                                <p style="margin: 0; color: #fbbf24; font-size: 14px; line-height: 1.6;">
                                  ⏱️ Bu kod <strong>15 dakika</strong> geçerlidir.
                                </p>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                            Eğer bu talebi siz yapmadıysanız, bu e-postayı güvenle görmezden gelebilirsiniz. Hesabınız güvendedir.
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
                            Bu otomatik bir e-postadır, lütfen yanıtlamayın.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });
      } catch (emailError) {
        console.error('[Reset] Email send error:', emailError);
        // Continue even if email fails
      }
    } else {
      // Development: Log code to console
      console.log(`\n🔐 [PASSWORD RESET - RESEND] Code for ${email}: ${code}\n`);
    }

    res.json(ResponseFormatter.success({}, 'Yeni doğrulama kodu e-postanıza gönderildi.'));
  } catch (error) {
    console.error('[Reset] Resend error:', error);
    res.status(500).json(ResponseFormatter.error('Bir hata oluştu.', 'SERVER_ERROR'));
  }
}));



router.get('/users/me', requireAuth, require('../modules/auth/auth.controller').getProfile.bind(require('../modules/auth/auth.controller')));
router.post('/users/update-onesignal-id', requireAuth, require('../modules/auth/auth.controller').updateOnesignalPlayerId.bind(require('../modules/auth/auth.controller')));

// Avatar upload and delete routes
const { uploadAvatar } = require('../middleware/upload.middleware');
router.post('/users/me/avatar', requireAuth, uploadAvatar, require('../modules/auth/auth.controller').uploadAvatar.bind(require('../modules/auth/auth.controller')));
router.delete('/users/me/avatar', requireAuth, require('../modules/auth/auth.controller').deleteAvatar.bind(require('../modules/auth/auth.controller')));

// Serve uploaded avatar images
router.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));

// Profile Routes - Professional Backend Integration
router.get('/api/profile/:userId', requireAuth, validateUserId, asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const { userId } = req.params;

  // Verify user can access this profile
  if (req.user.id !== userId && !req.user.isAdmin) {
    return res.status(403).json(ResponseFormatter.error('Access denied', 'FORBIDDEN'));
  }

  try {
    const db = req.db;

    // Fetch user profile
    const userResult = await db.query(
      'SELECT id, name, email, avatar, phone, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json(ResponseFormatter.error('User not found', 'USER_NOT_FOUND'));
    }

    const user = userResult.rows[0];

    // Fetch user stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(DISTINCT device_id) as total_devices,
        COUNT(*) as total_locations,
        COALESCE(SUM(CASE WHEN timestamp > NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0) as locations_24h
      FROM locations 
      WHERE user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0] || { total_devices: 0, total_locations: 0, locations_24h: 0 };

    res.json(ResponseFormatter.success({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        memberSince: user.created_at
      },
      stats: {
        devices: parseInt(stats.total_devices) || 0,
        locations: parseInt(stats.total_locations) || 0,
        active24h: parseInt(stats.locations_24h) || 0
      }
    }));
  } catch (error) {
    console.error('[Profile] Error:', error);
    res.status(500).json(ResponseFormatter.error('Failed to fetch profile', 'PROFILE_ERROR'));
  }
}));

router.put('/api/profile/:userId', requireAuth, validateUserId, asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const { userId } = req.params;
  const { name, phone } = req.body;

  // Verify user can update this profile
  if (req.user.id !== userId) {
    return res.status(403).json(ResponseFormatter.error('Access denied', 'FORBIDDEN'));
  }

  try {
    const db = req.db;

    // Update user profile
    const result = await db.query(
      'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = NOW() WHERE id = $3 RETURNING id, name, email, phone, avatar',
      [name, phone, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(ResponseFormatter.error('User not found', 'USER_NOT_FOUND'));
    }

    res.json(ResponseFormatter.success({
      user: result.rows[0]
    }, 'Profile updated successfully'));
  } catch (error) {
    console.error('[Profile] Update error:', error);
    res.status(500).json(ResponseFormatter.error('Failed to update profile', 'UPDATE_ERROR'));
  }
}));

router.get('/api/profile/:userId/stats', requireAuth, validateUserId, asyncHandler(async (req, res) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  const { userId } = req.params;

  // Verify user can access stats
  if (req.user.id !== userId && !req.user.isAdmin) {
    return res.status(403).json(ResponseFormatter.error('Access denied', 'FORBIDDEN'));
  }

  try {
    const db = req.db;

    // Comprehensive stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(DISTINCT device_id) as total_devices,
        COUNT(*) as total_locations,
        COALESCE(SUM(CASE WHEN timestamp > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) as locations_week,
        COALESCE(SUM(CASE WHEN timestamp > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) as locations_month
      FROM locations 
      WHERE user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0] || {};

    res.json(ResponseFormatter.success({
      devices: parseInt(stats.total_devices) || 0,
      totalLocations: parseInt(stats.total_locations) || 0,
      lastWeek: parseInt(stats.locations_week) || 0,
      lastMonth: parseInt(stats.locations_month) || 0
    }));
  } catch (error) {
    console.error('[Profile] Stats error:', error);
    res.status(500).json(ResponseFormatter.error('Failed to fetch stats', 'STATS_ERROR'));
  }
}));

// Profile Stats Route
const profileStatsController = require('../controllers/profileStatsController');
router.get('/api/profile/stats', requireAuth, asyncHandler(profileStatsController.getStats.bind(profileStatsController)));

// Articles Routes
const articlesController = require('../controllers/articlesController');
router.get('/articles', asyncHandler(articlesController.getArticles.bind(articlesController)));
router.get('/api/articles', asyncHandler(articlesController.getArticles.bind(articlesController)));
router.get('/api/articles/featured', asyncHandler(articlesController.getFeaturedArticles.bind(articlesController)));
router.get('/api/articles/:id', asyncHandler(articlesController.getArticleById.bind(articlesController)));

// Shopier Payment Routes
const shopierController = require('../controllers/shopierController');
router.post('/billing/shopier/checkout', requireAuth, asyncHandler(shopierController.createCheckout.bind(shopierController)));
router.get('/billing/shopier/status/:transactionId', requireAuth, asyncHandler(shopierController.checkStatus.bind(shopierController)));
router.post('/billing/shopier/webhook', asyncHandler(shopierController.webhook.bind(shopierController)));

// Card Validation Routes
const cardValidationController = require('../controllers/cardValidationController');
router.post('/billing/validate-card', requireAuth, asyncHandler(cardValidationController.validateCard.bind(cardValidationController)));

const locationController = require('../controllers/locationController');
// Import validation schemas
const { schemas, validate } = require('../core/schemas/apiSchemas');

router.post('/location/store',
  requireAuth,
  validate(schemas.storeLocation),
  asyncHandler(locationController.storeLocation.bind(locationController))
);
router.post('/locations',
  requireAuth,
  validate(schemas.storeLocation),
  asyncHandler(locationController.storeLocation.bind(locationController))
);
router.get('/location/analytics/advanced', locationController.getAdvancedAnalytics.bind(locationController));
router.post('/location/share', requireAuth, locationController.createShareLink.bind(locationController));
router.get('/location/find-by-phone', requireAuth, locationController.findLocationByPhone.bind(locationController));
router.get('/location/:deviceId', requireAuth, validateDeviceId, asyncHandler(locationController.getLocationHistory.bind(locationController)));
router.get('/locations/:deviceId/recent', requireAuth, validateDeviceId, asyncHandler(locationController.getRecentLocations.bind(locationController)));
router.get('/location/:deviceId/latest', requireAuth, validateDeviceId, asyncHandler(locationController.getLatestLocation.bind(locationController)));
router.get('/locations/latest', requireAuth, locationController.getLatestLocations.bind(locationController));
router.get('/location/:deviceId/stats', requireAuth, locationController.getLocationStats.bind(locationController));
router.get('/location/:deviceId/route-optimized', requireAuth, locationController.getRouteOptimized.bind(locationController));
router.get('/location/:deviceId/geofence', requireAuth, locationController.checkGeofence.bind(locationController));
router.get('/location/:deviceId/recommendations', requireAuth, locationController.getTrackingRecommendations.bind(locationController));
router.get('/active', requireAuth, locationController.getActiveDevices.bind(locationController));
router.delete('/location/:deviceId', requireAuth, locationController.deleteLocationData.bind(locationController));
router.get('/devices', requireAuth, locationController.getAllDevices.bind(locationController));

const analyticsController = require('../controllers/analyticsController');
const { requirePremium, requireBusiness, checkFeature } = require('../middleware/premiumCheck');
router.get('/analytics/:deviceId/daily', requireAuth, validateDeviceId, analyticsController.getDailyStats.bind(analyticsController));
router.get('/analytics/:deviceId/weekly', requireAuth, validateDeviceId, analyticsController.getWeeklyStats.bind(analyticsController));
router.get('/analytics/:deviceId/monthly', requireAuth, validateDeviceId, analyticsController.getMonthlyStats.bind(analyticsController));
router.get('/analytics/:deviceId/heatmap', requireAuth, validateDeviceId, requirePremium('Heatmap analytics'), analyticsController.getHeatmapData.bind(analyticsController));
router.get('/analytics/:deviceId/speed', requireAuth, validateDeviceId, requirePremium('Speed analysis'), analyticsController.getSpeedAnalysis.bind(analyticsController));

router.get('/location/:deviceId/analytics', requireAuth, requirePremium('Location analytics'), locationController.getLocationAnalytics.bind(locationController));
router.get('/location/:deviceId/route-metrics', requireAuth, requirePremium('Route metrics'), locationController.getRouteMetrics.bind(locationController));
router.get('/location/:deviceId/quality', requireAuth, locationController.getLocationQuality.bind(locationController));
router.get('/location/:deviceId/prediction', requireAuth, requirePremium('Location prediction'), locationController.getLocationPrediction.bind(locationController));
router.get('/location/share/:shareToken', locationController.getSharedLocation.bind(locationController));
router.post('/location/live/start', requireAuth, locationController.startLiveLocation.bind(locationController));
router.post('/location/family/add', requireAuth, locationController.addFamilyMember.bind(locationController));
router.get('/location/family', requireAuth, locationController.getFamilyLocations.bind(locationController));
router.post('/location/delivery/create', requireAuth, locationController.createDelivery.bind(locationController));
router.get('/location/deliveries', requireAuth, locationController.getDeliveries.bind(locationController));
router.put('/location/delivery/:deliveryId/status', requireAuth, validateDeliveryId, locationController.updateDeliveryStatus.bind(locationController));
router.post('/location/route/save', requireAuth, locationController.saveRoute.bind(locationController));
router.get('/location/routes', requireAuth, locationController.listRoutes.bind(locationController));
router.post('/location/validate-input', requireAuth, locationController.validateInput.bind(locationController));

// Vehicle Tracking Routes
router.post('/vehicles/session/start', requireAuth, asyncHandler(locationController.startVehicleSession.bind(locationController)));
router.post('/vehicles/session/:sessionId/end', requireAuth, asyncHandler(locationController.endVehicleSession.bind(locationController)));
router.post('/vehicles/speed-violation', requireAuth, asyncHandler(locationController.recordSpeedViolation.bind(locationController)));
router.get('/vehicles/sessions', requireAuth, asyncHandler(locationController.getVehicleSessions.bind(locationController)));
router.get('/groups/:groupId/vehicles', requireAuth, validateGroupId, asyncHandler(locationController.getGroupVehicles.bind(locationController)));

// Messaging Controller
const messagingController = require('../controllers/messagingController');
router.post('/messages/send',
  requireAuth,
  validate(schemas.sendMessage),
  asyncHandler(messagingController.sendMessage.bind(messagingController))
);
router.get('/messages', requireAuth, asyncHandler(messagingController.getMessages.bind(messagingController)));
router.get('/messages/conversations', requireAuth, asyncHandler(messagingController.getConversations.bind(messagingController)));
router.put('/messages/:messageId/read', requireAuth, asyncHandler(messagingController.markAsRead.bind(messagingController)));

// Dashboard Routes
const dashboardController = require('../controllers/dashboardController');
router.get('/api/dashboard', requireAuth, asyncHandler(dashboardController.getDashboard.bind(dashboardController)));
router.get('/api/dashboard/activities', requireAuth, asyncHandler(dashboardController.getActivities.bind(dashboardController)));
router.get('/api/dashboard/stats', requireAuth, asyncHandler(dashboardController.getStats.bind(dashboardController)));
// Legacy dashboard routes (for backward compatibility)
router.get('/dashboard/:userId', requireAuth, validateUserId, dashboardController.getDashboard.bind(dashboardController));
router.get('/dashboard', requireAuth, dashboardController.getDashboard.bind(dashboardController));
router.get('/stats', requireAuth, dashboardController.getStats.bind(dashboardController));
router.put('/messages/read-all', requireAuth, asyncHandler(messagingController.markAllAsRead.bind(messagingController)));
router.delete('/messages/:messageId', requireAuth, asyncHandler(messagingController.deleteMessage.bind(messagingController)));

// Legacy location message endpoints (kept for backward compatibility)
router.post('/location/message/send', requireAuth, locationController.sendMessage.bind(locationController));
router.get('/location/messages', requireAuth, locationController.getMessages.bind(locationController));
router.post('/location/message/location', requireAuth, locationController.sendLocationMessage.bind(locationController));
router.get('/location/metrics', requireAuth, locationController.getMetrics.bind(locationController));
router.get('/location/health', requireAuth, locationController.getHealthStatus.bind(locationController));
router.get('/location/performance', requireAuth, locationController.getPerformanceStats.bind(locationController));
router.get('/location/vehicle/track', requireAuth, locationController.trackVehicle.bind(locationController));
router.get('/location/vehicle/status', requireAuth, locationController.getVehicleStatus.bind(locationController));
router.get('/location/vehicle/history', requireAuth, locationController.getVehicleHistory.bind(locationController));
router.get('/location/vehicle/group', requireAuth, locationController.getGroupVehicles.bind(locationController));
router.get('/location/activity/status', requireAuth, locationController.getActivityStatus.bind(locationController));
router.post('/location/geocode', requireAuth, locationController.geocodeAddress.bind(locationController));
router.get('/location/geocode', requireAuth, asyncHandler(locationController.reverseGeocode.bind(locationController)));

// Steps Module - Background tracking with notifications
router.use('/steps', require('../modules/steps/steps.routes'));

const systemController = require('../controllers/systemController');
router.get('/system/info', systemController.getSystemInfo.bind(systemController));
router.post('/system/backup', systemController.createBackup.bind(systemController));
router.get('/system/backups', systemController.listBackups.bind(systemController));

const adminController = require('../controllers/adminController');
router.post('/admin/reset-all', adminController.resetAllData.bind(adminController));

const blogController = require('../controllers/blogController');
router.get('/articles', blogController.getAllArticles.bind(blogController));
router.get('/articles/search', blogController.searchArticles.bind(blogController));
router.get('/articles/categories', blogController.getCategories.bind(blogController));
router.get('/articles/tags', blogController.getTags.bind(blogController));
router.get('/articles/featured', blogController.getFeaturedArticles.bind(blogController));
router.get('/articles/popular', blogController.getPopularArticles.bind(blogController));
router.get('/articles/slug/:slug', blogController.getArticleBySlug.bind(blogController));
router.get('/articles/:id', validateArticleId, blogController.getArticleById.bind(blogController));
router.post('/articles', blogController.createArticle.bind(blogController));
router.put('/articles/:id', validateArticleId, blogController.updateArticle.bind(blogController));
router.delete('/articles/:id', validateArticleId, blogController.deleteArticle.bind(blogController));

const notificationsController = require('../controllers/notificationsController');
router.get('/notifications', notificationsController.list.bind(notificationsController));
router.post('/notifications/read-all', notificationsController.markAllRead.bind(notificationsController));
router.post('/notifications/:id/read', notificationsController.markRead.bind(notificationsController));
router.post('/notifications/push', notificationsController.sendPush.bind(notificationsController));
router.post('/notifications/test-onesignal', requireAuth, notificationsController.testOneSignal.bind(notificationsController));
router.get('/notifications/onesignal-status', requireAuth, notificationsController.getOneSignalStatus.bind(notificationsController));

const billingController = require('../controllers/billingController');
router.get('/plans', billingController.getPlans.bind(billingController)); // Public endpoint
router.get('/billing/plans', billingController.getPlans.bind(billingController)); // Public endpoint
router.get('/me/subscription', requireAuth, billingController.getMySubscription.bind(billingController));
router.post('/me/subscription/cancel', requireAuth, billingController.cancelSubscription.bind(billingController));
router.post('/me/subscription/renew', requireAuth, billingController.renewSubscription.bind(billingController));
router.put('/me/subscription/change-plan', requireAuth, billingController.changePlan.bind(billingController));

// New subscription endpoints
router.get('/subscription/usage', requireAuth, billingController.getUsageStats.bind(billingController));
router.get('/subscription/comparison', billingController.getPlanComparison.bind(billingController)); // Public
router.get('/subscription/upgrade-eligibility', requireAuth, billingController.checkUpgradeEligibility.bind(billingController));
router.post('/subscription/check-feature', requireAuth, billingController.checkFeatureAccess.bind(billingController));

router.post('/checkout', billingController.checkout.bind(billingController));
router.post('/billing/checkout', billingController.checkout.bind(billingController));
router.post('/billing/subscribe', billingController.subscribe.bind(billingController));
const { validatePaymentRequest } = require('../middleware/paymentValidation');
const { paymentRateLimiter, sanitizeCardData } = require('../middleware/paymentSecurity');
router.post('/payment/process', paymentRateLimiter, sanitizeCardData, validatePaymentRequest, billingController.processPayment.bind(billingController));
router.get('/payment/:paymentId/status', validatePaymentId, billingController.getPaymentStatus.bind(billingController));
router.get('/billing/history', billingController.getHistory.bind(billingController));
router.get('/billing/receipts', billingController.getReceipts.bind(billingController));
router.get('/billing/receipt/:receiptNumber', billingController.getReceipt.bind(billingController));
router.get('/checkout/mock/:sessionId', billingController.mockCheckoutPage.bind(billingController));
router.post('/payment/callback', billingController.paymentCallback.bind(billingController));
router.get('/payment/callback', billingController.paymentCallback.bind(billingController));
router.get('/payment/callback/:type', billingController.paymentCallback.bind(billingController));
router.post('/webhook/payment', billingController.handleWebhook.bind(billingController));

router.post('/billing/shopier/checkout', requireAuth, billingController.shopierCheckout.bind(billingController));
router.post('/webhook/shopier', billingController.shopierWebhook.bind(billingController));
router.get('/billing/shopier/status/:transactionId', requireAuth, billingController.shopierStatus.bind(billingController));

// Enhanced Shopier webhook routes
const shopierWebhookController = require('../controllers/shopierWebhookController');
router.post('/webhook/shopier/v2', shopierWebhookController.handleWebhook.bind(shopierWebhookController));
router.get('/webhook/shopier/status', shopierWebhookController.getWebhookStatus.bind(shopierWebhookController));
router.post('/webhook/shopier/retry/:transactionId', requireAuth, shopierWebhookController.retryPayment.bind(shopierWebhookController));


const { checkLimit } = require('../core/middleware/subscriptionCheck');
const groupController = require('../controllers/groupController');
router.post('/groups',
  requireAuth,
  checkLimit('maxGroups'),
  validate(schemas.createGroup),
  asyncHandler(groupController.createGroup.bind(groupController))
);
router.get('/groups/user/:userId/admin', requireAuth, validateUserId, groupController.getGroupsByAdmin.bind(groupController));
router.get('/groups/user/:userId', requireAuth, validateUserId, groupController.getActiveGroupsForUser.bind(groupController)); // Alias for active groups
router.get('/groups/user/:userId/active', requireAuth, validateUserId, groupController.getActiveGroupsForUser.bind(groupController));
router.get('/groups/:groupId/requests', requireAuth, groupController.getRequests.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/approve', requireAuth, validateGroupId, validateRequestId, groupController.approveRequest.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/reject', requireAuth, validateGroupId, validateRequestId, groupController.rejectRequest.bind(groupController));
router.get('/groups/:groupId/members-with-locations', requireAuth, validateGroupId, asyncHandler(groupController.getMembersWithLocations.bind(groupController)));
router.get('/groups/:groupId/members', requireAuth, validateGroupId, asyncHandler(groupController.getMembers.bind(groupController)));
router.post('/groups/:groupId/locations', requireAuth, validateGroupId, validateCoordinates, asyncHandler(groupController.recordGroupLocation.bind(groupController)));
router.get('/groups/:groupId/locations', requireAuth, validateGroupId, asyncHandler(groupController.getGroupLocations.bind(groupController)));

// Group messages
router.get('/groups/:groupId/messages', requireAuth, validateGroupId, asyncHandler(groupController.getMessages.bind(groupController)));
router.post('/groups/:groupId/messages', requireAuth, validateGroupId, asyncHandler(groupController.sendMessage.bind(groupController)));
router.delete('/groups/:groupId/messages/:messageId', requireAuth, validateGroupId, asyncHandler(groupController.deleteMessage.bind(groupController)));

// Message read receipts
router.put('/groups/:groupId/messages/:messageId/read', requireAuth, validateGroupId, asyncHandler(groupController.markMessageAsRead.bind(groupController)));
router.get('/groups/:groupId/unread-count', requireAuth, validateGroupId, asyncHandler(groupController.getUnreadCount.bind(groupController)));

router.post('/groups/:groupId/leave', requireAuth, groupController.leaveGroup.bind(groupController));
router.post('/groups/:groupId/transfer-admin', requireAuth, groupController.transferAdmin.bind(groupController));
router.delete('/groups/:groupId', requireAuth, groupController.deleteGroup.bind(groupController));
router.get('/groups/:code/info', groupController.getGroupInfoByCode.bind(groupController));
router.post('/groups/:code/join-request', requireAuth, groupController.createJoinRequestByCode.bind(groupController));
router.post('/groups/user/:userId/leave-all', requireAuth, validateUserId, groupController.leaveAllGroups.bind(groupController));
router.post('/user/:userId/purge', requireAuth, groupController.purgeUserData.bind(groupController));

const mapController = require('../controllers/mapController');
router.get('/map/features', requireAuth, mapController.getMapFeatures.bind(mapController));
router.get('/map/layers', requireAuth, mapController.getMapLayers.bind(mapController));
router.post('/map/export', requireAuth, mapController.exportMap.bind(mapController));

const activityController = require('../controllers/activityController');
router.get('/activities', requireAuth, activityController.getActivities.bind(activityController));
router.get('/activities/stats', requireAuth, activityController.getActivityStats.bind(activityController));
router.get('/groups/:groupId/activities', requireAuth, activityController.getGroupActivities.bind(activityController));

const microservicesController = require('../controllers/microservicesController');
const analyticsProcessingService = require('../services/analyticsProcessingService');
const reportsService = require('../services/reportsService');

router.get('/microservices/status', microservicesController.getServiceStatus.bind(microservicesController));
router.get('/microservices/analytics/:userId', microservicesController.getAnalytics.bind(microservicesController));
router.post('/microservices/reports/:userId', microservicesController.generateReport.bind(microservicesController));
router.post('/microservices/location/batch', microservicesController.processLocationBatch.bind(microservicesController));
router.post('/microservices/notifications/process', microservicesController.processNotifications.bind(microservicesController));
router.get('/microservices/notifications/stats/:userId', microservicesController.getNotificationStats.bind(microservicesController));
router.post('/microservices/billing/process', microservicesController.processBilling.bind(microservicesController));
router.get('/microservices/billing/history/:userId', microservicesController.getBillingHistory.bind(microservicesController));
router.post('/microservices/reports/generate', microservicesController.generateReportNew.bind(microservicesController));
router.get('/microservices/reports/list/:userId', microservicesController.listReports.bind(microservicesController));

router.get('/api/analytics/:user_id', requireAuth, requirePremium('Analytics'), asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const userId = req.user?.id;
  const dateRange = req.query.date_range || req.headers['x-date-range'] || '7d';
  const analytics = await analyticsProcessingService.fetchAnalyticsData(user_id, dateRange);

  const activityLogService = require('../services/activityLogService');
  if (userId) {
    activityLogService.logActivity(userId, 'analytics', 'view_analytics', {
      targetUserId: user_id,
      dateRange,
      path: req.path
    });
  }

  res.json({
    user_id,
    date_range: dateRange,
    summary: analytics?.summary || {},
    trends: analytics?.trends || {},
    predictions: analytics?.predictions || {},
    insights: analytics?.insights || [],
    anomalies: analytics?.anomalies || []
  });
}));

router.post('/api/analytics/predict', requireAuth, requirePremium('Route prediction'), asyncHandler(async (req, res) => {
  const { user_id, locations, prediction_type = 'route' } = req.body;
  const userId = req.user?.id;
  const predictions = await analyticsProcessingService.mlPredictRoute(user_id, locations || [], prediction_type);

  const activityLogService = require('../services/activityLogService');
  if (userId) {
    activityLogService.logActivity(userId, 'analytics', 'predict_route', {
      targetUserId: user_id,
      prediction_type,
      locationCount: locations?.length || 0,
      path: req.path
    });
  }

  res.json({
    user_id,
    prediction_type,
    predictions: predictions || {},
    confidence: predictions?.confidence || 0.0
  });
}));

router.get('/api/analytics/insights/:user_id', requireAuth, requirePremium('Analytics insights'), asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const userId = req.user?.id;
  const dateRange = req.query.date_range || '30d';
  const analytics = await analyticsProcessingService.fetchAnalyticsData(user_id, dateRange);
  const insights = await analyticsProcessingService.generateInsights(user_id, analytics);
  const recommendations = await analyticsProcessingService.generateRecommendations(user_id, insights);

  const activityLogService = require('../services/activityLogService');
  if (userId) {
    activityLogService.logActivity(userId, 'analytics', 'view_insights', {
      targetUserId: user_id,
      dateRange,
      path: req.path
    });
  }

  res.json({
    user_id,
    insights: insights || [],
    recommendations: recommendations || [],
    generated_at: new Date().toISOString()
  });
}));

router.post('/api/reports/generate', requireAuth, requirePremium('Report generation'), asyncHandler(async (req, res) => {
  const { user_id, report_type, date_range, format } = req.body;
  const userId = req.user?.id;

  if (!user_id || !report_type) {
    return res.status(400).json({ error: 'user_id and report_type required' });
  }

  const report = await reportsService.generateReport(user_id, report_type, date_range, format);

  const activityLogService = require('../services/activityLogService');
  if (userId) {
    activityLogService.logActivity(userId, 'reports', 'generate_report', {
      targetUserId: user_id,
      report_type,
      format,
      path: req.path
    });
  }

  res.json(report || {});
}));

router.get('/api/reports/list', requireAuth, asyncHandler(async (req, res) => {
  const { user_id } = req.query;
  const userId = req.user?.id;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  const reports = await reportsService.listReports(user_id);

  const activityLogService = require('../services/activityLogService');
  if (userId) {
    activityLogService.logActivity(userId, 'reports', 'view_reports', {
      targetUserId: user_id,
      reportCount: reports?.length || 0,
      path: req.path
    });
  }

  res.json(reports || []);
}));

router.get('/api/reports/download/:reportId', requireAuth, validateReportId, asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  const reportData = await reportsService.downloadReport(reportId);

  const activityLogService = require('../services/activityLogService');
  if (userId) {
    activityLogService.logActivity(userId, 'reports', 'download_report', {
      reportId,
      path: req.path
    });
  }

  res.json(reportData || {});
}));

const crossPageController = require('../controllers/crossPageController');
router.get('/navigation/data', requireAuth, crossPageController.getNavigationData.bind(crossPageController));
router.get('/page/context', requireAuth, crossPageController.getPageContext.bind(crossPageController));
router.post('/pages/share', requireAuth, crossPageController.shareDataBetweenPages.bind(crossPageController));
router.get('/pages/shared', requireAuth, crossPageController.getSharedData.bind(crossPageController));

const appConfigController = require('../controllers/appConfigController');
router.get('/app/config', appConfigController.getAppConfig.bind(appConfigController));
router.get('/app/splash', appConfigController.getSplashConfig.bind(appConfigController));

const uiController = require('../controllers/uiController');
router.post('/ui/preference', requireAuth, uiController.updateUIPreference.bind(uiController));

const scheduledTasksController = require('../controllers/scheduledTasksController');
router.post('/scheduled/trigger-check', requireAuth, scheduledTasksController.triggerManualCheck.bind(scheduledTasksController));
router.get('/scheduled/activity/:userId', requireAuth, scheduledTasksController.getUserActivity.bind(scheduledTasksController));
router.get('/scheduled/activities', requireAuth, scheduledTasksController.getAllActivities.bind(scheduledTasksController));
router.post('/scheduled/test-notification', requireAuth, scheduledTasksController.sendTestNotification.bind(scheduledTasksController));

// Attendance/Work Hours Routes
const attendanceController = require('../controllers/attendanceController');
router.post('/api/attendance/check-in', requireAuth, asyncHandler(attendanceController.checkIn.bind(attendanceController)));
router.post('/api/attendance/check-out', requireAuth, asyncHandler(attendanceController.checkOut.bind(attendanceController)));
router.get('/api/attendance/status', requireAuth, asyncHandler(attendanceController.getCurrentStatus.bind(attendanceController)));
router.get('/api/attendance/history', requireAuth, asyncHandler(attendanceController.getHistory.bind(attendanceController)));

// Vehicle Tracking Routes
const vehicleController = require('../controllers/vehicleController');
router.post('/api/vehicles', requireAuth, asyncHandler(vehicleController.createVehicle.bind(vehicleController)));
router.get('/api/vehicles', requireAuth, asyncHandler(vehicleController.getVehicles.bind(vehicleController)));
router.post('/api/vehicles/session/start', requireAuth, asyncHandler(vehicleController.startSession.bind(vehicleController)));
router.post('/api/vehicles/speed-violation', requireAuth, asyncHandler(vehicleController.logSpeedViolation.bind(vehicleController)));

// Report Routes
const reportController = require('../controllers/reportController');
router.get('/api/reports/daily', requireAuth, asyncHandler(reportController.generateDailyReport.bind(reportController)));
router.get('/api/reports/attendance', requireAuth, asyncHandler(reportController.getAttendanceReport.bind(reportController)));
router.get('/api/reports/location', requireAuth, asyncHandler(reportController.getLocationReport.bind(reportController)));

// Geofence Routes
const geofenceController = require('../controllers/geofenceController');
router.post('/api/geofences', requireAuth, asyncHandler(geofenceController.createGeofence.bind(geofenceController)));
router.get('/api/geofences', requireAuth, asyncHandler(geofenceController.getGeofences.bind(geofenceController)));
router.put('/api/geofences/:id', requireAuth, asyncHandler(geofenceController.updateGeofence.bind(geofenceController)));
router.delete('/api/geofences/:id', requireAuth, asyncHandler(geofenceController.deleteGeofence.bind(geofenceController)));
router.post('/api/geofences/events', requireAuth, asyncHandler(geofenceController.logEvent.bind(geofenceController)));
router.get('/api/geofences/events', requireAuth, asyncHandler(geofenceController.getEvents.bind(geofenceController)));
// Pages Routes - Product, Company, Resources, Legal
const pagesController = require('../controllers/pagesController');
router.get('/app/pages/product', asyncHandler(pagesController.getProductPage.bind(pagesController)));
router.get('/app/pages/company', asyncHandler(pagesController.getCompanyPage.bind(pagesController)));
router.get('/app/pages/resources', asyncHandler(pagesController.getResourcesPage.bind(pagesController)));
router.get('/app/pages/legal', asyncHandler(pagesController.getLegalPage.bind(pagesController)));
router.get('/app/config', asyncHandler(pagesController.getAppConfig.bind(pagesController)));

// Help & Support Routes
router.use('/faq', require('./faq.routes'));
router.use('/contact', require('./contact.routes'));
router.use('/feedback', require('./feedback.routes'));


router.use((req, res, next) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  res.status(404).json(ResponseFormatter.error('Endpoint not found', 'NOT_FOUND', { path: req.path }));
});

const { handleError } = require('../core/utils/errorHandler');
router.use(handleError);

// Inactivity notification routes
router.use('/inactivity', require('./inactivity'));

module.exports = router;
