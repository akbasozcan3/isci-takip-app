/**
 * Database Middleware
 * Automatic query optimization and caching
 */

const databaseService = require('../services/database.service');
const advancedCacheService = require('../services/advancedCache.service');

function databaseMiddleware(req, res, next) {
  // Attach database service to request
  req.db = databaseService;
  
  // Cache control headers
  res.setHeader('X-Cache-Status', 'miss');
  res.setHeader('X-Database-Optimized', 'true');
  
  // Response interceptor for caching
  const originalJson = res.json;
  res.json = function(data) {
    // Cache successful GET requests
    if (req.method === 'GET' && res.statusCode === 200 && data && data.success !== false) {
      const queryStr = JSON.stringify(req.query || {});
      const cacheKey = databaseService.generateCacheKey(req.path, queryStr, req.user?.id);
      if (cacheKey) {
        const ttl = req.user?.subscription?.planId === 'business' ? 600000 : 300000;
        advancedCacheService.set(cacheKey, data, ttl, req.user?.id);
        res.setHeader('X-Cache-Status', 'set');
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

module.exports = databaseMiddleware;

