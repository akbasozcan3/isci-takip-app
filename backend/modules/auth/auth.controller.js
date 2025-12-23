const AuthService = require('./auth.service');
const UserModel = require('../../core/database/models/user.model');
const TokenModel = require('../../core/database/models/token.model');
const VerificationModel = require('../../core/database/models/verification.model');
const { requireAuth } = require('../../core/middleware/auth.middleware');
const ResponseFormatter = require('../../core/utils/responseFormatter');
const { createError } = require('../../core/utils/errorHandler');
const { OAuth2Client } = require('google-auth-library');

// Google OAuth Configuration - Use environment variable for flexibility
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '984232035409-7dauhh2jakbrf56abhooq7si1ukdp8t9o.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

class AuthController {
  async googleLogin(req, res) {
    const startTime = Date.now();
    try {
      const { idToken } = req.body;

      // Validation: Check if token exists
      if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
        console.warn('[Auth] Google login attempted without ID token');
        return res.status(400).json(
          ResponseFormatter.error('ID Token is required', 'MISSING_TOKEN')
        );
      }

      console.log('[Auth] Google login attempt started');

      // Verify Google Token
      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: idToken.trim(),
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
        console.log('[Auth] ✓ Google token verified successfully');
      } catch (verifyError) {
        console.error('[Auth] ✗ Google token verification failed:', verifyError.message);

        // Check for specific error types
        if (verifyError.message?.includes('Token used too late')) {
          return res.status(401).json(
            ResponseFormatter.error('Google token has expired. Please try again.', 'TOKEN_EXPIRED')
          );
        }
        if (verifyError.message?.includes('Invalid token signature')) {
          return res.status(401).json(
            ResponseFormatter.error('Invalid Google token signature', 'INVALID_SIGNATURE')
          );
        }

        return res.status(401).json(
          ResponseFormatter.error('Invalid Google token. Please try again.', 'INVALID_TOKEN')
        );
      }

      const { email, name, sub: googleId, picture, email_verified } = payload;

      // Validation: Email must exist
      if (!email || typeof email !== 'string') {
        console.error('[Auth] ✗ Google account has no email');
        return res.status(400).json(
          ResponseFormatter.error('Google account email not found', 'INVALID_GOOGLE_ACCOUNT')
        );
      }

      // Validation: Email should be verified by Google
      if (email_verified === false) {
        console.warn(`[Auth] ⚠️ Google email not verified: ${email}`);
        return res.status(400).json(
          ResponseFormatter.error('Please verify your Google email first', 'EMAIL_NOT_VERIFIED_GOOGLE')
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      console.log(`[Auth] Processing Google login for: ${cleanEmail}`);

      // Check if user exists
      let user;
      let isNewUser = false;

      try {
        user = UserModel.findByEmail(cleanEmail);
      } catch (dbError) {
        console.error('[Auth] ✗ Database error while finding user:', dbError.message);
        return res.status(500).json(
          ResponseFormatter.error('Database error. Please try again later.', 'DATABASE_ERROR')
        );
      }

      if (!user) {
        // Create new user
        isNewUser = true;
        console.log(`[Auth] Creating new user for: ${cleanEmail}`);

        try {
          const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
          user = UserModel.create({
            email: cleanEmail,
            password,
            name: name || 'Google User',
            displayName: name || email.split('@')[0],
            role: 'user',
            isVerified: true, // Google accounts are already verified
            googleId: googleId,
            avatar: picture || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          console.log(`[Auth] ✓ New user created successfully: ${user.id}`);
        } catch (createError) {
          console.error('[Auth] ✗ Failed to create user:', createError.message);
          return res.status(500).json(
            ResponseFormatter.error('Failed to create user account. Please try again.', 'USER_CREATE_ERROR')
          );
        }
      } else {
        console.log(`[Auth] Existing user found: ${user.id}`);

        // Update existing user with googleId if missing
        try {
          if (!user.googleId) {
            user.googleId = googleId;
            UserModel.update(user.id, { googleId, isVerified: true });
            console.log(`[Auth] ✓ Updated user ${user.id} with Google ID`);
          }

          // Update avatar from Google if we don't have one or if it's from Google
          if (picture && (!user.avatar || user.avatar.includes('googleusercontent'))) {
            user.avatar = picture;
            UserModel.update(user.id, { avatar: picture });
            console.log(`[Auth] ✓ Updated Google avatar for user ${user.id}`);
          }
        } catch (updateError) {
          console.warn(`[Auth] ⚠️ Failed to update user ${user.id}:`, updateError.message);
          // Non-critical error, continue with login
        }
      }

      // Generate App Token
      let token;
      try {
        token = AuthService.generateToken(user);
        await TokenModel.create({
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        console.log(`[Auth] ✓ Token generated for user ${user.id}`);
      } catch (tokenError) {
        console.error('[Auth] ✗ Token generation failed:', tokenError.message);
        return res.status(500).json(
          ResponseFormatter.error('Failed to generate authentication token', 'TOKEN_ERROR')
        );
      }

      // Prepare response
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name || user.displayName,
        role: user.role,
        isVerified: user.isVerified,
        subscription: user.subscription,
        avatar: user.avatar
      };

      const duration = Date.now() - startTime;
      console.log(`[Auth] ✓ Google login successful for user ${user.id} (${duration}ms)${isNewUser ? ' [NEW USER]' : ''}`);

      return res.status(200).json(ResponseFormatter.success({
        user: userData,
        token: token,
        isNewUser: isNewUser
      }, 'Google login successful'));

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Auth] ✗ Google login error (${duration}ms):`, error.message);
      console.error('[Auth] Stack trace:', error.stack);

      return res.status(500).json(
        ResponseFormatter.error(
          'An unexpected error occurred during Google login. Please try again.',
          'INTERNAL_ERROR',
          process.env.NODE_ENV === 'development' ? { details: error.message } : undefined
        )
      );
    }
  }

  async preVerifyEmail(req, res) {
    try {
      const { email } = req.body;
      if (!email || !email.trim()) {
        return res.status(400).json(ResponseFormatter.error('E-posta adresi gereklidir', 'MISSING_EMAIL'));
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!AuthService.isValidEmail(cleanEmail)) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz e-posta formatı', 'INVALID_EMAIL'));
      }

      if (AuthService.userExists(cleanEmail)) {
        return res.status(400).json(
          ResponseFormatter.error('Bu e-posta adresi zaten kayıtlıdır', 'EMAIL_ALREADY_EXISTS')
        );
      }

      const verifications = VerificationModel.getEmailVerifications(cleanEmail) || [];
      const recentVerifications = (Array.isArray(verifications) ? verifications : []).filter(v =>
        v && v.timestamp && (Date.now() - (v.timestamp || 0)) < 10 * 60 * 1000
      );

      if (recentVerifications.length >= 3) {
        return res.status(429).json(
          ResponseFormatter.rateLimitError(600, 3, 0)
        );
      }

      const code = await AuthService.sendVerificationCode(cleanEmail);

      const emailVerificationService = require('../../services/emailVerificationService');

      try {
        const result = await emailVerificationService.sendVerificationEmail(cleanEmail, code);
        console.log(`[Auth] ✓ Verification email sent to ${cleanEmail} (MessageId: ${result.messageId})`);

        return res.json(
          ResponseFormatter.success(
            { emailSent: true },
            'Doğrulama kodu e-postanıza gönderildi'
          )
        );
      } catch (error) {
        console.error(`[Auth] ✗ Failed to send verification email to ${email.trim()}:`, error.message);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Verification code for ${cleanEmail}: ${code}`);
          return res.json(ResponseFormatter.success(
            { code: code, emailSent: false, emailError: error.message },
            'Doğrulama kodu oluşturuldu (SMTP hatası - development modunda kod konsola yazdırıldı)'
          ));
        }

        return res.status(500).json(ResponseFormatter.error(
          'E-posta gönderilemedi. Lütfen SMTP ayarlarını kontrol edin veya daha sonra tekrar deneyin.',
          'EMAIL_SEND_ERROR',
          { emailError: error.message }
        ));
      }
    } catch (error) {
      console.error('[Auth] Pre-verify email error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error('Doğrulama kodu gönderilemedi', 'VERIFICATION_ERROR'));
    }
  }

