const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const BACKUP_DIR = path.join(__dirname, '../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

class BackupService {
  createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
      const data = JSON.stringify(db.data, null, 2);
      fs.writeFileSync(backupFile, data, 'utf8');
      
      const stats = fs.statSync(backupFile);
      return {
        success: true,
        file: backupFile,
        size: stats.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Backup creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  cleanupOldBackups(maxBackups = 10) {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(BACKUP_DIR, f),
          time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > maxBackups) {
        const toDelete = files.slice(maxBackups);
        toDelete.forEach(file => {
          fs.unlinkSync(file.path);
        });
        return { deleted: toDelete.length };
      }
      return { deleted: 0 };
    } catch (error) {
      console.error('Backup cleanup error:', error);
      return { deleted: 0, error: error.message };
    }
  }

  restoreBackup(backupFile) {
    try {
      if (!fs.existsSync(backupFile)) {
        return { success: false, error: 'Backup file not found' };
      }

      const data = fs.readFileSync(backupFile, 'utf8');
      const parsed = JSON.parse(data);
      db.data = parsed;
      db.save();
      
      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Backup restore error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  listBackups() {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .map(f => {
          const filePath = path.join(BACKUP_DIR, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      return files;
    } catch (error) {
      console.error('List backups error:', error);
      return [];
    }
  }
}

const backupService = new BackupService();
const activityLogService = require('./activityLogService');

setInterval(() => {
  try {
    const result = backupService.createBackup();
    if (result.success) {
      activityLogService.logActivity('system', 'system', 'auto_backup_created', {
        file: result.file,
        size: result.size
      });
    }
    backupService.cleanupOldBackups(10);
  } catch (error) {
    console.error('[BackupService] Auto-backup error:', error);
  }
}, 3600000);

module.exports = backupService;

