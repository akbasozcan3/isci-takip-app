const AuthService = require('./auth.service');
const UserModel = require('../../core/database/models/user.model');
const TokenModel = require('../../core/database/models/token.model');
const VerificationModel = require('../../core/database/models/verification.model');
const { requireAuth } = require('../../core/middleware/auth.middleware');
const ResponseFormatter = require('../../core/utils/responseFormatter');
const { createError } = require('../../core/utils/errorHandler');

class AuthController {
  async preVerifyEmail(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json(ResponseFormatter.error('E-posta adresi gereklidir', 'MISSING_EMAIL'));
      }

      if (!AuthService.isValidEmail(email.trim())) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz e-posta formatı', 'INVALID_EMAIL'));
      }

      if (AuthService.userExists(email.trim())) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlıdır' });
      }

      const verifications = VerificationModel.getEmailVerifications(email.trim());
      const recentVerifications = verifications.filter(v => 
        Date.now() - v.timestamp < 10 * 60 * 1000
      );
      
      if (recentVerifications.length >= 3) {
        return res.status(429).json({ 
          error: 'Çok fazla istek. Yeni bir kod talep etmeden önce 10 dakika bekleyin.',
          retryAfter: 600
        });
      }

      const code = await AuthService.sendVerificationCode(email.trim());

        const emailVerificationService = require('../../services/emailVerificationService');
      
      try {
        const result = await emailVerificationService.sendVerificationEmail(email.trim(), code);
        console.log(`[Auth] ✓ Verification email sent to ${email.trim()} (MessageId: ${result.messageId})`);

      return res.json({
        success: true,
          message: 'Doğrulama kodu e-postanıza gönderildi',
          emailSent: true
        });
      } catch (error) {
        console.error(`[Auth] ✗ Failed to send verification email to ${email.trim()}:`, error.message);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Verification code for ${email.trim()}: ${code}`);
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

      const user = UserModel.findByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(401).json(ResponseFormatter.error('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı', 'USER_NOT_FOUND'));
      }

      if (!UserModel.isEmailVerified(email.trim().toLowerCase())) {
        return res.status(403).json(ResponseFormatter.error(
          'E-posta doğrulanmamış',
          'EMAIL_NOT_VERIFIED',
          { requiresVerification: true, message: 'Lütfen giriş yapmadan önce e-postanızı doğrulayın' }
        ));
      }

      const hashedPassword = UserModel.getPassword(email.trim().toLowerCase());
      if (!hashedPassword) {
        return res.status(401).json(ResponseFormatter.error('Geçersiz e-posta veya şifre', 'INVALID_CREDENTIALS'));
      }

      const isValidPassword = await AuthService.comparePassword(password, hashedPassword);
      if (!isValidPassword) {
        return res.status(401).json(ResponseFormatter.error('Geçersiz e-posta veya şifre', 'INVALID_CREDENTIALS'));
      }

      TokenModel.removeAllForUser(user.id);

      const token = AuthService.createSession(user.id, user.email, user.role);

      // OneSignal ile hoş geldiniz bildirimi gönder (gecikmeli - player ID sync olması için)
      // Async olarak gönder, login response'u bekletme
      setImmediate(async () => {
        try {
          // Player ID'nin backend'e sync olması için 3 saniye bekle
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
            console.log(`[Auth] ✅ Welcome notification sent to user ${user.id} (${userName})`);
          } else {
            console.warn(`[Auth] ⚠️ Welcome notification failed for user ${user.id}:`, result.error || 'Unknown error');
          }
        } catch (notificationError) {
          // Bildirim hatası login'i engellemesin
          console.warn(`[Auth] ⚠️ Failed to send welcome notification to user ${user.id}:`, notificationError.message);
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
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          name: user.displayName || user.name,
          phone: user.phone || null,
          createdAt: user.createdAt
        }
      });
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
        return res.status(401).json({ error: 'Token gereklidir' });
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

  async deleteAccount(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json(ResponseFormatter.error('Token gereklidir', 'AUTH_REQUIRED'));
      }

      UserModel.delete(user.id);
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        TokenModel.remove(token);
      }

      return res.json(ResponseFormatter.success(null, 'Hesap başarıyla silindi'));
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
        return res.status(400).json({ success: false, error: 'E-posta adresi gereklidir' });
      }

      const cleanEmail = email.trim().toLowerCase();

      if (!AuthService.isValidEmail(cleanEmail)) {
        return res.status(400).json({ success: false, error: 'Geçersiz e-posta formatı. Lütfen geçerli bir e-posta adresi girin.' });
      }

      const VerificationModel = require('../../core/database/models/verification.model');
      const recentResets = VerificationModel.getPasswordResets(cleanEmail) || [];
      const now = Date.now();
      const recentRequests = recentResets.filter(r => now - (r.timestamp || r.requestedAt || 0) < 15 * 60 * 1000);
      
      if (recentRequests.length >= 3) {
        const oldestRequest = Math.min(...recentRequests.map(r => r.timestamp || r.requestedAt || 0));
        const waitTime = Math.ceil((15 * 60 * 1000 - (now - oldestRequest)) / 1000 / 60);
        return res.status(429).json({ 
          success: false,
          error: `Çok fazla istek. Lütfen ${waitTime} dakika sonra tekrar deneyin.`,
          retryAfter: Math.ceil((15 * 60 * 1000 - (now - oldestRequest)) / 1000)
        });
      }

      const user = UserModel.findByEmail(cleanEmail);
      if (!user) {
        VerificationModel.addPasswordReset(cleanEmail, { 
          timestamp: now, 
          requestedAt: now,
          success: false 
        });
        return res.status(404).json({ 
          success: false,
          error: 'Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen e-posta adresinizi kontrol edin.' 
        });
      }

      VerificationModel.addPasswordReset(cleanEmail, { 
        timestamp: now, 
        requestedAt: now,
        success: true 
      });
      const resetToken = AuthService.generateResetToken(cleanEmail);

        const emailVerificationService = require('../../services/emailVerificationService');
      
      try {
        const result = await emailVerificationService.sendResetLinkEmail(email.trim(), '', resetToken);
        console.log(`[Auth] ✓ Password reset email sent to ${email.trim()} (MessageId: ${result.messageId})`);

      return res.json({
        success: true,
          message: 'Şifre sıfırlama bilgileri e-postanıza gönderildi. Mobil uygulamadan şifrenizi sıfırlayabilirsiniz.',
          emailSent: true
        });
      } catch (error) {
        console.error(`[Auth] ✗ Failed to send reset email to ${email.trim()}:`, error.message);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Password reset token for ${email.trim()}: ${resetToken}`);
          return res.json({
            success: true,
            message: 'Şifre sıfırlama token\'ı oluşturuldu (SMTP hatası - development modunda token konsola yazdırıldı). Mobil uygulamadan şifrenizi sıfırlayabilirsiniz.',
            resetToken: resetToken,
            emailSent: false,
            emailError: error.message
          });
        }
        
        return res.status(500).json({
          success: false,
          error: 'E-posta gönderilemedi. Lütfen SMTP ayarlarını kontrol edin veya daha sonra tekrar deneyin.',
          emailError: error.message
      });
      }
    } catch (error) {
      console.error('Request password reset error:', error);
      return res.status(500).json({ error: 'Şifre sıfırlama isteği oluşturulamadı' });
    }
  }

  async verifyResetToken(req, res) {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({ success: false, error: 'Token gereklidir. Lütfen e-postanızdaki token\'ı girin.' });
      }

      let decodedToken;
      try {
        decodedToken = decodeURIComponent(token.trim());
      } catch (e) {
        decodedToken = token.trim();
      }

      if (!decodedToken || decodedToken.length < 10) {
        return res.status(400).json({ success: false, error: 'Geçersiz token formatı. Lütfen e-postanızdaki token\'ı tam olarak kopyalayın.' });
      }

      const decoded = AuthService.verifyResetToken(decodedToken);
      
      if (!decoded || !decoded.email) {
        console.error(`[Auth] ✗ Invalid or expired reset token`);
        return res.status(400).json({ 
          success: false, 
          error: 'Token geçersiz veya süresi dolmuş. Lütfen yeni bir şifre sıfırlama isteği gönderin.' 
        });
      }

      const user = UserModel.findByEmail(decoded.email);
      if (!user) {
        console.error(`[Auth] ✗ User not found for email: ${decoded.email}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Kullanıcı bulunamadı. Lütfen geçerli bir token kullanın.' 
        });
      }

      console.log(`[Auth] ✓ Reset token verified for ${decoded.email}`);
      return res.json({
        success: true,
        email: decoded.email,
        message: 'Token doğrulandı. Yeni şifrenizi belirleyebilirsiniz.'
      });
    } catch (error) {
      console.error('[Auth] ✗ Verify reset token error:', error);
      if (error.message && error.message.includes('malformed')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Geçersiz token formatı. Lütfen e-postanızdaki token\'ı tam olarak kopyalayın.' 
        });
      }
      return res.status(500).json({ 
        success: false, 
        error: 'Token doğrulanırken bir hata oluştu. Lütfen tekrar deneyin.' 
      });
    }
  }

  async confirmPasswordReset(req, res) {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || (typeof token === 'string' && !token.trim())) {
        return res.status(400).json({ 
          success: false, 
          error: 'Token gereklidir. Lütfen e-postanızdaki token\'ı girin.' 
        });
      }

      if (!newPassword || (typeof newPassword === 'string' && !newPassword.trim())) {
        return res.status(400).json({ 
          success: false, 
          error: 'Yeni şifre gereklidir. Lütfen yeni şifrenizi girin.' 
        });
      }

      let decodedToken;
      try {
        decodedToken = typeof token === 'string' ? decodeURIComponent(token.trim()) : token;
      } catch (e) {
        decodedToken = typeof token === 'string' ? token.trim() : token;
      }

      if (!decodedToken || (typeof decodedToken === 'string' && decodedToken.length < 10)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Geçersiz token formatı. Lütfen e-postanızdaki token\'ı tam olarak kopyalayın.' 
        });
      }

      const decoded = AuthService.verifyResetToken(decodedToken);
      
      if (!decoded || !decoded.email) {
        console.error(`[Auth] ✗ Invalid or expired reset token in confirm`);
        return res.status(400).json({ 
          success: false, 
          error: 'Token geçersiz veya süresi dolmuş. Lütfen yeni bir şifre sıfırlama isteği gönderin.' 
        });
      }

      const cleanPassword = typeof newPassword === 'string' ? newPassword.trim() : String(newPassword);

      if (!AuthService.isValidPassword(cleanPassword)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Şifre en az 6 karakter olmalıdır. Lütfen daha güçlü bir şifre seçin.' 
        });
      }

      const user = UserModel.findByEmail(decoded.email);
      if (!user) {
        console.error(`[Auth] ✗ User not found for email: ${decoded.email}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Kullanıcı bulunamadı. Lütfen geçerli bir token kullanın.' 
        });
      }

      const hashedPassword = await AuthService.hashPassword(cleanPassword);
      UserModel.setPassword(decoded.email, hashedPassword);
      TokenModel.removeAllForUser(user.id);

      const VerificationModel = require('../../core/database/models/verification.model');
      VerificationModel.deletePasswordResets(decoded.email);

      console.log(`[Auth] ✓ Password reset successful for ${decoded.email}`);
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
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const verifications = VerificationModel.getEmailVerifications(user.email);
      const recentVerifications = verifications.filter(v => 
        Date.now() - v.timestamp < 10 * 60 * 1000
      );
      
      if (recentVerifications.length >= 3) {
        return res.status(429).json({ 
          error: 'Çok fazla istek. Yeni bir kod talep etmeden önce 10 dakika bekleyin.',
          retryAfter: 600
        });
      }

      const code = await AuthService.sendVerificationCode(user.email);

        const emailVerificationService = require('../../services/emailVerificationService');
      
      try {
        const result = await emailVerificationService.sendVerificationEmail(user.email, code);
        console.log(`[Auth] ✓ Password change verification email sent to ${user.email} (MessageId: ${result.messageId})`);

      return res.json({
        success: true,
          message: 'Doğrulama kodu e-postanıza gönderildi',
          emailSent: true
        });
      } catch (error) {
        console.error(`[Auth] ✗ Failed to send password change email to ${user.email}:`, error.message);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Auth] [DEV] Password change verification code for ${user.email}: ${code}`);
          return res.json({
            success: true,
            message: 'Doğrulama kodu oluşturuldu (SMTP hatası - development modunda kod konsola yazdırıldı)',
            code: code,
            emailSent: false,
            emailError: error.message
          });
        }
        
        return res.status(500).json({
          success: false,
          error: 'E-posta gönderilemedi. Lütfen SMTP ayarlarını kontrol edin veya daha sonra tekrar deneyin.',
          emailError: error.message
      });
      }
    } catch (error) {
      console.error('Send password change code error:', error);
      return res.status(500).json({ error: 'Doğrulama kodu gönderilemedi' });
    }
  }

  async verifyPasswordChangeCode(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Doğrulama kodu gereklidir' });
      }

      const verification = await AuthService.verifyCode(user.email, code);
      if (!verification.valid) {
        return res.status(400).json({ error: verification.error });
      }

      return res.json({
        success: true,
        message: 'Doğrulama kodu başarıyla doğrulandı'
      });
    } catch (error) {
      console.error('Verify password change code error:', error);
      return res.status(500).json({ error: 'Doğrulama kodu kontrol edilemedi' });
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

}

module.exports = new AuthController();

