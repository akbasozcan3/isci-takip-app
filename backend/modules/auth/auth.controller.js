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
        return res.status(400).json({ error: 'E-posta adresi gereklidir' });
      }

      if (!AuthService.isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
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

      const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5001';
      let emailSent = false;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const emailResponse = await fetch(`${emailServiceUrl}/send-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: email.trim(),
            code: code
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (emailResponse.ok) {
          const responseData = await emailResponse.json().catch(() => ({}));
          if (responseData.success) {
            emailSent = true;
          }
        }
      } catch (error) {
        console.warn(`Email service unavailable: ${error.message}`);
      }

      console.log(`Verification code for ${email}: ${code}`);

      return res.json({
        success: true,
        message: emailSent ? 'Doğrulama kodu gönderildi' : 'Doğrulama kodu oluşturuldu (e-posta gönderilemedi)',
        code: process.env.NODE_ENV === 'development' ? code : undefined,
        emailSent: emailSent
      });
    } catch (error) {
      console.error('Pre-verify email error:', error);
      return res.status(500).json({ error: 'Doğrulama kodu gönderilemedi' });
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
      console.error('Verify email code error:', error);
      return res.status(500).json({ error: 'E-posta doğrulama kodu kontrol edilemedi' });
    }
  }

  async register(req, res) {
    try {
      const { email, password, displayName, verificationCode } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'E-posta ve şifre gereklidir' });
      }

      if (!AuthService.isValidEmail(email)) {
        return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
      }

      if (!AuthService.isValidPassword(password)) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
      }

      if (!verificationCode) {
        return res.status(400).json({ 
          error: 'Doğrulama kodu gereklidir',
          requiresVerification: true
        });
      }

      const verification = await AuthService.verifyCode(email, verificationCode);
      if (!verification.valid) {
        return res.status(400).json(ResponseFormatter.error(verification.error, 'INVALID_VERIFICATION_CODE', { requiresVerification: true }));
      }

      if (AuthService.userExists(email)) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlıdır' });
      }

      const hashedPassword = await AuthService.hashPassword(password);
      
      const user = UserModel.create({
        email: email.trim().toLowerCase(),
        displayName: (displayName || email.split('@')[0]).trim(),
        username: email.split('@')[0].toLowerCase(),
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      UserModel.setPassword(email, hashedPassword);
      UserModel.verifyEmail(email);

      const token = AuthService.createSession(user.id, user.email, user.role);

      return res.status(201).json({
        success: true,
        message: 'Kayıt başarılı',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          email_verified: true,
          createdAt: user.createdAt
        },
        token
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ 
        error: 'Kullanıcı kaydı başarısız',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'E-posta ve şifre gereklidir' });
      }

      const user = UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Bu e-posta adresi ile kayıtlı bir hesap bulunamadı' });
      }

      if (!UserModel.isEmailVerified(email)) {
        return res.status(403).json({ 
          error: 'E-posta doğrulanmamış',
          requiresVerification: true,
          message: 'Lütfen giriş yapmadan önce e-postanızı doğrulayın'
        });
      }

      const hashedPassword = UserModel.getPassword(email);
      if (!hashedPassword) {
        return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
      }

      const isValidPassword = await AuthService.comparePassword(password, hashedPassword);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
      }

      TokenModel.removeAllForUser(user.id);

      const token = AuthService.createSession(user.id, user.email, user.role);

      return res.json({
        success: true,
        message: 'Giriş başarılı',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          email_verified: true
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Giriş yapılamadı' });
    }
  }

  async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        TokenModel.remove(token);
      }

      return res.json({
        success: true,
        message: 'Çıkış başarılı'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ error: 'Çıkış yapılamadı' });
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
      console.error('Get profile error:', error);
      return res.status(500).json({ error: 'Profil bilgileri alınamadı' });
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
            return res.status(400).json({ error: 'Şifre bulunamadı' });
          }

          const isValidPassword = await AuthService.comparePassword(currentPassword, hashedPassword);
          if (!isValidPassword) {
            return res.status(400).json({ error: 'Mevcut şifre yanlış' });
          }
          canChangePassword = true;
        } else if (verificationCode) {
          const verification = await AuthService.verifyCode(user.email, verificationCode);
          if (!verification.valid) {
            return res.status(400).json({ error: verification.error });
          }
          canChangePassword = true;
        } else {
          return res.status(400).json({ error: 'Mevcut şifre veya doğrulama kodu gereklidir' });
        }

        if (canChangePassword) {
          if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır' });
          }

          const newHashedPassword = await AuthService.hashPassword(newPassword);
          UserModel.setPassword(user.email, newHashedPassword);

          TokenModel.removeAllForUser(user.id);
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

      return res.json({
        success: true,
        message: newPassword ? 'Profil ve şifre başarıyla güncellendi' : 'Profil başarıyla güncellendi',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          phone: user.phone || null,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Profil güncellenemedi' });
    }
  }

  async deleteAccount(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      UserModel.delete(user.id);
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        TokenModel.remove(token);
      }

      return res.json({
        success: true,
        message: 'Hesap başarıyla silindi'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      return res.status(500).json({ error: 'Hesap silinemedi' });
    }
  }

  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'E-posta adresi gereklidir' });
      }

      if (!AuthService.isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
      }

      const user = UserModel.findByEmail(email.trim());
      if (!user) {
        return res.status(404).json(ResponseFormatter.error('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı', 'USER_NOT_FOUND'));
      }

      const resetToken = AuthService.generateResetToken(email.trim());
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/reset-password?token=${resetToken}`;

      const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5001';
      let emailSent = false;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const emailResponse = await fetch(`${emailServiceUrl}/send-reset-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: email.trim(),
            resetLink: resetLink
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (emailResponse.ok) {
          const responseData = await emailResponse.json().catch(() => ({}));
          if (responseData.success) {
            emailSent = true;
          }
        }
      } catch (error) {
        console.warn(`Email service unavailable: ${error.message}`);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`Password reset link for ${email}: ${resetLink}`);
      }

      return res.json({
        success: true,
        message: emailSent ? 'Şifre sıfırlama linki e-postanıza gönderildi' : 'Şifre sıfırlama linki oluşturuldu (e-posta gönderilemedi)',
        resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
      });
    } catch (error) {
      console.error('Request password reset error:', error);
      return res.status(500).json({ error: 'Şifre sıfırlama isteği oluşturulamadı' });
    }
  }

  async verifyResetToken(req, res) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ error: 'Token gereklidir' });
      }

      const decoded = AuthService.verifyResetToken(token);
      if (!decoded || !decoded.email) {
        return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
      }

      const user = UserModel.findByEmail(decoded.email);
      if (!user) {
        throw createError('Kullanıcı bulunamadı', 404, 'USER_NOT_FOUND');
      }

      return res.json({
        success: true,
        email: decoded.email
      });
    } catch (error) {
      console.error('Verify reset token error:', error);
      return res.status(500).json({ error: 'Token doğrulanamadı' });
    }
  }

  async confirmPasswordReset(req, res) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token ve yeni şifre gereklidir' });
      }

      const decoded = AuthService.verifyResetToken(token);
      if (!decoded || !decoded.email) {
        return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
      }

      if (!AuthService.isValidPassword(newPassword)) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
      }

      const user = UserModel.findByEmail(decoded.email);
      if (!user) {
        throw createError('Kullanıcı bulunamadı', 404, 'USER_NOT_FOUND');
      }

      const hashedPassword = await AuthService.hashPassword(newPassword);
      UserModel.setPassword(decoded.email, hashedPassword);

      TokenModel.removeAllForUser(user.id);

      return res.json({
        success: true,
        message: 'Şifre başarıyla sıfırlandı'
      });
    } catch (error) {
      console.error('Confirm password reset error:', error);
      return res.status(500).json({ error: 'Şifre sıfırlanamadı' });
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

      const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5001';
      let emailSent = false;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const emailResponse = await fetch(`${emailServiceUrl}/send-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: user.email,
            code: code
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (emailResponse.ok) {
          const responseData = await emailResponse.json().catch(() => ({}));
          if (responseData.success) {
            emailSent = true;
          }
        }
      } catch (error) {
        console.warn(`Email service unavailable: ${error.message}`);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`Password change verification code for ${user.email}: ${code}`);
      }

      return res.json({
        success: true,
        message: emailSent ? 'Doğrulama kodu e-postanıza gönderildi' : 'Doğrulama kodu oluşturuldu (e-posta gönderilemedi)',
        code: process.env.NODE_ENV === 'development' ? code : undefined,
        emailSent: emailSent
      });
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
}

module.exports = new AuthController();

