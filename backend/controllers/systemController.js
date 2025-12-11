const backupService = require('../services/backupService');
const db = require('../config/database');
const activityLogService = require('../services/activityLogService');

function getUserIdFromToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const TokenModel = require('../core/database/models/token.model');
  const tokenData = TokenModel.get(token);
  return tokenData ? tokenData.userId : null;
}

class SystemController {
  async getSystemInfo(req, res) {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      return res.json({
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: uptime,
          uptimeFormatted: this.formatUptime(uptime)
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        database: {
          users: Object.keys(db.data.users || {}).length,
          devices: Object.keys(db.data.store || {}).length,
          groups: Object.keys(db.data.groups || {}).length,
          articles: Object.keys(db.data.articles || {}).length
        },
        environment: process.env.NODE_ENV || 'development'
      });

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'system', 'view_system_info', {
          path: req.path
        });
      }

      return res.json({
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: uptime,
          uptimeFormatted: this.formatUptime(uptime)
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        database: {
          users: Object.keys(db.data.users || {}).length,
          devices: Object.keys(db.data.store || {}).length,
          groups: Object.keys(db.data.groups || {}).length,
          articles: Object.keys(db.data.articles || {}).length
        },
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('Get system info error:', error);
      return res.status(500).json({ error: 'Failed to get system info' });
    }
  }

  async createBackup(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      const result = backupService.createBackup();
      
      if (userId) {
        activityLogService.logActivity(userId, 'system', 'create_backup', {
          path: req.path
        });
      }
      
      if (result.success) {
        return res.json({
          success: true,
          message: 'Backup created successfully',
          ...result
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Create backup error:', error);
      return res.status(500).json({ error: 'Failed to create backup' });
    }
  }

  async listBackups(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      const backups = backupService.listBackups();
      
      if (userId) {
        activityLogService.logActivity(userId, 'system', 'view_backups', {
          backupCount: backups.length,
          path: req.path
        });
      }
      
      return res.json({ backups });
    } catch (error) {
      console.error('List backups error:', error);
      return res.status(500).json({ error: 'Failed to list backups' });
    }
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }
}

module.exports = new SystemController();

