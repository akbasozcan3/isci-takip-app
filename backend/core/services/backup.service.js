/**
 * Professional Backup Service
 * Automated database backups with rotation and compression
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

const db = require('../../config/database');

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.maxBackups = 30; // Keep last 30 backups
    this.backupInterval = 3600000; // 1 hour
    this.enabled = process.env.ENABLE_AUTO_BACKUP !== 'false';
    
    this.ensureBackupDir();
    if (this.enabled) {
      this.startAutoBackup();
    }
  }

  /**
   * Ensure backup directory exists
   */
  async ensureBackupDir() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        await mkdir(this.backupDir, { recursive: true });
        console.log('[BackupService] Backup directory created');
      }
    } catch (error) {
      console.error('[BackupService] Failed to create backup directory:', error);
    }
  }

  /**
   * Create backup
   */
  async createBackup(metadata = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.json`;
      const filepath = path.join(this.backupDir, filename);
      
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        metadata,
        data: db.data
      };
      
      const jsonData = JSON.stringify(backupData, null, 2);
      await writeFile(filepath, jsonData, 'utf8');
      
      // Compress backup (optional - can use zlib for compression)
      const stats = fs.statSync(filepath);
      
      console.log(`[BackupService] Backup created: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      // Cleanup old backups
      await this.cleanupOldBackups();
      
      return {
        success: true,
        filename,
        size: stats.size,
        path: filepath
      };
    } catch (error) {
      console.error('[BackupService] Backup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(filename) {
    try {
      const filepath = path.join(this.backupDir, filename);
      
      if (!fs.existsSync(filepath)) {
        throw new Error(`Backup file not found: ${filename}`);
      }
      
      const content = await readFile(filepath, 'utf8');
      const backupData = JSON.parse(content);
      
      // Validate backup structure
      if (!backupData.data || typeof backupData.data !== 'object') {
        throw new Error('Invalid backup file structure');
      }
      
      // Restore data
      db.data = backupData.data;
      await db.save();
      
      console.log(`[BackupService] Backup restored: ${filename}`);
      
      return {
        success: true,
        timestamp: backupData.timestamp,
        version: backupData.version
      };
    } catch (error) {
      console.error('[BackupService] Restore failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List available backups
   */
  listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }
      
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .map(file => {
          const filepath = path.join(this.backupDir, file);
          const stats = fs.statSync(filepath);
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.created - a.created);
      
      return files;
    } catch (error) {
      console.error('[BackupService] List backups failed:', error);
      return [];
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups() {
    try {
      const backups = this.listBackups();
      
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        
        for (const backup of toDelete) {
          try {
            fs.unlinkSync(path.join(this.backupDir, backup.filename));
            console.log(`[BackupService] Deleted old backup: ${backup.filename}`);
          } catch (error) {
            console.error(`[BackupService] Failed to delete backup ${backup.filename}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[BackupService] Cleanup failed:', error);
    }
  }

  /**
   * Start automatic backups
   */
  startAutoBackup() {
    // Create initial backup
    this.createBackup({ type: 'auto', trigger: 'startup' });
    
    // Schedule periodic backups
    setInterval(() => {
      this.createBackup({ type: 'auto', trigger: 'scheduled' });
    }, this.backupInterval);
    
    console.log('[BackupService] Auto-backup enabled (interval: 1 hour)');
  }

  /**
   * Get backup statistics
   */
  getStats() {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    
    return {
      enabled: this.enabled,
      totalBackups: backups.length,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
      newestBackup: backups.length > 0 ? backups[0].created : null,
      nextBackup: this.enabled ? new Date(Date.now() + this.backupInterval).toISOString() : null
    };
  }
}

module.exports = new BackupService();

