/**
 * Controller Helper Utilities
 * Common functions for controllers
 */

const ResponseFormatter = require('./responseFormatter');
const { createError } = require('./errorHandler');
const databaseService = require('../services/database.service');

class ControllerHelper {
  /**
   * Get user from request with caching
   */
  static getUser(req, useCache = true) {
    const userId = req.user?.id;
    if (!userId) {
      throw createError('User not authenticated', 401, 'UNAUTHORIZED');
    }
    
    return databaseService.findUserById(userId, useCache);
  }

  /**
   * Validate user exists
   */
  static validateUser(user) {
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  /**
   * Get subscription plan
   */
  static getPlan(req) {
    const user = this.getUser(req);
    const subscription = user.subscription || {};
    return subscription.planId || 'free';
  }

  /**
   * Check feature access
   */
  static checkFeatureAccess(req, feature, planRequirements = {}) {
    const plan = this.getPlan(req);
    const requiredPlan = planRequirements[feature] || 'free';
    
    const planHierarchy = { free: 0, plus: 1, business: 2 };
    const userLevel = planHierarchy[plan] || 0;
    const requiredLevel = planHierarchy[requiredPlan] || 0;
    
    if (userLevel < requiredLevel) {
      throw createError(
        `This feature requires ${requiredPlan} plan`,
        403,
        'FEATURE_RESTRICTED',
        { requiredPlan, currentPlan: plan }
      );
    }
    
    return true;
  }

  /**
   * Paginate response
   */
  static paginateResponse(data, page, limit, meta = {}) {
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offset = (pageNum - 1) * limitNum;
    
    const total = Array.isArray(data) ? data.length : 0;
    const paginated = Array.isArray(data) 
      ? data.slice(offset, offset + limitNum)
      : [];
    
    return ResponseFormatter.paginated(paginated, pageNum, limitNum, total, meta);
  }

  /**
   * Success response
   */
  static success(data = null, message = null, meta = {}) {
    return ResponseFormatter.success(data, message, meta);
  }

  /**
   * Error response
   */
  static error(message, code = 'ERROR', details = null) {
    return ResponseFormatter.error(message, code, details);
  }

  /**
   * Handle async errors
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Validate required fields
   */
  static validateRequired(data, fields) {
    const missing = fields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });
    
    if (missing.length > 0) {
      throw createError(
        `Missing required fields: ${missing.join(', ')}`,
        400,
        'MISSING_REQUIRED_FIELDS',
        { missing }
      );
    }
  }

  /**
   * Sanitize input
   */
  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return input.trim().replace(/[<>]/g, '');
    }
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    return input;
  }

  /**
   * Log activity
   */
  static logActivity(userId, category, action, metadata = {}) {
    try {
      const activityLogService = require('../../services/activityLogService');
      activityLogService.logActivity(userId, category, action, metadata);
    } catch (error) {
      // Non-critical, continue
      console.warn('[ControllerHelper] Activity logging failed:', error.message);
    }
  }
}

module.exports = ControllerHelper;

