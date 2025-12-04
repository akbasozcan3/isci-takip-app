const db = require('../../../config/database');

class TokenModel {
  static set(token, data) {
    return db.setToken(token, data);
  }

  static get(token) {
    return db.getToken(token);
  }

  static remove(token) {
    return db.removeToken(token);
  }

  static removeAllForUser(userId) {
    for (const [token, info] of Object.entries(db.data.tokens || {})) {
      if (info && info.userId === userId) {
        delete db.data.tokens[token];
      }
    }
    db.scheduleSave();
  }
}

module.exports = TokenModel;

