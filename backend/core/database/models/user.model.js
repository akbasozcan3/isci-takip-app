const db = require('../../../config/database');

class UserModel {
  static findById(id) {
    return db.findUserById(id);
  }

  static findByEmail(email) {
    return db.findUserByEmail(email);
  }

  static findByUsername(username) {
    return db.findUserByUsername(username);
  }

  static create(userData) {
    return db.createUser(userData);
  }

  static delete(userId) {
    return db.deleteUser(userId);
  }

  static deleteByEmail(email) {
    return db.deleteUserByEmail(email);
  }

  static verifyEmail(email) {
    return db.verifyUserEmail(email);
  }

  static isEmailVerified(email) {
    return db.isEmailVerified(email);
  }

  static setPassword(email, hash) {
    return db.setPassword(email, hash);
  }

  static getPassword(email) {
    return db.getPassword(email);
  }

  static deletePassword(email) {
    return db.deletePassword(email);
  }
}

module.exports = UserModel;

