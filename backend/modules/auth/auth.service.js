const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../../core/database/models/user.model');
const TokenModel = require('../../core/database/models/token.model');
const VerificationModel = require('../../core/database/models/verification.model');

class AuthService {
  generateToken(userId, email, role = 'user') {
    return jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      return null;
    }
  }

  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPassword(password) {
    return password && password.length >= 6;
  }

  getUserFromToken(token) {
    const tokenData = TokenModel.get(token);
    if (!tokenData) {
      return null;
    }
    return UserModel.findById(tokenData.userId);
  }

  userExists(email) {
    return !!UserModel.findByEmail(email);
  }

  createSession(userId, email, role = 'user') {
    const token = this.generateToken(userId, email, role);
    TokenModel.set(token, { userId, email, role });
    return token;
  }

  destroySession(token) {
    TokenModel.remove(token);
  }

  async sendVerificationCode(email) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verification = {
      code,
      email,
      timestamp: Date.now(),
      attempts: 0
    };
    VerificationModel.addEmailVerification(email, verification);
    return code;
  }

  async verifyCode(email, code) {
    const verifications = VerificationModel.getEmailVerifications(email);
    if (!verifications || verifications.length === 0) {
      return { valid: false, error: 'Doğrulama kodu bulunamadı' };
    }

    const latestVerification = verifications[verifications.length - 1];
    if (latestVerification.code !== String(code).trim()) {
      return { valid: false, error: 'Geçersiz doğrulama kodu' };
    }

    const isExpired = Date.now() - latestVerification.timestamp > 10 * 60 * 1000;
    if (isExpired) {
      return { valid: false, error: 'Doğrulama kodu süresi doldu' };
    }

    return { valid: true };
  }
}

module.exports = new AuthService();

