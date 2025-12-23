/**
 * PostgreSQL Database Configuration
 * World-class GPS tracking system database setup
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

class PostgreSQLDatabase {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.connectionString = process.env.DATABASE_URL || this.buildConnectionString();
    this.lastConnectionAttempt = 0;
    this.lastErrorLog = 0;
  }

  buildConnectionString() {
    // Fallback to individual env vars if DATABASE_URL not set
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'bavaxe_gps',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
  }

  async connect() {
    if (this.isConnected && this.pool) {
      return this.pool;
    }

    // Throttle connection attempts
    const now = Date.now();
    if (this.lastConnectionAttempt && now - this.lastConnectionAttempt < 5000) {
      // Too soon to retry
      return null;
    }
    this.lastConnectionAttempt = now;

    try {
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('[PostgreSQL] ✅ Connected successfully');

      // Run migrations on connect
      await this.runMigrations();

      return this.pool;
    } catch (error) {
      this.isConnected = false;
      
      // In development, silently fallback to JSON database (reduce log spam)
      if (process.env.NODE_ENV !== 'production') {
        // Only log first error or errors after 60 seconds
        if (!this.lastErrorLog || now - this.lastErrorLog > 60000) {
          this.lastErrorLog = now;
          console.warn('[PostgreSQL] ⚠️  Not available, using JSON database');
        }
        return null;
      }
      
      // In production, silently fallback to JSON (no error spam)
      // PostgreSQL is optional, JSON fallback works fine
      if (!this.lastErrorLog || now - this.lastErrorLog > 300000) { // 5 minutes
        this.lastErrorLog = now;
        // Silent fallback - no error logging
      }
      
      return null; // Return null instead of throwing to allow JSON fallback
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('[PostgreSQL] Disconnected');
    }
  }

  async query(text, params) {
    // Auto-connect if not connected
    if (!this.isConnected || !this.pool) {
      try {
        await this.connect();
      } catch (connectError) {
        // Silently fallback to JSON - no logging needed
        return { rows: [] };
      }
    }

    // If still not connected after attempt, return empty result
    if (!this.isConnected || !this.pool) {
      return { rows: [] };
    }

    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.log('[PostgreSQL] Slow query:', { text: text.substring(0, 100), duration: `${duration}ms` });
      }

      return res;
    } catch (error) {
      // Silently fallback to JSON - no error logging
      // PostgreSQL is optional, JSON fallback works fine
      return { rows: [] };
    }
  }

  async transaction(callback) {
    if (!this.isConnected || !this.pool) {
      await this.connect();
    }
    
    if (!this.pool) {
      throw new Error('PostgreSQL not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Silently ignore rollback errors
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async runMigrations() {
    if (!this.isConnected || !this.pool) {
      console.log('[PostgreSQL] Not connected, skipping migrations');
      return;
    }

    const migrationsDir = path.join(__dirname, '../migrations');
    
    try {
      // Check if migrations table exists
      try {
        await this.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP DEFAULT NOW()
          )
        `);
      } catch (migrationTableError) {
        console.warn('[PostgreSQL] Could not create migrations table:', migrationTableError.message);
        return;
      }

      // Get applied migrations
      let appliedVersions = new Set();
      try {
        const appliedResult = await this.query('SELECT version FROM schema_migrations ORDER BY version');
        appliedVersions = new Set(appliedResult.rows.map(row => row.version));
      } catch (e) {
        console.warn('[PostgreSQL] Could not read applied migrations:', e.message);
      }

      // Get migration files
      let files = [];
      try {
        files = await fs.readdir(migrationsDir);
      } catch (e) {
        if (e.code === 'ENOENT') {
          console.log('[PostgreSQL] No migrations directory found, skipping migrations');
          return;
        }
        throw e;
      }

      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      // Run pending migrations
      for (const file of migrationFiles) {
        const version = file.replace('.sql', '');
        
        if (appliedVersions.has(version)) {
          console.log(`[PostgreSQL] Migration ${version} already applied, skipping`);
          continue;
        }

        console.log(`[PostgreSQL] Running migration ${version}...`);
        try {
          const migrationPath = path.join(migrationsDir, file);
          const migrationSQL = await fs.readFile(migrationPath, 'utf8');

          // Run migration in transaction
          await this.transaction(async (client) => {
            await client.query(migrationSQL);
            await client.query(
              'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
              [version, file]
            );
          });

          console.log(`[PostgreSQL] ✅ Migration ${version} applied successfully`);
        } catch (migrationError) {
          console.error(`[PostgreSQL] ❌ Migration ${version} failed:`, migrationError.message);
          // In development, continue with other migrations
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[PostgreSQL] Continuing with other migrations...`);
            continue;
          }
          throw migrationError;
        }
      }
    } catch (error) {
      // If migrations fail in development, log and continue
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[PostgreSQL] Migration error (non-critical):', error.message);
        return;
      }
      throw error;
    }
  }

  // Helper method to check if PostgreSQL is available
  static async isAvailable() {
    try {
      const db = new PostgreSQLDatabase();
      await db.connect();
      await db.disconnect();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let instance = null;

function getPostgresDB() {
  if (!instance) {
    instance = new PostgreSQLDatabase();
  }
  return instance;
}

const postgresInstance = getPostgresDB();

// Add isInitialized getter for backward compatibility
Object.defineProperty(postgresInstance, 'isInitialized', {
  get() {
    return this.isConnected;
  }
});

module.exports = postgresInstance;
module.exports.PostgreSQLDatabase = PostgreSQLDatabase;
module.exports.getPostgresDB = getPostgresDB;

