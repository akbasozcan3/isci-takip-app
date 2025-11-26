// Authentication Controller
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
// Ensure fetch and AbortController are available (Node < 18 fallback)
try {
  if (typeof fetch === 'undefined') {
    const nodeFetch = require('node-fetch');
    global.fetch = nodeFetch;
    if (typeof AbortController === 'undefined' && nodeFetch.AbortController) {
      global.AbortController = nodeFetch.AbortController;
    }
  }
} catch (_) {}

class AuthController {
  // Send verification code to existing user (for password change)
  async sendPasswordChangeCode(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const tokenData = db.getToken(token);
      if (!tokenData) {
        return res.status(401).json({ error: 'Geçersiz token' });
      }

      const user = db.findUserById(tokenData.userId);
      if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      const email = user.email;

      // Rate limiting - check recent attempts (max 3 per 10 minutes)
      const verifications = db.getEmailVerifications(email);
      const recentVerifications = verifications.filter(v => 
        Date.now() - v.timestamp < 10 * 60 * 1000
      );
      
      if (recentVerifications.length >= 3) {
        return res.status(429).json({ 
          error: 'Çok fazla istek. Yeni bir kod talep etmeden önce 10 dakika bekleyin.',
          retryAfter: 600
        });
      }

      // Generate verification code
      const code = db.generateCode();
      
      // Store verification data
      const verification = {
        code,
        email,
        timestamp: Date.now(),
        attempts: 0,
        purpose: 'password_change' // Şifre değiştirme için
      };
      
      db.addEmailVerification(email, verification);

      // Send verification code via Python email service
      const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5001';
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
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
          console.log(`✅ Password change verification email sent to ${email}`);
        } else {
          const errorData = await emailResponse.json().catch(() => ({}));
          console.warn(`⚠️ Email service failed: ${errorData.error || 'Unknown error'}`);
          console.warn(`Code generated (for testing): ${code}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.warn('⚠️ Email service timeout - code still generated for testing');
        } else {
          console.warn(`⚠️ Email service unavailable: ${error.message}`);
        }
        console.warn(`Code generated (for testing): ${code}`);
      }

      // In development, always return the code for testing
      console.log(`Password change verification code for ${email}: ${code}`);

      return res.json({
        success: true,
        message: 'Doğrulama kodu e-postanıza gönderildi',
        // In development, return the code for testing
        code: process.env.NODE_ENV === 'development' ? code : undefined
      });
    } catch (error) {
      console.error('Send password change code error:', error);
      return res.status(500).json({ error: 'Doğrulama kodu gönderilemedi' });
    }
  }

  // Verify password change code before allowing password reset
  async verifyPasswordChangeCode(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const { code } = req.body || {};
      if (!code || String(code).trim().length !== 6) {
        return res.status(400).json({ error: 'Geçerli bir doğrulama kodu girin' });
      }

      const tokenData = db.getToken(token);
      if (!tokenData) {
        return res.status(401).json({ error: 'Geçersiz token' });
      }

      const user = db.findUserById(tokenData.userId);
      if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      const verifications = db.getEmailVerifications(user.email) || [];
      const eligible = verifications.filter(v => !v.purpose || v.purpose === 'password_change');
      if (!eligible.length) {
        return res.status(400).json({ error: 'Aktif doğrulama kodu bulunamadı' });
      }

      const latestVerification = eligible[eligible.length - 1];
      if (latestVerification.code !== String(code).trim()) {
        return res.status(400).json({ error: 'Doğrulama kodu yanlış' });
      }

      const isExpired = Date.now() - latestVerification.timestamp > 10 * 60 * 1000;
      if (isExpired) {
        return res.status(400).json({ error: 'Doğrulama kodu süresi doldu' });
      }

      return res.json({
        success: true,
        message: 'Kod doğrulandı'
      });
    } catch (error) {
      console.error('Verify password change code error:', error);
      return res.status(500).json({ error: 'Kod doğrulanamadı' });
    }
  }

  // Pre-verify email (send verification code)
  async preVerifyEmail(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'E-posta adresi gereklidir' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
      }

      // Check if email already exists
      const existingUser = db.findUserByEmail(email.trim());
      if (existingUser) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlıdır' });
      }

      // Rate limiting - check recent attempts (max 3 per 10 minutes)
      const verifications = db.getEmailVerifications(email.trim());
      const recentVerifications = verifications.filter(v => 
        Date.now() - v.timestamp < 10 * 60 * 1000
      );
      
      if (recentVerifications.length >= 3) {
        return res.status(429).json({ 
          error: 'Çok fazla istek. Yeni bir kod talep etmeden önce 10 dakika bekleyin.',
          retryAfter: 600
        });
      }

      // Generate verification code
      const code = db.generateCode();
      
      // Store verification data
      const verification = {
        code,
        email,
        timestamp: Date.now(),
        attempts: 0
      };
      
      db.addEmailVerification(email, verification);

      // Send verification code via Python email service
      const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5001';
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const emailResponse = await fetch(`${emailServiceUrl}/send-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: email.trim(),
            code: code  // Send the code generated by backend
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (emailResponse.ok) {
          console.log(`✅ Verification email sent to ${email}`);
        } else {
          const errorData = await emailResponse.json().catch(() => ({}));
          console.warn(`⚠️ Email service failed: ${errorData.error || 'Unknown error'}`);
          console.warn(`Code generated (for testing): ${code}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.warn('⚠️ Email service timeout - code still generated for testing');
        } else {
          console.warn(`⚠️ Email service unavailable: ${error.message}`);
        }
        console.warn(`Code generated (for testing): ${code}`);
      }

      // In development, always return the code for testing
      console.log(`Verification code for ${email}: ${code}`);

      return res.json({
        success: true,
        message: 'Doğrulama kodu gönderildi',
        // In development, return the code for testing
        code: process.env.NODE_ENV === 'development' ? code : undefined
      });
    } catch (error) {
      console.error('Pre-verify email error:', error);
      return res.status(500).json({ error: 'Doğrulama kodu gönderilemedi' });
    }
  }

  // Request password reset (send link via Gmail service)
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: 'E-posta gereklidir' });
      const user = db.findUserByEmail(email);
      if (!user) return res.status(200).json({ success: true }); // do not reveal existence

      // Rate limit: 10 dakikada max 3 istek (production only)
      if (process.env.NODE_ENV === 'production') {
        const resets = db.getPasswordResets(email);
        const recent = resets.filter(r => Date.now() - r.timestamp < 10 * 60 * 1000);
        if (recent.length >= 3) {
          return res.status(429).json({ error: 'Çok fazla istek. 10 dakika sonra tekrar deneyin.' });
        }
      }

      // Generate secure token
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      // Store token
      db.addPasswordResetToken(token, {
        email: email.trim(),
        userId: user.id,
        expiresAt
      });

      // Also add to emailResets for rate limiting
      db.addPasswordReset(email, { token, timestamp: Date.now(), attempts: 0 });

      // Create reset link
      // Prefer native deep link using Expo scheme so email opens the app directly.
      // You can override with FRONTEND_URL for web or production links.
      const appScheme = process.env.APP_SCHEME || 'iscitakip';
      const nativeDeepLink = `${appScheme}://auth/reset-password?token=${token}`;
      const webBase =
        process.env.FRONTEND_URL ||
        process.env.API_BASE_URL ||
        'http://localhost:8081'; // expo-router dev web base URL
      const webLink = `${webBase.replace(/\/+$/, '')}/auth/reset-password?token=${token}`;
      // Use web link for development, native deep link for production
      // Development'da web link kullan (localhost:8081)
      // Production'da native deep link kullan (iscitakip://auth/reset-password?token=...)
      const resetLink = process.env.NODE_ENV === 'production' ? nativeDeepLink : webLink;

      // Fire-and-forget email sending to avoid blocking the API response
      let sent = false;
      (async () => {
        try {
          const emailSvc = require('../services/emailService');
          const result = await emailSvc.sendResetLink(email.trim(), resetLink, token);
          if (result && result.ok) {
            sent = true;
            console.log(`✅ Reset link sent via Gmail to ${email}`);
            return;
          }
        } catch (e) {
          console.warn('EmailService Gmail send failed, will fallback:', e?.message || e);
        }
        try {
          const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5001';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          await fetch(`${emailServiceUrl}/send-reset-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), resetLink, token }),
            signal: controller.signal
          }).catch(() => {});
          clearTimeout(timeoutId);
          sent = true;
          console.log(`✅ Reset link sent via external service to ${email}`);
        } catch (e) {
          console.warn('External email service failed:', e?.message || e);
        }
      })().catch(() => {});

      console.log(`Reset token for ${email}: ${token}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Reset link (web): ${webLink}`);
        console.log(`Reset link (native/dev): ${nativeDeepLink}`);
      }
      const shouldReturnDev =
        (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') ||
        String(process.env.RESET_DEV_RETURN_CODE || '') === '1';
      return res.json({
        success: true,
        via: sent ? 'email' : 'queued',
        ...(shouldReturnDev
          ? {
              dev: {
                token,
                links: { web: webLink, native: nativeDeepLink, used: resetLink }
              }
            }
          : {})
      });
    } catch (e) {
      console.error('requestPasswordReset error:', e);
      return res.status(500).json({ error: 'Link gönderilemedi' });
    }
  }

