const db = require('../../../config/database');

class VerificationModel {
  static addEmailVerification(email, verification) {
    return db.addEmailVerification(email, verification);
  }

  static getEmailVerifications(email) {
    return db.getEmailVerifications(email);
  }

  static deleteEmailVerifications(email) {
    return db.deleteEmailVerifications(email);
  }

  static addPasswordReset(email, reset) {
    return db.addPasswordReset(email, reset);
  }

  static getPasswordResets(email) {
    return db.getPasswordResets(email);
  }

  static deletePasswordResets(email) {
    return db.deletePasswordResets(email);
  }

  static addPasswordResetToken(token, data) {
    return db.addPasswordResetToken(token, data);
  }

  static getPasswordResetToken(token) {
    return db.getPasswordResetToken(token);
  }

  static deletePasswordResetToken(token) {
    return db.deletePasswordResetToken(token);
  }
}

module.exports = VerificationModel;