  async verifyEmailCode(req, res) {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json(ResponseFormatter.error('E-posta ve kod gereklidir', 'MISSING_PARAMS'));
      }

      const verification = await AuthService.verifyCode(email, code);
      if (!verification.valid) {
        return res.status(400).json(ResponseFormatter.error(verification.error, 'INVALID_CODE'));
      }

      UserModel.verifyEmail(email);

      return res.json(ResponseFormatter.success(null, 'E-posta başarıyla doğrulandı'));
    } catch (error) {
      console.error('[Auth] Verify email code error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error('E-posta doğrulama kodu kontrol edilemedi', 'VERIFICATION_ERROR'));
    }
  }

  async register(req, res) {
    try {
      const { email, password, displayName, verificationCode } = req.body;

      if (!email || !password) {
        return res.status(400).json(ResponseFormatter.error('E-posta ve şifre gereklidir', 'MISSING_CREDENTIALS'));
      }

      if (!AuthService.isValidEmail(email.trim())) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz e-posta formatı', 'INVALID_EMAIL'));
      }

      if (!AuthService.isValidPassword(password)) {
        return res.status(400).json(ResponseFormatter.error('Şifre en az 6 karakter olmalıdır', 'INVALID_PASSWORD'));
      }

      if (!verificationCode) {
        return res.status(400).json(ResponseFormatter.error(
          'Doğrulama kodu gereklidir',
          'MISSING_VERIFICATION_CODE',
          { requiresVerification: true }
        ));
      }

      const verification = await AuthService.verifyCode(email, verificationCode);
      if (!verification.valid) {
        return res.status(400).json(ResponseFormatter.error(verification.error, 'INVALID_VERIFICATION_CODE', { requiresVerification: true }));
      }

      if (AuthService.userExists(email.trim().toLowerCase())) {
        return res.status(400).json(ResponseFormatter.error('Bu e-posta adresi zaten kayıtlıdır', 'EMAIL_ALREADY_EXISTS'));
      }

      const hashedPassword = await AuthService.hashPassword(password);
      const cleanEmail = email.trim().toLowerCase();

      const user = UserModel.create({
        email: cleanEmail,
        displayName: (displayName || email.split('@')[0]).trim(),
        username: email.split('@')[0].toLowerCase(),
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      UserModel.setPassword(cleanEmail, hashedPassword);
      UserModel.verifyEmail(cleanEmail);

      const token = AuthService.createSession(user.id, user.email, user.role);

      // OneSignal ile hoş geldiniz bildirimi gönder (yeni kayıt için)
      setImmediate(async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const onesignalService = require('../../services/onesignalService');
          const userName = user.displayName || user.name || user.email.split('@')[0] || 'Kullanıcı';

          const result = await onesignalService.sendToUser(
            user.id,
            'Hoş Geldiniz! 🎉',
            `Merhaba ${userName}, hesabınız başarıyla oluşturuldu!`,
            {
              data: {
                type: 'welcome',
                userId: user.id,
                timestamp: Date.now()
              },
              priority: 10,
              sound: 'default'
            }
          );

          if (result.success) {
            console.log(`[Auth] ✅ Welcome notification sent to new user ${user.id} (${userName})`);
          }
        } catch (notificationError) {
          console.warn(`[Auth] ⚠️ Failed to send welcome notification to new user ${user.id}:`, notificationError.message);
        }
      });

      return res.status(201).json(ResponseFormatter.success({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          email_verified: true,
          createdAt: user.createdAt
        },
        token
      }, 'Kayıt başarılı'));
    } catch (error) {
      console.error('[Auth] Register error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error(
        'Kullanıcı kaydı başarısız',
        'REGISTRATION_ERROR',
        process.env.NODE_ENV === 'development' ? { details: error.message } : null
      ));
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json(ResponseFormatter.error('E-posta ve şifre gereklidir', 'MISSING_CREDENTIALS'));
      }

      // Email format validation
      if (!AuthService.isValidEmail(email.trim())) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz e-posta formatı', 'INVALID_EMAIL'));
      }

      const cleanEmailLower = email.trim().toLowerCase();
      const user = UserModel.findByEmail(cleanEmailLower);
      if (!user || !user.id) {
        return res.status(401).json(ResponseFormatter.error('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı', 'USER_NOT_FOUND'));
      }

      if (!UserModel.isEmailVerified(cleanEmailLower)) {
        return res.status(403).json(ResponseFormatter.error(
          'E-posta doğrulanmamış',
          'EMAIL_NOT_VERIFIED',
          { requiresVerification: true, message: 'Lütfen giriş yapmadan önce e-postanızı doğrulayın' }
        ));
      }

      const hashedPassword = UserModel.getPassword(cleanEmailLower);
      if (!hashedPassword || typeof hashedPassword !== 'string') {
        return res.status(401).json(ResponseFormatter.error('Geçersiz e-posta veya şifre', 'INVALID_CREDENTIALS'));
      }

      let isValidPassword = false;
      try {
        isValidPassword = await AuthService.comparePassword(password, hashedPassword);
      } catch (compareError) {
        console.error('[Auth] Password comparison error:', compareError.message);
        return res.status(401).json(ResponseFormatter.error('Geçersiz e-posta veya şifre', 'INVALID_CREDENTIALS'));
      }

      if (!isValidPassword) {
        return res.status(401).json(ResponseFormatter.error('Geçersiz e-posta veya şifre', 'INVALID_CREDENTIALS'));
      }

      TokenModel.removeAllForUser(user.id);

      const token = AuthService.createSession(user.id, user.email, user.role);

      setImmediate(async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));

          const onesignalService = require('../../services/onesignalService');
          const userName = user.displayName || user.name || user.email.split('@')[0] || 'Kullanıcı';

          const result = await onesignalService.sendToUser(
            user.id,
            'Hoş Geldiniz! 👋',
            `Merhaba ${userName}, uygulamaya hoş geldiniz!`,
            {
              data: {
                type: 'welcome',
                userId: user.id,
                timestamp: Date.now()
              },
              priority: 10,
              sound: 'default'
            }
          );

          if (result.success) {
            console.log(`[Auth] ✅ Welcome notification sent to user ${user.id}`);
          } else if (result.error && !result.error.includes('not subscribed')) {
            console.warn(`[Auth] ⚠️ Welcome notification failed:`, result.error);
          }
        } catch (notificationError) {
          if (notificationError.message && !notificationError.message.includes('not subscribed')) {
            console.warn(`[Auth] ⚠️ Notification error:`, notificationError.message);
          }
        }
      });

      return res.json(ResponseFormatter.success({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          email_verified: true
        },
        token
      }, 'Giriş başarılı'));
    } catch (error) {
      console.error('[Auth] Login error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error('Giriş yapılamadı', 'LOGIN_ERROR'));
    }
  }

  async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        TokenModel.remove(token);
      }

      return res.json(ResponseFormatter.success(null, 'Çıkış başarılı'));
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error('Çıkış yapılamadı', 'LOGOUT_ERROR'));
    }
  }

  async getProfile(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(
          ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED')
        );
      }

      return res.json(ResponseFormatter.success({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          name: user.displayName || user.name,
          phone: user.phone || null,
          avatar: user.avatar || null,
          createdAt: user.createdAt
        }
      }));
    } catch (error) {
      console.error('[Auth] Get profile error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error('Profil bilgileri alınamadı', 'PROFILE_FETCH_ERROR'));
    }
  }

  async updateProfile(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(
          ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED')
        );
      }

      const { displayName, phone, currentPassword, newPassword, verificationCode } = req.body;

      if (newPassword) {
        let canChangePassword = false;

        if (currentPassword) {
          const hashedPassword = UserModel.getPassword(user.email);
          if (!hashedPassword) {
            return res.status(400).json(ResponseFormatter.error('Şifre bulunamadı', 'PASSWORD_NOT_FOUND'));
          }

          const isValidPassword = await AuthService.comparePassword(currentPassword, hashedPassword);
          if (!isValidPassword) {
            return res.status(400).json(ResponseFormatter.error('Mevcut şifre yanlış', 'INVALID_CURRENT_PASSWORD'));
          }
          canChangePassword = true;
        } else if (verificationCode) {
          const verification = await AuthService.verifyCode(user.email, verificationCode);
          if (!verification.valid) {
            return res.status(400).json(ResponseFormatter.error(verification.error, 'INVALID_VERIFICATION_CODE'));
          }
          canChangePassword = true;
        } else {
          return res.status(400).json(ResponseFormatter.error('Mevcut şifre veya doğrulama kodu gereklidir', 'MISSING_PASSWORD_VERIFICATION'));
        }

        if (canChangePassword) {
          if (newPassword.length < 6) {
            return res.status(400).json(ResponseFormatter.error('Yeni şifre en az 6 karakter olmalıdır', 'INVALID_PASSWORD_LENGTH'));
          }

          const newHashedPassword = await AuthService.hashPassword(newPassword);
          UserModel.setPassword(user.email, newHashedPassword);
        }
      }

      if (displayName) {
        user.displayName = displayName.trim();
      }

      if (phone !== undefined) {
        user.phone = phone ? phone.trim() : null;
      }

      const db = require('../../config/database');
      db.scheduleSave();

      return res.json(ResponseFormatter.success({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          phone: user.phone || null,
          createdAt: user.createdAt
        }
      }, newPassword ? 'Profil ve şifre başarıyla güncellendi' : 'Profil başarıyla güncellendi'));
    } catch (error) {
      console.error('[Auth] Update profile error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error('Profil güncellenemedi', 'PROFILE_UPDATE_ERROR'));
    }
  }

  async requestAccountDeletionCode(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED'));
      }

      const email = user.email;
      const phone = user.phone;

      if (!email && !phone) {
        return res.status(400).json(ResponseFormatter.error('E-posta veya telefon numarası bulunamadı', 'MISSING_CONTACT'));
      }

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Store verification code
      const verification = {
        code,
        email: email || null,
        phone: phone || null,
        type: 'account_deletion',
        timestamp: Date.now(),
        attempts: 0,
        expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
      };

      VerificationModel.addEmailVerification(email || phone, verification);

      // Send code via email or SMS
      let emailSent = false;
      let smsSent = false;
      let emailError = null;

      if (email) {
        try {
          const emailVerificationService = require('../../services/emailVerificationService');
          const result = await emailVerificationService.sendVerificationEmail(email, code, 'account_deletion');
          emailSent = result.success;
          if (emailSent) {
            console.log(`[Auth] ✓ Account deletion code sent to email ${email}`);
          } else {
            emailError = result.error || 'Email gönderilemedi';
            console.warn(`[Auth] ⚠️ Email send failed for ${email}:`, emailError);
          }
        } catch (error) {
          emailError = error.message || 'Email gönderme hatası';
          console.error(`[Auth] ✗ Failed to send deletion code to email ${email}:`, emailError);
        }
      }

      // In development, always return code even if email fails
      // In production, only return code if email was sent successfully
      const shouldReturnCode = process.env.NODE_ENV === 'development' || emailSent;

      if (phone && !emailSent) {
        // TODO: Implement SMS sending service
        // For now, log in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Account deletion code for ${phone}: ${code}`);
          smsSent = true;
        }
      }

      // If email failed, return error (both development and production)
      if (!emailSent) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Account deletion code for ${email || phone}: ${code} (logged to console only)`);
        }
        return res.status(500).json(ResponseFormatter.error(
          'Doğrulama kodu gönderilemedi. Lütfen SMTP ayarlarını kontrol edin veya daha sonra tekrar deneyin.',
          'EMAIL_SEND_ERROR',
          { emailError }
        ));
      }

      // Email sent successfully - don't return code in response
      return res.json(ResponseFormatter.success({
        emailSent: true,
        smsSent,
        method: email ? 'email' : 'sms'
      }, 'Doğrulama kodu e-posta adresinize gönderildi'));
    } catch (error) {
      console.error('[Auth] Request deletion code error:', error);
      return res.status(500).json(ResponseFormatter.error('Doğrulama kodu gönderilemedi', 'CODE_SEND_ERROR'));
    }
  }

  async deleteAccount(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED'));
      }

      // Handle DELETE requests - body might be undefined
      const body = req.body || {};
      const { code } = body;

      if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json(ResponseFormatter.error('Geçerli bir 6 haneli doğrulama kodu gereklidir', 'INVALID_CODE'));
      }

      const email = user.email;
      const phone = user.phone;
      const identifier = email || phone;

      // Verify code
      const verifications = VerificationModel.getEmailVerifications(identifier);
      const validVerification = verifications.find(v =>
        v.type === 'account_deletion' &&
        v.code === code &&
        Date.now() < v.expiresAt &&
        v.attempts < 5
      );

      if (!validVerification) {
        // Increment attempts
        if (verifications.length > 0) {
          const latest = verifications[verifications.length - 1];
          if (latest.type === 'account_deletion') {
            latest.attempts = (latest.attempts || 0) + 1;
          }
        }
        return res.status(400).json(ResponseFormatter.error('Geçersiz veya süresi dolmuş doğrulama kodu', 'INVALID_CODE'));
      }

      // Delete user account and all related data
      const userId = user.id;
      const startTime = Date.now();

      // Delete from PostgreSQL if connected (comprehensive cleanup)
      const postgres = require('../../config/postgres');
      if (postgres.isConnected && postgres.transaction) {
        try {
          // Use transaction for atomic deletion
          await postgres.transaction(async (client) => {
            // Delete all user-related data in correct order (respecting foreign keys)
            await client.query('DELETE FROM location_points WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM tracks WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM step_daily WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM geofence_events WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM attendance WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM vehicle_sessions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM speed_violations WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM daily_reports WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM devices WHERE user_id = $1', [userId]);

            // Finally delete the user
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
          });

          const duration = Date.now() - startTime;
          console.log(`[Auth] ✓ User ${userId} and all related data deleted from PostgreSQL (${duration}ms)`);
        } catch (pgError) {
          console.warn('[Auth] PostgreSQL delete failed, using JSON fallback:', pgError.message);
        }
      } else if (postgres.isConnected) {
        // Fallback: delete without transaction if transaction method not available
        try {
          await postgres.query('DELETE FROM users WHERE id = $1', [userId]);
          console.log(`[Auth] ✓ User ${userId} deleted from PostgreSQL`);
        } catch (pgError) {
          console.warn('[Auth] PostgreSQL delete failed, using JSON fallback:', pgError.message);
        }
      }

      // Delete from JSON database
      const db = require('../../config/database');

      // Remove user data
      UserModel.delete(userId);

      // Remove all tokens
      TokenModel.removeAllForUser(userId);

      // Remove verification codes
      VerificationModel.deleteEmailVerifications(identifier);

      // Remove from groups
      if (db.removeMember) {
        const groupsData = db && db.data && db.data.groups ? db.data.groups : {};
        const groups = Object.values(groupsData).filter(g =>
          g.members && g.members.includes(userId)
        );
        (Array.isArray(groups) ? groups : []).forEach(group => {
          db.removeMember(group.id, userId);
        });
      }

      // Clean up location data
      if (db.data.location_points) {
        const locationPoints = db && db.data && db.data.location_points ? db.data.location_points : {};
        Object.keys(locationPoints).forEach(key => {
          if (db.data.location_points[key]?.userId === userId) {
            delete db.data.location_points[key];
          }
        });
      }

      // Clean up tracks
      if (db.data.tracks) {
        const tracks = db && db.data && db.data.tracks ? db.data.tracks : {};
        Object.keys(tracks).forEach(key => {
          if (db.data.tracks[key]?.userId === userId) {
            delete db.data.tracks[key];
          }
        });
      }

      // Clean up step data
      if (db.data.step_daily) {
        const stepDaily = db && db.data && db.data.step_daily ? db.data.step_daily : {};
        Object.keys(stepDaily).forEach(key => {
          if (db.data.step_daily[key]?.userId === userId) {
            delete db.data.step_daily[key];
          }
        });
      }

      // Save database after cleanup
      if (db.scheduleSave) {
        db.scheduleSave();
      }

      const duration = Date.now() - startTime;
      console.log(`[Auth] ✓ Account ${userId} and all related data permanently deleted (${duration}ms)`);

      return res.json(ResponseFormatter.success(null, 'Hesabınız ve tüm verileriniz kalıcı olarak silindi'));
    } catch (error) {
      console.error('[Auth] Delete account error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      return res.status(500).json(ResponseFormatter.error('Hesap silinemedi', 'ACCOUNT_DELETE_ERROR'));
    }
  }

  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;
      if (!email || !email.trim()) {
        return res.status(400).json(
          ResponseFormatter.error('E-posta adresi gereklidir', 'MISSING_EMAIL')
        );
      }

      const cleanEmail = email.trim().toLowerCase();

      if (!AuthService.isValidEmail(cleanEmail)) {
        return res.status(400).json(
          ResponseFormatter.error('Geçersiz e-posta formatı. Lütfen geçerli bir e-posta adresi girin.', 'INVALID_EMAIL')
        );
      }

      const VerificationModel = require('../../core/database/models/verification.model');
      const recentResets = VerificationModel.getPasswordResets(cleanEmail) || [];
      const now = Date.now();
      const recentResetsArray = Array.isArray(recentResets) ? recentResets : [];
      const recentRequests = recentResetsArray.filter(r => r && (now - (r.timestamp || r.requestedAt || 0)) < 15 * 60 * 1000);

      if (recentRequests.length >= 3) {
        const timestamps = recentRequests.map(r => r && (r.timestamp || r.requestedAt || 0)).filter(t => t > 0);
        const oldestRequest = timestamps.length > 0 ? Math.min(...timestamps) : now;
        const waitTime = Math.ceil((15 * 60 * 1000 - (now - oldestRequest)) / 1000 / 60);
        const retryAfter = Math.ceil((15 * 60 * 1000 - (now - oldestRequest)) / 1000);
        return res.status(429).json(
          ResponseFormatter.rateLimitError(retryAfter, 3, 0)
        );
      }

      const user = UserModel.findByEmail(cleanEmail);
      if (!user) {
        VerificationModel.addPasswordReset(cleanEmail, {
          timestamp: now,
          requestedAt: now,
          success: false
        });
        return res.status(404).json(
          ResponseFormatter.error('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen e-posta adresinizi kontrol edin.', 'USER_NOT_FOUND')
        );
      }

      VerificationModel.addPasswordReset(cleanEmail, {
        timestamp: now,
        requestedAt: now,
        success: true
      });

      // Generate 6-digit verification code instead of token
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Store verification code for password reset
      const verification = {
        code,
        email: cleanEmail,
        type: 'password-reset',
        timestamp: Date.now(),
        attempts: 0,
        expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
      };

      VerificationModel.addEmailVerification(cleanEmail, verification);

      const emailVerificationService = require('../../services/emailVerificationService');

      try {
        const result = await emailVerificationService.sendVerificationEmail(cleanEmail, code, 'password-reset');
        console.log(`[Auth] ✓ Password reset code sent to ${cleanEmail} (MessageId: ${result.messageId})`);

        return res.json(
          ResponseFormatter.success(
            { emailSent: true },
            'Şifre sıfırlama kodu e-postanıza gönderildi. Lütfen e-posta gelen kutunuzu kontrol edin.'
          )
        );
      } catch (error) {
        console.error(`[Auth] ✗ Failed to send reset code to ${cleanEmail}:`, error.message);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Password reset code for ${cleanEmail}: ${code}`);
          return res.json(
            ResponseFormatter.success(
              { code: code, emailSent: false, emailError: error.message },
              'Şifre sıfırlama kodu oluşturuldu (SMTP hatası - development modunda kod konsola yazdırıldı).'
            )
          );
        }

        return res.status(500).json(
          ResponseFormatter.error(
            'E-posta gönderilemedi. Lütfen SMTP ayarlarını kontrol edin veya daha sonra tekrar deneyin.',
            'EMAIL_SEND_ERROR',
            { emailError: error.message }
          )
        );
      }
    } catch (error) {
      console.error('Request password reset error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Şifre sıfırlama isteği oluşturulamadı', 'PASSWORD_RESET_ERROR')
      );
    }
  }

  async verifyResetCode(req, res) {
    try {
      const { email, code } = req.body;
      if (!email || !email.trim()) {
        return res.status(400).json(
          ResponseFormatter.error('E-posta adresi gereklidir', 'MISSING_EMAIL')
        );
      }
      if (!code || !code.trim()) {
        return res.status(400).json(
          ResponseFormatter.error('Doğrulama kodu gereklidir. Lütfen e-postanızdaki 6 haneli kodu girin.', 'MISSING_CODE')
        );
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.trim();

      if (!/^\d{6}$/.test(cleanCode)) {
        return res.status(400).json(
          ResponseFormatter.error('Geçersiz kod formatı. Kod 6 haneli olmalıdır.', 'INVALID_CODE_FORMAT')
        );
      }

      // Verify code using AuthService
      const verification = await AuthService.verifyCode(cleanEmail, cleanCode);

      if (!verification.valid) {
        console.error(`[Auth] ✗ Invalid or expired reset code for ${cleanEmail}`);
        return res.status(400).json({
          success: false,
          error: verification.error || 'Kod geçersiz veya süresi dolmuş. Lütfen yeni bir şifre sıfırlama isteği gönderin.'
        });
      }

      // Check if code is for password reset
      const verifications = VerificationModel.getEmailVerifications(cleanEmail);
      const latestVerification = verifications && verifications.length > 0 ? verifications[verifications.length - 1] : null;

      if (!latestVerification || latestVerification.type !== 'password-reset') {
        return res.status(400).json({
          success: false,
          error: 'Bu kod şifre sıfırlama için geçerli değil.'
        });
      }

      const user = UserModel.findByEmail(cleanEmail);
      if (!user) {
        console.error(`[Auth] ✗ User not found for email: ${cleanEmail}`);
        return res.status(404).json({
          success: false,
          error: 'Kullanıcı bulunamadı.'
        });
      }

      console.log(`[Auth] ✓ Reset code verified for ${cleanEmail}`);
      return res.json({
        success: true,
        email: cleanEmail,
        message: 'Kod doğrulandı. Yeni şifrenizi belirleyebilirsiniz.'
      });
    } catch (error) {
      console.error('[Auth] ✗ Verify reset code error:', error);
      return res.status(500).json({
        success: false,
        error: 'Kod doğrulanırken bir hata oluştu. Lütfen tekrar deneyin.'
      });
    }
  }

  async confirmPasswordReset(req, res) {
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({
          success: false,
          error: 'E-posta adresi gereklidir.'
        });
      }

      if (!code || !code.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Doğrulama kodu gereklidir. Lütfen e-postanızdaki 6 haneli kodu girin.'
        });
      }

      if (!newPassword || (typeof newPassword === 'string' && !newPassword.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Yeni şifre gereklidir. Lütfen yeni şifrenizi girin.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.trim();

      if (!/^\d{6}$/.test(cleanCode)) {
        return res.status(400).json({
          success: false,
          error: 'Geçersiz kod formatı. Kod 6 haneli olmalıdır.'
        });
      }

      // Verify code using AuthService
      const verification = await AuthService.verifyCode(cleanEmail, cleanCode);

      if (!verification.valid) {
        console.error(`[Auth] ✗ Invalid or expired reset code in confirm for ${cleanEmail}`);
        return res.status(400).json({
          success: false,
          error: verification.error || 'Kod geçersiz veya süresi dolmuş. Lütfen yeni bir şifre sıfırlama isteği gönderin.'
        });
      }

      // Check if code is for password reset
      const verifications = VerificationModel.getEmailVerifications(cleanEmail);
      const latestVerification = verifications && verifications.length > 0 ? verifications[verifications.length - 1] : null;

      if (!latestVerification || latestVerification.type !== 'password-reset') {
        return res.status(400).json({
          success: false,
          error: 'Bu kod şifre sıfırlama için geçerli değil.'
        });
      }

      const cleanPassword = typeof newPassword === 'string' ? newPassword.trim() : String(newPassword);

      if (!AuthService.isValidPassword(cleanPassword)) {
        return res.status(400).json({
          success: false,
          error: 'Şifre en az 6 karakter olmalıdır. Lütfen daha güçlü bir şifre seçin.'
        });
      }

      const user = UserModel.findByEmail(cleanEmail);
      if (!user) {
        console.error(`[Auth] ✗ User not found for email: ${cleanEmail}`);
        return res.status(404).json({
          success: false,
          error: 'Kullanıcı bulunamadı.'
        });
      }

      const hashedPassword = await AuthService.hashPassword(cleanPassword);
      UserModel.setPassword(cleanEmail, hashedPassword);
      TokenModel.removeAllForUser(user.id);

      // Remove password reset verification codes (optional cleanup)
      // The code is already verified and used, so we can optionally clean it up
      // For now, we'll leave it for potential debugging, but it will expire in 10 minutes anyway

      console.log(`[Auth] ✓ Password reset successful for ${cleanEmail}`);
      return res.json({
        success: true,
        message: 'Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.'
      });
    } catch (error) {
      console.error('[Auth] ✗ Confirm password reset error:', error);
      if (error.message && error.message.includes('malformed')) {
        return res.status(400).json({
          success: false,
          error: 'Geçersiz token formatı. Lütfen e-postanızdaki token\'ı tam olarak kopyalayın.'
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Şifre sıfırlanırken bir hata oluştu. Lütfen tekrar deneyin.'
      });
    }
  }

  async sendPasswordChangeCode(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(
          ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED')
        );
      }

      const verifications = VerificationModel.getEmailVerifications(user.email);
      const verificationsArray = Array.isArray(verifications) ? verifications : [];
      const recentVerifications = verificationsArray.filter(v =>
        Date.now() - v.timestamp < 10 * 60 * 1000
      );

      if (recentVerifications.length >= 3) {
        return res.status(429).json(
          ResponseFormatter.rateLimitError(600, 3, 0)
        );
      }

      const code = await AuthService.sendVerificationCode(user.email);

      const emailVerificationService = require('../../services/emailVerificationService');

      try {
        const result = await emailVerificationService.sendVerificationEmail(user.email, code);
        console.log(`[Auth] ✓ Password change verification email sent to ${user.email} (MessageId: ${result.messageId})`);

        return res.json(
          ResponseFormatter.success(
            { emailSent: true },
            'Doğrulama kodu e-postanıza gönderildi'
          )
        );
      } catch (error) {
        console.error(`[Auth] ✗ Failed to send password change email to ${user.email}:`, error.message);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Password change verification code for ${user.email}: ${code}`);
          return res.json(
            ResponseFormatter.success(
              { code: code, emailSent: false, emailError: error.message },
              'Doğrulama kodu oluşturuldu (SMTP hatası - development modunda kod konsola yazdırıldı)'
            )
          );
        }

        return res.status(500).json(
          ResponseFormatter.error(
            'E-posta gönderilemedi. Lütfen SMTP ayarlarını kontrol edin veya daha sonra tekrar deneyin.',
            'EMAIL_SEND_ERROR',
            { emailError: error.message }
          )
        );
      }
    } catch (error) {
      console.error('Send password change code error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Doğrulama kodu gönderilemedi', 'CODE_SEND_ERROR')
      );
    }
  }

  async verifyPasswordChangeCode(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(
          ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED')
        );
      }

      const { code } = req.body;
      if (!code || !code.trim()) {
        return res.status(400).json(
          ResponseFormatter.error('Doğrulama kodu gereklidir', 'MISSING_CODE')
        );
      }

      const verification = await AuthService.verifyCode(user.email, code.trim());
      if (!verification.valid) {
        return res.status(400).json(
          ResponseFormatter.error(verification.error, 'INVALID_CODE')
        );
      }

      return res.json(
        ResponseFormatter.success(null, 'Doğrulama kodu başarıyla doğrulandı')
      );
    } catch (error) {
      console.error('Verify password change code error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Doğrulama kodu kontrol edilemedi', 'CODE_VERIFY_ERROR')
      );
    }
  }

  async getEmailHealth(req, res) {
    try {
      const emailVerificationService = require('../../services/emailVerificationService');
      const health = await emailVerificationService.getHealthStatus();
      return res.json(health);
    } catch (error) {
      console.error('Get email health error:', error);
      return res.status(500).json({
        status: 'ERROR',
        service: 'Email Verification Service',
        error: error.message
      });
    }
  }

  async updateOnesignalPlayerId(req, res) {
    try {
      const user = req.user;
      if (!user) {
        console.warn('[AuthController] updateOnesignalPlayerId: No user in request');
        return res.status(401).json({
          success: false,
          error: 'Token gereklidir'
        });
      }

      const { playerId, userId } = req.body;

      if (!playerId || typeof playerId !== 'string' || playerId.trim().length === 0) {
        console.warn('[AuthController] updateOnesignalPlayerId: Invalid playerId');
        return res.status(400).json({
          success: false,
          error: 'playerId gereklidir ve geçerli bir string olmalıdır'
        });
      }

      // Verify userId matches token user (if provided)
      if (userId && userId !== user.id) {
        console.warn(`[AuthController] updateOnesignalPlayerId: User ID mismatch. Token: ${user.id}, Request: ${userId}`);
        return res.status(403).json({
          success: false,
          error: 'Yetkisiz işlem'
        });
      }

      const db = require('../../config/database');
      const trimmedPlayerId = String(playerId).trim();

      console.log(`[AuthController] Updating OneSignal Player ID for user ${user.id}: ${trimmedPlayerId}`);

      const updatedUser = db.updateUserOnesignalPlayerId(user.id, trimmedPlayerId);

      if (!updatedUser) {
        console.error(`[AuthController] updateOnesignalPlayerId: User not found in database: ${user.id}`);
        return res.status(404).json({
          success: false,
          error: 'Kullanıcı bulunamadı'
        });
      }

      const activityLogService = require('../../services/activityLogService');
      try {
        activityLogService.logActivity(user.id, 'notification', 'update_onesignal_player_id', {
          playerId: trimmedPlayerId,
          path: req.path
        });
      } catch (logError) {
        console.warn('[AuthController] Failed to log activity:', logError.message);
      }

      console.log(`[AuthController] ✅ OneSignal Player ID updated successfully for user ${user.id}`);

      return res.json({
        success: true,
        message: 'OneSignal Player ID güncellendi',
        playerId: updatedUser.onesignalPlayerId || trimmedPlayerId
      });
    } catch (error) {
      console.error('[AuthController] updateOnesignalPlayerId error:', error);
      return res.status(500).json({
        success: false,
        error: 'Player ID güncellenemedi: ' + error.message
      });
    }
  }

  async uploadAvatar(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(
          ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED')
        );
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json(
          ResponseFormatter.error('Fotoğraf dosyası gereklidir', 'MISSING_FILE')
        );
      }

      console.log('[Auth] Avatar upload for user:', user.id, 'File:', req.file.filename);

      // Convert image to Base64 for database storage (Render.com compatible)
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(req.file.path);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = req.file.mimetype || 'image/jpeg';
      const avatarUrl = `data:${mimeType};base64,${base64Image}`;

      console.log('[Auth] Image converted to Base64, size:', base64Image.length, 'bytes');

      // Delete uploaded file (no longer needed)
      try {
        fs.unlinkSync(req.file.path);
        console.log('[Auth] Temporary file deleted:', req.file.path);
      } catch (err) {
        console.warn('[Auth] Failed to delete temp file:', err.message);
      }

      // Update user avatar in database
      user.avatar = avatarUrl;
      const db = require('../../config/database');
      if (db.scheduleSave) {
        db.scheduleSave();
      }

      console.log('[Auth] ✓ Avatar uploaded successfully (Base64)');

      return res.json(ResponseFormatter.success({
        avatarUrl: avatarUrl,
        message: 'Profil fotoğrafı başarıyla yüklendi'
      }, 'Profil fotoğrafı güncellendi'));

    } catch (error) {
      console.error('[Auth] Upload avatar error:', error);
      if (error.isOperational) {
        return res.status(error.statusCode).json(
          ResponseFormatter.error(error.message, error.code, error.details)
        );
      }
      return res.status(500).json(
        ResponseFormatter.error('Profil fotoğrafı yüklenemedi', 'AVATAR_UPLOAD_ERROR')
      );
    }
  }

  async deleteAvatar(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(
          ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED')
        );
      }

      // Check if user has an avatar
      if (!user.avatar) {
        return res.status(404).json(
          ResponseFormatter.error('Profil fotoğrafı bulunamadı', 'AVATAR_NOT_FOUND')
        );
      }

      console.log('[Auth] Deleting avatar for user:', user.id);

      // Delete avatar file if it's a local upload (not Google avatar)
      if (!user.avatar.includes('googleusercontent')) {
        const fs = require('fs');
        const path = require('path');
        const avatarPath = path.join(__dirname, '../../uploads/avatars', path.basename(user.avatar));

        if (fs.existsSync(avatarPath)) {
          try {
            fs.unlinkSync(avatarPath);
            console.log('[Auth] ✓ Avatar file deleted:', avatarPath);
          } catch (err) {
            console.warn('[Auth] Failed to delete avatar file:', err.message);
          }
        }
      }

      // Update user avatar to null in database
      user.avatar = null;
      const db = require('../../config/database');
      if (db.scheduleSave) {
        db.scheduleSave();
      }

      console.log('[Auth] ✓ Avatar deleted successfully for user:', user.id);

      return res.json(ResponseFormatter.success(
        { deleted: true },
        'Profil fotoğrafı başarıyla silindi'
      ));

    } catch (error) {
      console.error('[Auth] Delete avatar error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Profil fotoğrafı silinemedi', 'AVATAR_DELETE_ERROR')
      );
    }
  }

  async checkEmailRegistration(req, res) {
    try {
      const { email } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json(
          ResponseFormatter.error('E-posta adresi gereklidir', 'MISSING_EMAIL')
        );
      }

      const cleanEmail = email.trim().toLowerCase();

      let user;
      try {
        user = UserModel.findByEmail(cleanEmail);
      } catch (dbError) {
        console.error('[Auth] Database error while checking email:', dbError.message);
        return res.status(500).json(
          ResponseFormatter.error('Database error', 'DATABASE_ERROR')
        );
      }

      if (!user) {
        console.log(`[Auth] Email ${cleanEmail} not found in database`);
        return res.json(ResponseFormatter.success({
          exists: false
        }));
      }

      const registeredWithGoogle = !!user.googleId;
      const registeredWithSMTP = !user.googleId;

      console.log(`[Auth] Email ${cleanEmail} registration check:`, {
        exists: true,
        registeredWithSMTP,
        registeredWithGoogle
      });

      return res.json(ResponseFormatter.success({
        exists: true,
        registeredWithSMTP,
        registeredWithGoogle
      }));

    } catch (error) {
      console.error('[Auth] Check email registration error:', error);
      return res.status(500).json(
        ResponseFormatter.error('E-posta kontrolü yapılamadı', 'CHECK_ERROR')
      );
    }
  }

  /**
   * Verify email code and delete account
   * Used for email/password users
   */
  async verifyAndDeleteAccount(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED'));
      }

      const { code } = req.body;
      if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json(ResponseFormatter.error('Geçerli bir 6 haneli doğrulama kodu gereklidir', 'INVALID_CODE'));
      }

      const email = user.email;
      const identifier = email || user.phone;

      // Verify code
      const verifications = VerificationModel.getEmailVerifications(identifier);
      const validVerification = verifications.find(v =>
        v.type === 'account_deletion' &&
        v.code === code &&
        Date.now() < v.expiresAt &&
        v.attempts < 5
      );

      if (!validVerification) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz veya süresi dolmuş doğrulama kodu', 'INVALID_CODE'));
      }

      // Delete account (reuse existing deleteAccount logic)
      const userId = user.id;
      const startTime = Date.now();

      // Delete from PostgreSQL if connected
      const postgres = require('../../config/postgres');
      if (postgres.isConnected && postgres.transaction) {
        try {
          await postgres.transaction(async (client) => {
            await client.query('DELETE FROM location_points WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM tracks WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM step_daily WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM devices WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
          });
          console.log(`[Auth] ✓ User ${userId} deleted from PostgreSQL`);
        } catch (pgError) {
          console.warn('[Auth] PostgreSQL delete failed, using JSON fallback:', pgError.message);
        }
      }

      // Delete from JSON database
      const db = require('../../config/database');
      UserModel.delete(userId);
      TokenModel.removeAllForUser(userId);
      VerificationModel.deleteEmailVerifications(identifier);

      if (db.scheduleSave) {
        db.scheduleSave();
      }

      const duration = Date.now() - startTime;
      console.log(`[Auth] ✓ Account ${userId} permanently deleted (${duration}ms)`);

      return res.json(ResponseFormatter.success(null, 'Hesabınız başarıyla silindi'));
    } catch (error) {
      console.error('[Auth] Verify and delete account error:', error);
      return res.status(500).json(ResponseFormatter.error('Hesap silinemedi', 'ACCOUNT_DELETE_ERROR'));
    }
  }

  /**
   * Delete Google account without email verification
   * Google users don't need email verification since they're already authenticated via Google
   */
  async deleteGoogleAccount(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED'));
      }

      // Verify this is a Google user
      if (!user.googleId) {
        return res.status(400).json(ResponseFormatter.error('Bu işlem sadece Google kullanıcıları için geçerlidir', 'NOT_GOOGLE_USER'));
      }

      const userId = user.id;
      const startTime = Date.now();

      console.log(`[Auth] Deleting Google account: ${userId}`);

      // Delete from PostgreSQL if connected
      const postgres = require('../../config/postgres');
      if (postgres.isConnected && postgres.transaction) {
        try {
          await postgres.transaction(async (client) => {
            await client.query('DELETE FROM location_points WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM tracks WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM step_daily WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM devices WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
          });
          console.log(`[Auth] ✓ Google user ${userId} deleted from PostgreSQL`);
        } catch (pgError) {
          console.warn('[Auth] PostgreSQL delete failed, using JSON fallback:', pgError.message);
        }
      }

      // Delete from JSON database
      const db = require('../../config/database');
      UserModel.delete(userId);
      TokenModel.removeAllForUser(userId);

      // Clean up Google-specific data
      if (user.email) {
        VerificationModel.deleteEmailVerifications(user.email);
      }

      if (db.scheduleSave) {
        db.scheduleSave();
      }

      const duration = Date.now() - startTime;
      console.log(`[Auth] ✓ Google account ${userId} permanently deleted (${duration}ms)`);

      return res.json(ResponseFormatter.success(null, 'Google hesabınız başarıyla silindi'));
    } catch (error) {
      console.error('[Auth] Delete Google account error:', error);
      return res.status(500).json(ResponseFormatter.error('Hesap silinemedi', 'ACCOUNT_DELETE_ERROR'));
    }
  }

  /**
   * Alias for deleteAccount - used by frontend /auth/account/delete-verify endpoint
   * Verifies the deletion code and deletes the account
   */
  async verifyAndDeleteAccount(req, res) {
    return this.deleteAccount(req, res);
  }

}

module.exports = new AuthController();