  // Verify reset token
  async verifyResetToken(req, res) {
    try {
      const { token } = req.query || req.body || {};
      if (!token) return res.status(400).json({ error: 'Token gereklidir' });

      const tokenData = db.getPasswordResetToken(token);
      if (!tokenData) {
        return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
      }

      // Check expiration
      if (Date.now() > tokenData.expiresAt) {
        db.deletePasswordResetToken(token);
        return res.status(400).json({ error: 'Linkin süresi dolmuş' });
      }

      return res.json({ 
        success: true, 
        email: tokenData.email,
        message: 'Token geçerli'
      });
    } catch (e) {
      console.error('verifyResetToken error:', e);
      return res.status(500).json({ error: 'Token doğrulanamadı' });
    }
  }

  // Confirm reset with token and set new password
  async confirmPasswordReset(req, res) {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token ve yeni şifre gereklidir' });
      }

      const tokenData = db.getPasswordResetToken(token);
      if (!tokenData) {
        return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
      }

      // Check expiration
      if (Date.now() > tokenData.expiresAt) {
        db.deletePasswordResetToken(token);
        return res.status(400).json({ error: 'Linkin süresi dolmuş' });
      }

      const user = db.findUserByEmail(tokenData.email);
      if (!user) {
        return res.status(400).json({ error: 'Kullanıcı bulunamadı' });
      }

