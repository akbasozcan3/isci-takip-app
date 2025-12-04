const AuthService = require('./auth.service');
const UserModel = require('../../core/database/models/user.model');
const TokenModel = require('../../core/database/models/token.model');
const VerificationModel = require('../../core/database/models/verification.model');
const { requireAuth } = require('../../core/middleware/auth.middleware');

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
        return res.status(400).json({ error: 'E-posta ve kod gereklidir' });
      }

      const verification = await AuthService.verifyCode(email, code);
      if (!verification.valid) {
        return res.status(400).json({ error: verification.error });
      }

      UserModel.verifyEmail(email);

      return res.json({
        success: true,
        message: 'E-posta başarıyla doğrulandı'
      });
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
        return res.status(400).json({ 
          error: verification.error,
          requiresVerification: true
        });
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
}

module.exports = new AuthController();

