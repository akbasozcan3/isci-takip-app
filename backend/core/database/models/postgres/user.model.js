/**
 * PostgreSQL User Model
 * World-class GPS tracking system - User management
 */

const { getPostgresDB } = require('../../../config/postgres');

class UserModel {
  /**
   * Create a new user
   */
  static async create(userData) {
    const db = getPostgresDB();
    const query = `
      INSERT INTO users (
        email, password_hash, name, phone, verified, email_verified,
        phone_verified, subscription_plan, subscription_status,
        subscription_start_date, onesignal_player_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      userData.email,
      userData.password_hash,
      userData.name || null,
      userData.phone || null,
      userData.verified || false,
      userData.email_verified || false,
      userData.phone_verified !== undefined ? userData.phone_verified : true,
      userData.subscription_plan || 'free',
      userData.subscription_status || 'active',
      userData.subscription_start_date || null,
      userData.onesignal_player_id || null,
    ];

    const result = await db.query(query, values);
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const db = getPostgresDB();
    if (!db) return null;

    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) return null;
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const db = getPostgresDB();
    if (!db) return null;

    const query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1)';
    const result = await db.query(query, [email]);

    if (result.rows.length === 0) return null;
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Update user
   */
  static async update(id, updates) {
    const db = getPostgresDB();
    if (!db) return null;

    const allowedFields = [
      'name', 'phone', 'verified', 'email_verified', 'phone_verified',
      'subscription_plan', 'subscription_status', 'subscription_start_date',
      'subscription_end_date', 'onesignal_player_id'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    if (result.rows.length === 0) return null;
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Delete user (soft delete or hard delete)
   */
  static async delete(id, hardDelete = false) {
    const db = getPostgresDB();
    if (!db) return false;

    if (hardDelete) {
      const query = 'DELETE FROM users WHERE id = $1';
      await db.query(query, [id]);
    } else {
      // Soft delete: mark as deleted
      await this.update(id, { verified: false });
    }

    return true;
  }

  /**
   * Verify user email
   */
  static async verifyEmail(email) {
    const db = getPostgresDB();
    if (!db) return false;

    const query = `
      UPDATE users
      SET email_verified = true, verified = true
      WHERE LOWER(email) = LOWER($1)
      RETURNING *
    `;

    const result = await db.query(query, [email]);
    return result.rows.length > 0;
  }

  /**
   * Update OneSignal player ID
   */
  static async updateOnesignalPlayerId(userId, playerId) {
    return await this.update(userId, { onesignal_player_id: playerId });
  }

  /**
   * Get default subscription
   */
  static getDefaultSubscription() {
    return {
      planId: 'free',
      planName: 'Free',
      price: 0,
      currency: 'USD',
      interval: 'monthly',
      status: 'active',
      renewsAt: null,
      updatedAt: Date.now()
    };
  }

  /**
   * Map database row to user object (for backward compatibility)
   */
  static mapRowToUser(row) {
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      password_hash: row.password_hash,
      name: row.name,
      phone: row.phone,
      verified: row.verified,
      email_verified: row.email_verified,
      phone_verified: row.phone_verified,
      subscription: {
        planId: row.subscription_plan,
        planName: row.subscription_plan === 'free' ? 'Free' : 
                  row.subscription_plan === 'plus' ? 'Plus' : 'Business',
        status: row.subscription_status,
        startDate: row.subscription_start_date,
        endDate: row.subscription_end_date,
      },
      onesignalPlayerId: row.onesignal_player_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = UserModel;