      // Validate password
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
      }

      // Update password
      const hashed = await bcrypt.hash(newPassword, 10);
      db.setPassword(tokenData.email, hashed);
      db.deletePasswordResetToken(token);
      db.deletePasswordResets(tokenData.email);

      // Invalidate all sessions for this user
      for (const [t, info] of Object.entries(db.data.tokens || {})) {
        if (info && info.userId === user.id) {
          delete db.data.tokens[t];
        }
      }
      db.scheduleSave();

      return res.json({ success: true, message: 'Şifre güncellendi' });
    } catch (e) {
      console.error('confirmPasswordReset error:', e);
      return res.status(500).json({ error: 'Şifre sıfırlanamadı' });
    }
  }
  // Verify email code
  async verifyEmailCode(req, res) {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: 'E-posta ve kod gereklidir' });
      }

      const verifications = db.getEmailVerifications(email);
      const latestVerification = verifications[verifications.length - 1];
      
      if (!latestVerification || latestVerification.code !== code) {
        return res.status(400).json({ error: 'Geçersiz doğrulama kodu' });
      }

      // Check if code is expired (10 minutes)
      const isExpired = Date.now() - latestVerification.timestamp > 10 * 60 * 1000;
      if (isExpired) {
        return res.status(400).json({ error: 'Doğrulama kodu süresi doldu' });
      }

      // Mark email as verified
      db.verifyUserEmail(email);

      return res.json({
        success: true,
        message: 'E-posta başarıyla doğrulandı'
      });
    } catch (error) {
      console.error('Verify email code error:', error);
      return res.status(500).json({ error: 'E-posta doğrulama kodu kontrol edilemedi' });
    }
  }

  // Register new user
  async register(req, res) {
    console.log('🔵 [REGISTER] Registration request received:', JSON.stringify(req.body, null, 2));
    
    try {
      const { email, password, displayName, verificationCode } = req.body;
      
      // Input validation
      if (!email || !password || !verificationCode) {
        console.log('❌ [REGISTER] Missing required fields:', { 
          email: !!email, 
          password: !!password, 
          verificationCode: !!verificationCode 
        });
        return res.status(400).json({ 
          error: 'E-posta, şifre ve doğrulama kodu gereklidir',
          requiresVerification: !verificationCode
        });
      }

      console.log('🔵 [REGISTER] Verifying email code for:', email);
      // Get latest verification
      const verifications = db.getEmailVerifications(email) || [];
      const latestVerification = verifications[verifications.length - 1];
      
      // Check verification code
      if (!latestVerification || latestVerification.code !== verificationCode) {
        console.log('❌ [REGISTER] Invalid verification code for:', email);
        return res.status(400).json({ 
          error: 'Geçersiz doğrulama kodu',
          requiresVerification: true
        });
      }

      // Check if code is expired (10 minutes)
      const isExpired = Date.now() - latestVerification.timestamp > 10 * 60 * 1000;
      if (isExpired) {
        console.log('❌ [REGISTER] Expired verification code for:', email);
        return res.status(400).json({ 
          error: 'Doğrulama kodu süresi doldu',
          requiresVerification: true
        });
      }

      // Check if email already exists
      const existingUser = db.findUserByEmail(email);
      if (existingUser) {
        console.log('❌ [REGISTER] Email already exists:', email);
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlıdır' });
      }

      console.log('🔵 [REGISTER] Creating user account for:', email);
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = db.createUser({
        email: email.trim().toLowerCase(),
        displayName: (displayName || email.split('@')[0]).trim(),
        username: email.split('@')[0].toLowerCase(),
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Store password
      db.setPassword(email, hashedPassword);

      // Mark email as verified
      db.verifyUserEmail(email);

      console.log('🔵 [REGISTER] Generating JWT token...');
      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      // Store token
      db.setToken(token, { 
        userId: user.id, 
        email: user.email,
        role: user.role
      });

      console.log('✅ [REGISTER] Registration successful for:', email);
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
      console.error('❌ [REGISTER] Error:', error);
      return res.status(500).json({ 
        error: 'Kullanıcı kaydı başarısız',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'E-posta ve şifre gereklidir' });
      }

      // Find user
      const user = db.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Bu e-posta adresi ile kayıtlı bir hesap bulunamadı' });
      }

      // Check if email is verified - REQUIRED for login
      if (!db.isEmailVerified(email)) {
        return res.status(403).json({ 
          error: 'E-posta doğrulanmamış',
          requiresVerification: true,
          message: 'Lütfen giriş yapmadan önce e-postanızı doğrulayın'
        });
      }

      // Check password
      const hashedPassword = db.getPassword(email);
      if (!hashedPassword) {
        return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
      }

      const isValidPassword = await bcrypt.compare(password, hashedPassword);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      // Single-session enforcement: remove all existing tokens for this user
      try {
        const existingTokens = Object.entries(db.data.tokens || {});
        for (const [t, info] of existingTokens) {
          if (info && info.userId === user.id) {
            delete db.data.tokens[t];
          }
        }
      } catch (_) {}
      // Store new token
      db.setToken(token, { userId: user.id, email: user.email });

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

  // Logout user
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        db.removeToken(token);
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

  // Get user profile
  async getProfile(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const tokenData = db.getToken(token);
      if (!tokenData) {
        return res.status(401).json({ error: 'Geçersiz token' });
      }

      const user = db.findUserById(tokenData.userId);
      if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          name: user.displayName || user.name, // Frontend compatibility
          phone: user.phone || null,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({ error: 'Profil bilgileri alınamadı' });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const tokenData = db.getToken(token);
      if (!tokenData) {
        return res.status(401).json({ error: 'Geçersiz token' });
      }

      const user = db.findUserById(tokenData.userId);
      if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      const { displayName, phone, currentPassword, newPassword, verificationCode } = req.body;
      
      // Şifre değiştirme kontrolü
      if (newPassword) {
        let canChangePassword = false;

        // Yöntem 1: Mevcut şifre ile
        if (currentPassword) {
          const hashedPassword = db.getPassword(user.email);
          if (!hashedPassword) {
            return res.status(400).json({ error: 'Şifre bulunamadı' });
          }

          const isValidPassword = await bcrypt.compare(currentPassword, hashedPassword);
          if (!isValidPassword) {
            return res.status(400).json({ error: 'Mevcut şifre yanlış' });
          }
          canChangePassword = true;
        }
        // Yöntem 2: Email doğrulama kodu ile (şifre unutulduysa)
        else if (verificationCode) {
          const verifications = db.getEmailVerifications(user.email) || [];
          const latestVerification = verifications[verifications.length - 1];
          
          if (!latestVerification || latestVerification.code !== verificationCode) {
            return res.status(400).json({ error: 'Geçersiz doğrulama kodu' });
          }

          // Kod süresi kontrolü (10 dakika)
          const isExpired = Date.now() - latestVerification.timestamp > 10 * 60 * 1000;
          if (isExpired) {
            return res.status(400).json({ error: 'Doğrulama kodu süresi doldu' });
          }

          canChangePassword = true;
          // Doğrulama kodunu kullanıldı olarak işaretle (opsiyonel - veritabanında tutulabilir)
        }
        else {
          return res.status(400).json({ error: 'Mevcut şifre veya doğrulama kodu gereklidir' });
        }

        if (canChangePassword) {
          // Yeni şifre validasyonu
          if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır' });
          }

          // Yeni şifreyi hash'le ve kaydet
          const newHashedPassword = await bcrypt.hash(newPassword, 10);
          db.setPassword(user.email, newHashedPassword);

          // Tüm oturumları geçersiz kıl (güvenlik için)
          for (const [t, info] of Object.entries(db.data.tokens || {})) {
            if (info && info.userId === user.id && t !== token) {
              delete db.data.tokens[t];
            }
          }
          console.log(`✅ Password changed for user: ${user.email} (via ${currentPassword ? 'password' : 'verification code'})`);
        }
      }
      
      // Profil bilgilerini güncelle
      if (displayName) {
        user.displayName = displayName.trim();
      }

      if (phone !== undefined) {
        user.phone = phone ? phone.trim() : null;
      }

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

  // Delete user account
  async deleteAccount(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const tokenData = db.getToken(token);
      if (!tokenData) {
        return res.status(401).json({ error: 'Geçersiz token' });
      }

      const user = db.findUserById(tokenData.userId);
      if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      console.log(`🗑️ [DELETE ACCOUNT] Deleting account for user: ${user.email}`);

      // Delete user data
      db.deleteUser(user.id);
      
      // Remove token
      db.removeToken(token);

      // Delete password
      db.deletePassword(user.email);

      // Delete email verifications
      db.deleteEmailVerifications(user.email);

      console.log(`✅ [DELETE ACCOUNT] Account deleted successfully: ${user.email}`);

      return res.json({
        success: true,
        message: 'Hesap başarıyla silindi'
      });
    } catch (error) {
      console.error('❌ [DELETE ACCOUNT] Error:', error);
      return res.status(500).json({ error: 'Hesap silinemedi' });
    }
  }
}

module.exports = new AuthController();
