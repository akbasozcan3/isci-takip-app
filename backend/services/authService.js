// Authentication Service
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

class AuthService {
  // Generate JWT token
  generateToken(userId, email) {
    return jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      return null;
    }
  }

  // Hash password
  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  isValidPassword(password) {
    // At least 6 characters
    return password && password.length >= 6;
  }

  // Get user from token
  getUserFromToken(token) {
    const tokenData = db.getToken(token);
    if (!tokenData) {
      return null;
    }

    return db.findUserById(tokenData.userId);
  }

  // Check if user exists
  userExists(email) {
    return !!db.findUserByEmail(email);
  }

  // Create user session
  createSession(userId, email) {
    const token = this.generateToken(userId, email);
    db.setToken(token, { userId, email });
    return token;
  }

  // Destroy user session
  destroySession(token) {
    db.removeToken(token);
  }
}

module.exports = new AuthService();
